import { describe, it, expect, vi } from 'vitest';
import { runCorpusAnalysis, MIN_CORPUS_ARTICLES } from '../lib/corpusAnalysisPipeline.js';

/** Build a corpus-spectra result with N articles spread across given spectra. */
function corpus(spectraCounts) {
  const spectra = {};
  let total = 0;
  for (const [sp, arts] of Object.entries(spectraCounts)) {
    spectra[sp] = { articles: arts };
    total += arts.length;
  }
  return { spectra, total_articles: total, fetched_at: new Date().toISOString(), search_meta: {} };
}

const ART = (id, title, summary, domain, url) => ({
  _corpusId: id, id, article_title: title, our_summary: summary,
  source_domain: domain, source_name: domain, article_url: url, spectrum: 'center',
});

function baseDeps(over = {}) {
  const cs = corpus({
    left:   [{ ...ART(1, 'Rentenreform Kritik', 'Linke kritisiert die Reform.', 'taz.de', 'https://taz.de/1'), spectrum: 'left' }],
    center: [
      ART(2, 'Bundestag beschließt Rentenreform', 'Der Bundestag beschloss die Rentenreform heute.', 'tagesschau.de', 'https://t.de/2'),
      ART(3, 'Reform tritt 2027 in Kraft', 'Die Rentenreform tritt 2027 in Kraft.', 'zdf.de', 'https://zdf.de/3'),
    ],
    right:  [{ ...ART(4, 'Rentenreform teuer', 'Bild nennt die Reform teuer.', 'bild.de', 'https://bild.de/4'), spectrum: 'right' }],
  });

  const analysis = {
    overall_non_partisan_analysis: 'Der Bundestag beschloss die Rentenreform. Die Reform tritt 2027 in Kraft.',
    news_spectrum: {
      left:   [{ source_name: 'taz', article_title: 'Rentenreform Kritik', article_url: 'https://taz.de/1' }],
      center: [{ source_name: 'tagesschau', article_title: 'Bundestag beschließt Rentenreform', article_url: 'https://t.de/2' }],
      right:  [{ source_name: 'bild', article_title: 'Rentenreform teuer', article_url: 'https://bild.de/4' }],
      center_left: [], center_right: [],
    },
  };

  return {
    retrieve: vi.fn().mockResolvedValue(cs),
    analyze: vi.fn().mockResolvedValue({ analysis }),
    getDownFeeds: vi.fn().mockResolvedValue([]),
    ...over,
  };
}

describe('runCorpusAnalysis', () => {
  it('falls back when the corpus is too thin', async () => {
    const deps = baseDeps({ retrieve: vi.fn().mockResolvedValue(corpus({ center: [ART(1, 't', 's', 'd', 'u')] })) });
    const out = await runCorpusAnalysis('Rentenreform', 'de', deps);
    expect(out.fellBack).toBe(true);
    expect(out.reason).toBe('thin_corpus');
    expect(deps.analyze).not.toHaveBeenCalled();
  });

  it('falls back when analysis returns nothing', async () => {
    const deps = baseDeps({ analyze: vi.fn().mockResolvedValue({ analysis: null }) });
    const out = await runCorpusAnalysis('Rentenreform', 'de', deps);
    expect(out.fellBack).toBe(true);
    expect(out.reason).toBe('analysis_failed');
  });

  it('runs the full chain and returns a reliability envelope', async () => {
    const deps = baseDeps();
    const out = await runCorpusAnalysis('Rentenreform', 'de', deps);
    expect(out.fellBack).toBe(false);
    expect(out.corpusCount).toBeGreaterThanOrEqual(MIN_CORPUS_ARTICLES);
    // grounding ran → emitted articles get citations
    expect(out.analysis.news_spectrum.center[0]._grounded).toBe(true);
    // reliability envelope present
    expect(out.reliability.confidence.score).toBeGreaterThan(0);
    expect(out.reliability.coverage).toBeTruthy();
    // claims extracted from the overall analysis and verified
    expect(out.claims.length).toBeGreaterThan(0);
    expect(out.reliability.claims.total).toBe(out.claims.length);
  });

  it('grounds against the corpus (matched url → grounded true)', async () => {
    const out = await runCorpusAnalysis('Rentenreform', 'de', baseDeps());
    const all = [
      ...out.analysis.news_spectrum.left,
      ...out.analysis.news_spectrum.center,
      ...out.analysis.news_spectrum.right,
    ];
    expect(all.every(a => a._grounded === true)).toBe(true);
  });

  it('passes entailmentFn through to claim verification', async () => {
    const entailmentFn = vi.fn().mockResolvedValue('entailment');
    const deps = baseDeps({ entailmentFn });
    const out = await runCorpusAnalysis('Rentenreform', 'de', deps);
    expect(entailmentFn).toHaveBeenCalled();
    expect(out.reliability.claims.supported).toBeGreaterThan(0);
  });

  it('runs deep analysis and annotates silenced topics with blindspot verification', async () => {
    const deepAnalyze = vi.fn().mockResolvedValue({
      shared_facts: [{ claim: 'Die Rentenreform tritt 2027 in Kraft.' }],
      silenced_topics: [
        { topic: 'Finanzierung', only_in: 'center_right', description: 'nur mitte-rechts' },
      ],
    });
    // center_right has a broken feed → silence there is unverifiable
    const getDownFeeds = vi.fn().mockResolvedValue([
      { spectrum: 'center_right', source_name: 'FAZ', status: 'down', consecutive_failures: 4 },
    ]);
    const out = await runCorpusAnalysis('Rentenreform', 'de', baseDeps({ deepAnalyze, getDownFeeds }));
    expect(out.deepAnalysis.silenced_topics[0]._verified).toBe(false);
  });

  it('survives deepAnalyze throwing (keeps going without deep analysis)', async () => {
    const deepAnalyze = vi.fn().mockRejectedValue(new Error('gemini timeout'));
    const out = await runCorpusAnalysis('Rentenreform', 'de', baseDeps({ deepAnalyze }));
    expect(out.fellBack).toBe(false);
    expect(out.deepAnalysis).toBeNull();
  });

  it('survives getDownFeeds throwing (no blindspot data, still completes)', async () => {
    const getDownFeeds = vi.fn().mockRejectedValue(new Error('db'));
    const out = await runCorpusAnalysis('Rentenreform', 'de', baseDeps({ getDownFeeds }));
    expect(out.fellBack).toBe(false);
    expect(out.reliability).toBeTruthy();
  });
});
