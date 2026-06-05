import { describe, it, expect } from 'vitest';
import {
  classifySilence,
  verifyBlindspots,
  annotateSilencedTopics,
  totalFeedsForSpectrum,
} from '../lib/blindspotVerification.js';

describe('totalFeedsForSpectrum', () => {
  it('reflects the configured RSS_FEEDS counts', () => {
    expect(totalFeedsForSpectrum('left')).toBe(5);
    expect(totalFeedsForSpectrum('center_left')).toBe(8);
    expect(totalFeedsForSpectrum('center')).toBe(5);
    expect(totalFeedsForSpectrum('center_right')).toBe(8);
    expect(totalFeedsForSpectrum('right')).toBe(7);
    expect(totalFeedsForSpectrum('nonexistent')).toBe(0);
  });
});

describe('classifySilence', () => {
  it('covered when there are articles', () => {
    expect(classifySilence(3, 0, 3).status).toBe('covered');
    // even with a down feed, articles present → covered
    expect(classifySilence(2, 1, 3).status).toBe('covered');
  });

  it('silent ONLY when zero articles and all feeds healthy', () => {
    const c = classifySilence(0, 0, 3);
    expect(c.status).toBe('silent');
    expect(c.confidence).toBe(1);
  });

  it('unknown when zero articles and at least one feed down', () => {
    const c = classifySilence(0, 1, 3);
    expect(c.status).toBe('unknown');
    expect(c.confidence).toBeCloseTo(2 / 3, 2);
    expect(c.healthyFeeds).toBe(2);
  });

  it('unknown with confidence 0 when all feeds down', () => {
    const c = classifySilence(0, 3, 3);
    expect(c.status).toBe('unknown');
    expect(c.confidence).toBe(0);
  });
});

describe('verifyBlindspots', () => {
  const spectra = (counts) => {
    const out = {};
    for (const [sp, n] of Object.entries(counts)) {
      out[sp] = { articles: Array.from({ length: n }, (_, i) => ({ id: i })) };
    }
    return out;
  };

  it('separates covered, verified silence, and unverifiable', () => {
    const corpus = spectra({ left: 2, center: 0, right: 0 });
    // right has a broken feed; center has none
    const downFeeds = [{ spectrum: 'right', source_name: 'Bild', status: 'down', consecutive_failures: 5 }];
    const r = verifyBlindspots(corpus, downFeeds);

    expect(r.coveredSpectra).toContain('left');
    expect(r.verifiedSilences).toContain('center'); // 0 articles, all feeds healthy
    expect(r.unverifiable).toContain('right');       // 0 articles, feed down
    expect(r.verifiedSilences).not.toContain('right');
  });

  it('records broken feeds per spectrum', () => {
    const corpus = spectra({ right: 0 });
    const downFeeds = [{ spectrum: 'right', source_name: 'Bild', status: 'degraded', consecutive_failures: 2 }];
    const r = verifyBlindspots(corpus, downFeeds);
    expect(r.perSpectrum.right.brokenFeeds[0].source_name).toBe('Bild');
    expect(r.perSpectrum.right.status).toBe('unknown');
  });

  it('all spectra silent when corpus empty and all feeds healthy', () => {
    const r = verifyBlindspots(spectra({}), []);
    expect(r.verifiedSilences.sort()).toEqual(
      ['center', 'center_left', 'center_right', 'left', 'right']
    );
  });
});

describe('annotateSilencedTopics', () => {
  const report = {
    unverifiable: ['right'],
    verifiedSilences: ['center'],
  };

  it('marks topics pointing at an unverifiable spectrum as not verified', () => {
    const deep = { silenced_topics: [
      { topic: 'X', only_in: 'right', description: 'rechts schweigt' },
      { topic: 'Y', only_in: 'center', description: 'mitte schweigt' },
    ] };
    const out = annotateSilencedTopics(deep, report);
    expect(out.silenced_topics[0]._verified).toBe(false);
    expect(out.silenced_topics[0]._note).toMatch(/Nicht verifizierbar/);
    expect(out.silenced_topics[1]._verified).toBe(true);
  });

  it('keeps only_in:"none" as verified general silence', () => {
    const deep = { silenced_topics: [{ topic: 'Z', only_in: 'none', description: 'fehlt überall' }] };
    const out = annotateSilencedTopics(deep, report);
    expect(out.silenced_topics[0]._verified).toBe(true);
  });

  it('does not mutate input and tolerates missing silenced_topics', () => {
    const deep = { shared_facts: [] };
    expect(annotateSilencedTopics(deep, report)).toEqual({ shared_facts: [] });
  });
});
