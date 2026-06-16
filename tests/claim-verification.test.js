import { describe, it, expect, vi } from 'vitest';
import {
  textTokens,
  coverageScore,
  flattenCorpus,
  extractClaims,
  bestEvidence,
  verifyClaims,
} from '../lib/claimVerification.js';

const art = (id, title, summary, over = {}) => ({
  _corpusId: id, id, article_title: title, our_summary: summary,
  article_url: `https://t.de/${id}`, source_name: 'Tagesschau', spectrum: 'center', ...over,
});

describe('textTokens / coverageScore', () => {
  it('keeps words >= 4 chars', () => {
    expect(textTokens('Der Bundestag und Reform')).toEqual(['bundestag', 'reform']);
  });
  it('coverage = fraction of claim vocab found in article', () => {
    // claim tokens: bundestag, reform → both present → 1.0
    expect(coverageScore('Bundestag Reform', 'Der Bundestag beschließt eine Reform')).toBe(1);
    // only one of two present → 0.5
    expect(coverageScore('Bundestag Klimagipfel', 'Der Bundestag tagt')).toBe(0.5);
  });
  it('returns 0 for empty claim', () => {
    expect(coverageScore('', 'whatever')).toBe(0);
  });
});

describe('flattenCorpus', () => {
  it('flattens all spectra into one list', () => {
    const corpus = {
      left: { articles: [art(1, 'a', 'b')] },
      center: { articles: [art(2, 'c', 'd'), art(3, 'e', 'f')] },
    };
    expect(flattenCorpus(corpus).map(a => a.id)).toEqual([1, 2, 3]);
  });
  it('handles empty/missing', () => {
    expect(flattenCorpus({})).toEqual([]);
    expect(flattenCorpus(null)).toEqual([]);
  });
});

describe('extractClaims', () => {
  it('pulls sentences from overall analysis', () => {
    const a = { overall_non_partisan_analysis: 'Der Bundestag beschloss die Reform. Die Opposition kritisierte das Vorgehen.' };
    const claims = extractClaims(a);
    expect(claims).toHaveLength(2);
    expect(claims[0].kind).toBe('overall');
  });
  it('pulls shared_facts from deep analysis', () => {
    const claims = extractClaims({}, { shared_facts: [{ claim: 'Die Rentenreform tritt 2027 in Kraft.' }] });
    expect(claims[0].kind).toBe('shared_fact');
  });
  it('skips too-short fragments', () => {
    const claims = extractClaims({ overall_non_partisan_analysis: 'Ja. Nein.' });
    expect(claims).toHaveLength(0);
  });
});

describe('bestEvidence', () => {
  it('returns the highest-coverage article', () => {
    const arts = [art(1, 'Klimagipfel Berlin', 'foo'), art(2, 'Bundestag Rentenreform beschlossen', 'details')];
    const ev = bestEvidence('Bundestag Rentenreform', arts);
    expect(ev.art.id).toBe(2);
    expect(ev.score).toBeGreaterThan(0);
  });
});

describe('verifyClaims — lexical layer', () => {
  const arts = [
    art(1, 'Bundestag beschließt Rentenreform', 'Die Reform tritt 2027 in Kraft.'),
    art(2, 'Klimagipfel in Berlin', 'Staaten verhandeln über Emissionen.'),
  ];

  it('labels well-covered claims supported with evidence', async () => {
    const claims = [{ text: 'Der Bundestag beschließt die Rentenreform', kind: 'overall' }];
    const { results, report } = await verifyClaims(claims, arts);
    expect(results[0].label).toBe('supported');
    expect(results[0].evidence.corpus_id).toBe(1);
    expect(report.supported).toBe(1);
    expect(report.supportRatio).toBe(1);
  });

  it('labels uncovered claims unsupported with no evidence', async () => {
    const claims = [{ text: 'Aktienmärkte stürzten weltweit dramatisch ein', kind: 'overall' }];
    const { results, report } = await verifyClaims(claims, arts);
    expect(results[0].label).toBe('unsupported');
    expect(results[0].evidence).toBeNull();
    expect(report.supportRatio).toBe(0);
  });

  it('ratio is 1 for no claims', async () => {
    const { report } = await verifyClaims([], arts);
    expect(report.total).toBe(0);
    expect(report.supportRatio).toBe(1);
  });
});

describe('verifyClaims — entailment layer (injected)', () => {
  const arts = [art(1, 'Minister tritt zurück', 'Der Minister erklärte heute seinen Rücktritt vom Amt.')];

  it('upgrades supported → entailment', async () => {
    const entailmentFn = vi.fn().mockResolvedValue('entailment');
    const claims = [{ text: 'Der Minister tritt von seinem Amt zurück', kind: 'overall' }];
    const { results } = await verifyClaims(claims, arts, { entailmentFn });
    expect(entailmentFn).toHaveBeenCalled();
    expect(results[0].label).toBe('entailment');
  });

  it('flags contradiction when the source negates the claim', async () => {
    const entailmentFn = vi.fn().mockResolvedValue('contradiction');
    const claims = [{ text: 'Der Minister bleibt im Amt und tritt nicht zurück', kind: 'overall' }];
    const { results, report } = await verifyClaims(claims, arts, { entailmentFn });
    expect(results[0].label).toBe('contradiction');
    expect(report.hasContradiction).toBe(true);
    expect(report.contradicted).toBe(1);
  });

  it('does NOT call entailmentFn for lexically-unsupported claims (cost control)', async () => {
    const entailmentFn = vi.fn().mockResolvedValue('entailment');
    const claims = [{ text: 'Voellig unbezogenes Thema ueber Raumfahrt', kind: 'overall' }];
    await verifyClaims(claims, arts, { entailmentFn });
    expect(entailmentFn).not.toHaveBeenCalled();
  });

  it('keeps lexical label when entailmentFn throws', async () => {
    const entailmentFn = vi.fn().mockRejectedValue(new Error('timeout'));
    const claims = [{ text: 'Der Minister tritt von seinem Amt zurück', kind: 'overall' }];
    const { results } = await verifyClaims(claims, arts, { entailmentFn });
    expect(results[0].label).toBe('supported');
  });

  it('neutral entailment is labelled neutral (unmeasured, NOT a support failure)', async () => {
    const entailmentFn = vi.fn().mockResolvedValue('neutral');
    const claims = [{ text: 'Der Minister tritt von seinem Amt zurück', kind: 'overall' }];
    const { results, report } = await verifyClaims(claims, arts, { entailmentFn });
    expect(results[0].label).toBe('neutral');
    expect(report.neutral).toBe(1);
  });
});

