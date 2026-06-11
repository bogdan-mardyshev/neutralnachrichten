/**
 * db.js — PostgreSQL connection pool + migrations + helpers
 *
 * Falls back gracefully if DATABASE_URL is not set (dev without DB).
 * All public functions return null/empty on DB unavailability — server never crashes.
 */

import pkg from 'pg';
const { Pool } = pkg;
import {
  buildUpsertArticleQuery,
  buildUpsertEmbeddingQuery,
  buildFTSQuery,
  buildVectorQuery,
  buildFeedSuccessQuery,
  buildFeedFailureQuery,
  buildDownFeedsQuery,
  buildUpsertSourceRatingQuery,
  normalizeArticleRow,
} from './lib/corpusQueries.js';
import { combineRetrieval } from './lib/hybridRetrieval.js';

let pool = null;

export function isDBAvailable() {
  return pool !== null;
}

export async function initDB() {
  // Prefer internal Railway URL (faster, no egress), fall back to public URL
  const dbUrl = process.env.DATABASE_PRIVATE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn('[DB] No DATABASE_URL set — running without PostgreSQL. Cache will be in-memory only.');
    return false;
  }

  try {
    const needsSsl = !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1');
    // Log host for debugging (strip password)
    try {
      const u = new URL(dbUrl);
      console.log(`[DB] Connecting to ${u.hostname}:${u.port || 5432} db=${u.pathname.slice(1)} ssl=${needsSsl}`);
    } catch { console.log('[DB] Connecting (URL parse failed)'); }

    pool = new Pool({
      connectionString: dbUrl,
      ssl: needsSsl ? { rejectUnauthorized: false } : false,
      max: 20,                          // up from 10 for concurrent Gemini traffic
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: false,           // keep pool alive across SIGTERM window
      keepAlive: true,
      keepAliveInitialDelayMillis: 0,
    });

    // Test connection
    await pool.query('SELECT 1');
    console.log('[DB] PostgreSQL connected ✓');

    await runMigrations();
    return true;
  } catch (err) {
    console.error('[DB] Connection failed:', err.message || err.code || JSON.stringify(err));
    console.error('[DB] Error detail:', { code: err.code, errno: err.errno, syscall: err.syscall, address: err.address, port: err.port });
    pool = null;
    return false;
  }
}

