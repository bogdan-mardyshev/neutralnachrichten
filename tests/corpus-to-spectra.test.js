import { describe, it, expect } from 'vitest';
import { corpusToSpectra, corpusArticleToPipeline } from '../lib/corpusToSpectra.js';

const row = (id, over = {}) => ({
  id,
  url: `https://example.de/a/${id}`,
  source_name: 'Tagesschau',
  source_domain: 'tagesschau.de',
  spectrum: 'center',
  article_title: `Bundestag beschließt Rentenreform ${id}`,
  our_summary: 'Der Bundestag hat die Rentenreform beschlossen. Details folgen.',
  short_lead: 'Der Bundestag hat die Rentenreform beschlossen.',
  pubDate: new Date().toISOString(),
  _rrfScore: 0.5,
  _retrievers: ['semantic', 'lexical'],
  cluster_id: 9,
  ...over,
});

describe('corpusArticleToPipeline', () => {
  it('maps corpus fields onto the pipeline article shape', () => {
    const a = corpusArticleToPipeline(row(1), ['rentenreform']);
    expect(a).toMatchObject({
      source_name: 'Tagesschau',
      source_domain: 'tagesschau.de',
      article_title: 'Bundestag beschließt Rentenreform 1',
      article_url: 'https://example.de/a/1',
      content_text: 'Der Bundestag hat die Rentenreform beschlossen. Details folgen.',
      description: 'Der Bundestag hat die Rentenreform beschlossen.',
      _corpusId: 1,
      _clusterId: 9,
    });
    expect(a._retrievers).toEqual(['semantic', 'lexical']);
  });

  it('computes titleFullWordCount from keywords (full-word match)', () => {
    const a = corpusArticleToPipeline(row(1), ['rentenreform', 'bundestag']);
    expect(a.titleFullWordCount).toBe(2);
    expect(a.title_match).toBe(true);
  });

  it('does NOT count substring-only matches as full words', () => {
    const a = corpusArticleToPipeline(row(1, { article_title: 'Rente und Reformpläne' }), ['reform']);
    expect(a.titleFullWordCount).toBe(0);
  });

  it('falls back to short_lead for content_text when summary missing', () => {
    const a = corpusArticleToPipeline(row(1, { our_summary: '' }), []);
    expect(a.content_text).toBe('Der Bundestag hat die Rentenreform beschlossen.');
  });

  it('attaches tier/factual/reach from source_ratings (tagesschau.de = flagship/high)', () => {
    const a = corpusArticleToPipeline(row(1), []);
    expect(a._tier).toBe('flagship');
    expect(a._factual).toBe('high');
    expect(a._reachWeight).toBeGreaterThan(0);
  });

  it('defaults classification for an unrated outlet', () => {
    const a = corpusArticleToPipeline(row(1, { source_domain: 'unknown-blog.de' }), []);
    expect(a._tier).toBe('standard');
    expect(a._factual).toBe('mixed');
  });

  it('coerces a Date pubDate (from Postgres) into an ISO string', () => {
    // Postgres returns TIMESTAMPTZ as a Date — pubDate must be a string downstream.
    const a = corpusArticleToPipeline(row(1, { pubDate: new Date('2026-06-01T08:00:00Z') }), []);
    expect(typeof a.pubDate).toBe('string');
    expect(a.pubDate).toBe('2026-06-01T08:00:00.000Z');
    expect(() => a.pubDate.slice(0, 10)).not.toThrow();
    expect(a.pubDate.slice(0, 10)).toBe('2026-06-01');
  });

  it('null pubDate stays null', () => {
    const a = corpusArticleToPipeline(row(1, { pubDate: null }), []);
    expect(a.pubDate).toBeNull();
  });
});

describe('corpusToSpectra', () => {
  it('produces the searchAllFeeds-compatible shape', () => {
    const grouped = { center: [row(1), row(2)], left: [row(3, { spectrum: 'left' })] };
    const out = corpusToSpectra(grouped, { keywords: ['rentenreform'] });
    expect(out.total_articles).toBe(3);
    expect(out.spectra.center.articles).toHaveLength(2);
    expect(out.spectra.left.articles).toHaveLength(1);
    expect(out.spectra.right.articles).toEqual([]);
    expect(out.search_meta.source).toBe('corpus');
    expect(out.fetched_at).toBeTruthy();
  });

  it('includes all five spectrum keys even when empty', () => {
    const out = corpusToSpectra({}, {});
    expect(Object.keys(out.spectra).sort()).toEqual(
      ['center', 'center_left', 'center_right', 'left', 'right']
    );
    expect(out.total_articles).toBe(0);
  });

  it('sorts articles by score (RRF) descending', () => {
    const grouped = { center: [row(1, { _rrfScore: 0.1 }), row(2, { _rrfScore: 0.9 })] };
    const out = corpusToSpectra(grouped, {});
    expect(out.spectra.center.articles.map(a => a._corpusId)).toEqual([2, 1]);
  });

  it('computes count_week / count_month from pubDate', () => {
    const recent = row(1, { pubDate: new Date().toISOString() });
    const old = row(2, { pubDate: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString() });
    const out = corpusToSpectra({ center: [recent, old] }, {});
    expect(out.spectra.center.count_week).toBe(1);
    expect(out.spectra.center.count_month).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Relevance gate (reputation fix): drop off-topic filler from camps
// ─────────────────────────────────────────────────────────────────────────────
import { minKeywordsFor } from '../lib/corpusToSpectra.js';

describe('relevance gate', () => {
  it('minKeywordsFor: 2 for multi-word topics, 1 for single', () => {
    expect(minKeywordsFor(['deutschland', 'curacao', 'wm'])).toBe(2);
    expect(minKeywordsFor(['klima'])).toBe(1);
    expect(minKeywordsFor([])).toBe(1);
  });

  it('drops an article that matches only ONE common keyword (off-topic filler)', () => {
    const onTopic = row(1, { spectrum: 'center', article_title: 'Deutschland gewinnt gegen Curacao', our_summary: 'WM-Spiel Deutschland Curacao.' });
    const offTopic = row(2, { spectrum: 'left', article_title: 'Tomahawk-Raketen in Deutschland gestoppt', our_summary: 'Russland und die Stationierung.' });
    const out = corpusToSpectra({ center: [onTopic], left: [offTopic] }, { keywords: ['deutschland', 'curacao', 'wm'] });
    // center article has Deutschland+Curacao (2) → kept; left has only Deutschland (1) → dropped
    expect(out.spectra.center.articles).toHaveLength(1);
    expect(out.spectra.left.articles).toHaveLength(0);
    expect(out.search_meta.relevanceDropped).toBe(1);
  });

  it('keeps a single-keyword match when the topic itself is single-word', () => {
    const a = row(1, { spectrum: 'center', article_title: 'Großer Klimagipfel', our_summary: 'Klima Konferenz.' });
    const out = corpusToSpectra({ center: [a] }, { keywords: ['klima'] });
    expect(out.spectra.center.articles).toHaveLength(1);
  });

  it('no keywords → gate is a no-op (keeps everything)', () => {
    const a = row(1, { spectrum: 'center', article_title: 'Irgendwas', our_summary: 'x' });
    const out = corpusToSpectra({ center: [a] }, {});
    expect(out.spectra.center.articles).toHaveLength(1);
  });
});
