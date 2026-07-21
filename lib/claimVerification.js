/**
 * lib/claimVerification.js — NLI-style verification of analysis claims against the
 * source corpus. The anti-hallucination layer: a claim the model asserts must be
 * traceable to retrieved article text, or it is flagged.
 *
 * TWO LAYERS:
 *   1. Lexical support (always on, pure, cheap): how much of a claim's significant
 *      vocabulary is covered by the best-matching corpus article (title + summary).
 *      A claim with near-zero coverage has no source behind it → "unsupported".
 *   2. Optional entailment (injected entailmentFn, e.g. a Gemini call): upgrades a
 *      lexically-supported claim to entailment / contradiction / neutral. This
 *      catches the subtle case where the words overlap but the MEANING is negated
 *      ("X resigned" vs "X refused to resign"). Kept injectable so the module stays
 *      pure + unit-testable and the LLM pass is opt-in (cost control).
 *
 * Labels mirror NLI: 'supported'/'entailment' (good), 'contradiction' (bad —
 * the source says the opposite), 'unsupported'/'neutral' (no evidence).
 */

import { splitSentences } from './deriveArticle.js';
import { CORPUS_SPECTRUMS } from './corpusQueries.js';

export const SUPPORT_THRESHOLD = 0.3; // fraction of claim vocab that must be covered

/** Significant tokens: lowercased words ≥4 chars. */
export function textTokens(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/)
    .filter(w => w.length >= 4);
}

/** Coverage = |claim∩article| / |claim| — how much of the claim the article backs. */
export function coverageScore(claim, articleText) {
  const c = new Set(textTokens(claim));
  if (c.size === 0) return 0;
  const a = new Set(textTokens(articleText));
  let shared = 0;
  for (const w of c) if (a.has(w)) shared++;
  return shared / c.size;
}

/** Full searchable text for an article (title + derived summary). */
function articleText(art) {
  return `${art.article_title || art.title || ''} ${art.our_summary || art.content_text || art.description || ''}`;
}

/** Flatten corpus spectra into a single article list. */
export function flattenCorpus(corpusSpectra) {
  const out = [];
  for (const sp of CORPUS_SPECTRUMS) {
    for (const a of corpusSpectra?.[sp]?.articles || []) out.push(a);
  }
  return out;
}

/**
 * Pull verifiable claims out of the analysis objects.
 * - overall_non_partisan_analysis → its sentences
 * - deepAnalysis.shared_facts[].claim (highest hallucination risk)
 */
export function extractClaims(analysis = {}, deepAnalysis = null) {
  const claims = [];
  const overall = analysis.overall_non_partisan_analysis;
  if (typeof overall === 'string') {
    for (const s of splitSentences(overall)) {
      if (textTokens(s).length >= 3) claims.push({ text: s, kind: 'overall' });
    }
  }
  if (deepAnalysis && Array.isArray(deepAnalysis.shared_facts)) {
    for (const f of deepAnalysis.shared_facts) {
      const t = f?.claim;
      if (typeof t === 'string' && textTokens(t).length >= 3) {
        claims.push({ text: t, kind: 'shared_fact' });
      }
    }
  }
  return claims;
}

/** Find the best-supporting article for a claim (highest coverage). */
export function bestEvidence(claimText, articles) {
  let best = null;
  for (const art of articles) {
    const score = coverageScore(claimText, articleText(art));
    if (!best || score > best.score) best = { art, score };
  }
  return best;
}

/**
 * Top-K supporting articles for a claim, best coverage first.
 * Synthesis sentences are ABSTRACTIVE — they compress facts from several articles,
 * so no single article entails them and NLI returns 'neutral' (→ 0% support, the
 * "confidence stuck at 65" bug). Judging the claim against the UNION of the few
 * most relevant articles lets the entailment actually land.
 */
