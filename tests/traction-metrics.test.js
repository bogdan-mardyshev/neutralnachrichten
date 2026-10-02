import { describe, it, expect } from 'vitest';
import {
  pct,
  computeGrowth,
  computeRetention,
  buildCohortGrid,
  buildFunnel,
  summarizeAsset,
  shareTable,
} from '../lib/tractionMetrics.js';

describe('pct', () => {
  it('computes a percentage with one decimal', () => {
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(50, 200)).toBe(25);
  });

  it('returns null (not 0) when the base is zero — an undefined rate is unmeasured', () => {
    expect(pct(0, 0)).toBeNull();
    expect(pct(5, 0)).toBeNull();
  });

  it('coerces PG count strings', () => {
    expect(pct('3', '6')).toBe(50);
  });
});

describe('computeGrowth', () => {
  it('computes period-over-period growth', () => {
    const g = computeGrowth([{ count: 10 }, { count: 15 }]);
    expect(g).toEqual({ current: 15, previous: 10, growthPct: 50 });
  });

  it('reports decline as negative', () => {
    expect(computeGrowth([{ count: 20 }, { count: 15 }]).growthPct).toBe(-25);
  });

  it('returns null growth when there is no baseline — never 0% or Infinity', () => {
    expect(computeGrowth([{ count: 7 }]).growthPct).toBeNull();
    expect(computeGrowth([{ count: 0 }, { count: 9 }]).growthPct).toBeNull();
    expect(computeGrowth([]).growthPct).toBeNull();
  });

  it('uses the last two buckets of a longer series', () => {
    const g = computeGrowth([{ count: 1 }, { count: 2 }, { count: 4 }, { count: 6 }]);
    expect(g.current).toBe(6);
    expect(g.previous).toBe(4);
    expect(g.growthPct).toBe(50);
  });
});

describe('computeRetention', () => {
  it('counts a visitor as returning only on >= 2 distinct days', () => {
    const r = computeRetention([
      { active_days: 1 },  // one sitting — not retention
      { active_days: 1 },
      { active_days: 2 },  // returning
      { active_days: 5 },  // returning + loyal
    ]);
    expect(r.totalVisitors).toBe(4);
    expect(r.returningVisitors).toBe(2);
    expect(r.loyalVisitors).toBe(1);
    expect(r.returningRate).toBe(50);
  });

  it('averages active days', () => {
    expect(computeRetention([{ active_days: 1 }, { active_days: 3 }]).avgActiveDays).toBe(2);
  });

  it('handles an empty set without dividing by zero', () => {
    const r = computeRetention([]);
    expect(r.totalVisitors).toBe(0);
    expect(r.returningRate).toBeNull();
    expect(r.avgActiveDays).toBeNull();
  });
});

describe('buildCohortGrid', () => {
  const rows = [
    { cohort_week: '2026-08-03', week_offset: 0, visitors: 10 },
    { cohort_week: '2026-08-03', week_offset: 1, visitors: 4 },
    { cohort_week: '2026-08-03', week_offset: 2, visitors: 2 },
    { cohort_week: '2026-08-10', week_offset: 0, visitors: 8 },
    { cohort_week: '2026-08-10', week_offset: 1, visitors: 3 },
  ];

  it('builds retention percentages relative to cohort size', () => {
    const grid = buildCohortGrid(rows, { maxOffset: 2 });
    const aug3 = grid.find(c => c.cohortWeek === '2026-08-03');
    expect(aug3.size).toBe(10);
    expect(aug3.cells[1]).toEqual({ offset: 1, visitors: 4, pct: 40 });
    expect(aug3.cells[2]).toEqual({ offset: 2, visitors: 2, pct: 20 });
  });

  it('marks not-yet-elapsed weeks as null rather than 0%', () => {
    const grid = buildCohortGrid(rows, { maxOffset: 2 });
    const aug10 = grid.find(c => c.cohortWeek === '2026-08-10');
    expect(aug10.cells[2]).toEqual({ offset: 2, visitors: null, pct: null });
  });

  it('returns newest cohort first', () => {
    const grid = buildCohortGrid(rows, { maxOffset: 2 });
    expect(grid[0].cohortWeek).toBe('2026-08-10');
  });

  it('ignores offsets beyond the window and malformed rows', () => {
    const grid = buildCohortGrid(
      [...rows, { cohort_week: '2026-08-03', week_offset: 9, visitors: 1 }, { visitors: 3 }],
      { maxOffset: 2 }
    );
    expect(grid).toHaveLength(2);
    expect(grid.every(c => c.cells.length === 3)).toBe(true);
  });

  it('tolerates empty input', () => {
    expect(buildCohortGrid(null)).toEqual([]);
  });
});

describe('buildFunnel', () => {
  it('expresses every step as a share of those who ran an analysis', () => {
    const f = buildFunnel({ analysed: 100, repeat: 40, returning: 25, registered: 8 });
    expect(f.map(s => s.pct)).toEqual([100, 40, 25, 8]);
  });

  it('returns null percentages when nobody ran an analysis', () => {
    const f = buildFunnel({});
    expect(f[0].pct).toBeNull();
    expect(f[3].pct).toBeNull();
  });
});

describe('summarizeAsset', () => {
  it('derives articles/day from observed ingestion days only', () => {
    const a = summarizeAsset({
      articles: 1000,
      embeddings: 900,
      nliTotal: 120,
      outlets: 59,
      dailyIngest: [{ count: 100 }, { count: 200 }, { count: 0 }],
    });
    expect(a.observedDays).toBe(2);      // the zero day is not counted
    expect(a.articlesPerDay).toBe(150);
    expect(a.embeddingCoverage).toBe(90);
  });

  it('reports null rates when there is nothing observed yet', () => {
    const a = summarizeAsset({});
    expect(a.articlesPerDay).toBeNull();
    expect(a.embeddingCoverage).toBeNull();
    expect(a.articles).toBe(0);
  });
});

describe('shareTable', () => {
  it('computes shares and sorts by size', () => {
    const t = shareTable([{ lang: 'en', count: 25 }, { lang: 'de', count: 75 }]);
    expect(t[0]).toEqual({ label: 'de', count: 75, pct: 75 });
    expect(t[1].pct).toBe(25);
  });

  it('handles an empty table', () => {
    expect(shareTable([])).toEqual([]);
  });
});
