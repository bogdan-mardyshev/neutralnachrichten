import { describe, it, expect } from 'vitest';
import {
  mean, precisionAtK, recallAtK, reciprocalRank, averagePrecision, ndcgAtK,
  scoreRetrievalCase, faithfulnessScore, aggregate,
} from '../lib/ragEval.js';
import { GOLDEN_SET } from '../eval/golden-set.js';

describe('ragEval metrics — known inputs', () => {
  const ranked = ['a', 'b', 'c', 'd', 'e'];
  const relevant = ['a', 'c', 'x']; // a@1, c@3, x never retrieved

  it('mean handles empty', () => {
    expect(mean([])).toBe(0);
    expect(mean([1, 2, 3])).toBe(2);
  });

  it('precision@k counts hits over k', () => {
    expect(precisionAtK(ranked, relevant, 1)).toBe(1);     // a
    expect(precisionAtK(ranked, relevant, 3)).toBeCloseTo(2 / 3); // a,c of 3
    expect(precisionAtK(ranked, relevant, 5)).toBeCloseTo(2 / 5);
  });

  it('recall@k counts hits over all relevant', () => {
    expect(recallAtK(ranked, relevant, 1)).toBeCloseTo(1 / 3); // a of {a,c,x}
    expect(recallAtK(ranked, relevant, 5)).toBeCloseTo(2 / 3); // a,c; x missed
  });

  it('empty relevant set → recall 1 (nothing to find)', () => {
    expect(recallAtK(ranked, [], 5)).toBe(1);
  });

  it('reciprocal rank = 1/rank of first hit', () => {
    expect(reciprocalRank(ranked, relevant)).toBe(1);        // a at rank 1
    expect(reciprocalRank(ranked, ['c'])).toBeCloseTo(1 / 3); // c at rank 3
    expect(reciprocalRank(ranked, ['z'])).toBe(0);
  });

  it('average precision averages precision at each hit', () => {
    // hits at rank1 (p=1/1) and rank3 (p=2/3), over 3 relevant
    expect(averagePrecision(ranked, relevant)).toBeCloseTo((1 + 2 / 3) / 3);
  });

  it('nDCG@k is 1 for ideal ordering, <1 otherwise', () => {
    expect(ndcgAtK(['a', 'c'], ['a', 'c'], 2)).toBe(1);
    expect(ndcgAtK(['x', 'a'], ['a'], 2)).toBeLessThan(1); // relevant at rank 2
  });

  it('scoreRetrievalCase emits a flat metric map', () => {
    const m = scoreRetrievalCase(ranked, relevant, { ks: [1, 5] });
    expect(m).toHaveProperty('p@1');
    expect(m).toHaveProperty('r@5');
    expect(m).toHaveProperty('mrr');
    expect(m).toHaveProperty('ndcg@5');
  });
});

describe('faithfulnessScore', () => {
  it('multiplies grounding by claim support', () => {
    const f = faithfulnessScore({ grounding: { groundingRatio: 0.8 }, claims: { supportRatio: 0.5, contradicted: 0 } });
    expect(f.score).toBeCloseTo(0.4);
  });

  it('halves the score when a contradiction is present (the NLI penalty path)', () => {
    const clean = faithfulnessScore({ grounding: { groundingRatio: 1 }, claims: { supportRatio: 1, contradicted: 0 } });
    const contra = faithfulnessScore({ grounding: { groundingRatio: 1 }, claims: { supportRatio: 1, contradicted: 1 } });
    expect(clean.score).toBe(1);
    expect(contra.score).toBe(0.5);
    expect(contra.contradictions).toBe(1);
  });

  it('defaults missing reports to 0', () => {
    expect(faithfulnessScore({}).score).toBe(0);
  });
});

describe('aggregate', () => {
  it('means numeric keys across cases', () => {
    const agg = aggregate([{ 'p@5': 0.8, mrr: 1 }, { 'p@5': 0.6, mrr: 1 }]);
    expect(agg['p@5']).toBeCloseTo(0.7);
    expect(agg.mrr).toBe(1);
  });
});

describe('golden set integrity', () => {
  it('every case has labelled relevant ids and a synthesis', () => {
    expect(GOLDEN_SET.length).toBeGreaterThanOrEqual(3);
    for (const c of GOLDEN_SET) {
      expect(Array.isArray(c.relevantIds)).toBe(true);
      expect(c.relevantIds.length).toBeGreaterThan(0);
      expect(c.analysis.overall_non_partisan_analysis).toBeTruthy();
      expect(c.topicWords.length).toBeGreaterThanOrEqual(1);
    }
  });
});
