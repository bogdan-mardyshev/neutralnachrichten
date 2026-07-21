/**
 * lib/ingestionWorker.js — corpus ingestion orchestration (pure, dependency-injected).
 *
 * PIPELINE (per feed):
 *   fetch RSS → age-filter + cap → DERIVE (deriveArticle: our_summary + short_lead,
 *   full body discarded) → embed (title + our_summary) → upsert corpus_articles
 *   (+ corpus_embeddings) → record feed_health.
 *
 * WHY injected deps:
 *   All IO (network fetch, DB writes, embedding API) is passed in via `deps`, so
 *   the orchestration logic is unit-tested with fakes and never touches the network
 *   or a real database. worker.js wires the real implementations.
 *
 * LEGAL: the derive step (deriveArticle) is the only thing that ever sees the full
 * body; this module only handles the already-derived objects, so nothing here can
 * persist a reproduction of source content.
 */

import { RSS_FEEDS, SPECTRUM_ORDER } from './rssSearch.js';
import { deriveArticle, embeddingInputText } from './deriveArticle.js';

export const DEFAULT_INGEST_OPTS = {
  maxAgeDays: 14,   // ingest articles from the last 2 weeks
  maxPerFeed: 50,   // cap per feed per run (newest first)
  withEmbeddings: true,
};

/** Is the article recent enough to ingest? Unknown date → include (same policy as search). */
export function isWithinAge(pubDate, maxAgeDays) {
  if (!pubDate) return true;
  const d = pubDate instanceof Date ? pubDate : new Date(pubDate);
  if (Number.isNaN(d.getTime())) return true;
  const oldest = Date.now() - maxAgeDays * 24 * 3600 * 1000;
  return d.getTime() >= oldest;
}

/** newest-first sort by pubDate; unknown dates sink to the end. */
function byPubDateDesc(a, b) {
  const ta = a.pubDate instanceof Date ? a.pubDate.getTime() : (a.pubDate ? Date.parse(a.pubDate) : 0);
  const tb = b.pubDate instanceof Date ? b.pubDate.getTime() : (b.pubDate ? Date.parse(b.pubDate) : 0);
  return (tb || 0) - (ta || 0);
}

function emptyStats(feed) {
  return {
    feed: feed.name, spectrum: feed.spectrum, ok: false,
    fetched: 0, eligible: 0, inserted: 0, updated: 0, embedded: 0, embedSkipped: 0, skipped: 0, errors: 0,
  };
}

/**
 * Ingest a single feed.
 *
 * @param {object} feed — { name, domain, url, spectrum }
 * @param {object} deps — {
 *   fetchFeed(feed) => { feed, items, error },
 *   upsertArticle(article) => { id, inserted } | null,
 *   embedBatch(texts) => (number[]|null)[],   // optional; required if withEmbeddings
 *   upsertEmbedding(id, vec) => boolean,       // optional
 *   recordSuccess(url, name, spectrum),
 *   recordFailure(url, name, spectrum),
 * }
 * @param {object} opts — see DEFAULT_INGEST_OPTS
 * @returns {Promise<object>} per-feed stats
 */