describe('verifyClaims — neutral is unmeasured, excluded from supportRatio', () => {
  const arts = [{ article_title: 'Bundestag beschließt Rentenreform', our_summary: 'Die Reform tritt 2027 in Kraft.', article_url: 'https://t.de/1', source_name: 'Tagesschau', _corpusId: 1 }];

  it('all-neutral → supportRatio null (caller treats as UNMEASURED, not 0)', async () => {
    const claims = [{ text: 'Abstrakte Aussage A', kind: 'overall' }, { text: 'Abstrakte Aussage B', kind: 'overall' }];
    const batchFn = vi.fn().mockResolvedValue(['neutral', 'neutral']);
    const { report } = await verifyClaims(claims, arts, { batchEntailmentFn: batchFn });
    expect(report.neutral).toBe(2);
    expect(report.assessed).toBe(0);
    expect(report.supportRatio).toBeNull();   // ← the fix: not 0
    expect(report.method).toBe('nli');
  });

  it('mixed: ratio is over ASSESSED claims, neutral does not dilute it', async () => {
    const claims = [
      { text: 'Aussage eins', kind: 'overall' },
      { text: 'Aussage zwei', kind: 'overall' },
      { text: 'Aussage drei', kind: 'overall' },
    ];
    // one entailment, two neutral → 1 supported of 1 assessed = 1.0 (neutrals excluded)
    const batchFn = vi.fn().mockResolvedValue(['entailment', 'neutral', 'neutral']);
    const { report } = await verifyClaims(claims, arts, { batchEntailmentFn: batchFn });
    expect(report.supported).toBe(1);
    expect(report.neutral).toBe(2);
    expect(report.assessed).toBe(1);
    expect(report.supportRatio).toBe(1);
  });

  it('a contradiction still counts against the ratio and flags hasContradiction', async () => {
    const claims = [{ text: 'Aussage eins', kind: 'overall' }, { text: 'Aussage zwei', kind: 'overall' }];
    const batchFn = vi.fn().mockResolvedValue(['entailment', 'contradiction']);
    const { report } = await verifyClaims(claims, arts, { batchEntailmentFn: batchFn });
    expect(report.assessed).toBe(2);
    expect(report.supportRatio).toBe(0.5);
    expect(report.hasContradiction).toBe(true);
  });
});

describe('topEvidence — bundle the union of sources for abstractive claims', () => {
  it('returns the K best articles by coverage, best first', async () => {
    const { topEvidence } = await import('../lib/claimVerification.js');
    const articles = [
      { article_title: 'Ukraine Krieg', our_summary: 'Verhandlungen im Ukraine Krieg.' },
      { article_title: 'Nahost Konflikt', our_summary: 'Eskalation im Nahost Konflikt mit Iran.' },
      { article_title: 'Wetter', our_summary: 'Sonnig morgen.' },
    ];
    const top = topEvidence('Ukraine Krieg und Nahost Konflikt mit Iran', articles, 2);
    expect(top).toHaveLength(2);
    expect(top[0].score).toBeGreaterThanOrEqual(top[1].score); // sorted best-first
    expect(top.map(t => t.art.article_title)).not.toContain('Wetter'); // weakest dropped
  });
});

describe('verifyClaims — batch judges ALL claims regardless of lexical overlap (confidence fix)', () => {
  it('an abstract claim with low word-overlap still gets a batch verdict + evidence', async () => {
    const arts = [{ article_title: 'Bundestag beschließt Rentenreform', our_summary: 'Die Reform tritt 2027 in Kraft.', article_url: 'https://t.de/1', source_name: 'Tagesschau', _corpusId: 1 }];
    // Abstract synthesis sentence — shares few exact words with the article
    const claims = [{ text: 'Deutsche Medien berichten breit über das Vorhaben', kind: 'overall' }];
    const batchFn = vi.fn().mockResolvedValue(['entailment']);
    const { results, report } = await verifyClaims(claims, arts, { batchEntailmentFn: batchFn });
    expect(batchFn).toHaveBeenCalledTimes(1);
    expect(batchFn.mock.calls[0][0]).toHaveLength(1); // the abstract claim WAS sent
    expect(results[0].label).toBe('entailment');
    expect(results[0].evidence).toBeTruthy();          // evidence attached despite low lexical score
    expect(report.method).toBe('nli');
    expect(report.supportRatio).toBe(1);
  });

  it('report.method is "lexical" when no batch fn is given', async () => {
    const arts = [{ article_title: 'x', our_summary: 'y', article_url: 'u', source_name: 's' }];
    const { report } = await verifyClaims([{ text: 'something', kind: 'overall' }], arts);
    expect(report.method).toBe('lexical');
  });
});
