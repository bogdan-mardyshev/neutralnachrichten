/**
 * lib/deriveArticle.js — transform a raw RSS item into the derived artefacts we
 * are allowed to persist.
 *
 * LEGAL MODEL (derive-and-discard) — this module is the enforcement point:
 *   The full article body (item.contentText) is a TRANSIENT INPUT. We use it only
 *   to derive:
 *     • our_summary  — an OWN, transformed summary (extractive sentence selection +
 *                      truncation; a transformation, not a verbatim copy of the
 *                      article), capped at SUMMARY_MAX_CHARS.
 *     • short_lead   — a very short lead extract (≤ SHORT_LEAD_MAX chars).
 *   We never return — and the DB never stores — the full body. Callers MUST pass
 *   the body in and let it fall out of scope after deriveArticle() returns.
 *
 *   This keeps us clear of the German Presse-Leistungsschutzrecht (§87f UrhG /
 *   EU DSM Art. 15), which protects substantial reproductions of press content but
 *   explicitly excludes "single words or very short extracts".
 *
 * WHY a separate, pure module:
 *   No network, no DB, no SDK — every function here is deterministic and unit-
 *   testable, the same pattern as analysisValidator.js / corpusQueries.js. The
 *   worker (worker.js) does the IO; this module does the (legally load-bearing)
 *   transformation.
 */

import { clampShortLead, SHORT_LEAD_MAX } from './corpusQueries.js';

// Upper bound on our derived summary. Long enough to carry the lede + framing for
// retrieval/analysis grounding, short enough that it is unambiguously a summary
// (a transformation) rather than a reproduction of the source article.
export const SUMMARY_MAX_CHARS = 600;

// How many leading sentences to keep for the derived summary. German news ledes
// reliably front-load the who/what/where in the first 2-3 sentences.
export const SUMMARY_MAX_SENTENCES = 3;

// Articles whose derivable text is shorter than this are treated as "thin" — the
// worker can still store them, but the flag lets callers down-rank/skip if wanted.
export const MIN_USEFUL_SUMMARY_CHARS = 40;

/**
 * Collapse runs of whitespace (incl. newlines/tabs left over from HTML stripping)
 * into single spaces and trim. Defensive: parseRSSItems already strips tags, but
 * feeds vary wildly.
 */
export function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

/**
 * Split German prose into sentences on ., !, ? followed by whitespace.
 * Intentionally simple — we only need the first few sentences, and over-splitting
 * (e.g. on "z.B.") merely yields a slightly shorter first sentence, which is safe.
 * Returns [] for empty input.
 */
export function splitSentences(text) {
  const clean = normalizeWhitespace(text);
  if (!clean) return [];
  // Split AFTER sentence-ending punctuation + space, keeping the punctuation.
  return clean
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Build OUR derived summary from the title + body. Extractive: we select the
 * leading sentences (the lede) and cap the length. This is a transformation
 * (selection + truncation), never a verbatim reproduction of the full article.
 *
 * @param {string} title
 * @param {string} body   — content_text (full body) OR description fallback
 * @returns {string}      — our_summary, ≤ SUMMARY_MAX_CHARS
 */
export function deriveSummary(title, body) {
  const sentences = splitSentences(body);

  // Take leading sentences until we hit the sentence cap or the char budget.
  let summary = '';
  let used = 0;
  for (const s of sentences) {
    if (used >= SUMMARY_MAX_SENTENCES) break;
    const candidate = summary ? `${summary} ${s}` : s;
    if (candidate.length > SUMMARY_MAX_CHARS) {
      // If we have nothing yet, take a hard-truncated slice of this first sentence
      // so a single very long sentence still yields a usable summary.
      if (!summary) summary = s.slice(0, SUMMARY_MAX_CHARS).trim();
      break;
    }
    summary = candidate;
    used++;
  }

  // Fall back to the (normalized, capped) title when there is no body text at all.
  if (!summary) summary = normalizeWhitespace(title).slice(0, SUMMARY_MAX_CHARS);

  return summary;
}

/**
 * Derive the very short lead (≤ SHORT_LEAD_MAX). Prefers the first sentence of the
 * body; falls back to the title. Always clamped to the legal extract ceiling.
 */
export function deriveShortLead(title, body) {
  const sentences = splitSentences(body);
  const candidate = sentences[0] || normalizeWhitespace(title);
  return clampShortLead(candidate, SHORT_LEAD_MAX);
}

/**
 * The text we feed to the embedding model. Title + our_summary captures both the
 * headline framing and the lede — and crucially uses ONLY derived/stored text, so
 * the embedding never encodes anything we don't already persist.
 */
export function embeddingInputText(derived) {
  return normalizeWhitespace(`${derived.title || ''}. ${derived.our_summary || ''}`).trim();
}

/**
 * Normalize a pubDate (Date | string | null) into an ISO string or null.
 * Invalid dates → null (we never want to write "Invalid Date" into the DB).
 */
export function normalizePubDate(pubDate) {
  if (!pubDate) return null;
  const d = pubDate instanceof Date ? pubDate : new Date(pubDate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Transform a raw RSS item + its feed descriptor into the exact object shape that
 * db.upsertCorpusArticle (→ buildUpsertArticleQuery) expects.
 *
 * The full body (item.contentText) is consumed here and NOT placed on the result.
 *
 * @param {object} item — { title, description, contentText, link, pubDate }
 * @param {object} feed — { name, domain, spectrum }
 * @returns {object|null} — null when the item has no usable URL or title.
 */
export function deriveArticle(item, feed) {
  if (!item || !feed) return null;
  const url = String(item.link || '').trim();
  const title = normalizeWhitespace(item.title);
  // Without a URL we cannot dedup or link out; without a title there is nothing
  // meaningful to store. Skip — the worker counts these as "skipped", not errors.
  if (!url || !title) return null;

  const body = item.contentText || item.description || '';
  const our_summary = deriveSummary(title, body);
  const short_lead = deriveShortLead(title, body);

  return {
    url,
    source_name:   feed.name || '',
    source_domain: feed.domain || '',
    spectrum:      feed.spectrum,
    title,
    our_summary,
    short_lead,
    pub_date:      normalizePubDate(item.pubDate),
    lang:          'de',
    // diagnostic flag (NOT persisted) — lets the worker skip/flag thin items.
    _thin:         our_summary.length < MIN_USEFUL_SUMMARY_CHARS,
  };
}
