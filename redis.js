/**
 * redis.js — Upstash/Redis connection + helpers
 *
 * Falls back gracefully if REDIS_URL is not set.
 * All public functions are no-ops / return null when Redis is unavailable.
 *
 * Key prefix: "nn:" so we don't collide with other apps on the same Redis.
 */

import Redis from 'ioredis';

let client = null;

export function isRedisAvailable() {
  return client !== null && client.status === 'ready';
}

// Expose raw client for rate-limit-redis RedisStore
export function getRedisClient() { return client; }

export async function initRedis() {
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
  if (!url) {
    console.warn('[Redis] No REDIS_URL set — running without Redis (NodeCache fallback only)');
    return false;
  }

  try {
    const isTLS = url.startsWith('rediss://');
    client = new Redis(url, {
      maxRetriesPerRequest: 2,
      connectTimeout:       5000,
      lazyConnect:          false,
      tls: isTLS ? { rejectUnauthorized: false } : undefined,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
    });

    // Suppress ioredis "Unhandled error event" logs — errors are caught via try/catch
    client.on('error', (err) => {
      if (client) console.warn('[Redis] Connection error:', err.message);
    });

    await client.ping();
    console.log('[Redis] Connected ✓');
    return true;
  } catch (err) {
    console.error('[Redis] Connection failed:', err.message);
    try { await client?.quit(); } catch {}
    client = null;
    return false;
  }
}

export async function closeRedis() {
  if (client) {
    try { await client.quit(); } catch {}
    client = null;
    console.log('[Redis] Connection closed');
  }
}

// ── Cache ─────────────────────────────────────────────────────────────────────

export async function rGet(key) {
  if (!client) return null;
  try {
    const val = await client.get(`nn:${key}`);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    console.error('[Redis:get]', err.message);
    return null;
  }
}

export async function rSet(key, data, ttlSeconds) {
  if (!client) return;
  // Redis SETEX requires a positive integer — guard against NaN/float/undefined
  const ttl = Math.max(1, Math.round(Number(ttlSeconds) || 3600));
  try {
    await client.setex(`nn:${key}`, ttl, JSON.stringify(data));
  } catch (err) {
    console.error('[Redis:set]', err.message);
  }
}

export async function rDel(key) {
  if (!client) return;
  try { await client.del(`nn:${key}`); } catch {}
}

// ── Per-IP Rate Limiting ──────────────────────────────────────────────────────
// Key: nn:usage:{ip}:{YYYY-MM-DD}, expires at midnight UTC

function todayKey(ip) {
  const today = new Date().toISOString().split('T')[0];
  return `nn:usage:${ip}:${today}`;
}

function secondsUntilMidnightUTC() {
  const now  = new Date();
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
  ));
  return Math.max(1, Math.floor((midnight.getTime() - now.getTime()) / 1000));
}

export async function rGetUsage(ip) {
  if (!client) return null;
  try {
    const val = await client.get(todayKey(ip));
    return val !== null ? parseInt(val, 10) : 0;
  } catch { return null; }
}

export async function rIncrUsage(ip) {
  if (!client) return;
  try {
    const key = todayKey(ip);
    const ttl = secondsUntilMidnightUTC();
    const pl  = client.pipeline();
    pl.incr(key);
    pl.expire(key, ttl);
    await pl.exec();
  } catch (err) {
    console.error('[Redis:incrUsage]', err.message);
  }
}

// ── Analytics ─────────────────────────────────────────────────────────────────
// topic_stats  → sorted set: ZINCRBY nn:topic_stats 1 "topic"
// topic_names  → hash: HSET nn:topic_names topic_lower "Original Topic"
// total_analyses → INCR nn:total_analyses

export async function rTrackSearch(topic) {
  if (!client) return;
  try {
    const lower = topic.toLowerCase().trim();
    const pl    = client.pipeline();
    pl.incr('nn:total_analyses');
    pl.zincrby('nn:topic_stats', 1, lower);
    pl.hset('nn:topic_names', lower, topic);
    await pl.exec();
  } catch (err) {
    console.error('[Redis:trackSearch]', err.message);
  }
}

export async function rGetTopTopics(limit = 10) {
  if (!client) return null;
  try {
    // Returns flat array: [key, score, key, score, ...]
    const raw = await client.zrevrange('nn:topic_stats', 0, limit - 1, 'WITHSCORES');
    if (!raw.length) return [];
    const keys  = raw.filter((_, i) => i % 2 === 0);
    const names = await client.hmget('nn:topic_names', ...keys);
    return keys.map((lower, i) => ({
      topic: names[i] || lower,
      count: parseInt(raw[i * 2 + 1], 10),
    }));
  } catch { return null; }
}

export async function rGetTotalAnalyses() {
  if (!client) return null;
  try {
    const val = await client.get('nn:total_analyses');
    return val !== null ? parseInt(val, 10) : 0;
  } catch { return null; }
}

export async function rGetUniqueTopics() {
  if (!client) return null;
  try {
    return await client.zcard('nn:topic_stats');
  } catch { return null; }
}

// ── Server Stats ──────────────────────────────────────────────────────────────
// Persist cross-restart stats so admin dashboard is accurate.

export async function rIncrStat(field) {
  if (!client) return;
  try { await client.incr(`nn:stats:${field}`); } catch {}
}

export async function rGetStats() {
  if (!client) return null;
  try {
    const vals = await client.mget(
      'nn:stats:totalRequests',
      'nn:stats:cacheHits',
      'nn:stats:cacheMisses',
      'nn:stats:errors',
    );
    return {
      totalRequests: parseInt(vals[0] || 0, 10),
      cacheHits:     parseInt(vals[1] || 0, 10),
      cacheMisses:   parseInt(vals[2] || 0, 10),
      errors:        parseInt(vals[3] || 0, 10),
    };
  } catch { return null; }
}

export default {
  initRedis, isRedisAvailable, closeRedis,
  rGet, rSet, rDel,
  rGetUsage, rIncrUsage,
  rTrackSearch, rGetTopTopics, rGetTotalAnalyses, rGetUniqueTopics,
  rIncrStat, rGetStats,
};
