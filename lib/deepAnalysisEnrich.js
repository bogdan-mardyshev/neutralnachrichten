/**
 * lib/deepAnalysisEnrich.js — make the deep (comparative) analysis DEFENSIBLE.
 *
 * Wave 1 of the DeepAnalysis upgrade: every conclusion the model emits is checked
 * against the corpus it was built from, the same reliability bar as the main
 * analysis. Pure module (no IO); the server flattens the corpus and calls it.
 *
 *  • shared_facts   → NLI-style verification (lexical support + optional entailment)
 *                     + a citation to the best-supporting article.
 *  • experts_cited  → kept only when the name actually appears in article text;
 *                     unverifiable names are split out (never silently trusted).
 *  • diverging_points → each camp's view gets a citation to that camp's lead article.
 */

import { verifyClaims, bestEvidence, textTokens } from './claimVerification.js';
import { CORPUS_SPECTRUMS } from './corpusQueries.js';

/** Flatten _rss.spectra ({left:[arts]}) OR {left:{articles:[]}} into one array. */
export function flattenSpectra(spectra) {
  const out = [];
  for (const sp of CORPUS_SPECTRUMS) {
    const v = spectra?.[sp];
    const arts = Array.isArray(v) ? v : (v?.articles || []);
    for (const a of arts) out.push({ ...a, spectrum: a.spectrum || sp });
  }
  return out;
}

/** Compact citation from an article (or null). */
function citationOf(art) {
  if (!art) return null;
  return {
    url: art.article_url || art.url || '',
    source_name: art.source_name || '',
    title: art.article_title || art.title || '',
  };
}

/** Does this expert/institution name actually appear in any article's text? */
export function expertAppears(name, articles) {
  const tokens = textTokens(name).filter(w => w.length >= 4);
  if (tokens.length === 0) return false;
  for (const a of articles) {
    const hay = `${a.article_title || ''} ${a.our_summary || a.content_text || a.description || ''}`.toLowerCase();
    // require ALL significant name-tokens present (kills loose partial matches)
    if (tokens.every(t => hay.includes(t))) return true;
  }
  return false;
}

/**
 * Enrich a deep-analysis object with verification + citations.
 *
 * @param {object} deep — { shared_facts[], diverging_points[], silenced_topics[],
 *                          experts_cited{camp:[names]}, ... }
 * @param {Array}  articles — flattened corpus articles
 * @param {object} opts — { entailmentFn? }
 * @returns {Promise<{ deep, report }>}  (deep is a cloned, enriched copy)
 */
export async function enrichDeepAnalysis(deep, articles, opts = {}) {
  const clone = JSON.parse(JSON.stringify(deep || {}));
  const arts = Array.isArray(articles) ? articles : [];

  // ── shared_facts: NLI verification + citation ────────────────────────────────
  const facts = Array.isArray(clone.shared_facts) ? clone.shared_facts : [];
  if (facts.length) {
    const claims = facts.map(f => ({ text: f?.claim || '', kind: 'shared_fact' }));
    const { results } = await verifyClaims(claims, arts, { entailmentFn: opts.entailmentFn });
    facts.forEach((f, i) => {
      const r = results[i];
      if (!r) return;
      f._verification = {
        label: r.label,                 // supported | entailment | contradiction | unsupported
        score: r.score,
        evidence: r.evidence || null,   // {corpus_id,url,source_name,title} or null
      };
    });
  }

  // ── experts_cited: keep only names that appear in article text ───────────────
  if (clone.experts_cited && typeof clone.experts_cited === 'object') {
    const verified = {};
    const unverified = {};
    for (const sp of CORPUS_SPECTRUMS) {
      const names = Array.isArray(clone.experts_cited[sp]) ? clone.experts_cited[sp] : [];
      verified[sp] = [];
      unverified[sp] = [];
      for (const n of names) {
        (expertAppears(n, arts) ? verified[sp] : unverified[sp]).push(n);
      }
    }
    clone.experts_cited = verified;            // displayed list = only verified
    clone._experts_unverified = unverified;    // surfaced separately / for transparency
  }

  // ── diverging_points: cite each camp's lead supporting article ───────────────
  const VIEW_KEYS = { left: 'left_view', center_left: 'center_left_view', center: 'center_view', center_right: 'center_right_view', right: 'right_view' };
  const bySpectrum = {};
  for (const a of arts) (bySpectrum[a.spectrum] ||= []).push(a);
  const points = Array.isArray(clone.diverging_points) ? clone.diverging_points : [];
  for (const p of points) {
    p._citations = {};
    for (const sp of CORPUS_SPECTRUMS) {
      const view = p?.[VIEW_KEYS[sp]];
      if (!view) continue;
      const ev = bestEvidence(view, bySpectrum[sp] || []);
      if (ev && ev.score >= 0.2) p._citations[sp] = citationOf(ev.art);
    }
  }

  // ── report (feeds confidence / UI) ───────────────────────────────────────────
  const verifiedFacts = facts.filter(f => f._verification &&
    (f._verification.label === 'supported' || f._verification.label === 'entailment')).length;
  const contradicted = facts.filter(f => f._verification?.label === 'contradiction').length;

  return {
    deep: clone,
    report: {
      facts: facts.length,
      verifiedFacts,
      contradicted,
      factVerifyRatio: facts.length ? Number((verifiedFacts / facts.length).toFixed(3)) : 1,
      expertsKept: clone.experts_cited
        ? CORPUS_SPECTRUMS.reduce((n, sp) => n + (clone.experts_cited[sp]?.length || 0), 0) : 0,
      expertsDropped: clone._experts_unverified
        ? CORPUS_SPECTRUMS.reduce((n, sp) => n + (clone._experts_unverified[sp]?.length || 0), 0) : 0,
    },
  };
}
