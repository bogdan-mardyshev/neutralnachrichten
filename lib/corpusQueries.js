/**
 * lib/corpusQueries.js — pure SQL builders + helpers for the Corpus V2 data layer.
 *
 * WHY this module exists separately from db.js:
 *   db.js wraps a live pg Pool, so its functions can only be tested against a
 *   real database. By extracting the *pure* query-construction logic here (each
 *   function returns a plain { text, values } object, or shapes a row), we get
 *   100%-unit-testable SQL with no DB connection — the same pattern used for
 *   analysisValidator.js (extracted from server.js for testability).
 *
 * LEGAL NOTE (derive-and-discard):
 *   corpus_articles intentionally has NO full-body column. The full article text
 *   is a TRANSIENT input used only to derive `our_summary` (our own transformed
 *   summary) + `short_lead` (≤200-char extract) + the embedding vector, then
 *   discarded. We persist only derived/transformed artefacts + a link-out, which
 *   keeps us clear of German Presse-Leistungsschutzrecht (§87f UrhG / EU DSM Art.15).
 */

import crypto from 'crypto';

export const CORPUS_SPECTRUMS = ['left', 'center_left', 'center', 'center_right', 'right'];
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-004';
export const EMBEDDING_DIM = 768;
export const SHORT_LEAD_MAX = 200;

// ── Small helpers ─────────────────────────────────────────────────────────────

/** Stable dedup key for an article URL. */
export function urlHash(url) {
  return crypto.createHash('md5').update(String(url || '').trim()).digest('hex');
}

/** Clamp the short lead to the legal extract ceiling. */
export function clampShortLead(text, max = SHORT_LEAD_MAX) {
  return String(text || '').trim().slice(0, max);
}

/**
 * Render a JS number array as a pgvector literal: [0.1,0.2,...].
 * Throws if the dimension is wrong — a mismatched vector would corrupt the index.
 */
export function toVectorLiteral(arr, dim = EMBEDDING_DIM) {
  if (!Array.isArray(arr)) throw new Error('embedding must be an array');
  if (arr.length !== dim) throw new Error(`embedding must have ${dim} dims, got ${arr.length}`);
  for (const v of arr) {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('embedding must contain finite numbers');
  }
  return `[${arr.join(',')}]`;
}

/**
 * Sanitize a single keyword into a safe to_tsquery lexeme.
 * Keeps letters (incl. German umlauts/ß), digits — drops everything else so a
 * user query can never inject tsquery operators ('&', '|', '!', ':', parens).
 * Returns '' for tokens that sanitize to nothing.
 */
export function sanitizeTsToken(token) {
  return String(token || '')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]/gi, '')
    .trim();
}

/**
 * Build an OR-joined to_tsquery expression string from raw keywords.
 * OR (|) maximizes recall for corpus retrieval — we want every article that
 * mentions ANY of the topic words, then rank by relevance.
 * Returns '' if no usable tokens (caller should skip the query / return []).
 */
export function buildTsQueryExpr(keywords) {
  const list = Array.isArray(keywords) ? keywords : [keywords];
  const tokens = [...new Set(list.map(sanitizeTsToken).filter(Boolean))];
  return tokens.join(' | ');
}

/** feed_health status from a consecutive-failure count. */
export function computeFeedStatus(consecutiveFailures) {
  const n = Number(consecutiveFailures) || 0;
  if (n === 0) return 'ok';
  if (n < 3)   return 'degraded';
  return 'down';
}

/** Validate a spectrum value (defends against bad worker input). */
export function isValidSpectrum(s) {
  return CORPUS_SPECTRUMS.includes(s);
}

// ── corpus_articles ─────────────────────────────────────────────────────────

/**
 * Upsert an article by url_hash. Updates derived fields on conflict (re-ingest
 * with a better summary). Returns RETURNING id + an `inserted` flag via the
 * (xmax = 0) trick (true = new row, false = updated existing).
 *
 * @param {object} a — { url, source_name, source_domain, spectrum, title,
 *                       our_summary, short_lead, pub_date, lang }
 */
export function buildUpsertArticleQuery(a) {
  if (!a || !a.url) throw new Error('article.url is required');
  if (!isValidSpectrum(a.spectrum)) throw new Error(`invalid spectrum: ${a.spectrum}`);

  const values = [
    String(a.url).trim(),
    urlHash(a.url),
    a.source_name || '',
    a.source_domain || '',
    a.spectrum,
    a.title || '',
    a.our_summary || null,
    clampShortLead(a.short_lead),
    a.pub_date || null,
    a.lang || 'de',
  ];

  const text = `
    INSERT INTO corpus_articles
      (url, url_hash, source_name, source_domain, spectrum, title, our_summary, short_lead, pub_date, lang)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (url_hash) DO UPDATE SET
      our_summary = EXCLUDED.our_summary,
      short_lead  = EXCLUDED.short_lead,
      title       = EXCLUDED.title,
      pub_date    = EXCLUDED.pub_date,
      fetched_at  = now()
    RETURNING id, (xmax = 0) AS inserted`;

  return { text, values };
}

