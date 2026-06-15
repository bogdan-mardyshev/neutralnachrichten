/**
 * lib/biasProfile.js — turn a reader's media-spectrum percentages into an
 * actionable bias profile (audit C7 — deeper than Ground News' "My Bias").
 *
 * Input: { left, center_left, center, center_right, right } percentages (0-100,
 * roughly summing to 100) from getUserMediaSpectrum. Output: overall lean, a
 * balance score, the camps the reader rarely sees (blind spots), and concrete
 * counter-source recommendations drawn from those camps' high-factual outlets.
 *
 * Pure: no IO. The recommendations pull from SOURCE_RATINGS so they stay in sync
 * with the classified outlet set.
 */

import { CORPUS_SPECTRUMS } from './corpusQueries.js';
import { SOURCE_RATINGS } from './sourceRatingsSeed.js';

// Numeric position per camp for the weighted lean (-2 … +2).
const POS = { left: -2, center_left: -1, center: 0, center_right: 1, right: 2 };
export const BLINDSPOT_THRESHOLD = 10; // <10% of reading → a blind spot
export const OVERWEIGHT_THRESHOLD = 45;

/** Pick up to `n` recommendable outlets for a camp: high/mixed factual, by reach. */
export function recommendedOutletsFor(spectrum, n = 2) {
  return SOURCE_RATINGS
    .filter(r => r.spectrum === spectrum && r.factual_rating !== 'low')
    .sort((a, b) => (b.reach_weight || 0) - (a.reach_weight || 0))
    .slice(0, n)
    .map(r => r.source_name);
}

/**
 * @param {object} spectrum — { left, center_left, center, center_right, right, total_searches? }
 * @returns {null | { lean, leanScore, balanceScore, dominant, blindCamps, overweightCamps, recommendations }}
 */
export function analyzeBiasProfile(spectrum) {
  if (!spectrum) return null;
  const pct = {};
  let sum = 0;
  for (const sp of CORPUS_SPECTRUMS) { pct[sp] = Math.max(0, Number(spectrum[sp]) || 0); sum += pct[sp]; }
  if (sum <= 0) return null;
  // normalize to true percentages
  for (const sp of CORPUS_SPECTRUMS) pct[sp] = (pct[sp] / sum) * 100;

  // weighted lean (-2..+2) → label
  const leanScore = CORPUS_SPECTRUMS.reduce((acc, sp) => acc + (pct[sp] / 100) * POS[sp], 0);
  const lean = leanScore <= -1.2 ? 'left'
    : leanScore < -0.35 ? 'center_left'
    : leanScore <= 0.35 ? 'center'
    : leanScore < 1.2 ? 'center_right'
    : 'right';

  // balance: 100 = perfectly even across 5 camps; falls as reading concentrates.
  // Use total variation distance from the uniform 20%-each distribution.
  const tvd = CORPUS_SPECTRUMS.reduce((acc, sp) => acc + Math.abs(pct[sp] - 20), 0) / 2; // 0..80
  const balanceScore = Math.round(Math.max(0, 100 - (tvd / 80) * 100));

  const dominant = CORPUS_SPECTRUMS.reduce((a, b) => (pct[b] > pct[a] ? b : a));
  const blindCamps = CORPUS_SPECTRUMS.filter(sp => pct[sp] < BLINDSPOT_THRESHOLD);
  const overweightCamps = CORPUS_SPECTRUMS.filter(sp => pct[sp] >= OVERWEIGHT_THRESHOLD);

  // recommend counter-sources from the most-neglected camps first
  const recommendations = [...blindCamps]
    .sort((a, b) => pct[a] - pct[b])
    .map(sp => ({ spectrum: sp, outlets: recommendedOutletsFor(sp) }))
    .filter(r => r.outlets.length > 0);

  return {
    lean,
    leanScore: Number(leanScore.toFixed(2)),
    balanceScore,
    dominant,
    percentages: Object.fromEntries(CORPUS_SPECTRUMS.map(sp => [sp, Math.round(pct[sp])])),
    blindCamps,
    overweightCamps,
    recommendations,
    totalSearches: Number(spectrum.total_searches) || null,
  };
}
