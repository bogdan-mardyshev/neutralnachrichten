/**
 * db.js — PostgreSQL connection pool + migrations + helpers
 *
 * Falls back gracefully if DATABASE_URL is not set (dev without DB).
 * All public functions return null/empty on DB unavailability — server never crashes.
 */

import pkg from 'pg';
const { Pool } = pkg;

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
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
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
      key         TEXT PRIMARY KEY,
      data        JSONB NOT NULL,
      degraded    BOOLEAN DEFAULT false,
      updated_at  TIMESTAMPTZ DEFAULT now(),
      ttl_seconds INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id            BIGSERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      tier          TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
      daily_limit   INTEGER DEFAULT 10,
      created_at    TIMESTAMPTZ DEFAULT now(),
      last_login    TIMESTAMPTZ,
      is_active     BOOLEAN DEFAULT true
    );

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
  console.log('[DB] Migrations done ✓');
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
    };
  } catch (err) {
    console.error('[DB:cacheGet]', err.message);
    return null;
  }
}

export async function cacheSet(key, data, ttlSeconds, degraded = false) {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO content_cache (key, data, ttl_seconds, degraded, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (key) DO UPDATE
         SET data = $2, ttl_seconds = $3, degraded = $4, updated_at = now()`,
      [key, JSON.stringify(data), ttlSeconds, degraded]
    );
  } catch (err) {
    console.error('[DB:cacheSet]', err.message);
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

export async function findUserByEmail(email) {
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, tier, daily_limit, is_active FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  return rows[0] || null;
}

export async function findUserById(id) {
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT id, email, tier, daily_limit, created_at FROM users WHERE id = $1 AND is_active = true`,
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

export default { initDB, isDBAvailable, cacheGet, cacheSet, logSearch, getTopTopicsDB, getAdminStats, getUsageDB, incrementUsageDB, createUser, findUserByEmail, findUserById, updateLastLogin, getUsersAdmin, updateUserTier, saveUserSearch, getUserSearchHistory, deleteUserSearch };
