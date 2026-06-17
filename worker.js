/**
 * worker.js — corpus ingestion worker (separate Railway service).
 *
 * Wires the REAL implementations into the dependency-injected orchestration in
 * lib/ingestionWorker.js and runs it on an interval. Deployed as its own Railway
 * service (start command: `npm run worker`) sharing the same DATABASE_URL +
 * GEMINI_API_KEY as the web service, so the corpus it fills is read by the API.
 *
 * Modes:
 *   node worker.js          → run once, then every INGEST_INTERVAL_MINUTES (default 30)
 *   node worker.js --once   → run a single pass and exit (manual/dev/cron use)
 *
 * Reliability:
 *   - Never lets one run's error kill the loop (each pass is try/caught).
 *   - Degrades gracefully: no pgvector → articles stored, embeddings skipped (FTS
 *     still works). No API key → same. No DB → logs and idles (loop keeps trying).
 *   - Clean shutdown on SIGTERM/SIGINT so Railway redeploys don't drop the pool.
 */

import 'dotenv/config';
import {
  initDB,
  closeDB,
  isDBAvailable,
  isPgvectorAvailable,
  upsertCorpusArticle,
  upsertCorpusEmbedding,
  listArticleIdsMissingEmbeddings,
  recordFeedSuccess,
  recordFeedFailure,
  upsertSourceRating,
  pruneCorpus,
  getDownFeeds,
} from './db.js';
import { seedSourceRatings } from './lib/sourceRatingsSeed.js';
import { fetchRSSFeed } from './lib/rssSearch.js';
import { getEmbeddingsBatch, isEmbeddingAvailable } from './lib/embeddings.js';
import { runIngestionOnce } from './lib/ingestionWorker.js';
import { buildFeedHealthAlert } from './lib/feedHealthAlert.js';

const INTERVAL_MIN = Math.max(5, parseInt(process.env.INGEST_INTERVAL_MINUTES, 10) || 30);
const RUN_ONCE = process.argv.includes('--once');

/** Real dependencies for the orchestration layer. */
function buildDeps() {
  return {
    fetchFeed:      (feed) => fetchRSSFeed(feed),
    upsertArticle:  (article) => upsertCorpusArticle(article),
    embedBatch:     (texts) => getEmbeddingsBatch(texts),
    upsertEmbedding:(id, vec) => upsertCorpusEmbedding(id, vec),
    listMissingEmbeddings: (ids) => listArticleIdsMissingEmbeddings(ids),
    recordSuccess:  (url, name, spectrum) => recordFeedSuccess(url, name, spectrum),
    recordFailure:  (url, name, spectrum) => recordFeedFailure(url, name, spectrum),
  };
}

async function runPass() {
  if (!isDBAvailable()) {
    console.warn('[Worker] DB unavailable — skipping this pass');
    return;
  }
  const withEmbeddings = isPgvectorAvailable() && isEmbeddingAvailable();
  if (!withEmbeddings) {
    console.warn(
      `[Worker] embeddings off (pgvector=${isPgvectorAvailable()} apiKey=${isEmbeddingAvailable()}) ` +
      '— storing articles for FTS only'
    );
  }
  try {
    await runIngestionOnce(buildDeps(), { withEmbeddings });
  } catch (err) {
    console.error('[Worker] ingestion pass failed:', err.message);
  }

  // Retention (audit B1): history accumulates for timelines/trends, but growth is
  // capped — articles older than CORPUS_RETENTION_DAYS (default 180) are pruned
  // after each pass (embeddings follow via ON DELETE CASCADE).
  try {
    const retentionDays = parseInt(process.env.CORPUS_RETENTION_DAYS, 10) || 180;
    const pruned = await pruneCorpus(retentionDays);
    if (pruned > 0) console.log(`[Worker] retention: pruned ${pruned} articles older than ${retentionDays}d`);
  } catch (err) {
    console.error('[Worker] retention prune failed:', err.message);
  }

  // Feed-health alert: surface unhealthy feeds so a broken feed never silently
  // masquerades as editorial silence (false blindspot). Logged for Railway/Sentry.
  try {
    const alert = buildFeedHealthAlert(await getDownFeeds());
    if (alert.shouldAlert) {
      const line = `[FeedHealthAlert] ${alert.severity.toUpperCase()} — ${alert.message}`;
      if (alert.severity === 'critical') console.error(line); else console.warn(line);
    }
  } catch (err) {
    console.error('[Worker] feed-health alert failed:', err.message);
  }
}

let timer = null;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Worker] ${signal} received — shutting down`);
  if (timer) clearInterval(timer);
  await closeDB();
  process.exit(0);
}

async function main() {
  console.log(`[Worker] starting (mode=${RUN_ONCE ? 'once' : `loop/${INTERVAL_MIN}min`})`);
  await initDB();

  // Seed/refresh source classifications (idempotent upserts) so the API can serve
  // auditable spectrum ratings + reach weights for coverage normalization.
  if (isDBAvailable()) {
    const { seeded, failed } = await seedSourceRatings(upsertSourceRating);
    console.log(`[Worker] source ratings seeded: ${seeded} ok, ${failed} failed`);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  await runPass();

  if (RUN_ONCE) {
    await closeDB();
    process.exit(0);
  }

  timer = setInterval(runPass, INTERVAL_MIN * 60 * 1000);
  console.log(`[Worker] next pass in ${INTERVAL_MIN} min`);
}

main().catch(async (err) => {
  console.error('[Worker] fatal:', err);
  await closeDB().catch(() => {});
  process.exit(1);
});
