import { describe, it, expect } from 'vitest';
import { isLabelled, toCase, labelledCases } from '../eval/loadLabeled.js';

const capture = (over = {}) => ({
  topic: 'Rentenreform',
  keywords: ['rentenreform', 'rente'],
  topicWords: ['rentenreform'],
  capturedAt: '2026-06-16T00:00:00.000Z',
  candidates: [
    { id: 1, spectrum: 'center', source_name: 'Tagesschau', source_domain: 'tagesschau.de',
      article_title: 'Rentenreform beschlossen', our_summary: 'Die Rentenreform tritt in Kraft.',
      url: 'https://t.de/1', score: 0.9, retrievers: ['lexical'], passedGate: true, relevant: true },
    { id: 2, spectrum: 'left', source_name: 'taz', source_domain: 'taz.de',
      article_title: 'Fußball-Ergebnisse', our_summary: 'Bundesliga-Spieltag.',
      url: 'https://taz.de/2', score: 0.4, retrievers: ['semantic'], passedGate: false, relevant: false },
    { id: 3, spectrum: 'center_right', source_name: 'FAZ', source_domain: 'faz.net',
      article_title: 'Kosten der Rentenreform', our_summary: 'Was die Rentenreform kostet.',
      url: 'https://faz.net/3', score: 0.7, retrievers: ['lexical'], passedGate: true, relevant: null },
    ...(over.candidates || []),
  ],
  ...over,
});

describe('loadLabeled', () => {
  it('isLabelled is true when ≥1 row is labelled true/false', () => {
    expect(isLabelled(capture())).toBe(true);
    const blank = capture();
    for (const c of blank.candidates) c.relevant = null;
    expect(isLabelled(blank)).toBe(false);
    expect(isLabelled({})).toBe(false);
  });

  it('toCase builds grouped + relevantIds in golden-set shape', () => {
    const c = toCase(capture());
    expect(c.topic).toBe('Rentenreform');
    expect(c.relevantIds).toEqual([1]);             // only relevant===true
    expect(c.grouped.center).toHaveLength(1);
    expect(c.grouped.left).toHaveLength(1);
    expect(c.grouped.center_right).toHaveLength(1);
    // rows carry the fields corpusToSpectra needs
    const row = c.grouped.center[0];
    expect(row.id).toBe(1);
    expect(row._rrfScore).toBe(0.9);
    expect(row.our_summary).toBeTruthy();
    // diagnostics
    expect(c._raw).toBe(3);
    expect(c._labelled).toBe(2);   // rows 1 (true) + 2 (false); row 3 is null
    expect(c._relevant).toBe(1);
  });

  it('labelledCases skips unlabelled files', () => {
    const blank = capture();
    for (const x of blank.candidates) x.relevant = null;
    const cases = labelledCases([capture(), blank, {}]);
    expect(cases).toHaveLength(1);
    expect(cases[0].topic).toBe('Rentenreform');
  });

  it('a labelled real case scores correctly through the same metrics path', async () => {
    // wiring sanity: the case shape from toCase feeds corpusToSpectra + scorer
    const { corpusToSpectra } = await import('../lib/corpusToSpectra.js');
    const { scoreRetrievalCase } = await import('../lib/ragEval.js');
    const c = toCase(capture());
    const { spectra } = corpusToSpectra(c.grouped, { keywords: c.keywords, topicWords: c.topicWords });
    const ids = [];
    for (const sp of Object.keys(spectra)) for (const a of spectra[sp].articles) ids.push(a._corpusId);
    const m = scoreRetrievalCase(ids, c.relevantIds);
    expect(m.precision).toBeGreaterThan(0);  // the relevant row survives the gate
  });
});
