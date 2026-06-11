/**
 * lib/corpusToSpectra.js — adapt Corpus V2 hybrid-retrieval output into the exact
 * { spectra, total_articles, fetched_at, search_meta } shape that searchAllFeeds()
 * returns, so the corpus is a DROP-IN source for the existing analysis pipeline
 * (buildRSSContextPrompt, enrichWithRSSData, coverage helpers) with zero changes
 * downstream.
 *
 * Mapping (corpus row → pipeline article):
 *   our_summary → content_text   (the derived text Gemini grounds framing in)
 *   short_lead  → description     (teaser)
 *   url         → article_url
 *   _rrfScore   → score           (sort key)
 *
 * Pure module: no IO. db.searchCorpusHybrid produces `grouped`; this shapes it.
 */

import { CORPUS_SPECTRUMS } from './corpusQueries.js';
import { dedupeArticles } from './citationGrounding.js';
import { buildRatingsMap, SOURCE_OWNERS } from './sourceRatingsSeed.js';

const RATINGS = buildRatingsMap();

/** Count how many keywords appear as full words in the title (case-insensitive). */
function titleFullWordMatches(title, keywords) {
  if (!title || !Array.isArray(keywords) || keywords.length === 0) return 0;
  const t = String(title).toLowerCase();
  let n = 0;
  for (const kw of keywords) {
    const k = String(kw || '').toLowerCase().trim();
    if (!k) continue;
    // Unicode-aware-ish word boundary: surrounded by non-letters or string edges.
    const re = new RegExp(`(^|[^a-zäöüß0-9])${escapeRegExp(k)}([^a-zäöüß0-9]|$)`, 'i');
    if (re.test(t)) n++;
  }
  return n;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Coerce a pubDate into an ISO string. Postgres returns TIMESTAMPTZ as a Date
 * object, but the analysis pipeline treats pubDate as a string (e.g.
 * pubDate.slice(0,10)) — matching searchAllFeeds, which emits ISO strings. Without
 * this, a Date from the corpus crashes the pipeline ("pubDate.slice is not a function").
 */
function toIsoDate(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

/** Map one corpus row into the pipeline article shape. */
export function corpusArticleToPipeline(row, keywords) {
  const title = row.article_title || row.title || '';
  const tfw = titleFullWordMatches(title, keywords);
  const domain = String(row.source_domain || '').toLowerCase().replace(/^www\./, '');
  const rating = RATINGS[domain];
  return {
    source_name:         row.source_name || '',
    source_domain:       row.source_domain || '',
    article_title:       title,
    article_url:         row.url || '',
    description:         row.short_lead || '',
    // our_summary is our derived, transformed text — safe to ground analysis on.
    content_text:        row.our_summary || row.short_lead || '',
    pubDate:             toIsoDate(row.pubDate),
    score:               row._rrfScore ?? 0,
    rawScore:            row._rrfScore ?? 0,
    titleScore:          tfw > 0 ? 1 : 0,
    recency:             1,
    title_match:         tfw > 0,
    title_keyword_count: tfw,
    titleFullWordCount:  tfw,
    // corpus provenance (lets the UI show grounding + which retriever matched)
    _corpusId:           row.id ?? null,
    _retrievers:         row._retrievers || [],
    _clusterId:          row.cluster_id ?? null,
    // source classification (Wave 2 visuals: source map, factuality breakdown,
    // flagship/fringe). From source_ratings; defaults when an outlet is unrated.
    _tier:               rating?.tier ?? 'standard',
    _factual:            rating?.factual_rating ?? 'mixed',
    _reachWeight:        rating?.reach_weight ?? 1,
    _owner:              SOURCE_OWNERS[domain] ?? null,
  };
}

/**
 * Convert hybrid grouped output → searchAllFeeds-compatible result.
 *
 * @param {object} grouped — { left:[rows], center_left:[...], ... } from combineRetrieval
 * @param {object} opts — { keywords?: string[], fetchedAt?: string }
 * @returns {{spectra, total_articles, fetched_at, search_meta}}
 */
export function corpusToSpectra(grouped = {}, opts = {}) {
  const keywords = Array.isArray(opts.keywords) ? opts.keywords : [];
  const now = Date.now();
  const oneWeek = now - 7 * 24 * 3600 * 1000;
  const oneMonth = now - 30 * 24 * 3600 * 1000;

  const spectra = {};
  let total = 0;

  for (const sp of CORPUS_SPECTRUMS) {
    const rows = Array.isArray(grouped[sp]) ? grouped[sp] : [];
    // Drop near-duplicate rows (same story under URL variants / two feeds) BEFORE
    // they reach Gemini — otherwise the model sees and re-emits twin cards.
    const articles = dedupeArticles(rows.map(r => corpusArticleToPipeline(r, keywords)));
    // sort by score desc (RRF) — matches searchAllFeeds final ordering contract
    articles.sort((a, b) => b.score - a.score);

    let countWeek = 0, countMonth = 0;
    for (const a of articles) {
      const t = a.pubDate ? Date.parse(a.pubDate) : NaN;
      if (!Number.isNaN(t)) {
        if (t > oneWeek) countWeek++;
        if (t > oneMonth) countMonth++;
      }
    }

    spectra[sp] = { articles, count_week: countWeek, count_month: countMonth };
    total += articles.length;
  }

  return {
    spectra,
    total_articles: total,
    fetched_at: opts.fetchedAt || new Date().toISOString(),
    search_meta: {
      keywords,
      source: 'corpus',
    },
  };
}