// ── Migrations ───────────────────────────────────────────────────────────────

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_cache (
      key          TEXT PRIMARY KEY,
      data         JSONB NOT NULL,
      degraded     BOOLEAN DEFAULT false,
      updated_at   TIMESTAMPTZ DEFAULT now(),
      ttl_seconds  INTEGER NOT NULL,
      topic        TEXT,
      lang         TEXT,
      search_count INTEGER DEFAULT 1,
      last_searched TIMESTAMPTZ DEFAULT now()
    );
    -- Add columns to existing table if they don't exist yet
    ALTER TABLE content_cache ADD COLUMN IF NOT EXISTS topic TEXT;
    ALTER TABLE content_cache ADD COLUMN IF NOT EXISTS lang TEXT;
    ALTER TABLE content_cache ADD COLUMN IF NOT EXISTS search_count INTEGER DEFAULT 1;
    ALTER TABLE content_cache ADD COLUMN IF NOT EXISTS last_searched TIMESTAMPTZ DEFAULT now();
    CREATE INDEX IF NOT EXISTS content_cache_public ON content_cache(last_searched DESC) WHERE topic IS NOT NULL;

    CREATE TABLE IF NOT EXISTS users (
      id            BIGSERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      tier          TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
      daily_limit      INTEGER DEFAULT 10,
      created_at       TIMESTAMPTZ DEFAULT now(),
      last_login       TIMESTAMPTZ,
      is_active        BOOLEAN DEFAULT true,
      login_attempts   INTEGER DEFAULT 0,
      locked_until     TIMESTAMPTZ
    );
    -- Safe migration: add columns if they don't exist yet (idempotent)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until   TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS searches (
      id          BIGSERIAL PRIMARY KEY,
      topic       TEXT NOT NULL,
      topic_norm  TEXT NOT NULL,
      lang        TEXT NOT NULL,
      degraded    BOOLEAN DEFAULT false,
      cache_hit   BOOLEAN DEFAULT false,
      user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
      ip_hash     TEXT,
      created_at  TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS searches_topic_norm  ON searches(topic_norm);
    CREATE INDEX IF NOT EXISTS searches_created_at  ON searches(created_at DESC);
    CREATE INDEX IF NOT EXISTS searches_user_id     ON searches(user_id);

    CREATE TABLE IF NOT EXISTS user_daily_usage (
      identifier  TEXT NOT NULL,
      date        DATE NOT NULL,
      count       INTEGER DEFAULT 0,
      updated_at  TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (identifier, date)
    );

    CREATE TABLE IF NOT EXISTS user_searches (
      id            BIGSERIAL PRIMARY KEY,
      user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      topic         TEXT NOT NULL,
      lang          VARCHAR(5) DEFAULT 'de',
      coverage_json JSONB,
      created_at    TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS user_searches_user_id ON user_searches(user_id);
    CREATE INDEX IF NOT EXISTS user_searches_created  ON user_searches(created_at DESC);
  `);

  // Incremental alterations — safe to run repeatedly (IF NOT EXISTS / DO NOTHING)
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified      BOOLEAN     DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token  TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_expires TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token          TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires  TIMESTAMPTZ;
  `);

  // Likes table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS analysis_likes (
      id         BIGSERIAL PRIMARY KEY,
      topic_norm TEXT    NOT NULL,
      user_id    BIGINT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (topic_norm, user_id)
    );
    CREATE INDEX IF NOT EXISTS analysis_likes_topic ON analysis_likes(topic_norm);
    CREATE INDEX IF NOT EXISTS analysis_likes_user  ON analysis_likes(user_id);
  `);

  // content_cache: add view_count column (distinct from search_count)
  await pool.query(`
    ALTER TABLE content_cache ADD COLUMN IF NOT EXISTS view_count BIGINT DEFAULT 0;
  `);

  // Saved topics (bookmarks)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS saved_topics (
      id         BIGSERIAL PRIMARY KEY,
      user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
      topic      TEXT NOT NULL,
      topic_norm TEXT NOT NULL,
      lang       TEXT DEFAULT 'de',
      saved_at   TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id, topic_norm)
    );
    CREATE INDEX IF NOT EXISTS saved_topics_user_id ON saved_topics(user_id);
  `);

  // Email digest preference
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_digest BOOLEAN DEFAULT false;
  `);

  // Source suggestion submissions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS source_suggestions (
      id         BIGSERIAL PRIMARY KEY,
      name       TEXT,
      email      TEXT,
      url        TEXT NOT NULL,
      spectrum   TEXT,
      why        TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Corpus V2 (RSS-Direct corpus) — pgvector-aware, degrades to FTS if unavailable
  await runCorpusMigrations();

  console.log('[DB] Migrations done ✓');
}

// ── Corpus V2 migrations ───────────────────────────────────────────────────────
//
// pgvector is OPTIONAL. If the extension can't be created (no superuser rights on
// some managed Postgres), semantic search is disabled but the corpus + lexical
// (FTS) retrieval still work fully. corpus_articles deliberately has NO vector
// column — embeddings live in their own table — so the core schema is always
// creatable regardless of pgvector availability.

let pgvectorReady = false;

/** True once pgvector + corpus_embeddings are confirmed usable. */
export function isPgvectorAvailable() {
  return pgvectorReady;
}

async function runCorpusMigrations() {
  // 1) Try to enable pgvector — never throw; degrade to FTS-only on failure.
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    pgvectorReady = true;
    console.log('[DB] pgvector enabled ✓ (semantic search on)');
  } catch (err) {
    pgvectorReady = false;
    console.warn('[DB] pgvector unavailable — FTS-only mode:', err.message);
  }

  // 2) corpus_articles — derive-and-discard: NO full-body column. FTS over
  //    title + our_summary (German dictionary), generated + GIN-indexed.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS corpus_articles (
      id            BIGSERIAL PRIMARY KEY,
      url           TEXT NOT NULL,
      url_hash      TEXT NOT NULL UNIQUE,
      source_name   TEXT NOT NULL,
      source_domain TEXT NOT NULL,
      spectrum      TEXT NOT NULL,
      title         TEXT NOT NULL,
      our_summary   TEXT,
      short_lead    VARCHAR(200),
      pub_date      TIMESTAMPTZ,
      fetched_at    TIMESTAMPTZ DEFAULT now(),
      cluster_id    BIGINT,
      lang          TEXT DEFAULT 'de',
      fts           tsvector GENERATED ALWAYS AS (
                      to_tsvector('german', coalesce(title,'') || ' ' || coalesce(our_summary,''))
                    ) STORED
    );
    CREATE INDEX IF NOT EXISTS corpus_articles_fts      ON corpus_articles USING GIN(fts);
    CREATE INDEX IF NOT EXISTS corpus_articles_spectrum ON corpus_articles(spectrum);
    CREATE INDEX IF NOT EXISTS corpus_articles_pubdate  ON corpus_articles(pub_date DESC);
  `);

  // 3) feed_health — distinguishes real editorial silence from a broken feed.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feed_health (
      feed_url             TEXT PRIMARY KEY,
      source_name          TEXT NOT NULL,
      spectrum             TEXT NOT NULL,
      last_success         TIMESTAMPTZ,
      last_failure         TIMESTAMPTZ,
      consecutive_failures INTEGER DEFAULT 0,
      status               TEXT DEFAULT 'unknown',
      updated_at           TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS feed_health_status ON feed_health(status) WHERE status <> 'ok';
  `);

  // 4) source_ratings — auditable spectrum classification with provenance.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS source_ratings (
      source_domain TEXT PRIMARY KEY,
      source_name   TEXT NOT NULL,
      spectrum      TEXT NOT NULL,
      rating_source TEXT,
      confidence    REAL DEFAULT 0.5,
      reach_weight  REAL DEFAULT 1.0,
      notes         TEXT,
      updated_at    TIMESTAMPTZ DEFAULT now()
    );
    -- Two classification axes added in Step 11 (idempotent):
    --   tier: flagship|standard|niche (reach/prominence)
    --   factual_rating: high|mixed|low (factual quality, separate from spectrum)
    ALTER TABLE source_ratings ADD COLUMN IF NOT EXISTS tier           TEXT DEFAULT 'standard';
    ALTER TABLE source_ratings ADD COLUMN IF NOT EXISTS factual_rating TEXT DEFAULT 'mixed';
  `);

  // 5) story_clusters — base table (centroid added conditionally below).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS story_clusters (
      id            BIGSERIAL PRIMARY KEY,
      label         TEXT,
      article_count INTEGER DEFAULT 0,
      first_seen    TIMESTAMPTZ DEFAULT now(),
      last_seen     TIMESTAMPTZ DEFAULT now()
    );
  `);

  // 6) pgvector-dependent pieces — only when the extension is available.
  if (pgvectorReady) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS corpus_embeddings (
          article_id BIGINT NOT NULL REFERENCES corpus_articles(id) ON DELETE CASCADE,
          model      TEXT NOT NULL DEFAULT 'text-embedding-004',
          embedding  vector(768) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          PRIMARY KEY (article_id, model)
        );
      `);
      // HNSW index can be slow to build on big tables; isolate so a failure here
      // doesn't abort startup — queries still work without it (just slower).
      await pool.query(
        `CREATE INDEX IF NOT EXISTS corpus_embeddings_hnsw
           ON corpus_embeddings USING hnsw (embedding vector_cosine_ops)`
      ).catch(e => console.warn('[DB] HNSW index skipped:', e.message));
      await pool.query(`ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS centroid vector(768)`)
        .catch(e => console.warn('[DB] cluster centroid column skipped:', e.message));
    } catch (err) {
      // If the embeddings table can't be created, fall back to FTS-only.
      pgvectorReady = false;
      console.warn('[DB] corpus_embeddings setup failed — FTS-only mode:', err.message);
    }
  }

  console.log(`[DB] Corpus V2 ready ✓ (pgvector=${pgvectorReady})`);
}