/**
 * Lexical (full-text) retrieval over title + our_summary using the German
 * dictionary. Always available (no pgvector needed) — this is the reliability
 * floor: even if semantic search is disabled, FTS still works.
 *
 * @param {string[]} keywords
 * @param {object}   opts — { spectra?: string[], sinceDate?: string|Date, limit?: number }
 * @returns {{text:string, values:any[]}|null}  null when no usable keywords.
 */
export function buildFTSQuery(keywords, opts = {}) {
  const expr = buildTsQueryExpr(keywords);
  if (!expr) return null;

  const values = [expr];
  const where = ['fts @@ query'];

  if (Array.isArray(opts.spectra) && opts.spectra.length) {
    const valid = opts.spectra.filter(isValidSpectrum);
    if (valid.length) {
      values.push(valid);
      where.push(`spectrum = ANY($${values.length})`);
    }
  }
  if (opts.sinceDate) {
    values.push(opts.sinceDate);
    where.push(`pub_date >= $${values.length}`);
  }

  const limit = Math.min(200, Math.max(1, parseInt(opts.limit, 10) || 50));
  values.push(limit);

  const text = `
    SELECT id, url, source_name, source_domain, spectrum, title,
           our_summary, short_lead, pub_date, cluster_id,
           ts_rank(fts, query) AS rank
    FROM corpus_articles, to_tsquery('german', $1) query
    WHERE ${where.join(' AND ')}
    ORDER BY rank DESC, pub_date DESC NULLS LAST
    LIMIT $${values.length}`;

  return { text, values };
}

/**
 * Semantic (vector) retrieval via cosine distance (pgvector <=>).
 * Requires pgvector + corpus_embeddings — caller must check availability and
 * fall back to buildFTSQuery when unavailable.
 *
 * @param {number[]} embedding  — query vector (EMBEDDING_DIM dims)
 * @param {object}   opts — { spectra?, sinceDate?, limit?, model? }
 */
export function buildVectorQuery(embedding, opts = {}) {
  const literal = toVectorLiteral(embedding); // throws on bad dim → fail loud, never index garbage
  const model = opts.model || DEFAULT_EMBEDDING_MODEL;

  const values = [literal, model];
  const where = ['e.model = $2'];

  if (Array.isArray(opts.spectra) && opts.spectra.length) {
    const valid = opts.spectra.filter(isValidSpectrum);
    if (valid.length) {
      values.push(valid);
      where.push(`a.spectrum = ANY($${values.length})`);
    }
  }
  if (opts.sinceDate) {
    values.push(opts.sinceDate);
    where.push(`a.pub_date >= $${values.length}`);
  }

  const limit = Math.min(200, Math.max(1, parseInt(opts.limit, 10) || 50));
  values.push(limit);

  const text = `
    SELECT a.id, a.url, a.source_name, a.source_domain, a.spectrum, a.title,
           a.our_summary, a.short_lead, a.pub_date, a.cluster_id,
           (e.embedding <=> $1) AS distance
    FROM corpus_embeddings e
    JOIN corpus_articles a ON a.id = e.article_id
    WHERE ${where.join(' AND ')}
    ORDER BY e.embedding <=> $1
    LIMIT $${values.length}`;

  return { text, values };
}

/** Insert/replace an article embedding (one row per article+model). */
export function buildUpsertEmbeddingQuery(articleId, embedding, model = DEFAULT_EMBEDDING_MODEL) {
  const id = parseInt(articleId, 10);
  if (!Number.isInteger(id) || id <= 0) throw new Error('articleId must be a positive integer');
  const literal = toVectorLiteral(embedding);
  const text = `
    INSERT INTO corpus_embeddings (article_id, model, embedding)
    VALUES ($1, $2, $3)
    ON CONFLICT (article_id, model) DO UPDATE SET
      embedding  = EXCLUDED.embedding,
      created_at = now()`;
  return { text, values: [id, model, literal] };
}

// ── feed_health ───────────────────────────────────────────────────────────────

/** Record a successful feed fetch (resets the failure counter). */
export function buildFeedSuccessQuery(feedUrl, sourceName, spectrum) {
  if (!isValidSpectrum(spectrum)) throw new Error(`invalid spectrum: ${spectrum}`);
  const text = `
    INSERT INTO feed_health (feed_url, source_name, spectrum, last_success, consecutive_failures, status, updated_at)
    VALUES ($1, $2, $3, now(), 0, 'ok', now())
    ON CONFLICT (feed_url) DO UPDATE SET
      last_success         = now(),
      consecutive_failures = 0,
      status               = 'ok',
      source_name          = EXCLUDED.source_name,
      spectrum             = EXCLUDED.spectrum,
      updated_at           = now()`;
  return { text, values: [feedUrl, sourceName || '', spectrum] };
}

/**
 * Record a failed feed fetch (increments the failure counter and recomputes
 * status). The CASE expression maps the *new* counter to ok/degraded/down so
 * the threshold logic lives in one place (mirrors computeFeedStatus).
 */
