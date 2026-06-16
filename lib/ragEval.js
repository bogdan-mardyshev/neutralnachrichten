/**
 * lib/ragEval.js — pure metrics for the offline RAG-evaluation harness.
 *
 * WHY this exists:
 *   "Reliability" is only a claim until it's measured. This module turns the two
 *   things that decide whether an analysis can be trusted into NUMBERS that can be
 *   tracked and regression-gated, with NO Gemini and NO database in the loop:
 *
 *     1. RETRIEVAL QUALITY — did we surface the right articles and drop off-topic
 *        filler?  precision@k / recall@k / MRR / nDCG@k against a golden labelled
 *        set. This is the direct, measurable guard against the "Tomahawk article
 *        under a football topic" class of bug.
 *
 *     2. FAITHFULNESS — is the synthesis actually backed by the retrieved corpus?
 *        grounding ratio (cards resolve to real rows) × claim support (sentences
 *        are lexically/NLI-entailed by evidence). A high score means low
 *        hallucination risk.
 *
 * Everything here is a pure function of (ranked ids, relevant ids) or
 * (grounding, claims) — deterministic, unit-testable, CI-gateable.
 */

/** Arithmetic mean; empty → 0. */
export function mean(xs) {
  const a = Array.isArray(xs) ? xs : [];
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
}

const toSet = (ids) => new Set((Array.isArray(ids) ? ids : []).map(String));

/** Fraction of the top-k retrieved that are relevant. Denominator is k (standard). */
export function precisionAtK(rankedIds, relevantIds, k) {
  if (!k || k <= 0) return 0;
  const rel = toSet(relevantIds);
  const top = (Array.isArray(rankedIds) ? rankedIds : []).slice(0, k).map(String);
  const hits = top.filter((id) => rel.has(id)).length;
  return hits / k;
}

/** Fraction of all relevant items found within the top-k. */
export function recallAtK(rankedIds, relevantIds, k) {
  const rel = toSet(relevantIds);
  if (rel.size === 0) return 1; // nothing to find → trivially complete
  const top = (Array.isArray(rankedIds) ? rankedIds : []).slice(0, k).map(String);
  const hits = top.filter((id) => rel.has(id)).length;
  return hits / rel.size;
}

/** Reciprocal of the rank (1-based) of the first relevant hit; 0 if none. → MRR. */
export function reciprocalRank(rankedIds, relevantIds) {
  const rel = toSet(relevantIds);
  const ranked = (Array.isArray(rankedIds) ? rankedIds : []).map(String);
  for (let i = 0; i < ranked.length; i++) {
    if (rel.has(ranked[i])) return 1 / (i + 1);
  }
  return 0;
}

/** Average Precision: mean of precision@hit over every relevant item retrieved. → MAP. */
export function averagePrecision(rankedIds, relevantIds) {
  const rel = toSet(relevantIds);
  if (rel.size === 0) return 1;
  const ranked = (Array.isArray(rankedIds) ? rankedIds : []).map(String);
  let hits = 0, sum = 0;
  for (let i = 0; i < ranked.length; i++) {
    if (rel.has(ranked[i])) { hits++; sum += hits / (i + 1); }
  }
  return hits ? sum / rel.size : 0;
}

/** nDCG@k with binary relevance gains (1 if relevant, else 0). */
export function ndcgAtK(rankedIds, relevantIds, k) {
  const rel = toSet(relevantIds);
  const ranked = (Array.isArray(rankedIds) ? rankedIds : []).slice(0, k).map(String);
  const dcg = ranked.reduce((acc, id, i) => acc + (rel.has(id) ? 1 / Math.log2(i + 2) : 0), 0);
  const ideal = Math.min(rel.size, k);
  let idcg = 0;
  for (let i = 0; i < ideal; i++) idcg += 1 / Math.log2(i + 2);
  return idcg > 0 ? dcg / idcg : (rel.size === 0 ? 1 : 0);
}

const round = (n) => Number(n.toFixed(3));

/**
 * Score one retrieval case against gold labels.
 * @param {Array} rankedIds — retrieved ids, best-first (post relevance-gate)
 * @param {Array} relevantIds — gold on-topic ids
 * @param {object} opts — { ks=[1,3,5] }
 * @returns flat metric map: { 'p@1', 'r@5', mrr, map, 'ndcg@5', ... }
 */
export function scoreRetrievalCase(rankedIds, relevantIds, { ks = [1, 3, 5] } = {}) {
  const n = (Array.isArray(rankedIds) ? rankedIds : []).length;
  const out = {
    // SET-precision over what actually survived the gate — "of what we show, how
    // much is on-topic". Unlike p@k it isn't capped below 1 when relevant<k, so
    // it's the honest measure of off-topic filler and the right gating metric.
    precision: round(n ? precisionAtK(rankedIds, relevantIds, n) : 1),
    mrr: round(reciprocalRank(rankedIds, relevantIds)),
    map: round(averagePrecision(rankedIds, relevantIds)),
  };
  for (const k of ks) {
    out[`p@${k}`] = round(precisionAtK(rankedIds, relevantIds, k));
    out[`r@${k}`] = round(recallAtK(rankedIds, relevantIds, k));
    out[`ndcg@${k}`] = round(ndcgAtK(rankedIds, relevantIds, k));
  }
  return out;
}

/**
 * Faithfulness of a synthesis: how strongly the corpus backs it.
 *   score = groundingRatio × (volume-aware) claimSupportRatio
 * Both inputs are already-computed reports from groundAnalysis / verifyClaims.
 * @returns { groundingRatio, claimSupport, contradictions, score }
 */
export function faithfulnessScore({ grounding, claims } = {}) {
  const groundingRatio = grounding && typeof grounding.groundingRatio === 'number' ? grounding.groundingRatio : 0;
  const claimSupport = claims && typeof claims.supportRatio === 'number' ? claims.supportRatio : 0;
  const contradictions = claims && typeof claims.contradicted === 'number' ? claims.contradicted : 0;
  // A contradiction is worse than a missing citation — penalise the product hard.
  const penalty = contradictions > 0 ? 0.5 : 1;
  return {
    groundingRatio: round(groundingRatio),
    claimSupport: round(claimSupport),
    contradictions,
    score: round(groundingRatio * claimSupport * penalty),
  };
}

/** Aggregate per-case metric maps into a mean over all numeric keys. */
export function aggregate(perCaseMetrics) {
  const cases = Array.isArray(perCaseMetrics) ? perCaseMetrics : [];
  if (!cases.length) return {};
  const keys = new Set();
  for (const c of cases) for (const k of Object.keys(c)) if (typeof c[k] === 'number') keys.add(k);
  const agg = {};
  for (const k of keys) agg[k] = round(mean(cases.map((c) => (typeof c[k] === 'number' ? c[k] : 0))));
  return agg;
}
