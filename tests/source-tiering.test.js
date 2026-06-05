import { describe, it, expect } from 'vitest';
import {
  SOURCE_RATINGS,
  buildRatingsMap,
  flagshipDomainsBySpectrum,
  lowConfidenceRatings,
} from '../lib/sourceRatingsSeed.js';
import { normalizeTier, normalizeFactual, buildUpsertSourceRatingQuery } from '../lib/corpusQueries.js';
import { verifyBlindspots } from '../lib/blindspotVerification.js';

describe('classification axes integrity', () => {
  it('flagships exist for the high-reach camps (left has none — realistic)', () => {
    const fm = flagshipDomainsBySpectrum();
    // center_left, center, center_right, right all have mass-reach flagships
    for (const sp of ['center_left', 'center', 'center_right', 'right']) {
      expect((fm[sp] || []).length).toBeGreaterThanOrEqual(1);
    }
    // The German left has no mass-market flagship outlet — flagship_silent simply
    // never triggers there (guarded by hasFlagships). Documented, not a bug.
    expect((fm.left || []).length).toBe(0);
  });

  it('low-factual sources exist only where expected and are flagged', () => {
    const lows = SOURCE_RATINGS.filter(r => r.factual_rating === 'low');
    // Nius, Epoch Times DE, NachDenkSeiten are the low-factual inclusions
    expect(lows.map(r => r.source_domain)).toEqual(
      expect.arrayContaining(['nius.de', 'epochtimes.de', 'nachdenkseiten.de'])
    );
    // every low-factual source still carries provenance
    for (const r of lows) expect(r.rating_source).toBeTruthy();
  });

  it('flags borderline rows for manual review', () => {
    const flagged = lowConfidenceRatings(0.65);
    const domains = flagged.map(r => r.source_domain);
    expect(domains).toContain('wiwo.de');     // MBFC page missing
    expect(domains).toContain('dw.com');      // center vs center_left borderline
  });

  it('n-tv is flagship (corrected from IVW reach data)', () => {
    const map = buildRatingsMap();
    expect(map['n-tv.de'].tier).toBe('flagship');
  });

  it('Bild is flagship reach but only mixed factual (axes are independent)', () => {
    const map = buildRatingsMap();
    expect(map['bild.de'].tier).toBe('flagship');
    expect(map['bild.de'].factual_rating).toBe('mixed');
  });
});

describe('normalizeTier / normalizeFactual', () => {
  it('passes valid values, defaults invalid', () => {
    expect(normalizeTier('flagship')).toBe('flagship');
    expect(normalizeTier('bogus')).toBe('standard');
    expect(normalizeFactual('low')).toBe('low');
    expect(normalizeFactual(undefined)).toBe('mixed');
  });
});

describe('buildUpsertSourceRatingQuery with tier + factual', () => {
  it('includes the new columns and normalizes them', () => {
    const { text, values } = buildUpsertSourceRatingQuery({
      source_domain: 'WWW.Example.DE', source_name: 'Example', spectrum: 'left',
      tier: 'flagship', factual_rating: 'high', confidence: 0.9, reach_weight: 1.2,
    });
    expect(text).toMatch(/tier/);
    expect(text).toMatch(/factual_rating/);
    expect(values[0]).toBe('example.de');     // normalized domain
    expect(values).toContain('flagship');
    expect(values).toContain('high');
  });

  it('defaults bad tier/factual instead of throwing', () => {
    const { values } = buildUpsertSourceRatingQuery({
      source_domain: 'x.de', spectrum: 'right', tier: 'huge', factual_rating: 'perfect',
    });
    expect(values).toContain('standard');
    expect(values).toContain('mixed');
  });
});

describe('flagship-aware blindspot (three-level silence)', () => {
  const articlesFrom = (domains) => ({ articles: domains.map((d, i) => ({ id: i, source_domain: d })) });

  it('covered when a flagship of the camp published', () => {
    const corpus = { center_right: articlesFrom(['welt.de', 'cicero.de']) };
    const r = verifyBlindspots(corpus, []);
    expect(r.perSpectrum.center_right.flagshipPublished).toBe(true);
    expect(r.perSpectrum.center_right.flagshipSilent).toBe(false);
    expect(r.flagshipSilences).not.toContain('center_right');
  });

  it('flagship_silent when only smaller titles wrote', () => {
    // cicero is niche; no flagship (FAZ/Welt/Focus/n-tv/NZZ) present
    const corpus = { center_right: articlesFrom(['cicero.de']) };
    const r = verifyBlindspots(corpus, []);
    expect(r.perSpectrum.center_right.status).toBe('covered');
    expect(r.perSpectrum.center_right.flagshipSilent).toBe(true);
    expect(r.flagshipSilences).toContain('center_right');
  });

  it('camp_silent (verified) only when nobody wrote and feeds healthy', () => {
    const r = verifyBlindspots({ right: { articles: [] } }, []);
    expect(r.verifiedSilences).toContain('right');
    // not also flagged as flagship_silent (no articles at all)
    expect(r.flagshipSilences).not.toContain('right');
  });

  it('unknown (not silence) when feeds broken', () => {
    const down = [{ spectrum: 'right', source_name: 'Bild', status: 'down', consecutive_failures: 4 }];
    const r = verifyBlindspots({ right: { articles: [] } }, down);
    expect(r.unverifiable).toContain('right');
    expect(r.verifiedSilences).not.toContain('right');
  });
});