export function buildFeedFailureQuery(feedUrl, sourceName, spectrum) {
  if (!isValidSpectrum(spectrum)) throw new Error(`invalid spectrum: ${spectrum}`);
  const text = `
    INSERT INTO feed_health (feed_url, source_name, spectrum, last_failure, consecutive_failures, status, updated_at)
    VALUES ($1, $2, $3, now(), 1, 'degraded', now())
    ON CONFLICT (feed_url) DO UPDATE SET
      last_failure         = now(),
      consecutive_failures = feed_health.consecutive_failures + 1,
      status               = CASE
                               WHEN feed_health.consecutive_failures + 1 >= 3 THEN 'down'
                               ELSE 'degraded'
                             END,
      updated_at           = now()`;
  return { text, values: [feedUrl, sourceName || '', spectrum] };
}

/**
 * Fetch feeds that are NOT healthy (degraded/down), optionally per spectrum.
 * Used to distinguish real editorial silence from a broken feed when computing
 * blindspots — the #1 false-positive risk in the old architecture.
 */
export function buildDownFeedsQuery(spectra) {
  const values = [];
  const where = [`status <> 'ok'`];
  if (Array.isArray(spectra) && spectra.length) {
    const valid = spectra.filter(isValidSpectrum);
    if (valid.length) {
      values.push(valid);
      where.push(`spectrum = ANY($${values.length})`);
    }
  }
  const text = `
    SELECT feed_url, source_name, spectrum, status, consecutive_failures, last_success, last_failure
    FROM feed_health
    WHERE ${where.join(' AND ')}
    ORDER BY consecutive_failures DESC`;
  return { text, values };
}

// ── source_ratings ─────────────────────────────────────────────────────────────

// Two independent classification axes beyond spectrum:
//   tier    — audience reach / editorial prominence (flagship > standard > niche)
//   factual — factual-reporting quality (high > mixed > low), separate from politics
// They're orthogonal: Bild is flagship (huge reach) but only mixed factual.
export const SOURCE_TIERS = ['flagship', 'standard', 'niche'];
export const FACTUAL_RATINGS = ['high', 'mixed', 'low'];

/** Validate/normalize a tier; defaults to 'standard' on bad input. */
export function normalizeTier(tier) {
  return SOURCE_TIERS.includes(tier) ? tier : 'standard';
}

/** Validate/normalize a factual rating; defaults to 'mixed' on bad input. */
export function normalizeFactual(f) {
  return FACTUAL_RATINGS.includes(f) ? f : 'mixed';
}

/**
 * Upsert a source's classification with provenance (rating_source) so the UI can
 * show WHY an outlet is classified the way it is — turning an opaque label into an
 * auditable, defensible classification. Now carries tier + factual_rating.
 */
export function buildUpsertSourceRatingQuery(r) {
  if (!r || !r.source_domain) throw new Error('source_domain is required');
  if (!isValidSpectrum(r.spectrum)) throw new Error(`invalid spectrum: ${r.spectrum}`);
  const confidence = Math.min(1, Math.max(0, Number(r.confidence ?? 0.5)));
  const reachWeight = Math.max(0, Number(r.reach_weight ?? 1.0));
  const text = `
    INSERT INTO source_ratings (source_domain, source_name, spectrum, tier, factual_rating, rating_source, confidence, reach_weight, notes, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
    ON CONFLICT (source_domain) DO UPDATE SET
      source_name    = EXCLUDED.source_name,
      spectrum       = EXCLUDED.spectrum,
      tier           = EXCLUDED.tier,
      factual_rating = EXCLUDED.factual_rating,
      rating_source  = EXCLUDED.rating_source,
      confidence     = EXCLUDED.confidence,
      reach_weight   = EXCLUDED.reach_weight,
      notes          = EXCLUDED.notes,
      updated_at     = now()`;
  return {
    text,
    values: [
      r.source_domain.toLowerCase().replace(/^www\./, ''),
      r.source_name || '',
      r.spectrum,
      normalizeTier(r.tier),
      normalizeFactual(r.factual_rating),
      r.rating_source || 'editorial',
      confidence,
      reachWeight,
      r.notes || null,
    ],
  };
}

// ── Row shaping ────────────────────────────────────────────────────────────────

/** Normalize a corpus_articles result row into the shape the pipeline expects. */
export function normalizeArticleRow(row) {
  if (!row) return null;
  return {
    id:            row.id,
    url:           row.url,
    source_name:   row.source_name,
    source_domain: row.source_domain,
    spectrum:      row.spectrum,
    article_title: row.title,
    our_summary:   row.our_summary || '',
    short_lead:    row.short_lead || '',
    pubDate:       row.pub_date || null,
    cluster_id:    row.cluster_id ?? null,
    // retrieval scores (only one of these is present depending on the query path)
    rank:          row.rank != null ? Number(row.rank) : undefined,
    distance:      row.distance != null ? Number(row.distance) : undefined,
  };
}