export async function ingestFeed(feed, deps, opts = {}) {
  const o = { ...DEFAULT_INGEST_OPTS, ...opts };
  const stats = emptyStats(feed);

  let result;
  try {
    result = await deps.fetchFeed(feed);
  } catch (err) {
    console.error(`[Ingest] ${feed.name}: fetch threw`, err.message);
    result = { error: err.message, items: [] };
  }

  if (!result || result.error || !Array.isArray(result.items) || result.items.length === 0) {
    await deps.recordFailure(feed.url, feed.name, feed.spectrum);
    return stats;
  }

  // Feed responded → healthy, regardless of how many items survive filtering.
  await deps.recordSuccess(feed.url, feed.name, feed.spectrum);
  stats.ok = true;
  stats.fetched = result.items.length;

  // Age filter → newest-first → cap.
  const eligible = result.items
    .filter(it => isWithinAge(it.pubDate, o.maxAgeDays))
    .sort(byPubDateDesc)
    .slice(0, o.maxPerFeed);

  // DERIVE (full body discarded here). Skip items that can't be derived.
  const derived = [];
  for (const item of eligible) {
    const a = deriveArticle(item, feed);
    if (a) derived.push(a); else stats.skipped++;
  }
  stats.eligible = derived.length;
  if (derived.length === 0) return stats;

  // Upsert articles FIRST and collect their ids — embedding happens after, and
  // only for articles that don't have a vector yet (delta embedding, audit A6).
  // Previously every pass re-embedded the entire eligible set (~50/feed × 33
  // feeds every 30 min) which exhausted the embedding quota on unchanged data.
  const upserted = []; // { id, derivedIdx, inserted }
  for (let i = 0; i < derived.length; i++) {
    try {
      const res = await deps.upsertArticle(derived[i]);
      if (!res || res.id == null) { stats.errors++; continue; }
      if (res.inserted) stats.inserted++; else stats.updated++;
      upserted.push({ id: Number(res.id), derivedIdx: i, inserted: !!res.inserted });
    } catch (err) {
      console.error(`[Ingest] ${feed.name}: upsert failed`, err.message);
      stats.errors++;
    }
  }

  // Embed only articles that still need a vector. Preferred: the injected
  // listMissingEmbeddings (also backfills rows whose embedding failed earlier,
  // e.g. during a quota outage). Fallback without the dep: newly inserted only.
  if (o.withEmbeddings && typeof deps.embedBatch === 'function' && upserted.length) {
    let targets;
    if (typeof deps.listMissingEmbeddings === 'function') {
      try {
        const needIds = new Set(await deps.listMissingEmbeddings(upserted.map(u => u.id)));
        targets = upserted.filter(u => needIds.has(u.id));
      } catch (err) {
        console.error(`[Ingest] ${feed.name}: listMissingEmbeddings failed`, err.message);
        targets = upserted.filter(u => u.inserted);
      }
    } else {
      targets = upserted.filter(u => u.inserted);
    }

    if (targets.length) {
      try {
        const vectors = await deps.embedBatch(targets.map(u => embeddingInputText(derived[u.derivedIdx])));
        for (let k = 0; k < targets.length; k++) {
          const vec = vectors[k];
          if (vec && typeof deps.upsertEmbedding === 'function') {
            const ok = await deps.upsertEmbedding(targets[k].id, vec);
            if (ok) stats.embedded++;
          }
        }
      } catch (err) {
        console.error(`[Ingest] ${feed.name}: embedBatch failed`, err.message);
      }
    }
    stats.embedSkipped = upserted.length - targets.length;
  }

  return stats;
}

/** Aggregate per-feed stats into a single run summary. */
export function summarizeRun(perFeed) {
  const sum = (k) => perFeed.reduce((acc, s) => acc + (s[k] || 0), 0);
  return {
    feeds: perFeed.length,
    feedsOk: perFeed.filter(s => s.ok).length,
    feedsDown: perFeed.filter(s => !s.ok).length,
    fetched: sum('fetched'),
    eligible: sum('eligible'),
    inserted: sum('inserted'),
    updated: sum('updated'),
    embedded: sum('embedded'),
    embedSkipped: sum('embedSkipped'),
    skipped: sum('skipped'),
    errors: sum('errors'),
    perFeed,
  };
}

/**
 * Run one full ingestion pass over every configured feed.
 * Feeds are processed sequentially to keep DB/embedding load bounded and logs
 * readable; within a feed, embeddings are batched.
 *
 * @param {object} deps — same shape as ingestFeed's deps
 * @param {object} opts — see DEFAULT_INGEST_OPTS
 * @returns {Promise<object>} run summary (see summarizeRun)
 */
export async function runIngestionOnce(deps, opts = {}) {
  const feeds = SPECTRUM_ORDER.flatMap(spectrum =>
    (RSS_FEEDS[spectrum] || []).map(feed => ({ ...feed, spectrum }))
  );

  const perFeed = [];
  for (const feed of feeds) {
    const s = await ingestFeed(feed, deps, opts);
    perFeed.push(s);
    console.log(
      `[Ingest] ${feed.spectrum}/${feed.name}: ok=${s.ok} fetched=${s.fetched} ` +
      `eligible=${s.eligible} +${s.inserted}/~${s.updated} emb=${s.embedded}(skip ${s.embedSkipped ?? 0}) ` +
      `skip=${s.skipped} err=${s.errors}`
    );
  }

  const summary = summarizeRun(perFeed);
  console.log(
    `[Ingest] RUN DONE — feeds ${summary.feedsOk}/${summary.feeds} ok, ` +
    `inserted=${summary.inserted} updated=${summary.updated} embedded=${summary.embedded} ` +
    `skipped=${summary.skipped} errors=${summary.errors}`
  );
  return summary;
}
