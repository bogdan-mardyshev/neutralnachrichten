import { describe, it, expect, vi } from 'vitest';
import { translateAnalysis } from '../lib/translate.js';

/** Fake genAI that captures the prompt and echoes a translated JSON. */
function makeFakeGenAI(transform) {
  let captured = null;
  const genAI = {
    getGenerativeModel: () => ({
      generateContent: async ({ contents }) => {
        captured = contents[0].parts[0].text;
        // Parse the lean input JSON out of the prompt and "translate" it.
        const first = captured.indexOf('{', captured.indexOf('Input JSON:'));
        const last = captured.lastIndexOf('}', captured.indexOf('Translated JSON'));
        const lean = JSON.parse(captured.substring(first, last + 1));
        const out = transform ? transform(lean) : lean;
        return { response: { text: () => JSON.stringify(out) } };
      },
    }),
    _getCaptured: () => captured,
  };
  return genAI;
}

let _topicSeq = 0;
const baseAnalysis = () => ({
  analysis_topic: `Rentenreform-${++_topicSeq}`, // unique → avoids module-level cache collisions across tests
  response_language: 'de',
  overall_non_partisan_analysis: 'Der Bundestag beschloss die Reform.',
  coverage_distribution: { left: { count: 1 } },
  _rss: { spectra: { left: [{ huge: 'x'.repeat(5000) }] }, total_articles: 30 },
  _reliability: { confidence: { score: 100 } },
  analyzed_at: '2026-06-06T00:00:00Z',
  news_spectrum: {
    left: [{
      source_name: 'taz', source_domain: 'taz.de',
      article_title: 'Rentenreform beschlossen',
      summary_of_perspective: 'taz berichtet kritisch.',
      article_url: 'https://taz.de/a/1',
      url_is_search_fallback: false,
      publication_date: '2026-06-01',
      _grounded: true, _citation: { corpus_id: 7, url: 'https://taz.de/a/1' },
    }],
    center_left: [], center: [], center_right: [], right: [],
  },
});

describe('translateAnalysis', () => {
  it('returns input unchanged for target de', async () => {
    const a = baseAnalysis();
    expect(await translateAnalysis(a, 'de', makeFakeGenAI())).toBe(a);
  });

  it('sends a LEAN payload (no _rss / article_url / _citation) to the model', async () => {
    const genAI = makeFakeGenAI();
    await translateAnalysis(baseAnalysis(), 'en', genAI);
    const prompt = genAI._getCaptured();
    expect(prompt).not.toContain('_rss');
    expect(prompt).not.toContain('xxxxxxxxxx');         // the 5000-char _rss blob
    expect(prompt).not.toContain('_reliability');
    expect(prompt).not.toContain('https://taz.de/a/1'); // article_url stripped
    expect(prompt).not.toContain('_citation');
    // but the translatable fields ARE present
    expect(prompt).toContain('summary_of_perspective');
    expect(prompt).toContain('Rentenreform beschlossen');
  });

  it('restores url/domain/date onto the translated result (from original)', async () => {
    // model "translates" by uppercasing the title; drops url (lean had none)
    const genAI = makeFakeGenAI((lean) => {
      lean.news_spectrum.left[0].article_title = 'PENSION REFORM PASSED';
      lean.news_spectrum.left[0].summary_of_perspective = 'taz reports critically.';
      return lean;
    });
    const out = await translateAnalysis(baseAnalysis(), 'en', genAI);
    const art = out.news_spectrum.left[0];
    expect(art.article_title).toBe('PENSION REFORM PASSED');          // translated
    expect(art.summary_of_perspective).toBe('taz reports critically.');// translated
    expect(art.article_url).toBe('https://taz.de/a/1');               // restored
    expect(art.source_domain).toBe('taz.de');                         // restored
    expect(art.url_is_search_fallback).toBe(false);                   // restored
    expect(art.publication_date).toBe('2026-06-01');                  // restored
    expect(out.response_language).toBe('en');
    expect(out.coverage_distribution).toEqual({ left: { count: 1 } }); // preserved
  });

  it('falls back to the German analysis on malformed model output', async () => {
    const genAI = {
      getGenerativeModel: () => ({
        generateContent: async () => ({ response: { text: () => 'not json at all' } }),
      }),
    };
    const a = baseAnalysis();
    const out = await translateAnalysis(a, 'en', genAI);
    expect(out).toBe(a); // returned original on failure
  });
});
