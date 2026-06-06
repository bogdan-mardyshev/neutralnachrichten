import { describe, it, expect, vi } from 'vitest';
import {
  flattenSpectra,
  expertAppears,
  enrichDeepAnalysis,
} from '../lib/deepAnalysisEnrich.js';

const art = (over) => ({
  article_title: 'Bundestag beschließt Rentenreform',
  our_summary: 'Der Bundestag beschloss die Rentenreform. Wirtschaftsforscher Max Müller kritisierte sie.',
  article_url: 'https://t.de/1', source_name: 'Tagesschau', spectrum: 'center', ...over,
});

describe('flattenSpectra', () => {
  it('flattens array-style _rss.spectra', () => {
    const out = flattenSpectra({ left: [art({ spectrum: 'left' })], center: [art()] });
    expect(out).toHaveLength(2);
    expect(out[0].spectrum).toBe('left');
  });
  it('flattens {articles:[]} style too', () => {
    const out = flattenSpectra({ center: { articles: [art()] } });
    expect(out).toHaveLength(1);
  });
  it('handles empty', () => {
    expect(flattenSpectra({})).toEqual([]);
    expect(flattenSpectra(null)).toEqual([]);
  });
});

describe('expertAppears', () => {
  const arts = [art()];
  it('true when the full name appears in article text', () => {
    expect(expertAppears('Max Müller', arts)).toBe(true);
  });
  it('false when the name is absent (likely hallucinated)', () => {
    expect(expertAppears('Angela Schmidt-Niemand', arts)).toBe(false);
  });
  it('false for empty/short', () => {
    expect(expertAppears('', arts)).toBe(false);
  });
});

describe('enrichDeepAnalysis', () => {
  const articles = [
    art({ article_title: 'Bundestag beschließt Rentenreform', our_summary: 'Die Rentenreform tritt 2027 in Kraft.' }),
    art({ spectrum: 'left', source_name: 'taz', article_url: 'https://taz.de/9',
          article_title: 'Kritik an Rentenreform', our_summary: 'Linke kritisieren die Reform als unsozial. Max Müller warnt.' }),
  ];

  const baseDeep = () => ({
    shared_facts: [
      { claim: 'Die Rentenreform tritt 2027 in Kraft' },
      { claim: 'Aktienmärkte stürzten weltweit ein' }, // unsupported by corpus
    ],
    diverging_points: [
      { topic: 'Bewertung', left_view: 'Linke kritisieren die Reform als unsozial', right_view: 'Rechte loben Eigenverantwortung' },
    ],
    experts_cited: {
      left: ['Max Müller'],            // appears
      center_left: ['Erfundener Name'],// does not appear
      center: [], center_right: [], right: [],
    },
  });

  it('verifies shared_facts and attaches citations', async () => {
    const { deep, report } = await enrichDeepAnalysis(baseDeep(), articles);
    expect(deep.shared_facts[0]._verification.label).toBe('supported');
    expect(deep.shared_facts[0]._verification.evidence).toBeTruthy();
    expect(deep.shared_facts[1]._verification.label).toBe('unsupported');
    expect(report.verifiedFacts).toBe(1);
    expect(report.factVerifyRatio).toBeCloseTo(0.5, 2);
  });

  it('keeps verified experts, splits out unverifiable ones', async () => {
    const { deep, report } = await enrichDeepAnalysis(baseDeep(), articles);
    expect(deep.experts_cited.left).toEqual(['Max Müller']);
    expect(deep.experts_cited.center_left).toEqual([]);          // dropped
    expect(deep._experts_unverified.center_left).toEqual(['Erfundener Name']);
    expect(report.expertsKept).toBe(1);
    expect(report.expertsDropped).toBe(1);
  });

  it('cites each camp view in diverging_points', async () => {
    const { deep } = await enrichDeepAnalysis(baseDeep(), articles);
    expect(deep.diverging_points[0]._citations.left).toBeTruthy();
    expect(deep.diverging_points[0]._citations.left.url).toBe('https://taz.de/9');
  });

  it('flags contradiction via injected entailmentFn', async () => {
    const entailmentFn = vi.fn().mockResolvedValue('contradiction');
    const deep = { shared_facts: [{ claim: 'Die Rentenreform tritt 2027 in Kraft' }], experts_cited: {} };
    const { deep: out, report } = await enrichDeepAnalysis(deep, articles, { entailmentFn });
    expect(out.shared_facts[0]._verification.label).toBe('contradiction');
    expect(report.contradicted).toBe(1);
  });

  it('does not mutate the input', async () => {
    const input = baseDeep();
    const snapshot = JSON.parse(JSON.stringify(input));
    await enrichDeepAnalysis(input, articles);
    expect(input).toEqual(snapshot);
  });

  it('handles empty deep / no articles gracefully', async () => {
    const { deep, report } = await enrichDeepAnalysis({}, []);
    expect(report.facts).toBe(0);
    expect(report.factVerifyRatio).toBe(1);
    expect(deep).toEqual({});
  });
});
