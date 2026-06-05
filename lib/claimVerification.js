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
 * Verify claims against the corpus.
 *
 * @param {Array<{text,kind}>} claims
 * @param {Array} articles — flattened corpus articles
 * @param {object} opts — {
 *   threshold = SUPPORT_THRESHOLD,
 *   entailmentFn?: async (claim, evidenceText) => 'entailment'|'contradiction'|'neutral',
 * }
 * @returns {Promise<{results, report}>}
 */
export async function verifyClaims(claims, articles, opts = {}) {
  const threshold = opts.threshold ?? SUPPORT_THRESHOLD;
  const list = Array.isArray(claims) ? claims : [];
  const arts = Array.isArray(articles) ? articles : [];
  const results = [];

  for (const claim of list) {
    const ev = bestEvidence(claim.text, arts);
    const score = ev ? ev.score : 0;
    let label = score >= threshold ? 'supported' : 'unsupported';
    let entail = null;

    // Optional semantic upgrade — only run when we have a lexical candidate, to
    // avoid spending an LLM call on a claim with no evidence at all.
    if (typeof opts.entailmentFn === 'function' && ev && score >= threshold) {
      try {
        entail = await opts.entailmentFn(claim.text, articleText(ev.art));
        if (entail === 'contradiction') label = 'contradiction';
        else if (entail === 'entailment') label = 'entailment';
        else if (entail === 'neutral') label = 'unsupported';
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
      evidence: ev && score >= threshold
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

  return {
    results,
    report: {
      total: results.length,
      supported,
      contradicted,
      unsupported: results.length - supported - contradicted,
      supportRatio: results.length > 0 ? Number((supported / results.length).toFixed(3)) : 1,
      hasContradiction: contradicted > 0,
    },
  };
}
