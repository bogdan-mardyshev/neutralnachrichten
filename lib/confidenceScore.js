/**
 * lib/confidenceScore.js — the "serve" layer: turn all verification signals into a
 * single, honest confidence score + a reach-weighted coverage distribution.
 *
 * This is where Steps 5-8 pay off. Instead of presenting an analysis as equally
 * trustworthy regardless of how well-sourced it is, we publish a confidence the
 * user can see and we can defend:
 *
 *   confidence = weighted blend of
 *     • spectrum breadth  (how many of the 5 camps are actually covered)   30%
 *     • citation grounding(share of emitted articles matched to corpus)    25%
 *     • claim support     (share of claims entailed by sources, NLI)       25%
 *     • volume            (source count vs a target floor)                 20%
 *   × hard contradiction penalty (a source-contradicted claim is serious)
 *
 * Weights mirror the reliability model: breadth + grounding dominate because a
 * one-sided or ungrounded analysis is the failure mode we most need to flag.
 *
 * Pure module — every input is a plain number/object from the verification steps.
 */

import { CORPUS_SPECTRUMS } from './corpusQueries.js';
import { buildRatingsMap, SOURCE_RATINGS } from './sourceRatingsSeed.js';

// Recalibrated (audit A1). The original blend saturated to 100 on virtually
// every corpus analysis because grounding is near-circular (Gemini copies titles
// from our own prompt → ~always 1.0) and volume topped out at just 8 sources.
// New blend: claim support (the only signal that checks MEANING against sources)
// carries the most weight; grounding is demoted to a sanity check.
export const CONFIDENCE_WEIGHTS = {
  spectrumBreadth: 0.25,
  grounding:       0.15,
  claimSupport:    0.35,
  volume:          0.25,
};

// Source count at which the "volume" factor saturates to 1.0.
export const VOLUME_TARGET = 14;

// Factor used when a signal was NOT measured (e.g. no claims extracted).
// Unmeasured must not score as perfect — that was a key inflation bug.
export const UNMEASURED_FACTOR = 0.85;
// Multiplier applied when at least one claim is contradicted by its source.
export const CONTRADICTION_PENALTY = 0.6;

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/**
 * @param {object} signals — {
 *   coveredSpectra: number,        // 0..5 (from blindspot verification)
 *   groundingRatio: number,        // 0..1 (citationGrounding report)
 *   claimSupportRatio: number,     // 0..1 (claimVerification report)
 *   hasContradiction: boolean,
 *   sourceCount: number,
 * }
 * @returns {{ score, band, factors, penaltyApplied }}
 */
export function computeConfidence(signals = {}) {
  const breadth = clamp01((Number(signals.coveredSpectra) || 0) / CORPUS_SPECTRUMS.length);
  const grounding = clamp01(signals.groundingRatio ?? UNMEASURED_FACTOR);
  const claimSupport = clamp01(signals.claimSupportRatio ?? UNMEASURED_FACTOR);
  const volume = clamp01((Number(signals.sourceCount) || 0) / VOLUME_TARGET);

  const w = CONFIDENCE_WEIGHTS;
  let composite =
    breadth * w.spectrumBreadth +
    grounding * w.grounding +
    claimSupport * w.claimSupport +
    volume * w.volume;

  const penaltyApplied = !!signals.hasContradiction;
  if (penaltyApplied) composite *= CONTRADICTION_PENALTY;

  const score = Math.round(clamp01(composite) * 100);
  const band = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';

  return {
    score,
    band,
    penaltyApplied,
    factors: {
      spectrumBreadth: Number(breadth.toFixed(3)),
      grounding: Number(grounding.toFixed(3)),
      claimSupport: Number(claimSupport.toFixed(3)),
      volume: Number(volume.toFixed(3)),
    },
  };
}

/**
 * Reach-weighted coverage distribution. Instead of "5 articles left = 5 articles
 * right", each spectrum's weight is the sum of its DISTINCT sources' reach_weight,
 * so mass-market and niche outlets don't count equally. Returns percentages that
 * sum to 100 (0 for every spectrum when there is no coverage).
 *
 * @param {object} corpusSpectra — { left:{articles:[...]}, ... }
 * @param {object} opts — { ratingsMap? } (defaults to the seeded ratings)
 * @returns {object} { left:{percent,weight,sources}, ... }
 */
export function normalizeReachWeightedCoverage(corpusSpectra = {}, opts = {}) {
  const ratingsMap = opts.ratingsMap || buildRatingsMap(SOURCE_RATINGS);
  const raw = {};
  let totalWeight = 0;

  for (const sp of CORPUS_SPECTRUMS) {
    const articles = corpusSpectra?.[sp]?.articles || [];
    const seen = new Set();
    let weight = 0;
    for (const a of articles) {
      const domain = String(a.source_domain || '').toLowerCase().replace(/^www\./, '');
      if (!domain || seen.has(domain)) continue;
      seen.add(domain);
      const rating = ratingsMap[domain];
      weight += rating ? Number(rating.reach_weight) || 1 : 1; // unknown source → neutral weight 1
    }
    raw[sp] = { weight, sources: seen.size };
    totalWeight += weight;
  }

  const out = {};
  for (const sp of CORPUS_SPECTRUMS) {
    out[sp] = {
      percent: totalWeight > 0 ? Math.round((raw[sp].weight / totalWeight) * 100) : 0,
      weight: Number(raw[sp].weight.toFixed(2)),
      sources: raw[sp].sources,
    };
  }
  return out;
}

/**
 * Assemble the full reliability envelope served alongside an analysis.
 * Combines the four verification reports into the confidence score + coverage.
 */
export function buildReliabilityEnvelope({ corpusSpectra, grounding, claimVerification, blindspot } = {}) {
  const coveredSpectra = blindspot?.coveredSpectra?.length ?? 0;
  const sourceCount = CORPUS_SPECTRUMS.reduce(
    (n, sp) => n + (corpusSpectra?.[sp]?.articles?.length || 0), 0
  );

  const confidence = computeConfidence({
    coveredSpectra,
    groundingRatio: grounding?.groundingRatio,
    claimSupportRatio: claimVerification?.supportRatio,
    hasContradiction: claimVerification?.hasContradiction,
    sourceCount,
  });

  return {
    confidence,
    coverage: normalizeReachWeightedCoverage(corpusSpectra),
    grounding: grounding || null,
    claims: claimVerification || null,
    blindspots: blindspot
      ? {
          verifiedSilences: blindspot.verifiedSilences,
          flagshipSilences: blindspot.flagshipSilences || [],
          unverifiable: blindspot.unverifiable,
        }
      : null,
    sourceCount,
  };
}
