import { describe, it, expect, vi } from 'vitest';
import {
  buildEntailmentPrompt,
  parseEntailmentResponse,
  makeBatchEntailment,
} from '../lib/entailment.js';

const PAIRS = [
  { claim: 'Die Reform tritt 2027 in Kraft', evidence: 'Die Rentenreform tritt 2027 in Kraft.' },
  { claim: 'Der Minister bleibt im Amt', evidence: 'Der Minister erklärte seinen Rücktritt.' },
];

describe('buildEntailmentPrompt', () => {
  it('numbers all pairs and asks for a JSON array of that length', () => {
    const p = buildEntailmentPrompt(PAIRS);
    expect(p).toContain('1. CLAIM: Die Reform tritt 2027 in Kraft');
    expect(p).toContain('2. CLAIM: Der Minister bleibt im Amt');
    expect(p).toContain('JSON array of 2 strings');
  });
});

describe('parseEntailmentResponse', () => {
  it('parses a clean JSON array', () => {
    expect(parseEntailmentResponse('["entailment","contradiction"]', 2))
      .toEqual(['entailment', 'contradiction']);
  });
  it('strips code fences and surrounding prose', () => {
    expect(parseEntailmentResponse('```json\n["neutral","entailment"]\n```', 2))
      .toEqual(['neutral', 'entailment']);
  });
  it('maps unknown labels to neutral', () => {
    expect(parseEntailmentResponse('["yes","contradiction"]', 2))
      .toEqual(['neutral', 'contradiction']);
  });
  it('returns null on wrong length or garbage', () => {
    expect(parseEntailmentResponse('["entailment"]', 2)).toBeNull();
    expect(parseEntailmentResponse('not json', 2)).toBeNull();
    expect(parseEntailmentResponse('', 2)).toBeNull();
  });
});

describe('makeBatchEntailment', () => {
  const fakeGenAI = (text) => ({
    getGenerativeModel: () => ({
      generateContent: vi.fn().mockResolvedValue({ response: { text: () => text } }),
    }),
  });

  it('returns labels aligned with pairs', async () => {
    const fn = makeBatchEntailment(fakeGenAI('["entailment","contradiction"]'));
    expect(await fn(PAIRS)).toEqual(['entailment', 'contradiction']);
  });

  it('returns [] for empty input without calling the model', async () => {
    const genAI = { getGenerativeModel: vi.fn() };
    const fn = makeBatchEntailment(genAI);
    expect(await fn([])).toEqual([]);
    expect(genAI.getGenerativeModel).not.toHaveBeenCalled();
  });

  it('returns null (degrade, never throw) when the model fails', async () => {
    const genAI = { getGenerativeModel: () => ({ generateContent: vi.fn().mockRejectedValue(new Error('quota')) }) };
    const fn = makeBatchEntailment(genAI);
    expect(await fn(PAIRS)).toBeNull();
  });

  it('returns null on malformed output', async () => {
    const fn = makeBatchEntailment(fakeGenAI('whoops'));
    expect(await fn(PAIRS)).toBeNull();
  });
});

describe('verifyClaims with batchEntailmentFn (integration)', () => {
  it('one batched call covers all supported claims; contradiction flips label', async () => {
    const { verifyClaims } = await import('../lib/claimVerification.js');
    const arts = [
      { article_title: 'Rentenreform 2027', our_summary: 'Die Rentenreform tritt 2027 in Kraft.', spectrum: 'center' },
      { article_title: 'Minister Rücktritt', our_summary: 'Der Minister erklärte seinen Rücktritt vom Amt.', spectrum: 'center' },
    ];
    const claims = [
      { text: 'Die Rentenreform tritt 2027 in Kraft', kind: 'overall' },
      { text: 'Der Minister erklärte seinen Rücktritt', kind: 'overall' },
    ];
    const batchFn = vi.fn().mockResolvedValue(['entailment', 'contradiction']);
    const { results, report } = await verifyClaims(claims, arts, { batchEntailmentFn: batchFn });
    expect(batchFn).toHaveBeenCalledTimes(1);                 // ONE call for all claims
    expect(batchFn.mock.calls[0][0]).toHaveLength(2);
    expect(results[0].label).toBe('entailment');
    expect(results[1].label).toBe('contradiction');
    expect(report.hasContradiction).toBe(true);
  });

  it('keeps lexical labels when the batch judge returns null', async () => {
    const { verifyClaims } = await import('../lib/claimVerification.js');
    const arts = [{ article_title: 'Rentenreform 2027', our_summary: 'Die Rentenreform tritt 2027 in Kraft.', spectrum: 'center' }];
    const claims = [{ text: 'Die Rentenreform tritt 2027 in Kraft', kind: 'overall' }];
    const { results } = await verifyClaims(claims, arts, { batchEntailmentFn: vi.fn().mockResolvedValue(null) });
    expect(results[0].label).toBe('supported'); // lexical label preserved
  });
});
