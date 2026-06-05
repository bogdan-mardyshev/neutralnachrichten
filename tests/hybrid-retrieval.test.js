import { describe, it, expect } from 'vitest';
import {
  fuseRankings,
  balanceBySpectrum,
  groupBySpectrum,
  combineRetrieval,
  RRF_K,
} from '../lib/hybridRetrieval.js';

const art = (id, spectrum = 'center', extra = {}) => ({
  id, spectrum, article_title: `T${id}`, our_summary: `S${id}`, ...extra,
});

describe('fuseRankings (RRF)', () => {
  it('combines two lists and ranks by reciprocal rank', () => {
    const semantic = [art(1), art(2), art(3)];
    const lexical  = [art(3), art(1), art(4)];
    const fused = fuseRankings([
      { name: 'semantic', items: semantic },
      { name: 'lexical',  items: lexical },
    ]);
    // id1: 1/(k+1) + 1/(k+2); id3: 1/(k+3)+1/(k+1); both appear twice.
    const ids = fused.map(f => f.id);
    expect(new Set(ids)).toEqual(new Set([1, 2, 3, 4]));
    // items in BOTH lists should outrank items in only one.
    expect(fused[0]._retrievers.length).toBe(2);
    expect(fused[1]._retrievers.length).toBe(2);
  });

  it('annotates _rrfScore and _retrievers', () => {
    const fused = fuseRankings([
      { name: 'semantic', items: [art(1)] },
      { name: 'lexical',  items: [art(1)] },
    ]);
    expect(fused[0]._retrievers.sort()).toEqual(['lexical', 'semantic']);
    expect(fused[0]._rrfScore).toBeCloseTo(2 / (RRF_K + 1), 10);
  });

  it('handles a single list (semantic-off fallback)', () => {
    const fused = fuseRankings([
      { name: 'lexical', items: [art(1), art(2)] },
      { name: 'semantic', items: [] },
    ]);
    expect(fused.map(f => f.id)).toEqual([1, 2]);
    expect(fused.every(f => f._retrievers.length === 1)).toBe(true);
  });

  it('respects limit', () => {
    const fused = fuseRankings(
      [{ name: 'a', items: [art(1), art(2), art(3)] }],
      { limit: 2 }
    );
    expect(fused).toHaveLength(2);
  });

  it('skips items without an id', () => {
    const fused = fuseRankings([{ name: 'a', items: [{ no: 'id' }, art(1)] }]);
    expect(fused.map(f => f.id)).toEqual([1]);
  });

  it('handles empty / garbage input', () => {
    expect(fuseRankings([])).toEqual([]);
    expect(fuseRankings(null)).toEqual([]);
    expect(fuseRankings([{ name: 'x' }])).toEqual([]);
  });

  it('prefers the richer item when one list returns a sparse duplicate', () => {
    const sparse = { id: 7, spectrum: 'left' }; // no summary
    const rich   = art(7, 'left');
    const fused = fuseRankings([
      { name: 'semantic', items: [sparse] },
      { name: 'lexical',  items: [rich] },
    ]);
    expect(fused[0].our_summary).toBe('S7');
  });
});

describe('balanceBySpectrum', () => {
  it('caps items per spectrum, preserving order', () => {
    const items = [art(1, 'right'), art(2, 'right'), art(3, 'right'), art(4, 'left')];
    const out = balanceBySpectrum(items, { perSpectrum: 2 });
    expect(out.map(i => i.id)).toEqual([1, 2, 4]);
  });

  it('respects a global total cap', () => {
    const items = [art(1, 'left'), art(2, 'center'), art(3, 'right')];
    const out = balanceBySpectrum(items, { perSpectrum: 5, total: 2 });
    expect(out).toHaveLength(2);
  });

  it('passes everything through with defaults', () => {
    const items = [art(1), art(2)];
    expect(balanceBySpectrum(items)).toHaveLength(2);
  });
});

describe('groupBySpectrum', () => {
  it('groups into all five spectrum keys', () => {
    const g = groupBySpectrum([art(1, 'left'), art(2, 'right'), art(3, 'right')]);
    expect(Object.keys(g).sort()).toEqual(
      ['center', 'center_left', 'center_right', 'left', 'right']
    );
    expect(g.left.map(i => i.id)).toEqual([1]);
    expect(g.right.map(i => i.id)).toEqual([2, 3]);
    expect(g.center).toEqual([]);
  });

  it('ignores items with an unknown spectrum', () => {
    const g = groupBySpectrum([art(1, 'bogus'), art(2, 'center')]);
    expect(g.center.map(i => i.id)).toEqual([2]);
  });
});

describe('combineRetrieval (end-to-end pure)', () => {
  it('fuses, limits, and groups', () => {
    const semantic = [art(1, 'left'), art(2, 'center')];
    const lexical  = [art(2, 'center'), art(3, 'right')];
    const { ranked, grouped, meta } = combineRetrieval({ semantic, lexical, limit: 10 });
    expect(meta.semanticCount).toBe(2);
    expect(meta.lexicalCount).toBe(2);
    expect(meta.fusedCount).toBe(3);
    expect(meta.bothRetrieversCount).toBe(1); // id2 in both
    // id2 (in both) ranks first.
    expect(ranked[0].id).toBe(2);
    expect(grouped.center.map(i => i.id)).toEqual([2]);
  });

  it('works with semantic empty (pgvector off)', () => {
    const { ranked, meta } = combineRetrieval({ semantic: [], lexical: [art(1), art(2)] });
    expect(meta.semanticCount).toBe(0);
    expect(ranked.map(i => i.id)).toEqual([1, 2]);
  });

  it('applies per-spectrum balancing when requested', () => {
    const lexical = [art(1, 'right'), art(2, 'right'), art(3, 'left')];
    const { ranked } = combineRetrieval({ semantic: [], lexical, perSpectrum: 1, limit: 10 });
    expect(ranked.map(i => i.id)).toEqual([1, 3]);
  });
});
