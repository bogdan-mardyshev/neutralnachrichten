import { describe, it, expect, vi } from 'vitest';
import {
  computeConfidence,
  normalizeReachWeightedCoverage,
  buildReliabilityEnvelope,
  CONTRADICTION_PENALTY,
  VOLUME_TARGET,
} from '../lib/confidenceScore.js';
import {
  SOURCE_RATINGS,
  buildRatingsMap,
  seedSourceRatings,
} from '../lib/sourceRatingsSeed.js';

describe('source ratings seed', () => {
  it('covers the expanded outlet set across all 5 spectra', () => {
    expect(SOURCE_RATINGS.length).toBeGreaterThanOrEqual(30);
    const spectra = new Set(SOURCE_RATINGS.map(r => r.spectrum));
    expect([...spectra].sort()).toEqual(['center', 'center_left', 'center_right', 'left', 'right']);
  });
  it('every rating has provenance + bounded confidence/reach + both axes', () => {
    for (const r of SOURCE_RATINGS) {
      expect(r.rating_source).toBeTruthy();
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
      expect(r.reach_weight).toBeGreaterThan(0);
      expect(r.notes).toBeTruthy();
      expect(['flagship', 'standard', 'niche']).toContain(r.tier);
      expect(['high', 'mixed', 'low']).toContain(r.factual_rating);
    }
  });
  it('domains are unique', () => {
    const domains = SOURCE_RATINGS.map(r => r.source_domain);
    expect(new Set(domains).size).toBe(domains.length);
  });
  it('buildRatingsMap normalizes domains', () => {
    const map = buildRatingsMap();
    expect(map['bild.de'].spectrum).toBe('right');
    expect(map['tagesschau.de'].spectrum).toBe('center');
  });
  it('seedSourceRatings upserts each and counts results', async () => {
    const upsert = vi.fn().mockResolvedValue({ ok: true });
    const { seeded, failed } = await seedSourceRatings(upsert);
    expect(seeded).toBe(SOURCE_RATINGS.length);
    expect(failed).toBe(0);
    expect(upsert).toHaveBeenCalledTimes(SOURCE_RATINGS.length);
  });
  it('seedSourceRatings counts failures without throwing', async () => {
    const upsert = vi.fn().mockRejectedValue(new Error('db'));
    const { seeded, failed } = await seedSourceRatings(upsert, SOURCE_RATINGS.slice(0, 3));
    expect(seeded).toBe(0);
    expect(failed).toBe(3);
  });
});

describe('computeConfidence', () => {
  it('perfect signals → high band near 100', () => {
    const c = computeConfidence({
      coveredSpectra: 5, groundingRatio: 1, claimSupportRatio: 1,
      hasContradiction: false, sourceCount: VOLUME_TARGET,
    });
    expect(c.score).toBe(100);
    expect(c.band).toBe('high');
  });

  it('one-sided coverage drops the score', () => {
    const c = computeConfidence({
      coveredSpectra: 1, groundingRatio: 1, claimSupportRatio: 1,
      hasContradiction: false, sourceCount: VOLUME_TARGET,
    });
    // breadth 1/5 → loses most of the 30% breadth weight
    expect(c.score).toBeLessThan(80);
    expect(c.factors.spectrumBreadth).toBeCloseTo(0.2, 3);
  });

  it('applies the contradiction penalty', () => {
    const base = computeConfidence({
      coveredSpectra: 5, groundingRatio: 1, claimSupportRatio: 1,
      hasContradiction: false, sourceCount: VOLUME_TARGET,
    });
    const pen = computeConfidence({
      coveredSpectra: 5, groundingRatio: 1, claimSupportRatio: 1,
      hasContradiction: true, sourceCount: VOLUME_TARGET,
    });
    expect(pen.penaltyApplied).toBe(true);
    expect(pen.score).toBe(Math.round(base.score * CONTRADICTION_PENALTY));
  });

  it('missing ratios default to 1 (no false penalty when no claims emitted)', () => {
    const c = computeConfidence({ coveredSpectra: 5, sourceCount: VOLUME_TARGET });
    expect(c.factors.grounding).toBe(1);
    expect(c.factors.claimSupport).toBe(1);
  });

  it('clamps garbage inputs', () => {
    const c = computeConfidence({ coveredSpectra: 99, groundingRatio: 5, sourceCount: -3 });
    expect(c.factors.spectrumBreadth).toBe(1);
    expect(c.factors.grounding).toBe(1);
    expect(c.factors.volume).toBe(0);
  });
});

describe('normalizeReachWeightedCoverage', () => {
  const spectra = (map) => {
    const out = {};
    for (const [sp, domains] of Object.entries(map)) {
      out[sp] = { articles: domains.map(d => ({ source_domain: d })) };
    }
    return out;
  };

  it('weights by reach and returns percentages summing to ~100', () => {
    // right: bild (1.8); left: taz (0.6)
    const cov = normalizeReachWeightedCoverage(spectra({ right: ['bild.de'], left: ['taz.de'] }));
    expect(cov.right.percent).toBeGreaterThan(cov.left.percent);
    const sum = Object.values(cov).reduce((s, v) => s + v.percent, 0);
    expect(sum).toBeGreaterThanOrEqual(99);
    expect(sum).toBeLessThanOrEqual(101);
  });

  it('counts each source once (dedups within a spectrum)', () => {
    const cov = normalizeReachWeightedCoverage(spectra({ center: ['tagesschau.de', 'tagesschau.de'] }));
    expect(cov.center.sources).toBe(1);
  });

  it('unknown sources get neutral weight 1', () => {
    const cov = normalizeReachWeightedCoverage(spectra({ left: ['unknown-blog.de'] }));
    expect(cov.left.weight).toBe(1);
    expect(cov.left.percent).toBe(100);
  });

  it('all zero when there is no coverage', () => {
    const cov = normalizeReachWeightedCoverage({});
    expect(Object.values(cov).every(v => v.percent === 0)).toBe(true);
  });
});

describe('buildReliabilityEnvelope', () => {
  it('assembles confidence + coverage + reports', () => {
    const corpusSpectra = {
      left:   { articles: [{ source_domain: 'taz.de' }] },
      center: { articles: [{ source_domain: 'tagesschau.de' }, { source_domain: 'zdf.de' }] },
      right:  { articles: [{ source_domain: 'bild.de' }] },
    };
    const env = buildReliabilityEnvelope({
      corpusSpectra,
      grounding: { groundingRatio: 0.9 },
      claimVerification: { supportRatio: 0.8, hasContradiction: false },
      blindspot: { coveredSpectra: ['left', 'center', 'right'], verifiedSilences: ['center_left'], unverifiable: ['center_right'] },
    });
    expect(env.sourceCount).toBe(4);
    expect(env.confidence.score).toBeGreaterThan(0);
    expect(env.coverage.center.percent).toBeGreaterThan(0);
    expect(env.blindspots.verifiedSilences).toEqual(['center_left']);
  });
});
