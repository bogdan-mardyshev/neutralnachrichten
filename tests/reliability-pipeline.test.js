import { describe, it, expect, vi } from 'vitest';
import { composeReliability } from '../lib/reliabilityPipeline.js';

const art = (over) => ({
  source_name: 'Tagesschau', source_domain: 'tagesschau.de',
  article_title: 'Bundestag beschließt Rentenreform',
  our_summary: 'Der Bundestag beschloss die Rentenreform. Sie tritt 2027 in Kraft.',
  article_url: 'https://t.de/1', spectrum: 'center', ...over,
});

const corpusRss = () => ({
  search_meta: { source: 'corpus' },
  spectra: {
    left:   { articles: [art({ source_domain: 'taz.de', article_url: 'https://taz.de/9', article_title: 'Kritik an Rentenreform', spectrum: 'left' })] },
    center: { articles: [art()] },
    center_left: { articles: [] }, center_right: { articles: [] }, right: { articles: [] },
  },
});

const analysis = () => ({
  analysis_topic: 'Rentenreform',
  overall_non_partisan_analysis: 'Der Bundestag beschloss die Rentenreform. Sie tritt 2027 in Kraft.',
  news_spectrum: {
    left:   [{ source_name: 'taz', article_title: 'Kritik an Rentenreform', article_url: 'https://taz.de/9' }],
    center: [{ source_name: 'Tagesschau', article_title: 'Bundestag beschließt Rentenreform', article_url: 'https://t.de/1' }],
    center_left: [], center_right: [], right: [],
  },
});

describe('composeReliability', () => {
  it('no-op for non-corpus input', async () => {
    const a = analysis();
    const out = await composeReliability(a, { search_meta: { source: 'live' } }, {});
    expect(out.analysis).toBe(a);
    expect(out.reliability).toBeNull();
  });

  it('grounds, builds envelope, clusters — full corpus path', async () => {
    const out = await composeReliability(analysis(), corpusRss(), {
      getDownFeeds: async () => [],
    });
    expect(out.reliability).toBeTruthy();
    expect(out.reliability.confidence.score).toBeGreaterThan(0);
    expect(out.reliability.coverageWindow).toBeTruthy();
    // grounded cards get real link flag
    expect(out.analysis.news_spectrum.center[0]._grounded).toBe(true);
    expect(out.analysis.news_spectrum.center[0].url_is_search_fallback).toBe(false);
  });

  it('runs batched NLI when budget allows + records the call + persists verdicts', async () => {
    const batchEntailmentFn = vi.fn().mockResolvedValue(['entailment', 'entailment']);
    const recordEntailmentCall = vi.fn();
    const budgetSpend = vi.fn();
    const onNli = vi.fn();
    const out = await composeReliability(analysis(), corpusRss(), {
      getDownFeeds: async () => [],
      batchEntailmentFn, recordEntailmentCall, budgetSpend, onNli,
      budgetOk: () => true,
    });
    expect(batchEntailmentFn).toHaveBeenCalledTimes(1);   // ONE batched call
    expect(recordEntailmentCall).toHaveBeenCalled();
    expect(budgetSpend).toHaveBeenCalled();
    expect(onNli).toHaveBeenCalled();                      // verdicts persisted
    // claim support now feeds confidence (method nli)
    expect(out.reliability.claims.total).toBeGreaterThan(0);
  });

  it('never persists NLI-neutral verdicts (unmeasured → not attributed to a source, satisfies the DB label CHECK)', async () => {
    // claim 0 entailment, claim 1 neutral — both have lexical evidence attached.
    const batchEntailmentFn = vi.fn().mockResolvedValue(['entailment', 'neutral']);
    const onNli = vi.fn();
    await composeReliability(analysis(), corpusRss(), {
      getDownFeeds: async () => [], batchEntailmentFn, onNli, budgetOk: () => true,
    });
    expect(onNli).toHaveBeenCalledTimes(1);
    const rows = onNli.mock.calls[0][0];
    expect(rows.every(r => r.label !== 'neutral')).toBe(true);   // no neutral persisted
    expect(rows.every(r => ['supported', 'entailment', 'contradiction', 'unsupported'].includes(r.label))).toBe(true);
  });

  it('does not call onNli at all when every verdict is neutral', async () => {
    const batchEntailmentFn = vi.fn().mockResolvedValue(['neutral', 'neutral']);
    const onNli = vi.fn();
    await composeReliability(analysis(), corpusRss(), {
      getDownFeeds: async () => [], batchEntailmentFn, onNli, budgetOk: () => true,
    });
    expect(onNli).not.toHaveBeenCalled();   // nothing definite to attribute
  });

  it('skips NLI when budget exhausted (claims treated as unmeasured)', async () => {
    const batchEntailmentFn = vi.fn().mockResolvedValue(['entailment']);
    const out = await composeReliability(analysis(), corpusRss(), {
      getDownFeeds: async () => [],
      batchEntailmentFn, budgetOk: () => false,
    });
    expect(batchEntailmentFn).not.toHaveBeenCalled();
    // lexical-only → claimReport null → confidence still computed (unmeasured factor)
    expect(out.reliability.confidence.score).toBeGreaterThan(0);
  });

  it('survives getDownFeeds throwing', async () => {
    const out = await composeReliability(analysis(), corpusRss(), {
      getDownFeeds: async () => { throw new Error('db'); },
    });
    expect(out.reliability).toBeTruthy();
  });
});