// ── Content Cache ─────────────────────────────────────────────────────────────

export async function cacheGet(key) {
  if (!pool) return null;
  try {
    const { rows } = await pool.query(
      `SELECT data, degraded, updated_at, ttl_seconds FROM content_cache WHERE key = $1`,
      [key]
    );
    if (!rows.length) return null;
    const row = rows[0];
    const ageSeconds = (Date.now() - new Date(row.updated_at).getTime()) / 1000;
    return {
      data: row.data,
      degraded: row.degraded,
      isStale: ageSeconds > row.ttl_seconds,
      ageSeconds: Math.round(ageSeconds),
      ttl_seconds: row.ttl_seconds,   // needed by cacheGetLayered to compute remainTTL
    };
  } catch (err) {
    console.error('[DB:cacheGet]', err.message);
    return null;
  }
}

export async function cacheSet(key, data, ttlSeconds, degraded = false, topic = null, lang = null) {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO content_cache (key, data, ttl_seconds, degraded, updated_at, topic, lang, search_count, last_searched)
       VALUES ($1, $2, $3, $4, now(), $5, $6, 1, now())
       ON CONFLICT (key) DO UPDATE
         SET data = $2, ttl_seconds = $3, degraded = $4, updated_at = now(),
             topic = COALESCE($5, content_cache.topic),
             lang  = COALESCE($6, content_cache.lang),
             search_count  = content_cache.search_count + 1,
             last_searched = now()`,
      [key, JSON.stringify(data), ttlSeconds, degraded, topic, lang]
    );
  } catch (err) {
    console.error('[DB:cacheSet]', err.message);
  }
}

// Increment search_count when cache is hit (fire-and-forget)
export async function cacheHit(key) {
  if (!pool) return;
  pool.query(
    `UPDATE content_cache SET search_count = search_count + 1, last_searched = now() WHERE key = $1`,
    [key]
  ).catch(() => {});
}

// Return public analyses grouped by topic (same topic in multiple langs = one entry)
export async function getPublicAnalyses(limit = 20, userId = null) {
  if (!pool) return [];
  try {
    const { rows } = await pool.query(
      `SELECT
         lower(topic)                                                              AS topic_norm,
         (array_agg(topic          ORDER BY search_count DESC))[1]               AS topic,
         array_agg(DISTINCT lang   ORDER BY lang)                                AS langs,
         SUM(search_count)                                                        AS search_count,
         SUM(COALESCE(view_count, 0))                                             AS view_count,
         MAX(last_searched)                                                       AS last_searched,
         -- coverage from the most-searched lang row
         (array_agg(data->'coverage_distribution' ORDER BY search_count DESC))[1] AS coverage,
         -- summary snippet (~150 chars) from overall_non_partisan_analysis
         LEFT((array_agg(data->>'overall_non_partisan_analysis' ORDER BY search_count DESC))[1], 150) AS summary,
         -- total source count across all spectrum sides
         (array_agg(
           COALESCE(jsonb_array_length(data->'news_spectrum'->'left'),         0) +
           COALESCE(jsonb_array_length(data->'news_spectrum'->'center_left'),  0) +
           COALESCE(jsonb_array_length(data->'news_spectrum'->'center'),       0) +
           COALESCE(jsonb_array_length(data->'news_spectrum'->'center_right'), 0) +
           COALESCE(jsonb_array_length(data->'news_spectrum'->'right'),        0)
           ORDER BY search_count DESC
         ))[1]                                                                    AS source_count,
         -- like count
         COUNT(DISTINCT al.id)                                                    AS like_count,
         -- did the current user like this?
         BOOL_OR(al.user_id = $2)                                                AS user_liked
       FROM content_cache cc
       LEFT JOIN analysis_likes al ON al.topic_norm = lower(cc.topic)
       WHERE cc.topic IS NOT NULL AND cc.degraded = false
         AND cc.last_searched > now() - INTERVAL '48 hours'
       GROUP BY lower(cc.topic)
       ORDER BY SUM(cc.search_count) DESC, MAX(cc.last_searched) DESC
       LIMIT $1`,
      [limit, userId]
    );
    return rows;
  } catch (err) {
    console.error('[DB:getPublicAnalyses]', err.message);
    return [];
  }
}

// Increment view_count when a cached analysis is opened (fire-and-forget)
export async function incrementViewCount(topicNorm) {
  if (!pool) return;
  pool.query(
    `UPDATE content_cache SET view_count = COALESCE(view_count, 0) + 1
     WHERE lower(topic) = lower($1) AND topic IS NOT NULL`,
    [topicNorm]
  ).catch(() => {});
}

// Toggle like — returns { liked: bool, like_count: number }
export async function toggleAnalysisLike(topicNorm, userId) {
  if (!pool) return { liked: false, like_count: 0 };
  try {
    // Try to insert; if already exists, delete instead
    const { rowCount } = await pool.query(
      `INSERT INTO analysis_likes (topic_norm, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [topicNorm, userId]
    );
    const liked = rowCount > 0;
    if (!liked) {
      await pool.query(`DELETE FROM analysis_likes WHERE topic_norm = $1 AND user_id = $2`, [topicNorm, userId]);
    }
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM analysis_likes WHERE topic_norm = $1`, [topicNorm]
    );
    return { liked, like_count: Number(rows[0]?.cnt ?? 0) };
  } catch (err) {
    console.error('[DB:toggleAnalysisLike]', err.message);
    return { liked: false, like_count: 0 };
  }
}

// Get topics liked by a user (with display name from content_cache)
export async function getLikedAnalyses(userId) {
  if (!pool) return [];
  try {
    const { rows } = await pool.query(
      `SELECT al.topic_norm, al.created_at AS liked_at,
              (SELECT topic FROM content_cache WHERE lower(topic) = al.topic_norm AND topic IS NOT NULL LIMIT 1) AS topic,
              (SELECT lang  FROM content_cache WHERE lower(topic) = al.topic_norm AND topic IS NOT NULL ORDER BY search_count DESC LIMIT 1) AS lang
       FROM analysis_likes al
       WHERE al.user_id = $1
       ORDER BY al.created_at DESC
       LIMIT 50`,
      [userId]
    );
    return rows.filter(r => r.topic); // skip if cache was cleared
  } catch (err) {
    console.error('[DB:getLikedAnalyses]', err.message);
    return [];
  }
}

// Get user's media spectrum — aggregate coverage from all their searches
export async function getUserMediaSpectrum(userId) {
  if (!pool) return null;
  try {
    const { rows } = await pool.query(
      `SELECT
         AVG((coverage_json->'left'     ->>'percent')::float)        AS left_pct,
         AVG((coverage_json->'center_left'->>'percent')::float)      AS center_left_pct,
         AVG((coverage_json->'center'   ->>'percent')::float)        AS center_pct,
         AVG((coverage_json->'center_right'->>'percent')::float)     AS center_right_pct,
         AVG((coverage_json->'right'    ->>'percent')::float)        AS right_pct,
         COUNT(*)                                                     AS total_searches
       FROM user_searches
       WHERE user_id = $1 AND coverage_json IS NOT NULL`,
      [userId]
    );
    if (!rows[0] || !rows[0].total_searches) return null;
    return {
      left:          Math.round(rows[0].left_pct          ?? 0),
      center_left:   Math.round(rows[0].center_left_pct   ?? 0),
      center:        Math.round(rows[0].center_pct        ?? 0),
      center_right:  Math.round(rows[0].center_right_pct  ?? 0),
      right:         Math.round(rows[0].right_pct         ?? 0),
      total_searches: Number(rows[0].total_searches),
    };
  } catch (err) {
    console.error('[DB:getUserMediaSpectrum]', err.message);
    return null;
  }
}

// ── Search Analytics ──────────────────────────────────────────────────────────

export async function logSearch({ topic, lang, degraded, cacheHit, userId, ipHash }) {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO searches (topic, topic_norm, lang, degraded, cache_hit, user_id, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [topic, topic.toLowerCase().trim(), lang, degraded || false, cacheHit || false, userId || null, ipHash || null]
    );
  } catch (err) {
    console.error('[DB:logSearch]', err.message);
  }
}

export async function getTopTopicsDB(limit = 20) {
  if (!pool) return null;
  try {
    const { rows } = await pool.query(
      `SELECT topic_norm AS topic, COUNT(*) AS count,
              MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
       FROM searches
       GROUP BY topic_norm
       ORDER BY count DESC
       LIMIT $1`,
      [limit]
    );
    return rows.map(r => ({ ...r, count: parseInt(r.count) }));
  } catch (err) {
    console.error('[DB:getTopTopics]', err.message);
    return null;
  }
}

export async function getAdminStats() {
  if (!pool) return null;
  try {
    const today = new Date().toISOString().split('T')[0];

    const [total, todayCount, cacheSize, topTopics, hourly] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM searches`),
      pool.query(`SELECT COUNT(*) FROM searches WHERE created_at >= $1::date`, [today]),
      pool.query(`SELECT COUNT(*) FROM content_cache`),
      pool.query(
        `SELECT topic_norm AS topic, COUNT(*) AS count
         FROM searches GROUP BY topic_norm ORDER BY count DESC LIMIT 10`
      ),
      pool.query(
        `SELECT date_trunc('hour', created_at) AS hour, COUNT(*) AS count
         FROM searches WHERE created_at >= now() - interval '24 hours'
         GROUP BY hour ORDER BY hour`
      ),
    ]);

    return {
      totalSearches:  parseInt(total.rows[0].count),
      searchesToday:  parseInt(todayCount.rows[0].count),
      cachedItems:    parseInt(cacheSize.rows[0].count),
      topTopics:      topTopics.rows.map(r => ({ topic: r.topic, count: parseInt(r.count) })),
      hourlyLast24h:  hourly.rows,
    };
  } catch (err) {
    console.error('[DB:getAdminStats]', err.message);
    return null;
  }
}

