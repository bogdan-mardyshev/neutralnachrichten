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

  // Incremental alterations — safe to run repeatedly (IF NOT EXISTS / DO NOTHING)
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified      BOOLEAN     DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token  TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_expires TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token          TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires  TIMESTAMPTZ;
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

// Return recent public analyses for the "already analyzed" block
export async function getPublicAnalyses(limit = 12) {
  if (!pool) return [];
  try {
    const { rows } = await pool.query(
      `SELECT key, topic, lang, search_count, last_searched,
              data->'coverage_distribution' AS coverage
       FROM content_cache
       WHERE topic IS NOT NULL AND degraded = false
         AND last_searched > now() - INTERVAL '48 hours'
       ORDER BY search_count DESC, last_searched DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  } catch (err) {
    console.error('[DB:getPublicAnalyses]', err.message);
    return [];
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
    `SELECT id, email, tier, daily_limit, created_at, email_verified FROM users WHERE id = $1 AND is_active = true`,
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

export async function closeDB() {
  if (pool) {
    await pool.end().catch(e => console.error('[DB] pool.end error:', e.message));
    pool = null;
    console.log('[DB] Pool closed');
  }
}

export default { initDB, isDBAvailable, closeDB, cacheGet, cacheSet, cacheHit, getPublicAnalyses, logSearch, getTopTopicsDB, getAdminStats, getUsageDB, incrementUsageDB, createUser, findUserByEmail, findUserById, updateLastLogin, getUsersAdmin, updateUserTier, saveUserSearch, getUserSearchHistory, deleteUserSearch };
