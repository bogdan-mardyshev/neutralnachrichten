/**
 * lib/citationGrounding.js — verify every article the model emitted against the
 * corpus articles actually retrieved, and attach a verifiable citation.
 *
 * WHY:
 *   The analysis JSON lists articles per spectrum (source_name, title, url). With a
 *   real corpus we can do better than "trust the model": we match each emitted
 *   article back to a retrieved corpus row and either
 *     • ground it  → stamp the canonical corpus url + id (citation), or
 *     • flag it    → _grounded:false (a claim with no source behind it).
 *   The grounding ratio becomes an input to the confidence score (Step 9) and lets
 *   the UI show "N of M statements are source-backed".
 *
 * Pure module: operates on the analysis object + the corpus spectra. No IO.
 */

import { CORPUS_SPECTRUMS } from './corpusQueries.js';

/** Normalize a URL for equality: lowercase host, drop query/hash and trailing slash. */
export function normalizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    let path = u.pathname.replace(/\/+$/, '');
    return `${u.hostname.replace(/^www\./, '')}${path}`.toLowerCase();
  } catch {
    return String(url).trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');
  }
}

/** Normalize a title for dedup: lowercase, collapse whitespace, strip punctuation. */
export function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Drop duplicate articles, keeping the first occurrence. Two articles are "the
 * same" when they share a canonical URL, OR the same outlet published the same
 * headline (source_domain + normalized title). Same headline from DIFFERENT
 * outlets is kept — those are distinct sources with distinct perspectives.
 *
 * Fixes the corpus near-dup case: one story ingested under URL variants
 * (?utm=…, trailing slash, two feeds) lands as separate rows with different ids,
 * which RRF (id-keyed) won't merge — so they'd render as twin cards.
 */
export function dedupeArticles(articles) {
  const seen = new Set();
  const out = [];
  for (const a of Array.isArray(articles) ? articles : []) {
    if (!a) continue;
    const url = normalizeUrl(a.article_url || a.url);
    const domain = String(a.source_domain || '').toLowerCase().replace(/^www\./, '');
    const titleKey = `${domain}|${normalizeTitle(a.article_title || a.title)}`;
    const urlKey = url ? `u:${url}` : null;
    if ((urlKey && seen.has(urlKey)) || seen.has(titleKey)) continue;
    if (urlKey) seen.add(urlKey);
    seen.add(titleKey);
    out.push(a);
  }
  return out;
}

/** Title tokens: lowercased words ≥4 chars (kills stopword noise + punctuation). */
export function titleTokens(title) {
  return String(title || '')
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/)
    .filter(w => w.length >= 4);
}

/** Overlap ratio = |shared| / |smaller set|. 1.0 when one title's words ⊆ other's. */
export function titleOverlap(a, b) {
  const sa = new Set(titleTokens(a));
  const sb = new Set(titleTokens(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const w of sa) if (sb.has(w)) shared++;
  return shared / Math.min(sa.size, sb.size);
}

export const GROUNDING_TITLE_THRESHOLD = 0.5;

/**
 * Find the best-matching corpus row for one emitted article within a spectrum.
 * Exact normalized-URL match wins; otherwise the highest title overlap ≥ threshold.
 * @returns {{row, method, score}|null}
 */
export function matchArticle(emitted, corpusRows, threshold = GROUNDING_TITLE_THRESHOLD) {
  if (!emitted || !Array.isArray(corpusRows) || corpusRows.length === 0) return null;

  const emUrl = normalizeUrl(emitted.article_url);
  if (emUrl) {
    const exact = corpusRows.find(r => normalizeUrl(r.article_url || r.url) === emUrl);
    if (exact) return { row: exact, method: 'url', score: 1 };
  }

  let best = null;
  for (const r of corpusRows) {
    const score = titleOverlap(emitted.article_title, r.article_title || r.title);
    if (score >= threshold && (!best || score > best.score)) {
      best = { row: r, method: 'title', score };
    }
  }
  return best;
}

/**
 * Ground a full analysis against the corpus spectra used to produce it.
 * Mutates a CLONE of analysis (does not touch the input) and returns it plus a report.
 *
 * @param {object} analysis — { news_spectrum: { left:[...], ... } }
 * @param {object} corpusSpectra — { left:{articles:[...]}, ... } (corpusToSpectra output)
 * @returns {{ analysis, report }}
 */
export function groundAnalysis(analysis, corpusSpectra, opts = {}) {
  const threshold = opts.threshold ?? GROUNDING_TITLE_THRESHOLD;
  const clone = JSON.parse(JSON.stringify(analysis || {}));
  const ns = clone.news_spectrum || {};

  let total = 0, grounded = 0;
  const perSpectrum = {};

  for (const sp of CORPUS_SPECTRUMS) {
    const emitted = Array.isArray(ns[sp]) ? ns[sp] : [];
    const corpusRows = corpusSpectra?.[sp]?.articles || [];
    let spGrounded = 0;

    for (const art of emitted) {
      total++;
      const m = matchArticle(art, corpusRows, threshold);
      if (m) {
        grounded++; spGrounded++;
        art._grounded = true;
        art._citation = {
          method: m.method,
          score: Number(m.score.toFixed(3)),
          corpus_id: m.row._corpusId ?? m.row.id ?? null,
          url: m.row.article_url || m.row.url || art.article_url || '',
        };
        // Canonicalize the emitted url to the verified corpus url.
        if (art._citation.url) art.article_url = art._citation.url;
        // Stamp the authoritative source domain from the corpus row. Gemini's
        // prompt context has no domain, so its source_domain is often empty/wrong
        // — which broke domain-keyed dedup downstream (twin raw+analyzed cards).
        const rowDomain = m.row.source_domain || m.row.source_name;
        if (rowDomain) art.source_domain = String(rowDomain).toLowerCase().replace(/^www\./, '');
        if (m.row.source_name && !art.source_name) art.source_name = m.row.source_name;
        // Carry source classification onto the displayed card (provenance badges).
        if (m.row._tier)    art._tier    = m.row._tier;
        if (m.row._factual) art._factual = m.row._factual;
      } else {
        art._grounded = false;
        art._citation = null;
      }
    }

    perSpectrum[sp] = { emitted: emitted.length, grounded: spGrounded };
  }

  const report = {
    total,
    grounded,
    ungrounded: total - grounded,
    groundingRatio: total > 0 ? Number((grounded / total).toFixed(3)) : 1,
    perSpectrum,
  };

  return { analysis: clone, report };
}