// ── Per-IP / Per-User Daily Usage ─────────────────────────────────────────────

export async function getUsageDB(identifier) {
  if (!pool) return null;
  try {
    const today = new Date().toISOString().split('T')[0];
    const { rows } = await pool.query(
      `SELECT count FROM user_daily_usage WHERE identifier = $1 AND date = $2`,
      [identifier, today]
    );
    return rows.length ? parseInt(rows[0].count) : 0;
  } catch (err) {
    console.error('[DB:getUsage]', err.message);
    return null;
  }
}

export async function incrementUsageDB(identifier) {
  if (!pool) return;
  try {
    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      `INSERT INTO user_daily_usage (identifier, date, count, updated_at)
       VALUES ($1, $2, 1, now())
       ON CONFLICT (identifier, date) DO UPDATE
         SET count = user_daily_usage.count + 1, updated_at = now()`,
      [identifier, today]
    );
  } catch (err) {
    console.error('[DB:incrementUsage]', err.message);
  }
}

// ── User Auth ────────────────────────────────────────────────────────────────

export async function createUser(email, passwordHash) {
  if (!pool) throw new Error('DB not available');
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, tier, daily_limit`,
    [email, passwordHash]
  );
  return rows[0];
}

/**
 * Create or reset a dev/test account.
 * Sets email_verified=true and daily_limit=-1 regardless of existing state.
 * Only called from the protected /api/dev/ensure-test-user endpoint.
 */
export async function upsertDevUser(email, passwordHash) {
  if (!pool) throw new Error('DB not available');
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, email_verified, daily_limit, is_active)
     VALUES ($1, $2, true, -1, true)
     ON CONFLICT (email) DO UPDATE
       SET password_hash   = EXCLUDED.password_hash,
           email_verified  = true,
           daily_limit     = -1,
           is_active       = true
     RETURNING id, email, tier, daily_limit, email_verified`,
    [email.toLowerCase().trim(), passwordHash]
  );
  return rows[0];
}

