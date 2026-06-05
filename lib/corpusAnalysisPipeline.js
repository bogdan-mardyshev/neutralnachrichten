/**
 * lib/corpusAnalysisPipeline.js — the capstone that composes Steps 5-9 into one
 * corpus-backed analysis run.
 *
 *   retrieve (hybrid) → analyze (Gemini on corpus text) → ground (citations)
 *   → verify claims (NLI) → verify blindspots (feed_health) → reliability envelope
 *
 * Dependency-injected so the WHOLE chain is unit-testable with fakes — no DB, no
 * Gemini, no network. server.js wires the real implementations behind a flag and
 * falls back to the existing live-RSS path when the corpus is too thin.
 *
 * Returns either:
 *   { fellBack: true, reason, corpusCount }                 — caller uses live RSS
 *   { fellBack: false, analysis, deepAnalysis, reliability, claims, corpusSpectra }
 */

import { groundAnalysis } from './citationGrounding.js';
import { extractClaims, verifyClaims, flattenCorpus } from './claimVerification.js';
import { verifyBlindspots, annotateSilencedTopics } from './blindspotVerification.js';
import { buildReliabilityEnvelope } from './confidenceScore.js';

// Below this many corpus articles we don't trust a corpus-only analysis — fall back
// to the live-RSS path so the user never gets a thin, low-coverage result.
export const MIN_CORPUS_ARTICLES = 4;

/**
 * @param {string} topic
 * @param {string} lang
 * @param {object} deps — {
 *   retrieve(topic) => corpusSpectra,                       // corpusRetrieval
 *   analyze(topic, lang, corpusSpectra) => { analysis },    // Gemini on corpus
 *   deepAnalyze?(analysis) => deepAnalysis,                 // optional
 *   getDownFeeds?(spectra) => downFeeds,                    // db.getDownFeeds
 *   entailmentFn?,                                          // optional NLI upgrade
 * }
 * @param {object} opts — { minCorpusArticles?, retrieve opts pass-through }
 */
export async function runCorpusAnalysis(topic, lang, deps, opts = {}) {
  const minArticles = opts.minCorpusArticles ?? MIN_CORPUS_ARTICLES;

  // 1) Hybrid retrieval from the corpus.
  const corpusResult = await deps.retrieve(topic, opts);
  // retrieve returns the searchAllFeeds-style wrapper { spectra, total_articles, ... };
  // the verification helpers consume the inner spectra map directly. Accept either.
  const spectra = corpusResult?.spectra || corpusResult || {};
  const corpusCount = corpusResult?.total_articles
    ?? Object.values(spectra).reduce((n, s) => n + (s?.articles?.length || 0), 0);
  if (corpusCount < minArticles) {
    return { fellBack: true, reason: 'thin_corpus', corpusCount };
  }

  // 2) Analyze on the corpus text (Gemini grounded in our_summary).
  const analyzeRes = await deps.analyze(topic, lang, corpusResult);
  const baseAnalysis = analyzeRes?.analysis;
  if (!baseAnalysis) {
    return { fellBack: true, reason: 'analysis_failed', corpusCount };
  }

  // 3) Citation grounding — match emitted articles back to retrieved corpus rows.
  const { analysis, report: grounding } = groundAnalysis(baseAnalysis, spectra);

  // 4) Optional deep (comparative) analysis.
  let deepAnalysis = null;
  if (typeof deps.deepAnalyze === 'function') {
    try { deepAnalysis = await deps.deepAnalyze(analysis); } catch { deepAnalysis = null; }
  }

  // 5) NLI claim verification (overall sentences + shared_facts).
  const claims = extractClaims(analysis, deepAnalysis);
  const { results: claimResults, report: claimReport } = await verifyClaims(
    claims,
    flattenCorpus(spectra),
    { entailmentFn: deps.entailmentFn }
  );

  // 6) Verified blindspots via feed_health.
  let downFeeds = [];
  if (typeof deps.getDownFeeds === 'function') {
    try { downFeeds = await deps.getDownFeeds(); } catch { downFeeds = []; }
  }
  const blindspot = verifyBlindspots(spectra, downFeeds);
  if (deepAnalysis) deepAnalysis = annotateSilencedTopics(deepAnalysis, blindspot);

  // 7) Reliability envelope (confidence + reach-weighted coverage + reports).
  const reliability = buildReliabilityEnvelope({
    corpusSpectra: spectra,
    grounding,
    claimVerification: claimReport,
    blindspot,
  });

  return {
    fellBack: false,
    analysis,
    deepAnalysis,
    reliability,
    claims: claimResults,
    corpusSpectra: corpusResult,
    corpusCount,
  };
}
