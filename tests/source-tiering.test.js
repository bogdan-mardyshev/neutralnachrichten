import { describe, it, expect } from 'vitest';
import {
  SOURCE_RATINGS,
  SOURCE_OWNERS,
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

describe('expanded source corpus (~55 outlets) integrity', () => {
  it('has ≥50 outlets, every spectrum represented with breadth', () => {
    expect(SOURCE_RATINGS.length).toBeGreaterThanOrEqual(50);
    const counts = {};
    for (const r of SOURCE_RATINGS) counts[r.spectrum] = (counts[r.spectrum] || 0) + 1;
    for (const sp of ['left', 'center_left', 'center', 'center_right', 'right']) {
      expect(counts[sp]).toBeGreaterThanOrEqual(5); // no thin camp → no structural blindspot
    }
  });

  it('no duplicate domains', () => {
    const domains = SOURCE_RATINGS.map(r => r.source_domain.toLowerCase());
    expect(new Set(domains).size).toBe(domains.length);
  });

  it('every row is well-formed on all three axes + carries provenance', () => {
    const SPECTRA = ['left', 'center_left', 'center', 'center_right', 'right'];
    const TIERS = ['flagship', 'standard', 'niche'];
    const FACTUAL = ['high', 'mixed', 'low'];
    for (const r of SOURCE_RATINGS) {
      expect(SPECTRA).toContain(r.spectrum);
      expect(TIERS).toContain(r.tier);
      expect(FACTUAL).toContain(r.factual_rating);
      expect(r.rating_source).toBeTruthy();          // provenance never blank
      expect(r.notes).toBeTruthy();                  // human-readable rationale
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
      expect(r.reach_weight).toBeGreaterThan(0);
    }
  });

  it('every rated outlet has an ownership entry (concentration lens stays complete)', () => {
    for (const r of SOURCE_RATINGS) {
      expect(SOURCE_OWNERS[r.source_domain], `owner missing for ${r.source_domain}`).toBeTruthy();
    }
  });

  it('extremist outlets are classed low-factual with a citable basis', () => {
    const map = buildRatingsMap();
    for (const d of ['compact-online.de', 'sezession.de', 'pi-news.net']) {
      expect(map[d].factual_rating).toBe('low');
      expect(map[d].rating_source).toMatch(/Verfassungsschutz|NewsGuard|ISD/);
    }
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

describe('lead-silence (per-camp leading voice — works even where flagship-silence cannot)', () => {
  const articlesFrom = (domains) => ({ articles: domains.map((d, i) => ({ id: i, source_domain: d })) });

  it('left has NO mass flagship, so flagship-silence never fires — but lead-silence can', () => {
    // left covered only by a tiny outlet; its lead voices (taz, Junge Welt) stayed silent
    const r = verifyBlindspots({ left: articlesFrom(['jacobin.de']) }, []);
    expect(r.perSpectrum.left.status).toBe('covered');
    expect(r.perSpectrum.left.flagshipSilent).toBe(false);   // no flagship exists for left
    expect(r.flagshipSilences).not.toContain('left');
    expect(r.perSpectrum.left.leadSilent).toBe(true);        // lead voices silent → fires
    expect(r.leadSilences).toContain('left');
  });

  it('lead-silence clears when a leading voice of the camp published', () => {
    const r = verifyBlindspots({ left: articlesFrom(['taz.de', 'jacobin.de']) }, []); // taz is a lead voice
    expect(r.perSpectrum.left.leadPublished).toBe(true);
    expect(r.perSpectrum.left.leadSilent).toBe(false);
    expect(r.leadSilences).not.toContain('left');
  });

  it('no lead-silence when the camp is fully silent (nothing to lead)', () => {
    const r = verifyBlindspots({ left: { articles: [] } }, []);
    expect(r.leadSilences).not.toContain('left');
  });

  // ── M5.1 leadOnly (kills the center tautology) ──────────────────────────────
  it('leadOnlySilent fires for left (no flagship) but NOT for a camp where it is just flagship-silence', () => {
    // left: only a tiny outlet wrote → lead-silent, and left has no flagship → leadOnly
    const left = verifyBlindspots({ left: articlesFrom(['jacobin.de']) }, []);
    expect(left.perSpectrum.left.leadOnlySilent).toBe(true);
    expect(left.leadOnlySilences).toContain('left');

    // center_right: only Cicero (niche) wrote → both flagship_silent AND lead_silent;
    // leadOnly must be FALSE (already captured by flagship-silence — no duplicate signal)
    const cr = verifyBlindspots({ center_right: articlesFrom(['cicero.de']) }, []);
    expect(cr.perSpectrum.center_right.flagshipSilent).toBe(true);
    expect(cr.perSpectrum.center_right.leadSilent).toBe(true);
    expect(cr.perSpectrum.center_right.leadOnlySilent).toBe(false);
    expect(cr.leadOnlySilences).not.toContain('center_right');
  });

  // ── M5.2 granularity: which lead voices were silent ─────────────────────────
  it('exposes leadDomainsMissing/present instead of hiding a silent lead behind the OR', () => {
    // JW wrote, taz did not → leadPublished true (OR), but taz must show as missing
    const r = verifyBlindspots({ left: articlesFrom(['jungewelt.de', 'jacobin.de']) }, []);
    expect(r.perSpectrum.left.leadPublished).toBe(true);
    expect(r.perSpectrum.left.leadDomainsPresent).toContain('jungewelt.de');
    expect(r.perSpectrum.left.leadDomainsMissing).toContain('taz.de'); // the OR-hidden gap, now visible
  });

  // ── M5.3 lead-level feed health: a down lead feed ≠ editorial silence ────────
  it('does NOT accuse lead-silence when a lead outlet feed is down (uncertain instead)', () => {
    // left covered only by jacobin; taz (a lead) feed is DOWN → taz could not publish
    const down = [{ spectrum: 'left', source_name: 'taz', feed_url: 'https://taz.de/rss', status: 'down', consecutive_failures: 5 }];
    const r = verifyBlindspots({ left: articlesFrom(['jacobin.de']) }, down);
    expect(r.perSpectrum.left.leadSilent).toBe(false);          // not blamed
    expect(r.perSpectrum.left.leadSilentUncertain).toBe(true);  // flagged uncertain
    expect(r.leadSilences).not.toContain('left');
  });
});