export async function findUserByEmail(email) {
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, tier, daily_limit, is_active, email_verified FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  return rows[0] || null;
}

export async function findUserById(id) {
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT id, email, tier, daily_limit, created_at, email_verified, email_digest FROM users WHERE id = $1 AND is_active = true`,
    [id]
  );
  return rows[0] || null;
}

export async function updateLastLogin(userId) {
  if (!pool) return;
  await pool.query(`UPDATE users SET last_login = now() WHERE id = $1`, [userId]);
}

export async function getUsersAdmin(limit = 50) {
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT id, email, tier, daily_limit, created_at, last_login,
            (SELECT COUNT(*) FROM searches WHERE user_id = users.id) AS search_count
     FROM users ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function updateUserTier(id, tier, dailyLimit) {
  if (!pool) throw new Error('DB not available');
  const { rows } = await pool.query(
    `UPDATE users SET tier = $1, daily_limit = $2 WHERE id = $3
     RETURNING id, email, tier, daily_limit`,
    [tier, dailyLimit, id]
  );
  return rows[0] || null;
}

// ── User Search History ───────────────────────────────────────────────────────

export async function saveUserSearch(userId, topic, lang, coverageJson) {
  if (!pool) throw new Error('DB not available');
  const { rows } = await pool.query(
    `INSERT INTO user_searches (user_id, topic, lang, coverage_json)
     VALUES ($1, $2, $3, $4)
     RETURNING id, topic, lang, coverage_json, created_at`,
    [userId, topic, lang, JSON.stringify(coverageJson || null)]
  );
  return rows[0];
}

export async function getUserSearchHistory(userId, limit = 100) {
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT id, topic, lang, coverage_json, created_at
     FROM user_searches WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

export async function deleteUserSearch(userId, searchId) {
  if (!pool) return;
  await pool.query(
    `DELETE FROM user_searches WHERE id = $1 AND user_id = $2`,
    [searchId, userId]
  );
}

// ── Email Verification ────────────────────────────────────────────────────────

export async function setEmailVerifyToken(userId, tokenHash, expiresAt) {
  if (!pool) throw new Error('DB not available');
  await pool.query(
    `UPDATE users SET email_verify_token = $1, email_verify_expires = $2 WHERE id = $3`,
    [tokenHash, expiresAt, userId]
  );
}

export async function verifyEmailToken(tokenHash) {
  if (!pool) return null;
  const { rows } = await pool.query(
    `UPDATE users
     SET email_verified = true, email_verify_token = NULL, email_verify_expires = NULL
     WHERE email_verify_token = $1
       AND email_verify_expires > now()
       AND is_active = true
     RETURNING id, email, tier, daily_limit, email_verified`,
    [tokenHash]
  );
  return rows[0] || null;
}

// ── Password Reset ─────────────────────────────────────────────────────────────

export async function setResetToken(email, tokenHash, expiresAt) {
  if (!pool) return null;
  const { rows } = await pool.query(
    `UPDATE users SET reset_token = $1, reset_token_expires = $2
     WHERE email = $3 AND is_active = true
     RETURNING id`,
    [tokenHash, expiresAt, email.toLowerCase().trim()]
  );
  return rows[0] || null;
}

export async function useResetToken(tokenHash, newPasswordHash) {
  if (!pool) return null;
  const { rows } = await pool.query(
    `UPDATE users
     SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL
     WHERE reset_token = $2
       AND reset_token_expires > now()
       AND is_active = true
     RETURNING id, email, tier, daily_limit, email_verified`,
    [newPasswordHash, tokenHash]
  );
  return rows[0] || null;
}

// ── Account Management ────────────────────────────────────────────────────────

export async function updateUserPassword(userId, passwordHash) {
  if (!pool) throw new Error('DB not available');
  await pool.query(
    `UPDATE users SET password_hash = $1 WHERE id = $2`,
    [passwordHash, userId]
  );
}

export async function updateUserEmail(userId, email) {
  if (!pool) throw new Error('DB not available');
  const { rows } = await pool.query(
    `UPDATE users
     SET email = $1, email_verified = false, email_verify_token = NULL
     WHERE id = $2
     RETURNING id, email, tier, daily_limit`,
    [email.toLowerCase().trim(), userId]
  );
  return rows[0] || null;
}

export async function softDeleteUser(userId) {
  if (!pool) throw new Error('DB not available');
  // Anonymise PII rather than hard-delete (GDPR Art. 17 — right to erasure)
  const anon = `deleted_${userId}_${Date.now()}@deleted.invalid`;
  await pool.query(
    `UPDATE users
     SET is_active = false, email = $1, password_hash = 'DELETED',
         email_verify_token = NULL, reset_token = NULL
     WHERE id = $2`,
    [anon, userId]
  );
}

export async function exportUserData(userId) {
  if (!pool) return null;
  const [userRes, searchesRes, historyRes] = await Promise.all([
    pool.query(
      `SELECT id, email, tier, daily_limit, created_at, last_login, email_verified
       FROM users WHERE id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT topic, lang, degraded, cache_hit, created_at
       FROM searches WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    ),
    pool.query(
      `SELECT topic, lang, coverage_json, created_at
       FROM user_searches WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    ),
  ]);
  return {
    exported_at: new Date().toISOString(),
    account: userRes.rows[0] || null,
    searches: searchesRes.rows,
    saved_analyses: historyRes.rows,
  };
}

// ── Login brute-force protection ─────────────────────────────────────────────

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES    = 30;

/**
 * Call after a FAILED login attempt.
 * Returns { locked: true, lockedUntil: Date } if the account is now locked,
 * or { locked: false, attemptsLeft: N } otherwise.
 */
export async function recordFailedLogin(email) {
  if (!pool) return { locked: false, attemptsLeft: MAX_LOGIN_ATTEMPTS };
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000);

  const res = await pool.query(`
    UPDATE users
    SET login_attempts = login_attempts + 1,
        locked_until   = CASE
          WHEN login_attempts + 1 >= $1 THEN $2
          ELSE locked_until
        END
    WHERE email = $3
    RETURNING login_attempts, locked_until
  `, [MAX_LOGIN_ATTEMPTS, lockedUntil, email.toLowerCase().trim()]);

  if (!res.rows[0]) return { locked: false, attemptsLeft: MAX_LOGIN_ATTEMPTS };
  const { login_attempts, locked_until } = res.rows[0];
  if (locked_until && new Date(locked_until) > now) {
    return { locked: true, lockedUntil: new Date(locked_until) };
  }
  return { locked: false, attemptsLeft: Math.max(0, MAX_LOGIN_ATTEMPTS - login_attempts) };
}

/**
 * Check if an account is currently locked.
 * Returns { locked: true, lockedUntil, minutesLeft } or { locked: false }.
 */
export async function checkAccountLock(email) {
  if (!pool) return { locked: false };
  const res = await pool.query(
    `SELECT locked_until FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  if (!res.rows[0]?.locked_until) return { locked: false };
  const lockedUntil = new Date(res.rows[0].locked_until);
  if (lockedUntil <= new Date()) return { locked: false }; // expired
  const minutesLeft = Math.ceil((lockedUntil - new Date()) / 60000);
  return { locked: true, lockedUntil, minutesLeft };
}

