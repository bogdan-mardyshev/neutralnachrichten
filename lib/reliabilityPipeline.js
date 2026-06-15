/**
 * lib/reliabilityPipeline.js — the ONE place the post-analysis reliability layer
 * is composed. Previously this lived inline in server.js (untestable) AND was
 * duplicated by an orphaned corpusAnalysisPipeline.js (drift risk). This module
 * is the single source of truth; server.js is a thin transport wrapper.
 *
 * Pipeline (corpus path only — no-op for live-RSS):
 *   citation grounding (real URLs) → dedupe → verified blindspots (feed_health)
 *   → NLI claim verification (batched, meaning-based) → reach-weighted confidence
 *   envelope → coverage-window honesty badge → sub-story clusters.
 *
 * Pure analysis steps are imported directly; everything side-effectful (DB reads,
 * the Gemini NLI call, budget accounting, persistence, metrics) is INJECTED via
 * `deps`, so the whole composition is unit-testable with fakes.
 */

import { groundAnalysis, dedupeArticles } from './citationGrounding.js';
import { verifyBlindspots } from './blindspotVerification.js';
import { extractClaims, verifyClaims } from './claimVerification.js';
import { flattenSpectra } from './deepAnalysisEnrich.js';
import { buildReliabilityEnvelope } from './confidenceScore.js';
import { clusterArticles } from './storyClustering.js';
import { CORPUS_SPECTRUMS } from './corpusQueries.js';

const MAX_CLAIMS_PER_ANALYSIS = 8; // bound the NLI work per request

/** Extract a clean source domain from a citation URL (fallback to source_name). */
function domainOf(url, fallback) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return fallback || 'unknown'; }
}

/**
 * Compose the reliability envelope for a corpus-sourced analysis.
 *
 * @param {object} analysis — Gemini analysis (news_spectrum, overall_…)
 * @param {object} rssData   — corpusToSpectra result; must have search_meta.source==='corpus'
 * @param {object} deps — {
 *   getDownFeeds:    () => Promise<rows>,          // feed_health (optional)
 *   batchEntailmentFn?: (pairs) => Promise<labels|null>,  // Gemini NLI (optional)
 *   budgetOk?:       () => boolean,                // Gemini daily budget gate
 *   budgetSpend?:    () => void,
 *   recordEntailmentCall?: () => void,             // metrics
 *   onNli?:          (rows) => void,               // persist NLI verdicts (fire-and-forget)
 *   log?:            (msg) => void,
 *   coverageWindow?: { days, outlets },
 * }
 * @returns {Promise<{ analysis, reliability }>}  reliability is null for non-corpus input.
 */
export async function composeReliability(analysis, rssData, deps = {}) {
  if (!analysis || rssData?.search_meta?.source !== 'corpus') {
    return { analysis, reliability: null };
  }
  const log = deps.log || (() => {});
  const spectra = rssData.spectra || {};

  // 1) Citation grounding — attach real corpus URLs by url/title match.
  const { analysis: grounded, report: grounding } = groundAnalysis(analysis, spectra);

  // Mark grounded cards as real links + dedupe twins per spectrum.
  for (const sp of CORPUS_SPECTRUMS) {
    for (const art of (grounded.news_spectrum?.[sp] || [])) {
      if (art._grounded && art.article_url) art.url_is_search_fallback = false;
    }
    if (Array.isArray(grounded.news_spectrum?.[sp])) {
      grounded.news_spectrum[sp] = dedupeArticles(grounded.news_spectrum[sp]);
    }
  }

  // 2) Verified blindspots via feed_health.
  let downFeeds = [];
  if (typeof deps.getDownFeeds === 'function') {
    try { downFeeds = await deps.getDownFeeds(); } catch (e) { log(`getDownFeeds failed: ${e.message}`); }
  }
  const blindspot = verifyBlindspots(spectra, downFeeds);

  // 3) NLI claim verification (batched, meaning-based). Only feeds confidence
  //    when NLI actually ran (lexical-only on abstract text is near-noise).
  const flatArts = flattenSpectra(spectra);
  let claimReport = null;
  try {
    const claims = extractClaims(grounded).slice(0, MAX_CLAIMS_PER_ANALYSIS);
    if (claims.length && flatArts.length) {
      const canEntail = typeof deps.batchEntailmentFn === 'function' && (!deps.budgetOk || deps.budgetOk());
      if (canEntail) { deps.recordEntailmentCall?.(); deps.budgetSpend?.(); }
      const { results, report } = await verifyClaims(claims, flatArts, {
        batchEntailmentFn: canEntail ? deps.batchEntailmentFn : undefined,
      });
      claimReport = report.method === 'nli' ? report : null;
      log(`[NLI] method=${report.method} claims=${report.total} supported=${report.supported} contradicted=${report.contradicted}`);

      // Attribute each verdict to its evidence outlet (measured factuality, B5).
      if (typeof deps.onNli === 'function') {
        const rows = results.filter(r => r.evidence?.url).map(r => ({
          source_domain: domainOf(r.evidence.url, r.evidence.source_name),
          label: r.label,
          topic_norm: (analysis?.analysis_topic || '').toLowerCase().slice(0, 200) || null,
        }));
        if (rows.length) deps.onNli(rows);
      }
    }
  } catch (e) { log(`[NLI] skipped: ${e.message}`); }

  // 4) Confidence + reach-weighted coverage envelope.
  const reliability = buildReliabilityEnvelope({ corpusSpectra: spectra, grounding, claimVerification: claimReport, blindspot });

  // 5) Coverage-window honesty badge.
  reliability.coverageWindow = deps.coverageWindow || { days: 14, outlets: CORPUS_SPECTRUMS.length };

  // 6) Sub-story clusters (+ solo-camp sub-blindspots).
  try {
    const { clusters, meta } = clusterArticles(flatArts);
    reliability.clusters = clusters;
    reliability.clusterMeta = meta;
    if (meta.soloCamps?.length) log(`[Clusters] ${meta.clusterCount} sub-stories, solo: ${meta.soloCamps.map(s => `${s.camp}:${s.label}`).join(' | ')}`);
  } catch (e) { log(`[Clusters] skipped: ${e.message}`); }

  return { analysis: grounded, reliability };
}
