import { describe, it, expect, vi } from 'vitest';
import { makeEmbedder, extractVector } from '../lib/embeddings.js';
import { EMBEDDING_DIM } from '../lib/corpusQueries.js';

const vec = (fill = 0.1) => Array(EMBEDDING_DIM).fill(fill);

describe('extractVector', () => {
  it('accepts a raw number array of the right dim', () => {
    expect(extractVector(vec())).toHaveLength(EMBEDDING_DIM);
  });
  it('accepts the SDK shape { embedding: { values } }', () => {
    expect(extractVector({ embedding: { values: vec() } })).toHaveLength(EMBEDDING_DIM);
  });
  it('accepts { values }', () => {
    expect(extractVector({ values: vec() })).toHaveLength(EMBEDDING_DIM);
  });
  it('rejects wrong dimension', () => {
    expect(extractVector(Array(10).fill(0.1))).toBeNull();
    expect(extractVector({ embedding: { values: Array(769).fill(0.1) } })).toBeNull();
  });
  it('rejects non-finite values', () => {
    const bad = vec(); bad[0] = NaN;
    expect(extractVector(bad)).toBeNull();
    const bad2 = vec(); bad2[5] = Infinity;
    expect(extractVector(bad2)).toBeNull();
  });
  it('rejects null/garbage', () => {
    expect(extractVector(null)).toBeNull();
    expect(extractVector({})).toBeNull();
    expect(extractVector('nope')).toBeNull();
  });
});

describe('makeEmbedder.embed', () => {
  it('returns the validated vector on success', async () => {
    const embedContent = vi.fn().mockResolvedValue({ embedding: { values: vec() } });
    const { embed } = makeEmbedder(() => ({ embedContent }));
    const out = await embed('Bundestag Reform');
    expect(out).toHaveLength(EMBEDDING_DIM);
    expect(embedContent).toHaveBeenCalledWith('Bundestag Reform');
  });

  it('returns null for empty input WITHOUT calling the model', async () => {
    const embedContent = vi.fn();
    const { embed } = makeEmbedder(() => ({ embedContent }));
    expect(await embed('')).toBeNull();
    expect(await embed('   ')).toBeNull();
    expect(embedContent).not.toHaveBeenCalled();
  });

  it('returns null (not throw) when the model rejects', async () => {
    const embedContent = vi.fn().mockRejectedValue(new Error('rate limit'));
    const { embed } = makeEmbedder(() => ({ embedContent }));
    expect(await embed('x')).toBeNull();
  });

  it('returns null when the model yields a wrong-dim vector', async () => {
    const embedContent = vi.fn().mockResolvedValue({ embedding: { values: [1, 2, 3] } });
    const { embed } = makeEmbedder(() => ({ embedContent }));
    expect(await embed('x')).toBeNull();
  });
});

describe('makeEmbedder.embedBatch', () => {
  it('returns results aligned 1:1 with inputs', async () => {
    const embedContent = vi.fn().mockResolvedValue({ embedding: { values: vec() } });
    const { embedBatch } = makeEmbedder(() => ({ embedContent }));
    const out = await embedBatch(['a', 'b', 'c']);
    expect(out).toHaveLength(3);
    out.forEach(v => expect(v).toHaveLength(EMBEDDING_DIM));
    expect(embedContent).toHaveBeenCalledTimes(3);
  });

  it('isolates failures: one bad item → null at that index, others succeed', async () => {
    const embedContent = vi.fn()
      .mockResolvedValueOnce({ embedding: { values: vec() } })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ embedding: { values: vec() } });
    const { embedBatch } = makeEmbedder(() => ({ embedContent }));
    const out = await embedBatch(['a', 'b', 'c'], { concurrency: 1 });
    expect(out[0]).toHaveLength(EMBEDDING_DIM);
    expect(out[1]).toBeNull();
    expect(out[2]).toHaveLength(EMBEDDING_DIM);
  });

  it('handles an empty list', async () => {
    const { embedBatch } = makeEmbedder(() => ({ embedContent: vi.fn() }));
    expect(await embedBatch([])).toEqual([]);
  });

  it('respects concurrency without dropping work', async () => {
    let active = 0, maxActive = 0;
    const embedContent = vi.fn().mockImplementation(async () => {
      active++; maxActive = Math.max(maxActive, active);
      await new Promise(r => setTimeout(r, 5));
      active--;
      return { embedding: { values: vec() } };
    });
    const { embedBatch } = makeEmbedder(() => ({ embedContent }));
    const out = await embedBatch(Array(10).fill('x'), { concurrency: 3 });
    expect(out).toHaveLength(10);
    expect(out.every(v => v && v.length === EMBEDDING_DIM)).toBe(true);
    expect(maxActive).toBeLessThanOrEqual(3);
  });
});

describe('makeEmbedder guard', () => {
  it('throws if no model factory provided', () => {
    expect(() => makeEmbedder()).toThrow(/model factory/);
  });
});