/**
 * Call after a SUCCESSFUL login — resets attempt counter and clears lock.
 */
export async function clearLoginAttempts(email) {
  if (!pool) return;
  await pool.query(
    `UPDATE users SET login_attempts = 0, locked_until = NULL WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
}

// ── Saved Topics (Bookmarks) ──────────────────────────────────────────────────

export async function getSavedTopics(userId) {
  if (!pool) return [];
  try {
    const { rows } = await pool.query(
      `SELECT id, topic, topic_norm, lang, saved_at
       FROM saved_topics WHERE user_id = $1
       ORDER BY saved_at DESC LIMIT 100`,
      [userId]
    );
    return rows;
  } catch (err) {
    console.error('[DB:getSavedTopics]', err.message);
    return [];
  }
}

export async function saveTopic(userId, topic, topicNorm, lang) {
  if (!pool) throw new Error('DB not available');
  try {
    const { rows } = await pool.query(
      `INSERT INTO saved_topics (user_id, topic, topic_norm, lang)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, topic_norm) DO UPDATE
         SET topic = $2, lang = $4, saved_at = now()
       RETURNING id, topic, topic_norm, lang, saved_at`,
      [userId, topic, topicNorm, lang || 'de']
    );
    return rows[0];
  } catch (err) {
    console.error('[DB:saveTopic]', err.message);
    throw err;
  }
}

export async function unsaveTopic(userId, topicNorm) {
  if (!pool) return { ok: false };
  try {
    await pool.query(
      `DELETE FROM saved_topics WHERE user_id = $1 AND topic_norm = $2`,
      [userId, topicNorm]
    );
    return { ok: true };
  } catch (err) {
    console.error('[DB:unsaveTopic]', err.message);
    return { ok: false };
  }
}

export async function isTopicSaved(userId, topicNorm) {
  if (!pool) return false;
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM saved_topics WHERE user_id = $1 AND topic_norm = $2`,
      [userId, topicNorm]
    );
    return rows.length > 0;
  } catch (err) {
    console.error('[DB:isTopicSaved]', err.message);
    return false;
  }
}