export function topEvidence(claimText, articles, k = 3) {
  return (Array.isArray(articles) ? articles : [])
    .map(art => ({ art, score: coverageScore(claimText, articleText(art)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, k));
}

/** ~300-char snippet of an article for compact NLI evidence bundling. */
function evidenceSnippet(art) {
  return articleText(art).replace(/\s+/g, ' ').trim().slice(0, 300);
}

/**
 * Verify claims against the corpus.
 *
 * @param {Array<{text,kind}>} claims
 * @param {Array} articles — flattened corpus articles
 * @param {object} opts — {
 *   threshold = SUPPORT_THRESHOLD,
 *   entailmentFn?: async (claim, evidenceText) => 'entailment'|'contradiction'|'neutral',
 *   batchEntailmentFn?: async (pairs:[{claim,evidence}]) => labels[]|null,
 *     // ONE model call for all lexically-supported claims (cost: 1 req/analysis).
 *     // null result → keep lexical labels (degrade, never block).
 * }
 * @returns {Promise<{results, report}>}
 */
export async function verifyClaims(claims, articles, opts = {}) {
  const threshold = opts.threshold ?? SUPPORT_THRESHOLD;
  const list = Array.isArray(claims) ? claims : [];
  const arts = Array.isArray(articles) ? articles : [];
  const results = [];

  // Batched NLI: judge EVERY claim that has any candidate evidence in ONE call.
  // The lexical threshold is only a fallback gate for the per-claim path — the
  // batch judge decides by MEANING, so gating it on vocab overlap would defeat
  // the point (abstract synthesis sentences rarely share 30% vocab with a single
  // article, which previously made statement-coverage always 0 → confidence stuck).
  let batchLabels = null;       // index in batch → label
  let batchIndexByClaim = null; // claim list index → batch index
  if (typeof opts.batchEntailmentFn === 'function') {
    const pairs = [];
    batchIndexByClaim = new Map();
    list.forEach((claim, i) => {
      const top = topEvidence(claim.text, arts, opts.evidenceK ?? 3);
      if (top.length) {
        batchIndexByClaim.set(i, pairs.length);
        // Bundle the top-K articles so an abstractive claim can be entailed by the
        // UNION of its sources, not just the single best lexical match.
        pairs.push({ claim: claim.text, evidence: top.map(t => evidenceSnippet(t.art)).join(' ⋮ ') });
      }
    });
    if (pairs.length) {
      try { batchLabels = await opts.batchEntailmentFn(pairs); }
      catch { batchLabels = null; }
    }
  }

  for (let i = 0; i < list.length; i++) {
    const claim = list[i];
    const ev = bestEvidence(claim.text, arts);
    const score = ev ? ev.score : 0;
    let label = score >= threshold ? 'supported' : 'unsupported';
    let entail = null;

    // NLI verdicts. CRUCIAL: 'neutral' means "the evidence neither supports nor
    // contradicts this claim" — that is UNMEASURED, not a failure. Counting it as
    // 'unsupported' dragged supportRatio (and confidence) to 0 on well-sourced
    // analyses whose sentences are abstractive. We label it 'neutral' and exclude
    // it from the support ratio's denominator below.
    if (batchLabels && batchIndexByClaim?.has(i)) {
      entail = batchLabels[batchIndexByClaim.get(i)] ?? null;
      if (entail === 'contradiction') label = 'contradiction';
      else if (entail === 'entailment') label = 'entailment';
      else if (entail === 'neutral') label = 'neutral';
    }
    // Per-claim fallback (legacy injectable)
    else if (typeof opts.entailmentFn === 'function' && ev && score >= threshold) {
      try {
        entail = await opts.entailmentFn(claim.text, articleText(ev.art));
        if (entail === 'contradiction') label = 'contradiction';
        else if (entail === 'entailment') label = 'entailment';
        else if (entail === 'neutral') label = 'neutral';
      } catch {
        /* keep lexical label on entailment failure */
      }
    }

    results.push({
      claim: claim.text,
      kind: claim.kind,
      label,
      score: Number(score.toFixed(3)),
      entailment: entail,
      // Attach the evidence article when it lexically qualifies OR the batch judge
      // ruled on it (entailment/contradiction) — both mean we have a real source.
      evidence: ev && (score >= threshold || entail === 'entailment' || entail === 'contradiction')
        ? {
            corpus_id: ev.art._corpusId ?? ev.art.id ?? null,
            url: ev.art.article_url || ev.art.url || '',
            source_name: ev.art.source_name || '',
            title: ev.art.article_title || ev.art.title || '',
          }
        : null,
    });
  }

  const supported = results.filter(r => r.label === 'supported' || r.label === 'entailment').length;
  const contradicted = results.filter(r => r.label === 'contradiction').length;
  const neutral = results.filter(r => r.label === 'neutral').length;
  const unsupported = results.filter(r => r.label === 'unsupported').length;
  // Support ratio is over ASSESSED claims only — NLI-neutral claims are unmeasured
  // and excluded from the denominator. supportRatio is null when claims exist but
  // none could be assessed (all neutral) → the caller treats it as unmeasured
  // (UNMEASURED_FACTOR) instead of pinning confidence to 0.
  const assessed = supported + contradicted + unsupported;
  let supportRatio;
  if (results.length === 0) supportRatio = 1;          // nothing to verify → trivially fine
  else if (assessed > 0) supportRatio = Number((supported / assessed).toFixed(3));
  else supportRatio = null;                            // claims exist but all neutral → unmeasured

  return {
    results,
    report: {
      total: results.length,
      supported,
      contradicted,
      neutral,
      unsupported,
      assessed,
      supportRatio,
      hasContradiction: contradicted > 0,
      // 'nli' when the batch judge actually returned verdicts; 'lexical' when we
      // could only word-match. Callers use this to decide whether supportRatio is
      // a trustworthy confidence input (lexical-only on abstract text ≈ noise).
      method: batchLabels ? 'nli' : 'lexical',
    },
  };
}