// ── Email Digest ──────────────────────────────────────────────────────────────

export async function getDigestSubscribers() {
  if (!pool) return [];
  try {
    const { rows } = await pool.query(
      `SELECT id, email FROM users WHERE email_digest = true AND is_active = true AND email_verified = true`
    );
    return rows;
  } catch (err) {
    console.error('[DB:getDigestSubscribers]', err.message);
    return [];
  }
}

export async function setDigestPreference(userId, enabled) {
  if (!pool) throw new Error('DB not available');
  try {
    await pool.query(
      `UPDATE users SET email_digest = $1 WHERE id = $2`,
      [Boolean(enabled), userId]
    );
    return { ok: true };
  } catch (err) {
    console.error('[DB:setDigestPreference]', err.message);
    throw err;
  }
}

export async function saveSuggestion({ name, email, url, spectrum, why }) {
  if (!pool) throw new Error('DB not available');
  try {
    const { rows } = await pool.query(
      `INSERT INTO source_suggestions (name, email, url, spectrum, why)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        (name || '').trim().slice(0, 100) || null,
        (email || '').trim().slice(0, 200) || null,
        (url || '').trim().slice(0, 500),
        (spectrum || 'unsure').slice(0, 20),
        (why || '').trim().slice(0, 1000),
      ]
    );
    return rows[0];
  } catch (err) {
    console.error('[DB:saveSuggestion]', err.message);
    throw err;
  }
}

// ── Corpus V2 data helpers ─────────────────────────────────────────────────────
//
// Thin wrappers around the pure SQL builders in lib/corpusQueries.js. Query
// construction (and all its branching) is unit-tested there; these wrappers only
// add the live pool.query call + null-safety when the DB is unavailable.

/** Upsert a corpus article. Returns { id, inserted } or null when DB is down. */
export async function upsertCorpusArticle(article) {
  if (!pool) return null;
  try {
    const { text, values } = buildUpsertArticleQuery(article);
    const { rows } = await pool.query(text, values);
    return rows[0] || null;
  } catch (err) {
    console.error('[DB:upsertCorpusArticle]', err.message);
    throw err;
  }
}

/**
 * Of the given article ids, return those that have NO embedding yet (audit fix
 * A6 — delta embedding: the worker re-runs every 30 min over mostly-unchanged
 * feeds; re-embedding ~1000 unchanged articles per pass burned the quota).
 * Returns [] without pgvector/DB (caller then skips embedding entirely).
 */
export async function listArticleIdsMissingEmbeddings(articleIds) {
  if (!pool || !pgvectorReady) return [];
  const ids = (articleIds || []).map(n => parseInt(n, 10)).filter(Number.isInteger);
  if (!ids.length) return [];
  try {
    const { rows } = await pool.query(
      `SELECT a.id FROM corpus_articles a
       WHERE a.id = ANY($1::bigint[])
         AND NOT EXISTS (SELECT 1 FROM corpus_embeddings e WHERE e.article_id = a.id)`,
      [ids]
    );
    return rows.map(r => Number(r.id));
  } catch (err) {
    console.error('[DB:listArticleIdsMissingEmbeddings]', err.message);
    return [];
  }
}

/** Store/replace an article embedding. No-op (returns false) without pgvector. */
export async function upsertCorpusEmbedding(articleId, embedding, model) {
  if (!pool || !pgvectorReady) return false;
  try {
    const { text, values } = buildUpsertEmbeddingQuery(articleId, embedding, model);
    await pool.query(text, values);
    return true;
  } catch (err) {
    console.error('[DB:upsertCorpusEmbedding]', err.message);
    throw err;
  }
}

/** Lexical (FTS) corpus retrieval. Always available. */
export async function searchCorpusFTS(keywords, opts = {}) {
  if (!pool) return [];
  const spec = buildFTSQuery(keywords, opts);
  if (!spec) return [];
  try {
    const { rows } = await pool.query(spec.text, spec.values);
    return rows.map(normalizeArticleRow);
  } catch (err) {
    console.error('[DB:searchCorpusFTS]', err.message);
    return [];
  }
}

/**
 * Semantic (vector) corpus retrieval. Falls back to FTS automatically when
 * pgvector is unavailable, so callers get results either way.
 *
 * @param {number[]} embedding — query vector
 * @param {string[]} keywords  — used for the FTS fallback path
 */
export async function searchCorpusSemantic(embedding, keywords, opts = {}) {
  if (!pool) return [];
  if (!pgvectorReady) return searchCorpusFTS(keywords, opts);
  try {
    const { text, values } = buildVectorQuery(embedding, opts);
    const { rows } = await pool.query(text, values);
    return rows.map(normalizeArticleRow);
  } catch (err) {
    console.error('[DB:searchCorpusSemantic] vector path failed, falling back to FTS:', err.message);
    return searchCorpusFTS(keywords, opts);
  }
}

/**
 * Hybrid corpus retrieval: run semantic (vector) + lexical (FTS) in parallel and
 * fuse with Reciprocal Rank Fusion. Falls back cleanly: when pgvector is off,
 * searchCorpusSemantic already returns FTS results, so fusion still works (the two
 * lists may overlap heavily — RRF dedups by id).
 *
 * @param {number[]|null} embedding — query vector (null → lexical-only)
 * @param {string[]} keywords       — for the FTS path
 * @param {object} opts — { spectra?, sinceDate?, limit?, perSpectrum?, k? }
 * @returns {Promise<{ranked, grouped, meta}>}
 */
export async function searchCorpusHybrid(embedding, keywords, opts = {}) {
  if (!pool) return { ranked: [], grouped: {}, meta: { semanticCount: 0, lexicalCount: 0, fusedCount: 0, returnedCount: 0, bothRetrieversCount: 0 } };
  const retrieveLimit = Math.min(200, Math.max(1, parseInt(opts.limit, 10) || 50));
  const [semantic, lexical] = await Promise.all([
    embedding ? searchCorpusSemantic(embedding, keywords, { ...opts, limit: retrieveLimit }) : Promise.resolve([]),
    searchCorpusFTS(keywords, { ...opts, limit: retrieveLimit }),
  ]);
  return combineRetrieval({
    semantic, lexical,
    k: opts.k,
    limit: opts.limit ?? 50,
    perSpectrum: opts.perSpectrum,
  });
}

/** Record a successful feed fetch (resets the failure counter). */
export async function recordFeedSuccess(feedUrl, sourceName, spectrum) {
  if (!pool) return;
  try {
    const { text, values } = buildFeedSuccessQuery(feedUrl, sourceName, spectrum);
    await pool.query(text, values);
  } catch (err) {
    console.error('[DB:recordFeedSuccess]', err.message);
  }
}

/** Record a failed feed fetch (increments counter, escalates status). */
export async function recordFeedFailure(feedUrl, sourceName, spectrum) {
  if (!pool) return;
  try {
    const { text, values } = buildFeedFailureQuery(feedUrl, sourceName, spectrum);
    await pool.query(text, values);
  } catch (err) {
    console.error('[DB:recordFeedFailure]', err.message);
  }
}

/**
 * Corpus + feed-health stats for the admin metrics dashboard (audit fix A4).
 * Single round trip per query; null-safe when DB is down.
 */
export async function getCorpusStats() {
  if (!pool) return null;
  try {
    const [bySpectrum, embeddings, feeds] = await Promise.all([
      pool.query(`SELECT spectrum, COUNT(*)::int AS n, MAX(fetched_at) AS last_fetched
                  FROM corpus_articles GROUP BY spectrum`),
      pgvectorReady
        ? pool.query(`SELECT COUNT(*)::int AS n FROM corpus_embeddings`)
        : Promise.resolve({ rows: [{ n: 0 }] }),
      pool.query(`SELECT feed_url, source_name, spectrum, status, consecutive_failures,
                         last_success, last_failure
                  FROM feed_health ORDER BY status DESC, source_name`),
    ]);
    const spectra = {};
    let total = 0, lastFetched = null;
    for (const r of bySpectrum.rows) {
      spectra[r.spectrum] = r.n;
      total += r.n;
      if (!lastFetched || (r.last_fetched && r.last_fetched > lastFetched)) lastFetched = r.last_fetched;
    }
    return {
      articles: { total, bySpectrum: spectra, lastFetched },
      embeddings: embeddings.rows[0]?.n ?? 0,
      pgvector: pgvectorReady,
      feeds: feeds.rows,
      feedsDown: feeds.rows.filter(f => f.status !== 'ok').length,
    };
  } catch (err) {
    console.error('[DB:getCorpusStats]', err.message);
    return null;
  }
}

/** Get feeds that are degraded/down (optionally per spectrum). */
export async function getDownFeeds(spectra) {
  if (!pool) return [];
  try {
    const { text, values } = buildDownFeedsQuery(spectra);
    const { rows } = await pool.query(text, values);
    return rows;
  } catch (err) {
    console.error('[DB:getDownFeeds]', err.message);
    return [];
  }
}

/** Upsert a source's spectrum rating with provenance. */
export async function upsertSourceRating(rating) {
  if (!pool) return null;
  try {
    const { text, values } = buildUpsertSourceRatingQuery(rating);
    await pool.query(text, values);
    return { ok: true };
  } catch (err) {
    console.error('[DB:upsertSourceRating]', err.message);
    throw err;
  }
}

/** Get a single source's rating by domain (normalized). */
export async function getSourceRating(domain) {
  if (!pool) return null;
  try {
    const norm = String(domain || '').toLowerCase().replace(/^www\./, '');
    const { rows } = await pool.query(
      `SELECT source_domain, source_name, spectrum, tier, factual_rating, rating_source, confidence, reach_weight, notes
       FROM source_ratings WHERE source_domain = $1`,
      [norm]
    );
    return rows[0] || null;
  } catch (err) {
    console.error('[DB:getSourceRating]', err.message);
    return null;
  }
}

export async function closeDB() {
  if (pool) {
    await pool.end().catch(e => console.error('[DB] pool.end error:', e.message));
    pool = null;
    console.log('[DB] Pool closed');
  }
}

export default { initDB, isDBAvailable, closeDB, cacheGet, cacheSet, cacheHit, getPublicAnalyses, incrementViewCount, toggleAnalysisLike, getLikedAnalyses, getUserMediaSpectrum, logSearch, getTopTopicsDB, getAdminStats, getUsageDB, incrementUsageDB, createUser, findUserByEmail, findUserById, updateLastLogin, getUsersAdmin, updateUserTier, saveUserSearch, getUserSearchHistory, deleteUserSearch, getSavedTopics, saveTopic, unsaveTopic, isTopicSaved, getDigestSubscribers, setDigestPreference };
