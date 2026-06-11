import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import NodeCache from 'node-cache';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as Sentry from '@sentry/node';
import fs from 'fs';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { extractJSON } from './lib/utils.js';
import { translateAnalysis } from './lib/translate.js';
import { SPECTRUMS, validateAnalysisStructure, buildDeepAnalysisPrompt } from './lib/analysisValidator.js';
import { createOAuthCode, consumeOAuthCode } from './lib/oauthCodes.js';
import { searchAllFeeds, buildCoverageDistribution, detectSilence, buildCoverageVolume, extractSearchKeywords, getInputWordCount } from './lib/rssSearch.js';
import { callGeminiWithRSSContext } from './lib/rssDirectAnalysis.js';
import { retrieveCorpusSpectra } from './lib/corpusRetrieval.js';
import { getEmbedding } from './lib/embeddings.js';
import { groundAnalysis, dedupeArticles } from './lib/citationGrounding.js';
import { verifyBlindspots } from './lib/blindspotVerification.js';
import { buildReliabilityEnvelope } from './lib/confidenceScore.js';
import { enrichDeepAnalysis, flattenSpectra } from './lib/deepAnalysisEnrich.js';
import { clusterArticles } from './lib/storyClustering.js';
import { metrics } from './lib/metrics.js';
import { initDB, isDBAvailable, closeDB, cacheGet, cacheSet, cacheHit, getPublicAnalyses, incrementViewCount, toggleAnalysisLike, getLikedAnalyses, getUserMediaSpectrum, logSearch, getUsageDB, incrementUsageDB, createUser, upsertDevUser, findUserByEmail, findUserById, updateLastLogin, getAdminStats as getAdminStatsDB, getTopTopicsDB, getUsersAdmin, updateUserTier, saveUserSearch, getUserSearchHistory, deleteUserSearch, setEmailVerifyToken, verifyEmailToken, setResetToken, useResetToken, updateUserPassword, updateUserEmail, softDeleteUser, exportUserData, recordFailedLogin, checkAccountLock, clearLoginAttempts, getSavedTopics, saveTopic, unsaveTopic, isTopicSaved, getDigestSubscribers, setDigestPreference, saveSuggestion, searchCorpusHybrid, getDownFeeds, getCorpusStats } from './db.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendWeeklyDigest } from './lib/email.js';
import { initRedis, isRedisAvailable, closeRedis, getRedisClient, rGet, rSet, rGetUsage, rIncrUsage, rTrackSearch, rGetTopTopics, rGetTotalAnalyses, rGetUniqueTopics, rIncrStat, rGetStats } from './redis.js';

dotenv.config();

// ── Sentry (audit fix A4): without this, production errors only ever hit stdout.
// No-op when SENTRY_DSN is unset (local dev). Must run before request handling.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.RAILWAY_ENVIRONMENT || 'development',
    tracesSampleRate: 0.1,
  });
  console.log('[Sentry] error reporting enabled');
} else {
  console.warn('[Sentry] SENTRY_DSN not set — errors only go to stdout');
}
/** Report an error to Sentry (if configured) without ever throwing. */
function reportError(err, context = {}) {
  try { if (process.env.SENTRY_DSN) Sentry.captureException(err, { extra: context }); } catch { /* never block on telemetry */ }
}

// ── DB + Redis init (non-blocking — server starts even without either) ────────
initDB().then(ok => {
  if (ok) console.log('[Server] PostgreSQL ready');
  else    console.warn('[Server] Running without PostgreSQL (in-memory only)');
});
initRedis().then(ok => {
  if (ok) console.log('[Server] Redis ready');
  else    console.warn('[Server] Running without Redis (NodeCache + DB fallback)');
});

const JWT_SECRET  = process.env.JWT_SECRET  || 'dev-secret-change-in-prod';
const JWT_EXPIRES = '30d';
const BASE_URL    = process.env.BASE_URL    || 'http://localhost:5173';

// ── Startup security checks ───────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET env variable is not set in production. Refusing to start.');
    process.exit(1);
  }
  if (process.env.JWT_SECRET === 'dev-secret-change-in-prod') {
    console.error('[FATAL] JWT_SECRET is using the default dev value in production. Refusing to start.');
    process.exit(1);
  }
}
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || 3001;

// Adaptive timeouts — two tiers:
//   SSE streaming endpoint: Railway does NOT kill at 60s (SSE is long-lived by design)
//   REST endpoint:          Railway hard-kills at ~60s — must stay under that
const IS_PRODUCTION = !!process.env.RAILWAY_ENVIRONMENT;
const GEMINI_TIMEOUT_SSE  = IS_PRODUCTION ? 90000 : 180000; // SSE path — no Railway kill
const GEMINI_ATTEMPT_TIMEOUT = IS_PRODUCTION ? 50000 : 90000; // REST path — stays under 60s kill
const GLOBAL_TIMEOUT_MS     = IS_PRODUCTION ? 58000 : 120000;
const GLOBAL_TRANSL_TIMEOUT = IS_PRODUCTION ? 35000 :  40000;

const rawKey = process.env.GEMINI_API_KEY || '';
const GEMINI_API_KEY = rawKey.replace(/["']/g, '').trim();

// Single genAI instance reused across all calls (query translate, search, analysis translate)
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "https://app.posthog.com", "https://eu-assets.i.posthog.com", "https://browser.sentry-cdn.com"],
      "connect-src": ["'self'", "https://app.posthog.com", "https://eu.i.posthog.com", "https://eu-assets.i.posthog.com", "https://generativelanguage.googleapis.com", "https://*.sentry.io"],
    },
  },
}));

app.use(cors());
app.use(express.json({ limit: '1kb' }));

// ── Health check (Railway uses this for zero-downtime deploys) ────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:        'ok',
    uptime:        Math.round(process.uptime()),
    db:            isDBAvailable(),
    redis:         isRedisAvailable(),
    gemini_active: geminiSemaphore.active,
    gemini_queue:  geminiSemaphore.waiting,
    gemini_limit:  geminiSemaphore.max,
    timestamp:     new Date().toISOString(),
  });
});

// Default 24h TTL; overridden per-item for degraded results
const cache = new NodeCache({ stdTTL: 86400 });

// SPECTRUMS, validateAnalysisStructure, buildDeepAnalysisPrompt imported from lib/analysisValidator.js

// ── Gemini Concurrency Limiter ────────────────────────────────────────────────
// Semaphore prevents thundering-herd: at most MAX_CONCURRENT_GEMINI simultaneous
// Gemini API calls (search + translation combined). Excess requests wait in queue.
class Semaphore {
  constructor(max) {
    this.max    = max;
    this._active = 0;
    this._queue  = [];
  }
  /**
   * Acquire a slot.
   * @param {number} timeoutMs — max ms to wait in queue; 0 = unlimited.
   *   If exceeded, rejects with Error('semaphore_timeout').
   */
  acquire(timeoutMs = 0) {
    return new Promise((resolve, reject) => {
      if (this._active < this.max) { this._active++; resolve(); return; }
      const entry = { resolve, reject, timer: null };
      this._queue.push(entry);
      if (timeoutMs > 0) {
        entry.timer = setTimeout(() => {
          const idx = this._queue.indexOf(entry);
          if (idx !== -1) this._queue.splice(idx, 1);
          reject(new Error('semaphore_timeout'));
        }, timeoutMs);
      }
    });
  }
  release() {
    if (this._queue.length > 0) {
      const entry = this._queue.shift();
      if (entry.timer) clearTimeout(entry.timer);
      entry.resolve(); // transfer slot directly — _active stays the same
    } else {
      this._active--;
    }
  }
  get active()  { return this._active; }
  get waiting() { return this._queue.length; }
}

const MAX_CONCURRENT_GEMINI = parseInt(process.env.MAX_CONCURRENT_GEMINI || '6');
const geminiSemaphore = new Semaphore(MAX_CONCURRENT_GEMINI);
// Max time a request may wait in the semaphore queue before returning 503.
// Prevents thundering-herd pile-ups from blocking indefinitely under high load.
const SEMAPHORE_WAIT_TIMEOUT_MS = IS_PRODUCTION ? 45000 : 120000;

// ── Analytics ─────────────────────────────────────────────────────────────────
// In-memory topic counts. Resets on redeploy — Redis stores persistent counts.
const topicStats = new Map(); // topic_lower → { topic, count, firstSeen, lastSeen }
let totalAnalyses = 0; // in-memory fallback counter

function trackSearch(topic) {
  totalAnalyses++;
  const key = topic.toLowerCase().trim();
  const now = new Date().toISOString();
  if (topicStats.has(key)) {
    const entry = topicStats.get(key);
    entry.count++;
    entry.lastSeen = now;
  } else {
    topicStats.set(key, { topic, count: 1, firstSeen: now, lastSeen: now });
  }
  // Persist to Redis (fire-and-forget — never blocks a request)
  rTrackSearch(topic).catch(() => {});
}

// ── Per-IP Usage Tracking & Daily Limits ─────────────────────────────────────
// Free tier: FREE_DAILY_LIMIT analyses per IP per calendar day (UTC).
// Tokens are estimated (no extra API call needed).
// Admin key bypasses all limits.

const FREE_DAILY_LIMIT = parseInt(process.env.FREE_DAILY_LIMIT || '10');
const ADMIN_KEY        = process.env.ADMIN_KEY || '';

// Estimated Gemini 2.5 Flash costs per analysis (RSS-Direct, no grounding):
// Call 1 — main analysis (thinking OFF, RSS context, no googleSearch):
//   Input:    ~6 000 tokens × $0.075/1M  = $0.00045
//   Output:   ~3 000 tokens × $0.30/1M   = $0.0009
// Call 2 — deep analysis (thinking OFF):
//   Input:    ~2 000 tokens × $0.075/1M  = $0.00015
//   Output:   ~1 500 tokens × $0.30/1M   = $0.00045
// Call 3 — translation EN/RU (thinking OFF):
//   Input:    ~7 000 tokens × $0.075/1M  = $0.000525
//   Output:   ~6 000 tokens × $0.30/1M   = $0.0018
// Total per DE analysis  ≈ $0.0014
// Total per EN/RU analysis ≈ $0.003
const COST_PER_ANALYSIS = 0.003;
const TOKENS_PER_ANALYSIS_INPUT  = 4000;
const TOKENS_PER_ANALYSIS_OUTPUT = 3000;

// ipUsage: ip → { date: 'YYYY-MM-DD', count, tokensIn, tokensOut }
const ipUsage = new Map();

// Daily server-wide stats (resets on redeploy)
const serverStats = {
  startedAt: new Date().toISOString(),
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  errors: 0,
};

function todayUTC() {
  return new Date().toISOString().split('T')[0];
}

function getIPUsage(ip) {
  const today = todayUTC();
  const entry = ipUsage.get(ip);
  // Reset if new day
  if (!entry || entry.date !== today) {
    const fresh = { date: today, count: 0, tokensIn: 0, tokensOut: 0 };
    ipUsage.set(ip, fresh);
    return fresh;
  }
  return entry;
}


// Middleware: extract real IP behind Railway / Nginx proxy.
//
// SECURITY: X-Forwarded-For is a comma-separated chain "client, proxy1, proxy2, ...".
// A malicious client can prepend arbitrary fake IPs to the LEFT of the chain; only the
// entries APPENDED by trusted proxies (on the RIGHT) are reliable. The rightmost entry
// is the IP that our edge proxy (Railway) observed as the TCP peer — i.e. the real client.
// Taking the leftmost value (the old behaviour) let anyone spoof their IP per request and
// bypass per-IP rate limits / daily usage caps. We take the rightmost trusted hop instead.
//
// TRUSTED_PROXY_HOPS = how many trailing hops are our own infrastructure (default 1 =
// Railway edge). We return the entry just before those trusted hops.
const TRUSTED_PROXY_HOPS = Math.max(1, parseInt(process.env.TRUSTED_PROXY_HOPS || '1', 10) || 1);
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const chain = forwarded.split(',').map(s => s.trim()).filter(Boolean);
    if (chain.length) {
      const idx = Math.max(0, chain.length - TRUSTED_PROXY_HOPS);
      return chain[idx];
    }
  }
  return req.socket?.remoteAddress || 'unknown';
}

function getTopTopics(limit = 10) {
  return [...topicStats.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ── Auth Rate Limiters ────────────────────────────────────────────────────────
// Applied per-IP. Separate buckets for login, register, and password-reset
// so a brute-force on login doesn't consume the reset quota.
// Build a RedisStore lazily — falls back to memory if Redis not ready yet.
// Rate-limit-redis v5 uses sendCommand (ioredis-compatible).
function makeRedisStore(prefix) {
  return () => {
    const rc = getRedisClient();
    if (!rc || rc.status !== 'ready') return undefined; // memory fallback
    return new RedisStore({
      sendCommand: (...args) => rc.call(...args),
      prefix: `rl:${prefix}:`,
    });
  };
}

// Login: 5 attempts per 15 min per IP (account lockout handled separately in handler)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIP,
  store: makeRedisStore('login')(),
  message: { error: 'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.' },
  skip: (req) => !!(req.headers['x-admin-key'] && req.headers['x-admin-key'] === ADMIN_KEY),
});

// Register: 3 per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIP,
  store: makeRedisStore('register')(),
  message: { error: 'Zu viele Registrierungen. Bitte versuche es in einer Stunde erneut.' },
});

// Forgot / resend-verification: 3 per hour per IP
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIP,
  store: makeRedisStore('forgot')(),
  message: { error: 'Zu viele Anfragen. Bitte versuche es in einer Stunde erneut.' },
});

// Analyze burst limiter (audit fix A7): the per-day quota already exists
// (FREE_DAILY_LIMIT via checkDailyLimitDB), but nothing stopped a burst of
// expensive Gemini-backed requests within a minute. Cache hits are cheap and
// pass through (the handler short-circuits before Gemini on a hit anyway).
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.ANALYZE_RATE_PER_MIN, 10) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIP,
  store: makeRedisStore('analyze')(),
  message: { error: 'Zu viele Analysen pro Minute. Bitte kurz warten.' },
  skip: (req) => !!(req.headers['x-admin-key'] && req.headers['x-admin-key'] === ADMIN_KEY),
});

// Daily Gemini budget guard (audit fix A7): a hard server-wide ceiling on
// Gemini calls per UTC day. When exceeded we keep serving cache hits but refuse
// new model-backed analyses with 503 — protects against abuse-driven bills.
const GEMINI_DAILY_BUDGET = parseInt(process.env.GEMINI_DAILY_BUDGET, 10) || 3000;
let geminiBudget = { day: todayUTC(), calls: 0 };
function geminiBudgetOk() {
  const today = todayUTC();
  if (geminiBudget.day !== today) geminiBudget = { day: today, calls: 0 };
  return geminiBudget.calls < GEMINI_DAILY_BUDGET;
}
function geminiBudgetSpend() {
  const today = todayUTC();
  if (geminiBudget.day !== today) geminiBudget = { day: today, calls: 0 };
  geminiBudget.calls++;
  if (geminiBudget.calls === GEMINI_DAILY_BUDGET) {
    console.error(`[Budget] GEMINI_DAILY_BUDGET (${GEMINI_DAILY_BUDGET}) reached — refusing new model calls until UTC midnight`);
    reportError(new Error('Gemini daily budget exhausted'), { budget: GEMINI_DAILY_BUDGET });
  }
}

// ── Token helpers (SHA-256 hash stored in DB, plain token sent by email) ──────
function generateToken() {
  return crypto.randomBytes(32).toString('hex'); // 256-bit, URL-safe hex
}
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// createOAuthCode / consumeOAuthCode imported from lib/oauthCodes.js

// ── JWT auth middleware ────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── 3-layer cache: NodeCache (L1, 0ms) → Redis (L2, ~10ms) → PostgreSQL (L3) ──
async function cacheGetLayered(key) {
  // L1: NodeCache — in-process, zero latency
  const mem = cache.get(key);
  if (mem !== undefined) {
    // Bump search_count asynchronously (fire-and-forget)
    if (isDBAvailable()) cacheHit(key);
    return mem;
  }

  // L2: Redis — distributed, survives server restarts
  if (isRedisAvailable()) {
    const redisData = await rGet(key);
    if (redisData !== null) {
      cache.set(key, redisData, 3600);
      if (isDBAvailable()) cacheHit(key);
      console.log(`[Cache] Redis→L1 restored "${key}"`);
      return redisData;
    }
  }

  // L3: PostgreSQL — persistent fallback
  if (!isDBAvailable()) return undefined;
  const row = await cacheGet(key);
  if (!row || row.isStale) return undefined;
  const remainTTL = Math.max(60, row.ttl_seconds - row.ageSeconds);
  cache.set(key, row.data, remainTTL);
  if (isRedisAvailable()) rSet(key, row.data, remainTTL).catch(() => {});
  console.log(`[Cache] DB→L1 restored "${key}" (${row.ageSeconds}s old)`);
  return row.data;
}

async function cacheSetLayered(key, data, ttlSeconds, topic = null, lang = null) {
  cache.set(key, data, ttlSeconds);
  await Promise.allSettled([
    isRedisAvailable() ? rSet(key, data, ttlSeconds)                       : Promise.resolve(),
    isDBAvailable()    ? cacheSet(key, data, ttlSeconds, false, topic, lang) : Promise.resolve(),
  ]).then(([r, d]) => {
    if (r.status === 'rejected') console.error('[Cache] Redis write error:', r.reason?.message);
    if (d.status === 'rejected') console.error('[Cache] DB write error:',    d.reason?.message);
  });
}

// ── DB/Redis-backed usage tracking (Redis → PostgreSQL → in-memory fallback) ──
async function getUsageForIP(ip) {
  // Redis is fastest and survives restarts (most accurate for rate-limiting)
  if (isRedisAvailable()) {
    const count = await rGetUsage(ip);
    if (count !== null) return count;
  }
  // PostgreSQL fallback
  if (isDBAvailable()) {
    const count = await getUsageDB(ip);
    return count ?? getIPUsage(ip).count;
  }
  return getIPUsage(ip).count;
}

async function incrementUsageForIP(ip) {
  getIPUsage(ip).count++; // always update memory for fast in-process reads
  getIPUsage(ip).tokensIn  += TOKENS_PER_ANALYSIS_INPUT;
  getIPUsage(ip).tokensOut += TOKENS_PER_ANALYSIS_OUTPUT;
  // Persist to Redis + PostgreSQL in parallel (fire-and-forget)
  if (isRedisAvailable()) rIncrUsage(ip).catch(() => {});
  if (isDBAvailable())    incrementUsageDB(ip).catch(() => {});
}

async function checkDailyLimitDB(ip) {
  const count = await getUsageForIP(ip);
  const remaining = Math.max(0, FREE_DAILY_LIMIT - count);
  return { allowed: count < FREE_DAILY_LIMIT, remaining };
}

// extractJSON imported from lib/utils.js

// ── RSS helpers ───────────────────────────────────────────────────────────────

// Extract search keywords from a topic string (any language).
// RSS feeds are German, so German topics work best; English/Russian topics
// still work for shared proper nouns (Ukraine, Inflation, AfD, etc.).
// extractSearchKeywords is now in lib/rssSearch.js (v2) — imported above

// ── Corpus-vs-live source selection (Step 12 cutover) ───────────────────────────
//
// When CORPUS_ANALYSIS_ENABLED=true and the corpus has enough articles for the
// topic, analysis is sourced from Corpus V2 (hybrid semantic+lexical retrieval over
// 33 stored outlets, every article carrying a REAL stored URL) instead of a live
// per-request RSS fetch. Output shape is identical (corpusToSpectra is a drop-in),
// so the rest of the pipeline is unchanged. Falls back to live RSS on:
//   - flag off / DB down / corpus too thin / any retrieval error
// → with the flag OFF this is byte-for-byte the previous searchAllFeeds behavior.
const CORPUS_ANALYSIS_ENABLED = process.env.CORPUS_ANALYSIS_ENABLED === 'true';
const CORPUS_MIN_ARTICLES = parseInt(process.env.CORPUS_MIN_ARTICLES, 10) || 8;
// How many articles per camp Gemini writes perspective summaries for. ALL matching
// articles are still retrieved, counted and DISPLAYED (with real links) — this only
// bounds the AI-summary workload so one request stays within model token/latency
// limits. Articles beyond this show as raw cards (original RSS excerpt + link).
const GEMINI_MAX_PER_SPECTRUM = parseInt(process.env.GEMINI_MAX_PER_SPECTRUM, 10) || 12;

async function getSpectraForTopic(topic) {
  if (CORPUS_ANALYSIS_ENABLED && isDBAvailable()) {
    try {
      const corpus = await retrieveCorpusSpectra(
        topic,
        { getEmbedding, searchHybrid: (embedding, kw, o) => searchCorpusHybrid(embedding, kw, o) },
        // Retrieve ALL matching articles per camp — the page shows the full,
        // honest coverage (real links). The Gemini call is separately bounded
        // (maxPerSpectrum) so the AI summary stays within model limits while the
        // raw articles beyond that are still displayed.
        { limit: 250, perSpectrum: 60 }
      );
      if ((corpus?.total_articles ?? 0) >= CORPUS_MIN_ARTICLES) {
        console.log(`[Corpus] ${corpus.total_articles} articles (semantic=${corpus.search_meta?.usedSemantic})`);
        return corpus;
      }
      console.log(`[Corpus] only ${corpus?.total_articles ?? 0} articles for "${topic}" — live RSS fallback`);
    } catch (err) {
      console.error('[Corpus] retrieval failed, live RSS fallback:', err.message);
    }
  }
  return searchAllFeeds(extractSearchKeywords(topic), { inputWordCount: getInputWordCount(topic) });
}

// ── Step 12b: corpus citation grounding + reliability envelope ───────────────────
//
// For corpus-sourced analyses only. Gemini's prompt context carries source_name +
// title but NOT the domain, so enrichWithRSSData's domain-keyed URL match misses;
// citation grounding matches emitted articles to corpus rows by URL / title overlap
// and stamps the REAL stored URL (this is what makes source links clickable). Also
// computes verified blindspots (feed_health) + a confidence/coverage envelope.
// No-op for the live-RSS path (returns the analysis unchanged, reliability null).
async function applyCorpusReliability(analysis, rssData) {
  if (!analysis || rssData?.search_meta?.source !== 'corpus') {
    return { analysis, reliability: null };
  }
  const spectra = rssData.spectra || {};
  const { analysis: grounded, report: grounding } = groundAnalysis(analysis, spectra);

  // Grounded article → real corpus URL is now set; mark it as a real (non-fallback)
  // link so the UI renders "read article" with a working href. Then drop any twin
  // cards (same canonical URL now resolved, or same outlet+headline) — safety net
  // for duplicates the model may have emitted from near-duplicate corpus rows.
  for (const sp of SPECTRUMS) {
    for (const art of (grounded.news_spectrum?.[sp] || [])) {
      if (art._grounded && art.article_url) art.url_is_search_fallback = false;
    }
    if (Array.isArray(grounded.news_spectrum?.[sp])) {
      grounded.news_spectrum[sp] = dedupeArticles(grounded.news_spectrum[sp]);
    }
  }

  let downFeeds = [];
  try { downFeeds = await getDownFeeds(); } catch (e) { console.warn('[Reliability] getDownFeeds failed:', e.message); }
  const blindspot = verifyBlindspots(spectra, downFeeds);

  const reliability = buildReliabilityEnvelope({ corpusSpectra: spectra, grounding, blindspot });

  // Story clustering (Wave 4): group the topic's articles into sub-stories and
  // flag sub-angles only one camp tells (sub-story-level blindspots).
  try {
    const { clusters, meta } = clusterArticles(flattenSpectra(spectra));
    reliability.clusters = clusters;
    reliability.clusterMeta = meta;
    if (meta.soloCamps.length) console.log(`[Clusters] ${meta.clusterCount} sub-stories, solo-camp angles: ${meta.soloCamps.map(s => `${s.camp}:${s.label}`).join(' | ')}`);
  } catch (e) { console.warn('[Clusters] skipped:', e.message); }

  console.log(`[Reliability] confidence=${reliability.confidence.score}/${reliability.confidence.band} grounded=${grounding.grounded}/${grounding.total} flagshipSilent=[${blindspot.flagshipSilences}] verifiedSilent=[${blindspot.verifiedSilences}]`);
  metrics.recordConfidence(reliability.confidence.score);
  metrics.recordGrounding(grounding.groundingRatio);
  return { analysis: grounded, reliability };
}

// Merge real RSS data into a Gemini-produced analysis object.
// Returns a new analysis object (original is not mutated).
//   - Replaces search-fallback Google URLs with real RSS article URLs
//   - Overrides coverage_distribution with real RSS article-count math
//   - Adds deliberate-silence flags
//   - Stamps analyzed_at with current ISO timestamp
function enrichWithRSSData(analysis, rssData) {
  if (!rssData || rssData.total_articles === 0) {
    // Still stamp the time even with no RSS data
    return { ...analysis, analyzed_at: new Date().toISOString() };
  }

  const result = JSON.parse(JSON.stringify(analysis)); // deep clone

  // ── 1. Build domain → [rssArticle, ...] map for URL enrichment ────────────
  const rssArticlesByDomain = {};
  for (const spectrum of SPECTRUMS) {
    for (const art of (rssData.spectra[spectrum]?.articles || [])) {
      const dom = art.source_domain;
      if (!rssArticlesByDomain[dom]) rssArticlesByDomain[dom] = [];
      rssArticlesByDomain[dom].push(art);
    }
  }

  // ── 2. Replace search-fallback URLs with real RSS article URLs ─────────────
  let rssUrlsAdded = 0;
  for (const spectrum of SPECTRUMS) {
    result.news_spectrum[spectrum] = (analysis.news_spectrum[spectrum] || []).map(source => {
      // Enrich if: no URL at all (RSS-Direct path) OR URL is a Google Search fallback (grounding path)
      const needsUrl = !source.article_url || source.url_is_search_fallback;
      if (!needsUrl) return source;

      const domain = (source.source_domain || '').replace(/^www\./, '');
      const candidates =
        rssArticlesByDomain[domain] ||
        rssArticlesByDomain[`www.${domain}`] ||
        [];
      if (!candidates.length) return source;

      // Pick the RSS article whose title has the most word overlap with Gemini's title
      const gemLower = (source.article_title || '').toLowerCase();
      let bestArt  = null;
      let bestScore = -1;
      for (const art of candidates) {
        if (!art.article_url) continue;
        const rssWords = (art.article_title || '').toLowerCase()
          .split(/\s+/).filter(w => w.length >= 4);
        const hits  = rssWords.filter(w => gemLower.includes(w)).length;
        const score = rssWords.length > 0 ? hits / rssWords.length : 0;
        if (score > bestScore) { bestScore = score; bestArt = art; }
      }

      // RSS-Direct: Gemini copies exact titles from RSS → scores ≈1.0
      // Threshold 0.30 guards against accidental domain matches on unrelated articles.
      if (!bestArt?.article_url || bestScore < 0.30) return source;

      rssUrlsAdded++;
      return {
        ...source,
        article_url:         bestArt.article_url,
        article_title:       bestArt.article_title || source.article_title,
        publication_date:    bestArt.pubDate?.slice(0, 10) || source.publication_date,
        url_is_search_fallback: false,
      };
    });
  }
  console.log(`[RSS→URLs] ${rssUrlsAdded} fallback URLs → real RSS links`);

  // ── 3. Override coverage_distribution with real RSS article-count math ─────
  const rssCovDist      = buildCoverageDistribution(rssData.spectra);
  const silencedSpectra = detectSilence(rssData.spectra, rssData.total_articles);
  result.coverage_distribution = {};
  for (const spectrum of SPECTRUMS) {
    result.coverage_distribution[spectrum] = {
      ...rssCovDist[spectrum],
      silence: silencedSpectra.includes(spectrum),
    };
  }
  const covSummary = Object.fromEntries(SPECTRUMS.map(s => [s, result.coverage_distribution[s].count]));
  console.log(`[RSS→Coverage] article counts per spectrum: ${JSON.stringify(covSummary)}`);

  // ── 4. Fill spectra that Gemini left empty with best RSS articles ─────────
  // Handles two cases:
  //   (a) Gemini returned empty array [] for this spectrum
  //   (b) Gemini was fully degraded and left a "Kein Artikel gefunden" placeholder
  //
  // Relevance guard: only use RSS articles that matched at least one keyword in
  // the TITLE (titleScore > 0). Description-only matches are passing references,
  // not actual coverage — showing them would mislead users.
  //
  // rss_only: true marks these articles so the UI can display a note that no
  // Gemini perspective analysis is available for this outlet.
  const isPlaceholder = (art) =>
    art.source_name === 'Kein Artikel gefunden' || art.source_domain === 'n/a';

  let rssFilled = 0;
  let rssSkippedNoTitle = 0;
  for (const spectrum of SPECTRUMS) {
    const existing = result.news_spectrum[spectrum] || [];
    const hasReal  = existing.some(a => !isPlaceholder(a));
    if (hasReal) continue; // Gemini already has real articles

    // Only use articles where ≥1 keyword is a FULL WORD in the title (not compound-embedded).
    // titleScore > 0 passes compound-embedded matches (+1pt) like "haushalt" in "Haushalte"
    // which causes false positives — titleFullWordCount requires a real standalone match.
    const rssArts = (rssData.spectra[spectrum]?.articles || [])
      .filter(art => (art.titleFullWordCount ?? 0) > 0)
      .slice(0, 2);

    const skipped = (rssData.spectra[spectrum]?.articles || []).length - rssArts.length;
    rssSkippedNoTitle += Math.max(0, skipped);

    if (rssArts.length === 0) continue;

    result.news_spectrum[spectrum] = rssArts.map(art => ({
      source_name:               art.source_name,
      source_domain:             art.source_domain,
      article_title:             art.article_title,
      article_url:               art.article_url || null,
      url_is_search_fallback:    !art.article_url,
      publication_date:          art.pubDate?.slice(0, 10) ?? undefined,
      rss_only:                  true,   // ← no Gemini perspective analysis for this article
      // Brief machine-generated summary from RSS description (no Gemini context)
      summary_of_perspective:    art.description
        ? `${art.source_name} berichtet: ${art.description.slice(0, 300)}`
        : `${art.source_name}: ${art.article_title}`,
    }));
    rssFilled += rssArts.length;
  }
  if (rssFilled > 0) console.log(`[RSS→Spectrum] Added ${rssFilled} RSS articles to empty spectra (skipped ${rssSkippedNoTitle} desc-only matches)`);

  // ── 4b. Reconcile silence flags against final news_spectrum state ────────
  // Gemini may have found an article for a spectrum that RSS missed.
  // If news_spectrum[spectrum] now has real articles, the silence flag must
  // be cleared — otherwise the coverage bar contradicts the article card.
  for (const spectrum of SPECTRUMS) {
    if (!result.coverage_distribution[spectrum]?.silence) continue;
    const hasReal = (result.news_spectrum[spectrum] || []).some(a => !isPlaceholder(a));
    if (hasReal) {
      result.coverage_distribution[spectrum].silence = false;
      console.log(`[RSS→Coverage] silence cleared for ${spectrum} (Gemini found articles RSS missed)`);
    }
  }

  // ── 5. Stamp analyzed_at + store RSS metadata for downstream use ──────────
  result.analyzed_at = new Date().toISOString();
  result._rss = {
    total_articles:  rssData.total_articles,
    coverage_volume: buildCoverageVolume(rssData.spectra),
    fetched_at:      rssData.fetched_at,
    // All matched RSS articles per spectrum — used by frontend to populate Analyzed Sources
    spectra: Object.fromEntries(
      SPECTRUMS.map(s => [s, (rssData.spectra[s]?.articles || []).map(a => ({
        source_name:   a.source_name,
        source_domain: a.source_domain,
        article_title: a.article_title,
        article_url:   a.article_url || null,
        pub_date:      a.pubDate?.slice(0, 10) || null,
        description:   (a.description || '').slice(0, 300),
      }))])
    ),
  };

  return result;
}

// buildDeepAnalysisPrompt imported from lib/analysisValidator.js

/**
 * Run a single deep-analysis Gemini call.
 * Returns the parsed deep object, or throws on timeout / invalid JSON / bad structure.
 */
async function callDeepAnalysisOnce(analysis, timeoutMs) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = buildDeepAnalysisPrompt(analysis);

  const result = await Promise.race([
    model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Deep analysis timed out')), timeoutMs)
    ),
  ]);

  const rawText = result.response.text();
  console.log(`[DeepAnalysis] Raw length=${rawText?.length}`);
  const deep = extractJSON(rawText);

  if (!Array.isArray(deep.shared_facts) || !Array.isArray(deep.diverging_points) || !Array.isArray(deep.silenced_topics)) {
    throw new Error('Invalid deep_analysis structure — required arrays missing');
  }
  // Ensure optional fields default to empty structures if Gemini omitted them
  if (!deep.keywords)        deep.keywords        = Object.fromEntries(SPECTRUMS.map(s => [s, []]));
  if (!deep.sentiment)       deep.sentiment       = Object.fromEntries(SPECTRUMS.map(s => [s, 'neutral']));
  if (!deep.experts_cited)   deep.experts_cited   = Object.fromEntries(SPECTRUMS.map(s => [s, []]));
  if (!deep.coverage_volume) deep.coverage_volume = Object.fromEntries(SPECTRUMS.map(s => [s, { week: 0, month: 0 }]));

  return deep;
}

/**
 * Run deep analysis with one automatic retry if Gemini returns empty arrays.
 * Empty shared_facts + diverging_points = Gemini understood neither the topic
 * nor the articles — worth a single retry before accepting the degraded result.
 */
async function callDeepAnalysis(analysis, timeoutMs = 45000) {
  // Split budget: attempt-1 gets 60%, retry gets remaining minus 2s buffer
  const attempt1Budget = Math.round(timeoutMs * 0.6);

  let deep;
  try {
    deep = await callDeepAnalysisOnce(analysis, attempt1Budget);
  } catch (err) {
    console.error('[DeepAnalysis] Attempt 1 failed:', err.message);
    // Don't retry on timeout — no budget left
    if (err.message.includes('timed out')) throw err;
    // Rethrow structure errors without retry
    throw err;
  }

  // Quality check: if both key arrays are empty, Gemini missed the content
  const isEmpty = deep.shared_facts.length === 0 && deep.diverging_points.length === 0;
  if (isEmpty) {
    const retryBudget = Math.max(10000, timeoutMs - attempt1Budget - 2000);
    console.warn(`[DeepAnalysis] Empty result on attempt 1 — retrying (budget: ${retryBudget}ms)`);
    try {
      deep = await callDeepAnalysisOnce(analysis, retryBudget);
      console.log('[DeepAnalysis] Retry ✅ — non-empty result');
    } catch (retryErr) {
      console.warn('[DeepAnalysis] Retry failed:', retryErr.message);
      // Return the (empty) first attempt rather than throwing — deep analysis is secondary
    }
  }

  return deep;
}

app.post('/api/analyze', analyzeLimiter, async (req, res) => {
  const { topic, lang } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'API Key Missing' });

  serverStats.totalRequests++;

  const clientIP = getClientIP(req);
  const adminKeyHeader = req.headers['x-admin-key'];

  // ── JWT user extraction (optional — enriches DB log) ─────────────────────
  let jwtUser = null;
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      jwtUser = jwt.verify(authHeader.slice(7), JWT_SECRET);
    }
  } catch { /* anonymous */ }

  // ── Daily limit check (bypass for admin key or unlimited users) ──────────────
  const isAdmin = ADMIN_KEY && adminKeyHeader === ADMIN_KEY;
  const isUnlimited = jwtUser?.daily_limit === -1;
  if (!isAdmin && !isUnlimited) {
    const { allowed, remaining } = await checkDailyLimitDB(clientIP);
    res.set('X-RateLimit-Limit',     String(FREE_DAILY_LIMIT));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset',     'midnight UTC');
    if (!allowed) {
      console.warn(`[Limit] IP ${clientIP} exceeded daily limit (${FREE_DAILY_LIMIT}/day)`);
      return res.status(429).json({
        error: 'daily_limit_reached',
        message: `Free tier allows ${FREE_DAILY_LIMIT} analyses per day. Resets at midnight UTC.`,
        limit: FREE_DAILY_LIMIT,
        remaining: 0,
      });
    }
  }

  // ── Time budget breakdown (Railway hard-kills at ~60s) ─────────────────────
  // Main Gemini call (5 spectrum searches): ≤ 44s
  // Translation (non-DE):                  ≤ 10s
  // Buffer:                                  1s
  // Total ceiling:                          55s  (5s margin before Railway kills)
  const TIMEOUT_MS = GLOBAL_TIMEOUT_MS;
  const TRANSLATION_TIMEOUT = GLOBAL_TRANSL_TIMEOUT;

  // v4 cache — 5-spectrum format, deep_analysis fetched separately
  const cacheKey = crypto.createHash('md5').update(`${topic.toLowerCase()}:${lang}:v4`).digest('hex');
  const cached = await cacheGetLayered(cacheKey);
  if (cached) {
    console.log(`[Cache] HIT for "${topic}" (${lang})`);
    serverStats.cacheHits++;
    metrics.recordAnalysis({ cacheHit: true });
    // Still count as usage even on cache hit (reading data costs resources)
    if (!isAdmin) await incrementUsageForIP(clientIP);
    const { remaining } = await checkDailyLimitDB(clientIP);
    res.set('X-RateLimit-Remaining', String(remaining));
    logSearch({ topic, lang, degraded: cached._meta?.degraded ?? false, cacheHit: true, userId: jwtUser?.id, ipHash: crypto.createHash('sha256').update(clientIP).digest('hex').slice(0, 16) }).catch(() => {});
    incrementViewCount(topic).catch(() => {});
    return res.json(cached);
  }
  serverStats.cacheMisses++;

  const timeoutHandle = setTimeout(() => {
    if (!res.headersSent) {
      console.error('[Timeout] Analysis exceeded 50s, returning 503');
      res.status(503).json({ error: 'Analysis timed out. Please try again.' });
    }
  }, TIMEOUT_MS);

  // Track analytics (fire-and-forget)
  trackSearch(topic);

  const requestStart = Date.now();

  try {
    // Step 1: German Gemini search (cached per topic, shared across languages)
    const deKey = crypto.createHash('md5').update(`${topic.toLowerCase()}:de-base:v4`).digest('hex');
    let germanAnalysis, degraded;

    const cachedBase = await cacheGetLayered(deKey);
    if (cachedBase) {
      console.log(`[Cache] HIT German base for "${topic}"`);
      ({ germanAnalysis, degraded } = cachedBase);
    } else {
      // ── RSS: start fetching real articles immediately (no semaphore needed) ──
      // Runs in parallel while we wait for a Gemini slot — zero extra latency cost.
      const rssKeywords = extractSearchKeywords(topic);
      console.log(`[RSS] Parallel search for keywords: ${JSON.stringify(rssKeywords)}`);
      const rssPromise = getSpectraForTopic(topic)
        .then(r => {
          console.log(`[RSS] Done — ${r.total_articles} articles found (${Date.now() - requestStart}ms elapsed)`);
          return r;
        })
        .catch(err => {
          console.warn('[RSS] Search failed (analysis continues without it):', err.message);
          return null;
        });

      // RSS-Direct: wait for RSS first, then feed articles into Gemini as context.
      // Semaphore is acquired AFTER RSS resolves — slot not held during feed fetch.
      const rssData = await rssPromise;
      if (!geminiBudgetOk()) {
        return res.status(503).json({ error: 'budget_exhausted', message: 'Tageskontingent für neue Analysen erreicht. Bitte morgen erneut versuchen.' });
      }
      console.log(`[RSS-Direct] Waiting for Gemini slot (active=${geminiSemaphore.active}, queue=${geminiSemaphore.waiting})`);
      await geminiSemaphore.acquire(SEMAPHORE_WAIT_TIMEOUT_MS);
      try {
        const timeoutBudget = Math.max(10000, TIMEOUT_MS - (Date.now() - requestStart) - 3000);
        metrics.recordGeminiCall('analysis');
        geminiBudgetSpend();
        const { analysis: rawAnalysis, degraded: deg, meta: rssMeta } =
          await callGeminiWithRSSContext(topic, 'de', rssData?.spectra ?? {}, {
            timeoutMs:      timeoutBudget,
            maxPerSpectrum: GEMINI_MAX_PER_SPECTRUM, // AI summarises top-N/camp; remaining articles still shown via _rss merge
          });
        degraded = deg;
        if (rssMeta) console.log(`[RSS-Direct] meta: articles=${rssMeta.totalArticles} spectra=${rssMeta.coveredSpectra}/5 elapsed=${rssMeta.elapsedMs}ms${rssMeta.overallPatched ? ' (patched)' : ''}`);
        // Merge real RSS data into analysis (URLs, coverage counts, silence flags)
        germanAnalysis = enrichWithRSSData(rawAnalysis, rssData);
      } finally {
        geminiSemaphore.release();
      }
      // Corpus grounding + reliability envelope (parity with the SSE path).
      const rel = await applyCorpusReliability(germanAnalysis, rssData);
      germanAnalysis = rel.reliability ? { ...rel.analysis, _reliability: rel.reliability } : rel.analysis;
      // Always cache the German base so /api/deep-analysis can find it.
      // Degraded results use a short TTL (5 min) so the next request retries Gemini.
      await cacheSetLayered(deKey, { germanAnalysis, degraded }, degraded ? 300 : 86400);
    }

    // Step 2: Translate to user language (dynamic timeout = remaining budget - 1s)
    let finalAnalysis = germanAnalysis;
    let translationSucceeded = (lang === 'de');

    if (lang !== 'de') {
      const elapsed = Date.now() - requestStart;
      const remainingBudget = Math.max(5000, TIMEOUT_MS - elapsed - 1000);
      const translTimeout = Math.min(TRANSLATION_TIMEOUT, remainingBudget);
      console.log(`[Translate] Budget: ${translTimeout}ms (elapsed: ${elapsed}ms)`);
      // Strip deep_analysis + _rss before translation — fetched separately, no need to translate
      const { deep_analysis: _stripped, _rss: _rssStripped, ...analysisForTranslation } = germanAnalysis;

      // When degraded (Gemini failed, only RSS articles): trim to 2 articles per spectrum
      // to reduce the translation payload and avoid timeouts on slow models.
      if (degraded) {
        for (const sp of SPECTRUMS) {
          if (Array.isArray(analysisForTranslation.news_spectrum?.[sp])) {
            analysisForTranslation.news_spectrum[sp] = analysisForTranslation.news_spectrum[sp].slice(0, 2);
          }
        }
      }
      await geminiSemaphore.acquire(SEMAPHORE_WAIT_TIMEOUT_MS);
      try {
        metrics.recordGeminiCall('translate');
        finalAnalysis = await Promise.race([
          translateAnalysis(analysisForTranslation, lang, genAI),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Translation timeout after ${translTimeout}ms`)), translTimeout)
          ),
        ]);
        translationSucceeded = true;
        console.log(`[Translate] Analysis → ${lang} done`);
      } catch (err) {
        console.error('[Translate] Falling back to German:', err.message);
        finalAnalysis = germanAnalysis;
      } finally {
        geminiSemaphore.release();
      }
    }

    // Always restore non-translatable metadata from the German base
    finalAnalysis = {
      ...finalAnalysis,
      analysis_topic:   topic,
      response_language: lang,
      analyzed_at:      germanAnalysis.analyzed_at,
      ...(germanAnalysis._rss ? { _rss: germanAnalysis._rss } : {}),
      ...(germanAnalysis._reliability ? { _reliability: germanAnalysis._reliability } : {}),
    };
    const response = {
      ...finalAnalysis,
      _meta: {
        degraded,
        rss_articles: finalAnalysis.coverage_distribution
          ? Object.values(finalAnalysis.coverage_distribution).reduce((s, e) => s + (e.count ?? 0), 0)
          : undefined,
      },
    };

    // Only cache if Gemini succeeded AND translation succeeded (avoid caching empty/German fallbacks)
    if (!degraded && translationSucceeded) {
      await cacheSetLayered(cacheKey, response, 86400, topic, lang);
    }

    // Record usage AFTER successful Gemini call (not on cache hits — already counted above)
    if (!isAdmin) await incrementUsageForIP(clientIP);
    const { remaining } = await checkDailyLimitDB(clientIP);
    res.set('X-RateLimit-Remaining', String(remaining));

    // Log to DB analytics
    const ipHash = crypto.createHash('sha256').update(clientIP).digest('hex').slice(0, 16);
    logSearch({ topic, lang, degraded, cacheHit: false, userId: jwtUser?.id, ipHash }).catch(() => {});

    clearTimeout(timeoutHandle);
    if (!res.headersSent) res.json({ ...response, _usage: { remaining, limit: FREE_DAILY_LIMIT } });
  } catch (error) {
    serverStats.errors++;
    clearTimeout(timeoutHandle);
    console.error('[Analyze Error]:', error.message);
    if (error.message === 'semaphore_timeout') {
      if (!res.headersSent) res.status(503).json({ error: 'Server busy', message: 'Too many concurrent analyses. Please try again in a moment.' });
    } else {
      if (!res.headersSent) res.status(500).json({ error: 'Analysis failed', message: error.message });
    }
  }
});

// ── SSE streaming analysis endpoint ───────────────────────────────────────────
// Emits events progressively so the browser can render incrementally:
//   event:rss    (≈2s)  — real article links + coverage from RSS feeds
//   event:result (≈15-35s) — full AI analysis, merged with RSS
//   event:done   — stream closed cleanly
//
// Railway 60s hard-kill is not a problem because the first event (RSS) is
// written within 2 seconds, keeping the connection alive for the full analysis.
app.get('/api/analyze/stream', analyzeLimiter, async (req, res) => {
  const topic = ((req.query.topic || '') + '').trim().slice(0, 200);
  const lang  = ['de', 'en', 'ru'].includes(req.query.lang) ? req.query.lang : 'de';

  if (!topic)           return res.status(400).json({ error: 'topic required' });
  if (!GEMINI_API_KEY)  return res.status(500).json({ error: 'API Key Missing' });

  serverStats.totalRequests++;

  const clientIP       = getClientIP(req);
  const adminKeyHeader = req.headers['x-admin-key'];

  let jwtUser = null;
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) jwtUser = jwt.verify(authHeader.slice(7), JWT_SECRET);
  } catch { /* anonymous */ }

  const isAdmin     = ADMIN_KEY && adminKeyHeader === ADMIN_KEY;
  const isUnlimited = jwtUser?.daily_limit === -1;
  if (!isAdmin && !isUnlimited) {
    const { allowed, remaining } = await checkDailyLimitDB(clientIP);
    res.set('X-RateLimit-Limit',     String(FREE_DAILY_LIMIT));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset',     'midnight UTC');
    if (!allowed) {
      return res.status(429).json({
        error: 'daily_limit_reached',
        message: `Free tier allows ${FREE_DAILY_LIMIT} analyses per day. Resets at midnight UTC.`,
        limit: FREE_DAILY_LIMIT, remaining: 0,
      });
    }
  }

  // ── SSE headers ─────────────────────────────────────────────────────────────
  const requestStart = Date.now();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // prevent nginx from buffering the stream
  res.flushHeaders();

  const emit = (event, data) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const closeStream = () => { if (!res.writableEnded) res.end(); };

  req.on('close', closeStream); // clean up if client disconnects

  try {
    trackSearch(topic);

    const ipHash    = crypto.createHash('sha256').update(clientIP).digest('hex').slice(0, 16);
    const cacheKey  = crypto.createHash('md5').update(`${topic.toLowerCase()}:${lang}:v4`).digest('hex');

    // ── Fast path: full result already cached ────────────────────────────────
    const cached = await cacheGetLayered(cacheKey);
    if (cached) {
      console.log(`[Cache] HIT stream "${topic}" (${lang})`);
      serverStats.cacheHits++;
      metrics.recordAnalysis({ cacheHit: true });
      if (!isAdmin) await incrementUsageForIP(clientIP);
      const { remaining } = await checkDailyLimitDB(clientIP);
      logSearch({ topic, lang, degraded: cached._meta?.degraded ?? false, cacheHit: true, userId: jwtUser?.id, ipHash }).catch(() => {});
      incrementViewCount(topic).catch(() => {});
      emit('result', { ...cached, _usage: { remaining, limit: FREE_DAILY_LIMIT } });
      emit('done', {});
      closeStream();
      return;
    }
    serverStats.cacheMisses++;

    // ── Phase 1: RSS — start immediately, emit as soon as ready (~2s) ────────
    const rssKeywords = extractSearchKeywords(topic);
    console.log(`[RSS-Stream] keywords: ${JSON.stringify(rssKeywords)}`);

    // rssPromise emits the 'rss' event as a side-effect when it resolves
    const rssPromise = getSpectraForTopic(topic)
      .then(r => {
        console.log(`[RSS-Stream] ${r.total_articles} articles found`);
        const rssCovDist = buildCoverageDistribution(r.spectra);
        const silenced   = detectSilence(r.spectra, r.total_articles);
        const coverage   = Object.fromEntries(
          SPECTRUMS.map(s => [s, { ...rssCovDist[s], silence: silenced.includes(s) }])
        );
        // Build news_spectrum from top RSS articles (real links, no AI summaries yet)
        const rssSpectrum = Object.fromEntries(
          SPECTRUMS.map(s => [s, (r.spectra[s]?.articles || []).slice(0, 5).map(a => ({
            source_name:            a.source_name,
            source_domain:          a.source_domain,
            article_title:          a.article_title,
            article_url:            a.article_url || null,
            summary_of_perspective: a.description?.slice(0, 300) || a.article_title,
            publication_date:       a.pubDate?.slice(0, 10) ?? undefined,
            url_is_search_fallback: false,
          }))])
        );
        // Emit partial result immediately — browser renders cards in ~2s
        emit('rss', {
          analysis_topic:              topic,
          response_language:           lang,
          overall_non_partisan_analysis: '', // filled by result event
          news_spectrum:               rssSpectrum,
          coverage_distribution:       coverage,
          _meta: { degraded: false, rss_articles: r.total_articles },
          _rss: {
            total_articles:  r.total_articles,
            coverage_volume: buildCoverageVolume(r.spectra),
            fetched_at:      r.fetched_at,
            spectra:         Object.fromEntries(SPECTRUMS.map(s => [s, r.spectra[s]?.articles || []])),
          },
        });
        return r;
      })
      .catch(err => {
        console.warn('[RSS-Stream] failed:', err.message);
        return null;
      });

    // ── Phase 2: Gemini analysis (runs in parallel with RSS) ─────────────────
    const deKey      = crypto.createHash('md5').update(`${topic.toLowerCase()}:de-base:v4`).digest('hex');
    let germanAnalysis, degraded;
    let rssForReliability = null;   // corpus result used for grounding + reliability

    const cachedBase = await cacheGetLayered(deKey);
    if (cachedBase) {
      console.log(`[Cache] HIT German base stream "${topic}"`);
      ({ germanAnalysis, degraded } = cachedBase);
      // Always refresh coverage/RSS data even on cache hit — Gemini stays cached,
      // but article counts and _rss.spectra should reflect current feeds.
      const freshRssData = await rssPromise;
      rssForReliability = freshRssData;
      if (freshRssData && freshRssData.total_articles > 0) {
        const rssCovDist = buildCoverageDistribution(freshRssData.spectra);
        const silenced   = detectSilence(freshRssData.spectra, freshRssData.total_articles);
        germanAnalysis = {
          ...germanAnalysis,
          coverage_distribution: Object.fromEntries(
            SPECTRUMS.map(s => [s, { ...rssCovDist[s], silence: silenced.includes(s) }])
          ),
          _rss: {
            total_articles:  freshRssData.total_articles,
            coverage_volume: buildCoverageVolume(freshRssData.spectra),
            fetched_at:      freshRssData.fetched_at,
            spectra:         Object.fromEntries(SPECTRUMS.map(s => [s, freshRssData.spectra[s]?.articles || []])),
          },
        };
        console.log(`[RSS→Coverage] (cache-hit refresh) ${JSON.stringify(Object.fromEntries(SPECTRUMS.map(s => [s, rssCovDist[s].count])))}`);
      }
    } else {
      // RSS-Direct: RSS must resolve before Gemini so we can pass articles as context.
      // Await rssPromise before acquiring the semaphore — don't hold the slot during feed fetch.
      const rssData = await rssPromise;
      rssForReliability = rssData;
      if (!geminiBudgetOk()) {
        emit('error', { message: 'Tageskontingent für neue Analysen erreicht. Bitte morgen erneut versuchen.', code: 'budget_exhausted' });
        closeStream();
        return;
      }
      console.log(`[RSS-Direct-Stream] Waiting for Gemini slot`);
      await geminiSemaphore.acquire(SEMAPHORE_WAIT_TIMEOUT_MS);
      try {
        metrics.recordGeminiCall('analysis');
        geminiBudgetSpend();
        const { analysis: rawAnalysis, degraded: deg, meta: rssMeta } =
          await callGeminiWithRSSContext(topic, 'de', rssData?.spectra ?? {}, {
            timeoutMs:      GEMINI_TIMEOUT_SSE,
            maxPerSpectrum: GEMINI_MAX_PER_SPECTRUM, // AI summarises top-N/camp; remaining articles still shown via _rss merge
          });
        degraded = deg;
        if (rssMeta) console.log(`[RSS-Direct-Stream] meta: articles=${rssMeta.totalArticles} spectra=${rssMeta.coveredSpectra}/5 elapsed=${rssMeta.elapsedMs}ms${rssMeta.overallPatched ? ' (patched)' : ''}`);
        germanAnalysis = enrichWithRSSData(rawAnalysis, rssData);
      } finally {
        geminiSemaphore.release();
      }
      await cacheSetLayered(deKey, { germanAnalysis, degraded }, degraded ? 300 : 86400);
    }

    // ── Phase 2.5: corpus grounding + reliability (corpus path only) ───────────
    // Applied per-request (not cached) so source links resolve against the current
    // corpus and the confidence/blindspot envelope is always fresh.
    {
      const rel = await applyCorpusReliability(germanAnalysis, rssForReliability);
      germanAnalysis = rel.reliability ? { ...rel.analysis, _reliability: rel.reliability } : rel.analysis;
    }

    // ── Phase 3: Translation ─────────────────────────────────────────────────
    let finalAnalysis        = germanAnalysis;
    let translationSucceeded = (lang === 'de');

    if (lang !== 'de') {
      const { deep_analysis: _s, _rss: _r, ...forTranslation } = germanAnalysis;
      if (degraded) {
        for (const sp of SPECTRUMS) {
          if (Array.isArray(forTranslation.news_spectrum?.[sp]))
            forTranslation.news_spectrum[sp] = forTranslation.news_spectrum[sp].slice(0, 2);
        }
      }
      await geminiSemaphore.acquire(SEMAPHORE_WAIT_TIMEOUT_MS);
      try {
        metrics.recordGeminiCall('translate');
        finalAnalysis = await Promise.race([
          translateAnalysis(forTranslation, lang, genAI),
          new Promise((_, rej) => setTimeout(() => rej(new Error('translate timeout')), GLOBAL_TRANSL_TIMEOUT)),
        ]);
        translationSucceeded = true;
        console.log(`[Translate-Stream] → ${lang} done`);
      } catch (err) {
        console.error('[Translate-Stream] Falling back to German:', err.message);
        finalAnalysis = germanAnalysis;
      } finally {
        geminiSemaphore.release();
      }
    }

    // ── Emit final result ────────────────────────────────────────────────────
    finalAnalysis = {
      ...finalAnalysis,
      analysis_topic:    topic,
      response_language: lang,
      analyzed_at:       germanAnalysis.analyzed_at,
      ...(germanAnalysis._rss ? { _rss: germanAnalysis._rss } : {}),
      ...(germanAnalysis._reliability ? { _reliability: germanAnalysis._reliability } : {}),
    };
    // Final belt-and-suspenders dedup on the SHIPPED spectrum — URLs survive
    // translation, so this removes any same-article twin that slipped through
    // (e.g. a German original + its translated copy resolving to one URL).
    if (finalAnalysis.news_spectrum) {
      for (const sp of SPECTRUMS) {
        if (Array.isArray(finalAnalysis.news_spectrum[sp])) {
          finalAnalysis.news_spectrum[sp] = dedupeArticles(finalAnalysis.news_spectrum[sp]);
        }
      }
    }
    const fullResponse = {
      ...finalAnalysis,
      _meta: {
        degraded,
        rss_articles: finalAnalysis.coverage_distribution
          ? Object.values(finalAnalysis.coverage_distribution).reduce((s, e) => s + (e.count ?? 0), 0)
          : undefined,
      },
    };

    if (!isAdmin) await incrementUsageForIP(clientIP);
    const { remaining } = await checkDailyLimitDB(clientIP);

    if (!degraded && translationSucceeded) {
      await cacheSetLayered(cacheKey, fullResponse, 86400, topic, lang);
    }

    logSearch({ topic, lang, degraded, cacheHit: false, userId: jwtUser?.id, ipHash }).catch(() => {});

    metrics.recordAnalysis({ source: rssForReliability?.search_meta?.source === 'corpus' ? 'corpus' : 'live', degraded });
    metrics.recordTranslation(translationSucceeded);
    metrics.recordLatency('stream_total', Date.now() - requestStart);

    emit('result', { ...fullResponse, _usage: { remaining, limit: FREE_DAILY_LIMIT } });
    emit('done', {});
    closeStream();

  } catch (err) {
    serverStats.errors++;
    metrics.recordError();
    reportError(err, { endpoint: '/api/analyze/stream', topic });
    console.error('[Stream Error]:', err.message);
    if (err.message === 'semaphore_timeout') {
      emit('error', { message: 'Server busy', code: 'semaphore_timeout' });
    } else {
      emit('error', { message: err.message });
    }
    closeStream();
  }
});

// Standalone deep-analysis endpoint — called by the frontend AFTER main result is shown.
// Has its own 55s Railway window, separate from /api/analyze.
// Uses a dedicated deepKey cache so it never re-computes unnecessarily.
app.post('/api/deep-analysis', async (req, res) => {
  const { topic, lang } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });

  // Separate cache for deep analysis results (independent of main analysis cache)
  const deepKey = crypto.createHash('md5').update(`${topic.toLowerCase()}:deep:v4`).digest('hex');
  const cachedDeep = await cacheGetLayered(deepKey);
  if (cachedDeep) {
    console.log(`[DeepAnalysis] Cache hit for "${topic}"`);
    // For non-DE: check if we have a translated version stored
    if (lang !== 'de') {
      const translatedKey = crypto.createHash('md5').update(`${topic.toLowerCase()}:deep:${lang}:v4`).digest('hex');
      const translatedDeep = await cacheGetLayered(translatedKey);
      if (translatedDeep) return res.json({ deep_analysis: translatedDeep });
    } else {
      return res.json({ deep_analysis: cachedDeep });
    }
  }

  // Fetch the German base analysis from cache (must run /api/analyze first)
  const deKey = crypto.createHash('md5').update(`${topic.toLowerCase()}:de-base:v4`).digest('hex');
  const cachedBase = await cacheGetLayered(deKey);
  if (!cachedBase?.germanAnalysis) {
    return res.status(404).json({ error: 'Base analysis not cached yet — run /api/analyze first' });
  }

  const { germanAnalysis } = cachedBase;

  try {
    // Run deep analysis — throttled by semaphore (45s budget, own Railway window)
    console.log(`[DeepAnalysis] Waiting for slot (active=${geminiSemaphore.active}, queue=${geminiSemaphore.waiting})`);
    await geminiSemaphore.acquire(SEMAPHORE_WAIT_TIMEOUT_MS);
    let deep;
    try {
      metrics.recordGeminiCall('deep');
      deep = await callDeepAnalysis(germanAnalysis, 45000);
      metrics.recordDeepAnalysis(true);
    } catch (e) {
      metrics.recordDeepAnalysis(false);
      reportError(e, { endpoint: '/api/deep-analysis', topic });
      throw e;
    } finally {
      geminiSemaphore.release();
    }
    console.log(`[DeepAnalysis] Done — ${deep.shared_facts.length} facts, ${deep.diverging_points.length} diverging, ${deep.silenced_topics.length} silenced`);

    // Override Gemini's hallucinated coverage_volume with real RSS week/month counts
    if (germanAnalysis._rss?.coverage_volume) {
      deep.coverage_volume = germanAnalysis._rss.coverage_volume;
      console.log('[DeepAnalysis] coverage_volume overridden with real RSS data');
    }

    // Wave 1 reliability: verify shared_facts against the corpus, cite each
    // conclusion, and drop unverifiable experts. Only when corpus articles exist.
    if (germanAnalysis._rss?.spectra) {
      try {
        const flat = flattenSpectra(germanAnalysis._rss.spectra);
        if (flat.length) {
          const { deep: enriched, report } = await enrichDeepAnalysis(deep, flat);
          deep = enriched;
          console.log(`[DeepAnalysis] verified facts=${report.verifiedFacts}/${report.facts} contradicted=${report.contradicted} experts kept=${report.expertsKept} dropped=${report.expertsDropped}`);
        }
      } catch (e) {
        console.warn('[DeepAnalysis] enrichment skipped:', e.message);
      }
    }

    // Cache German deep analysis
    await cacheSetLayered(deepKey, deep, 86400);

    // Translate if needed, cache result separately
    // Pass only deep_analysis in a minimal wrapper — translating full spectrum JSON is too slow
    let finalDeep = deep;
    if (lang !== 'de') {
      await geminiSemaphore.acquire(SEMAPHORE_WAIT_TIMEOUT_MS);
      try {
        // Use a ':deep' suffix so translate.js cache doesn't collide with main analysis cache
        const minimalForTranslation = {
          analysis_topic: `${germanAnalysis.analysis_topic}:deep`,
          response_language: 'de',
          deep_analysis: deep,
        };
        const translated = await Promise.race([
          translateAnalysis(minimalForTranslation, lang, genAI),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Deep translation timeout')), 20000)),
        ]);
        finalDeep = translated.deep_analysis ?? deep;
        const translatedKey = crypto.createHash('md5').update(`${topic.toLowerCase()}:deep:${lang}:v4`).digest('hex');
        await cacheSetLayered(translatedKey, finalDeep, 86400);
      } catch (err) {
        console.warn('[DeepAnalysis] Translation failed, using German:', err.message);
      } finally {
        geminiSemaphore.release();
      }
    }

    res.json({ deep_analysis: finalDeep });
  } catch (err) {
    console.error('[DeepAnalysis] Failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Trending topics (real-time via Gemini + googleSearch) ────────────────────
// Cached for 4 hours so we don't hammer the API. The week key forces a refresh
// every Monday even without a cache flush.
function trendingCacheKey() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday of this week
  const day4 = monday.toISOString().split('T')[0];
  return `trending:de:${day4}`;
}

async function fetchTrendingFromGemini() {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} }],
  });
  const today = new Date().toISOString().split('T')[0];

  const prompt = `Use Google Search to find the TOP 8 news topics that are trending in Germany THIS WEEK (week of ${today}).

Focus on topics that are actively discussed in German media RIGHT NOW — politics, economy, society, international affairs.

OUTPUT ONLY this JSON object (no markdown, no fences):
{
  "week_of": "${today}",
  "topics": [
    {
      "topic_de": "<short German topic, 2-5 words>",
      "topic_en": "<English translation>",
      "topic_ru": "<Russian translation>",
      "category": "<politics|economy|society|defense|environment|international|culture|justice>",
      "trend_reason_de": "<one sentence in German: why is this trending right now>"
    }
  ]
}

RULES:
- Exactly 8 topics, ordered by relevance/buzz (most discussed first)
- topic_de must be search-friendly (someone could type it and find articles)
- Use only these categories: politics, economy, society, defense, environment, international, culture, justice
- trend_reason_de must be a real, concrete reason (not generic)`;

  const result = await Promise.race([
    model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } }, // simple list task
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Trending timeout')), 40000)),
  ]);

  const raw = result.response.text();
  return extractJSON(raw);
}

// ── Public analyses — already-cached results anyone can open instantly ────────
app.get('/api/public-analyses', async (req, res) => {
  try {
    // Pass userId if logged in so user_liked is populated
    let userId = null;
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try { userId = jwt.verify(auth.slice(7), JWT_SECRET).id; } catch {}
    }
    const rows = await getPublicAnalyses(20, userId);
    res.json(rows);
  } catch {
    res.json([]);
  }
});

// ── Analysis likes ────────────────────────────────────────────────────────────
app.post('/api/analyses/:topicNorm/like', requireAuth, async (req, res) => {
  const { topicNorm } = req.params;
  if (!topicNorm) return res.status(400).json({ error: 'topicNorm required' });
  try {
    const result = await toggleAnalysisLike(decodeURIComponent(topicNorm), req.user.id);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// ── View count (fire-and-forget when user opens a cached analysis) ────────────
app.post('/api/analyses/:topicNorm/view', async (req, res) => {
  incrementViewCount(decodeURIComponent(req.params.topicNorm));
  res.json({ ok: true });
});

// ── User media spectrum (for profile) ────────────────────────────────────────
app.get('/api/profile/media-spectrum', requireAuth, async (req, res) => {
  try {
    const spectrum = await getUserMediaSpectrum(req.user.id);
    res.json(spectrum ?? null);
  } catch {
    res.json(null);
  }
});

// ── Liked analyses (for profile) ─────────────────────────────────────────────
app.get('/api/profile/liked-analyses', requireAuth, async (req, res) => {
  try {
    const liked = await getLikedAnalyses(req.user.id);
    res.json({ liked });
  } catch {
    res.json({ liked: [] });
  }
});

// ── Daily usage check (used by frontend to show UsageBar on load) ─────────────
app.get('/api/usage', async (req, res) => {
  const ip = getClientIP(req);
  try {
    const { remaining } = await checkDailyLimitDB(ip);
    res.json({ remaining, limit: FREE_DAILY_LIMIT });
  } catch {
    res.json({ remaining: FREE_DAILY_LIMIT, limit: FREE_DAILY_LIMIT });
  }
});

app.get('/api/trending', async (req, res) => {
  const key = trendingCacheKey();
  const cached = await cacheGetLayered(key);
  if (cached) {
    console.log(`[Trending] Cache hit (${key})`);
    return res.json(cached);
  }

  try {
    console.log(`[Trending] Fetching live from Gemini...`);
    const data = await fetchTrendingFromGemini();
    if (!Array.isArray(data?.topics) || data.topics.length === 0) {
      throw new Error('Empty trending response');
    }
    await cacheSetLayered(key, data, 14400); // 4-hour TTL
    console.log(`[Trending] Got ${data.topics.length} topics, cached as ${key}`);
    res.json(data);
  } catch (err) {
    console.error('[Trending] Failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/top-topics', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  res.json({ topics: getTopTopics(limit) });
});

// ── Stats (hype counter) ───────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  const memTopTopic = [...topicStats.values()].sort((a, b) => b.count - a.count)[0] || null;

  // Try Redis for persistent numbers (survive restarts)
  const [redisTotal, redisTopics, redisUnique] = await Promise.all([
    rGetTotalAnalyses().catch(() => null),
    rGetTopTopics(1).catch(() => null),
    rGetUniqueTopics().catch(() => null),
  ]);

  res.json({
    total_analyses: redisTotal ?? totalAnalyses,
    unique_topics:  redisUnique ?? topicStats.size,
    top_topic: redisTopics?.[0] ?? (memTopTopic ? { topic: memTopTopic.topic, count: memTopTopic.count } : null),
  });
});

// ── Daily News ────────────────────────────────────────────────────────────────
function dailyNewsCacheKey() {
  const d = new Date();
  // Refresh every 2 hours
  const hour2 = Math.floor(d.getUTCHours() / 2) * 2;
  return `daily-news:${d.toISOString().split('T')[0]}:${hour2}`;
}

async function fetchDailyNewsFromGemini() {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} }],
  });
  const today = new Date().toISOString().split('T')[0];

  const prompt = `Use Google Search to find the TOP 6 breaking news stories in Germany TODAY (${today}).

Focus on the most important stories published or updated in the last 24 hours.

OUTPUT ONLY this JSON object (no markdown, no fences):
{
  "date": "${today}",
  "stories": [
    {
      "headline_de": "<punchy German headline, max 10 words>",
      "headline_en": "<English headline>",
      "headline_ru": "<Russian headline>",
      "summary_de": "<1 sentence in German: what happened>",
      "summary_en": "<1 sentence in English: what happened>",
      "summary_ru": "<1 sentence in Russian: what happened>",
      "category": "<politics|economy|society|defense|environment|international|culture|justice>",
      "source": "<primary source name, e.g. Spiegel, FAZ, ARD>",
      "search_topic": "<2-4 word search topic for this story in German>"
    }
  ]
}

RULES:
- Exactly 6 stories, most important first
- Real stories from today, not older than 48h
- search_topic must be useful for searching this story on this platform`;

  const result = await Promise.race([
    model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } }, // simple list task
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Daily news timeout')), 40000)),
  ]);

  const raw = result.response.text();
  return extractJSON(raw);
}

app.get('/api/daily-news', async (req, res) => {
  const key = dailyNewsCacheKey();
  const cached = await cacheGetLayered(key);
  if (cached) {
    console.log(`[DailyNews] Cache hit (${key})`);
    return res.json(cached);
  }

  try {
    console.log(`[DailyNews] Fetching live from Gemini...`);
    const data = await fetchDailyNewsFromGemini();
    if (!Array.isArray(data?.stories) || data.stories.length === 0) {
      throw new Error('Empty daily news response');
    }
    await cacheSetLayered(key, data, 7200); // 2-hour TTL
    console.log(`[DailyNews] Got ${data.stories.length} stories, cached as ${key}`);
    res.json(data);
  } catch (err) {
    console.error('[DailyNews] Failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Category News ─────────────────────────────────────────────────────────────
const VALID_CATEGORIES = ['politics','economy','society','defense','environment','international','culture','justice'];

function categoryNewsCacheKey(category) {
  const d = new Date();
  const hour4 = Math.floor(d.getUTCHours() / 4) * 4;
  return `cat-news:${category}:${d.toISOString().split('T')[0]}:${hour4}`;
}

async function fetchCategoryNews(category) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} }],
  });
  const today = new Date().toISOString().split('T')[0];

  const categoryLabels = {
    politics: 'Politics / Innenpolitik',
    economy: 'Economy / Wirtschaft',
    society: 'Society / Gesellschaft',
    defense: 'Defense / Verteidigung & Sicherheit',
    environment: 'Environment / Umwelt & Klima',
    international: 'International / Außenpolitik',
    culture: 'Culture / Kultur',
    justice: 'Justice / Justiz & Recht',
  };

  const prompt = `Use Google Search to find the TOP 8 news stories in Germany in the category "${categoryLabels[category]}" from the last 48 hours (today: ${today}).

OUTPUT ONLY this JSON object (no markdown, no fences):
{
  "category": "${category}",
  "date": "${today}",
  "stories": [
    {
      "headline_de": "<punchy German headline, max 10 words>",
      "headline_en": "<English headline>",
      "headline_ru": "<Russian headline>",
      "summary_de": "<1 sentence in German>",
      "summary_en": "<1 sentence in English>",
      "summary_ru": "<1 sentence in Russian>",
      "source": "<source name>",
      "search_topic": "<2-4 word German search query>"
    }
  ]
}

RULES:
- Exactly 8 stories, most important first
- Only stories from the "${categoryLabels[category]}" category
- Real stories from the last 48 hours
- search_topic must be concise and searchable`;

  const result = await Promise.race([
    model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } }, // simple list task
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Category news timeout')), 40000)),
  ]);

  const raw = result.response.text();
  return extractJSON(raw);
}

app.get('/api/category-news', async (req, res) => {
  const category = req.query.category;
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const key = categoryNewsCacheKey(category);
  const cached = await cacheGetLayered(key);
  if (cached) {
    console.log(`[CategoryNews] Cache hit (${key})`);
    return res.json(cached);
  }

  try {
    console.log(`[CategoryNews] Fetching ${category} from Gemini...`);
    const data = await fetchCategoryNews(category);
    if (!Array.isArray(data?.stories) || data.stories.length === 0) {
      throw new Error('Empty category news response');
    }
    await cacheSetLayered(key, data, 14400); // 4-hour TTL
    console.log(`[CategoryNews] Got ${data.stories.length} stories for ${category}`);
    res.json(data);
  } catch (err) {
    console.error(`[CategoryNews] Failed for ${category}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suggest-source', async (req, res) => {
  const { name, email, url, spectrum, why } = req.body;
  if (!url || !why) return res.status(400).json({ error: 'url and why are required' });

  const entry = {
    name:     (name     || '').trim().substring(0, 100),
    email:    (email    || '').trim().substring(0, 200),
    url:      (url      || '').trim().substring(0, 500),
    spectrum: ['left', 'center', 'right', 'unsure'].includes(spectrum) ? spectrum : 'unsure',
    why:      (why      || '').trim().substring(0, 1000),
  };

  // ── Primary: PostgreSQL (persistent across deploys) ───────────────────────
  if (isDBAvailable()) {
    try {
      await saveSuggestion(entry);
      console.log(`[Suggest] DB: ${entry.url} (${entry.spectrum})`);
      return res.json({ ok: true });
    } catch (err) {
      console.error('[Suggest] DB write failed, falling back to file:', err.message);
    }
  }

  // ── Fallback: local JSON file (dev without DB) ────────────────────────────
  const suggestionsFile = path.join(__dirname, 'suggestions.json');
  try {
    const existing = fs.existsSync(suggestionsFile)
      ? JSON.parse(fs.readFileSync(suggestionsFile, 'utf8'))
      : [];
    existing.push({ ...entry, timestamp: new Date().toISOString() });
    fs.writeFileSync(suggestionsFile, JSON.stringify(existing, null, 2));
    console.log(`[Suggest] File fallback: ${entry.url} (${entry.spectrum})`);
    res.json({ ok: true });
  } catch (fileErr) {
    console.error('[Suggest] File fallback error:', fileErr.message);
    res.status(500).json({ error: 'storage error' });
  }
});

// ── Auth Routes ───────────────────────────────────────────────────────────────

app.post('/api/auth/register', registerLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });

  try {
    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser(email.toLowerCase().trim(), passwordHash);

    // Send verification email — must be confirmed before login is allowed
    const verifyToken  = generateToken();
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await setEmailVerifyToken(user.id, hashToken(verifyToken), verifyExpiry);
    sendVerificationEmail(user.email, verifyToken).catch(e =>
      console.warn('[Auth/register] Verification email failed:', e.message)
    );

    // Do NOT return a JWT — user must verify email before they can log in
    res.status(201).json({ ok: true, email: user.email });
  } catch (err) {
    console.error('[Auth/register]', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Dev test account (staging only) ──────────────────────────────────────────
// POST /api/dev/ensure-test-user
// Protected by ADMIN_KEY. Creates or resets admin@test.local / admin with
// email_verified=true and daily_limit=-1 so it can log in without email flow.
app.post('/api/dev/ensure-test-user', async (req, res) => {
  // This endpoint MUST NOT be available in production — test account would be a security risk
  if (IS_PRODUCTION) return res.status(403).json({ error: 'Not available in production' });
  const key = req.headers['x-admin-key'];
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!isDBAvailable()) return res.status(503).json({ error: 'DB not available' });
  try {
    const passwordHash = await bcrypt.hash('admin', 12);
    const user = await upsertDevUser('admin@test.local', passwordHash);
    const token = jwt.sign(
      { id: user.id, email: user.email, tier: user.tier, daily_limit: user.daily_limit, email_verified: true },
      JWT_SECRET, { expiresIn: JWT_EXPIRES }
    );
    console.log(`[Dev] Test account ensured: ${user.email} (id=${user.id})`);
    res.json({ ok: true, email: user.email, token });
  } catch (err) {
    console.error('[Dev/ensure-test-user]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });

  try {
    // ── Account lockout check (before any DB user lookup to avoid timing leak) ──
    const lockStatus = await checkAccountLock(email);
    if (lockStatus.locked) {
      return res.status(423).json({
        error: 'account_locked',
        minutesLeft: lockStatus.minutesLeft,
        message: `Konto vorübergehend gesperrt. Bitte warte ${lockStatus.minutesLeft} Minuten oder setze dein Passwort zurück.`,
      });
    }

    const user = await findUserByEmail(email);
    // Always run bcrypt to prevent user enumeration via timing
    const dummyHash = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
    const ok = user?.is_active
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, dummyHash).then(() => false);

    if (!user || !user.is_active || !ok) {
      // Record failed attempt (fire-and-forget, non-blocking)
      if (user?.is_active) {
        recordFailedLogin(email).catch(() => {});
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.email_verified) {
      return res.status(403).json({ error: 'email_not_verified', email: user.email });
    }

    // Successful login — clear lockout counter
    await Promise.all([
      updateLastLogin(user.id),
      clearLoginAttempts(email),
    ]);

    const token = jwt.sign(
      { id: user.id, email: user.email, tier: user.tier, daily_limit: user.daily_limit, email_verified: user.email_verified ?? false },
      JWT_SECRET, { expiresIn: JWT_EXPIRES }
    );
    res.json({
      token,
      user: { id: user.id, email: user.email, tier: user.tier, daily_limit: user.daily_limit, email_verified: user.email_verified ?? false },
    });
  } catch (err) {
    console.error('[Auth/login]', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.get('/api/auth/usage', requireAuth, async (req, res) => {
  try {
    // Unlimited users (daily_limit = -1) never hit rate limits
    if (req.user?.daily_limit === -1) {
      return res.json({ used: 0, limit: -1, remaining: -1, unlimited: true });
    }
    const clientIP = getClientIP(req);
    const { remaining } = await checkDailyLimitDB(clientIP);
    const used = Math.max(0, FREE_DAILY_LIMIT - remaining);
    res.json({ used, limit: FREE_DAILY_LIMIT, remaining, unlimited: false });
  } catch (err) {
    res.json({ used: 0, limit: FREE_DAILY_LIMIT, remaining: FREE_DAILY_LIMIT, unlimited: false });
  }
});

// ── User Search History API ───────────────────────────────────────────────────

app.get('/api/history', requireAuth, async (req, res) => {
  try {
    const history = await getUserSearchHistory(req.user.id, 100);
    res.json({ history });
  } catch (err) {
    console.error('[history] GET error:', err.message);
    res.json({ history: [] });
  }
});

app.post('/api/history', requireAuth, async (req, res) => {
  const { topic, lang, coverage } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic required' });
  try {
    const entry = await saveUserSearch(req.user.id, topic, lang || 'de', coverage || null);
    res.json({ ok: true, entry });
  } catch (err) {
    console.error('[history] POST error:', err.message);
    res.json({ ok: false });
  }
});

app.delete('/api/history/:id', requireAuth, async (req, res) => {
  try {
    await deleteUserSearch(req.user.id, parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (err) {
    console.error('[history] DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Email Verification ────────────────────────────────────────────────────────

app.get('/api/auth/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Token required' });
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });
  try {
    const user = await verifyEmailToken(hashToken(token));
    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link' });
    console.log(`[Auth] Email verified: ${user.email}`);
    // Issue a JWT so the frontend can auto-login immediately after verification
    const jwt_token = jwt.sign(
      { id: user.id, email: user.email, tier: user.tier, daily_limit: user.daily_limit, email_verified: true },
      JWT_SECRET, { expiresIn: '30d' }
    );
    res.json({ ok: true, message: 'E-Mail erfolgreich bestätigt!', token: jwt_token, user: { id: user.id, email: user.email, tier: user.tier, daily_limit: user.daily_limit } });
  } catch (err) {
    console.error('[Auth/verify-email]', err.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Public resend — for users who can't login yet (email not verified)
app.post('/api/auth/resend-public', forgotLimiter, async (req, res) => {
  // Always return ok — prevent email enumeration
  if (!isDBAvailable()) return res.json({ ok: true });
  try {
    const { email } = req.body;
    if (!email) return res.json({ ok: true });
    const user = await findUserByEmail(email.toLowerCase().trim());
    if (user && !user.email_verified) {
      const token  = generateToken();
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await setEmailVerifyToken(user.id, hashToken(token), expiry);
      sendVerificationEmail(user.email, token).catch(e =>
        console.warn('[Auth/resend-public] Email failed:', e.message)
      );
    }
  } catch (err) {
    console.warn('[Auth/resend-public]', err.message);
  }
  res.json({ ok: true });
});

app.post('/api/auth/resend-verification', requireAuth, forgotLimiter, async (req, res) => {
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified) return res.json({ ok: true, message: 'Already verified' });
    const token  = generateToken();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await setEmailVerifyToken(user.id, hashToken(token), expiry);
    await sendVerificationEmail(user.email, token);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Auth/resend-verification]', err.message);
    res.status(500).json({ error: 'Failed to resend' });
  }
});

// ── Password Reset ─────────────────────────────────────────────────────────────

app.post('/api/auth/forgot-password', forgotLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  // Always return ok — never reveal whether email exists (prevent enumeration)
  res.json({ ok: true, message: 'Falls ein Konto existiert, wurde eine E-Mail gesendet.' });

  if (!isDBAvailable()) return;
  try {
    const token  = generateToken();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1h
    const found  = await setResetToken(email, hashToken(token), expiry);
    if (found) {
      await sendPasswordResetEmail(email.toLowerCase().trim(), token);
      console.log(`[Auth] Password reset email sent to ${email}`);
    }
  } catch (err) {
    console.warn('[Auth/forgot-password] Error (silent):', err.message);
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
  if (password.length < 8)  return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!isDBAvailable())      return res.status(503).json({ error: 'Database not available' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const user = await useResetToken(hashToken(token), hash);
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link' });
    const jwt_token = jwt.sign(
      { id: user.id, email: user.email, tier: user.tier, daily_limit: user.daily_limit, email_verified: user.email_verified ?? false },
      JWT_SECRET, { expiresIn: JWT_EXPIRES }
    );
    console.log(`[Auth] Password reset for ${user.email}`);
    res.json({ ok: true, token: jwt_token, user: { id: user.id, email: user.email, tier: user.tier, daily_limit: user.daily_limit, email_verified: user.email_verified } });
  } catch (err) {
    console.error('[Auth/reset-password]', err.message);
    res.status(500).json({ error: 'Reset failed' });
  }
});

// ── Account Management (authenticated) ───────────────────────────────────────

app.put('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });
  try {
    const user = await findUserByEmail(req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
    const hash = await bcrypt.hash(newPassword, 12);
    await updateUserPassword(req.user.id, hash);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Auth/change-password]', err.message);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

app.put('/api/auth/change-email', requireAuth, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });
  try {
    const user = await findUserByEmail(req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Passwort ist falsch' });
    const exists = await findUserByEmail(email);
    if (exists) return res.status(409).json({ error: 'Diese E-Mail ist bereits vergeben' });
    const updated = await updateUserEmail(req.user.id, email);
    // Send new verification email
    const verifyToken  = generateToken();
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setEmailVerifyToken(req.user.id, hashToken(verifyToken), verifyExpiry).catch(() => {});
    sendVerificationEmail(email.toLowerCase().trim(), verifyToken).catch(e =>
      console.warn('[Auth/change-email] Verification email failed:', e.message)
    );
    const newToken = jwt.sign(
      { id: req.user.id, email: updated.email, tier: updated.tier, daily_limit: updated.daily_limit, email_verified: false },
      JWT_SECRET, { expiresIn: JWT_EXPIRES }
    );
    res.json({ ok: true, token: newToken, user: { ...updated, email_verified: false } });
  } catch (err) {
    console.error('[Auth/change-email]', err.message);
    res.status(500).json({ error: 'Failed to change email' });
  }
});

app.delete('/api/auth/account', requireAuth, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required to confirm deletion' });
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });
  try {
    const user = await findUserByEmail(req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Passwort ist falsch' });
    await softDeleteUser(req.user.id);
    console.log(`[Auth] Account deleted: user ${req.user.id}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Auth/delete-account]', err.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

app.get('/api/auth/export', requireAuth, async (req, res) => {
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });
  try {
    const data = await exportUserData(req.user.id);
    if (!data) return res.status(404).json({ error: 'No data found' });
    const filename = `neutralnachrichten-export-${req.user.id}-${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(data);
  } catch (err) {
    console.error('[Auth/export]', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ── Saved Topics (Bookmarks) ──────────────────────────────────────────────────

app.get('/api/saved-topics', requireAuth, async (req, res) => {
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });
  try {
    const topics = await getSavedTopics(req.user.id);
    res.json({ saved: topics });
  } catch (err) {
    console.error('[SavedTopics/GET]', err.message);
    res.status(500).json({ error: 'Failed to fetch saved topics' });
  }
});

app.post('/api/saved-topics', requireAuth, async (req, res) => {
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });
  const { topic, topicNorm, lang } = req.body;
  if (!topic || !topicNorm) return res.status(400).json({ error: 'topic and topicNorm required' });
  try {
    const saved = await saveTopic(req.user.id, topic, topicNorm.toLowerCase().trim(), lang || 'de');
    res.json({ saved });
  } catch (err) {
    console.error('[SavedTopics/POST]', err.message);
    res.status(500).json({ error: 'Failed to save topic' });
  }
});

app.delete('/api/saved-topics/:norm', requireAuth, async (req, res) => {
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });
  const topicNorm = decodeURIComponent(req.params.norm);
  try {
    const result = await unsaveTopic(req.user.id, topicNorm.toLowerCase().trim());
    res.json(result);
  } catch (err) {
    console.error('[SavedTopics/DELETE]', err.message);
    res.status(500).json({ error: 'Failed to remove saved topic' });
  }
});

// ── Email Digest Preference ───────────────────────────────────────────────────

app.put('/api/auth/digest', requireAuth, async (req, res) => {
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled (boolean) required' });
  try {
    await setDigestPreference(req.user.id, enabled);
    res.json({ ok: true, email_digest: enabled });
  } catch (err) {
    console.error('[Digest/PUT]', err.message);
    res.status(500).json({ error: 'Failed to update digest preference' });
  }
});

// ── Admin: Send Weekly Digest ─────────────────────────────────────────────────

app.post('/api/admin/send-digest', async (req, res) => {
  const key = req.headers['x-admin-key'];
  if (!ADMIN_KEY || key !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });

  try {
    // Get top topics from last 7 days
    const allTopics = await getTopTopicsDB(5);
    if (!allTopics || allTopics.length === 0) {
      return res.json({ ok: true, sent: 0, message: 'No topics found' });
    }

    // Enrich with display names from cache
    const topicsForEmail = allTopics.slice(0, 3).map(t => ({
      topic: t.topic || t.topic_norm,
      topic_norm: t.topic_norm || t.topic,
    }));

    const subscribers = await getDigestSubscribers();
    if (subscribers.length === 0) {
      return res.json({ ok: true, sent: 0, message: 'No subscribers' });
    }

    let sent = 0;
    let errors = 0;
    for (const user of subscribers) {
      try {
        await sendWeeklyDigest(user.email, topicsForEmail);
        sent++;
      } catch (e) {
        console.error(`[Digest] Failed to send to ${user.email}:`, e.message);
        errors++;
      }
    }

    console.log(`[Digest] Sent to ${sent} subscribers (${errors} errors)`);
    res.json({ ok: true, sent, errors, topics: topicsForEmail });
  } catch (err) {
    console.error('[Digest/send]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Admin Dashboard API ───────────────────────────────────────────────────────
// Protected by ADMIN_KEY env var. Returns full platform analytics.
app.get('/api/admin/stats', async (req, res) => {
  const key = req.headers['x-admin-key'];
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const today = todayUTC();
  const topTopics = getTopTopics(20);

  // Aggregate IP usage stats
  const activeIPsToday = [...ipUsage.entries()]
    .filter(([, u]) => u.date === today)
    .sort(([, a], [, b]) => b.count - a.count);

  const totalAnalysesToday = activeIPsToday.reduce((s, [, u]) => s + u.count, 0);
  const estimatedTokensToday = activeIPsToday.reduce((s, [, u]) => s + u.tokensIn + u.tokensOut, 0);
  const estimatedCostToday = totalAnalysesToday * COST_PER_ANALYSIS;
  const estimatedCostMonth = estimatedCostToday * 30;

  // Cache stats
  const cacheKeys = cache.keys();
  const cacheHitRate = serverStats.totalRequests > 0
    ? Math.round((serverStats.cacheHits / serverStats.totalRequests) * 100)
    : 0;

  // DB + Redis stats (non-blocking)
  const [dbStats, dbTopTopics, dbUsers, redisTopics, redisTotal, rStats] = await Promise.all([
    getAdminStatsDB().catch(() => null),
    getTopTopicsDB(20).catch(() => null),
    getUsersAdmin(50).catch(() => []),
    rGetTopTopics(20).catch(() => null),
    rGetTotalAnalyses().catch(() => null),
    rGetStats().catch(() => null),
  ]);

  res.json({
    server: {
      startedAt:    serverStats.startedAt,
      uptime_hours: Math.round((Date.now() - new Date(serverStats.startedAt).getTime()) / 3600000 * 10) / 10,
      totalRequests: rStats?.totalRequests ?? serverStats.totalRequests,
      cacheHits:     rStats?.cacheHits    ?? serverStats.cacheHits,
      cacheMisses:   rStats?.cacheMisses  ?? serverStats.cacheMisses,
      cacheHitRate: `${cacheHitRate}%`,
      errors:        rStats?.errors       ?? serverStats.errors,
      cachedItems:  cacheKeys.length,
      dbAvailable:  isDBAvailable(),
      redisAvailable: isRedisAvailable(),
      gemini: { active: geminiSemaphore.active, queued: geminiSemaphore.waiting, limit: geminiSemaphore.max },
    },
    usage: {
      today,
      totalAnalysesAllTime: dbStats?.totalSearches ?? redisTotal ?? totalAnalyses,
      totalAnalysesToday:   dbStats?.searchesToday ?? totalAnalysesToday,
      uniqueTopicsAllTime:  topicStats.size,
      activeIPsToday:       activeIPsToday.length,
      freeDailyLimit:       FREE_DAILY_LIMIT,
    },
    costs: {
      estimatedTokensToday,
      estimatedCostToday: `$${estimatedCostToday.toFixed(3)}`,
      estimatedCostMonth: `$${estimatedCostMonth.toFixed(2)}`,
      costPerAnalysis: `$${COST_PER_ANALYSIS}`,
      note: 'Estimates only. RSS-Direct architecture — no Search Grounding cost.',
    },
    topTopics: dbTopTopics ?? redisTopics ?? topTopics,
    topIPs: activeIPsToday.slice(0, 10).map(([ip, u]) => ({
      ip: ip.replace(/\.\d+$/, '.***'), // mask last octet
      count: u.count,
      tokensEstimate: u.tokensIn + u.tokensOut,
    })),
    users: dbUsers,
    db: dbStats,
    hourlyLast24h: dbStats?.hourlyLast24h ?? [],
  });
});

// ── Admin: reliability & ops metrics (audit fix A4) ─────────────────────────────
// Everything the audit found us blind on: confidence distribution, grounding
// ratio, corpus vs live split, degraded rate, Gemini call counts, per-stage
// latency, corpus size + feed health. Header-auth like all admin endpoints.
app.get('/api/admin/metrics', async (req, res) => {
  const key = req.headers['x-admin-key'];
  if (!ADMIN_KEY || key !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });

  const [corpus] = await Promise.all([getCorpusStats().catch(() => null)]);
  res.json({
    process: metrics.snapshot(),
    corpus,
    flags: {
      corpusAnalysisEnabled: CORPUS_ANALYSIS_ENABLED,
      sentry: !!process.env.SENTRY_DSN,
      geminiMaxPerSpectrum: GEMINI_MAX_PER_SPECTRUM,
    },
    budget: {
      day: geminiBudget.day,
      callsToday: geminiBudget.calls,
      dailyLimit: GEMINI_DAILY_BUDGET,
      remaining: Math.max(0, GEMINI_DAILY_BUDGET - geminiBudget.calls),
    },
  });
});

// ── Admin User Management ─────────────────────────────────────────────────────

app.post('/api/admin/users/:id', async (req, res) => {
  const key = req.headers['x-admin-key'];
  if (!ADMIN_KEY || key !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });

  const userId = parseInt(req.params.id);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

  const { tier, daily_limit } = req.body;
  const validTiers = ['free', 'pro', 'enterprise'];
  if (tier && !validTiers.includes(tier)) return res.status(400).json({ error: 'Invalid tier' });

  // -1 = unlimited, must be integer
  const newLimit = daily_limit !== undefined ? parseInt(daily_limit) : undefined;
  if (newLimit !== undefined && isNaN(newLimit)) return res.status(400).json({ error: 'Invalid daily_limit' });

  try {
    const updated = await updateUserTier(
      userId,
      tier || 'free',
      newLimit ?? FREE_DAILY_LIMIT
    );
    if (!updated) return res.status(404).json({ error: 'User not found' });
    console.log(`[Admin] Updated user ${userId}: tier=${updated.tier}, daily_limit=${updated.daily_limit}`);
    res.json({ ok: true, user: updated });
  } catch (err) {
    console.error('[Admin/updateUser]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Google OAuth ──────────────────────────────────────────────────────────────

app.get('/api/auth/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(501).json({ error: 'Google OAuth not configured' });
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${BASE_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get('/api/auth/google/callback', async (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${BASE_URL}/?auth_error=oauth_not_configured`);
  }

  const { code } = req.query;
  if (!code) return res.redirect(`${BASE_URL}/?auth_error=no_code`);

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${BASE_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.id_token) throw new Error('No id_token from Google');

    // Decode and validate id_token claims.
    // The token arrived directly from Google's OAuth endpoint (not from the user),
    // so we verify: issuer, audience, and expiry at minimum.
    const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString());
    const validIssuers = ['https://accounts.google.com', 'accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) throw new Error('Google token: invalid issuer');
    if (GOOGLE_CLIENT_ID && payload.aud !== GOOGLE_CLIENT_ID) throw new Error('Google token: audience mismatch');
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Google token: expired');
    const { email, name } = payload;
    if (!email) throw new Error('No email in Google token');

    // Find or create user
    let user = await findUserByEmail(email);
    if (!user) {
      const randomPw = crypto.randomBytes(32).toString('hex');
      const hash = await bcrypt.hash(randomPw, 10);
      user = await createUser(email.toLowerCase().trim(), hash);
    }
    await updateLastLogin(user.id);

    const jwtToken = jwt.sign({ id: user.id, email: user.email, tier: user.tier, daily_limit: user.daily_limit }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    console.log(`[Auth/Google] ${email} signed in`);

    // Security: NEVER put JWT in URL (logs, history, Referer headers, analytics).
    // Instead, issue a one-time 30-second exchange code — frontend swaps it for the JWT via POST.
    const oauthCode = createOAuthCode(jwtToken);
    res.redirect(`${BASE_URL}/?oauth_code=${oauthCode}`);
  } catch (err) {
    console.error('[Auth/Google] Error:', err.message);
    res.redirect(`${BASE_URL}/?auth_error=oauth_failed`);
  }
});

// ── OAuth token exchange (one-time code → JWT) ────────────────────────────────
app.post('/api/auth/google/exchange', (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'code required' });
  }
  const jwtToken = consumeOAuthCode(code);
  if (!jwtToken) {
    return res.status(400).json({ error: 'Invalid or expired OAuth code' });
  }
  try {
    const payload = jwt.verify(jwtToken, JWT_SECRET);
    const user = { id: payload.id, email: payload.email, tier: payload.tier, daily_limit: payload.daily_limit };
    res.json({ ok: true, token: jwtToken, user });
  } catch {
    res.status(400).json({ error: 'Token verification failed' });
  }
});

// ── Dynamic OG image (/api/og-image?topic=...&lang=...) ───────────────────────
// Returns an SVG card with the topic embedded — used by social crawlers.
app.get('/api/og-image', (req, res) => {
  const topic = (req.query.topic || 'NeutralNachrichten').toString().slice(0, 80);
  const lang  = req.query.lang || 'de';

  const subtitle = lang === 'en'
    ? 'German media bias analysis'
    : lang === 'ru'
    ? 'Анализ немецких СМИ'
    : 'Deutsche Medienanalyse';

  // Simple clean SVG: 1200×630, newspaper style, topic as headline
  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .serif { font-family: Georgia, 'Times New Roman', serif; }
      .sans  { font-family: Arial, Helvetica, sans-serif; }
    </style>
  </defs>
  <!-- Background -->
  <rect width="1200" height="630" fill="#FFF8F0"/>
  <!-- Top black bar -->
  <rect width="1200" height="80" fill="#1a1a1a"/>
  <!-- Brand in top bar -->
  <text x="60" y="52" class="serif" font-size="28" font-weight="900" fill="#FFF8F0">NeutralNachrichten</text>
  <text x="1140" y="52" class="sans" font-size="13" fill="#FFF8F0" text-anchor="end" letter-spacing="2">MEDIENANALYSE</text>
  <!-- Spectrum strip -->
  <rect x="0"   y="80" width="240" height="8" fill="#e11d48"/>
  <rect x="240" y="80" width="240" height="8" fill="#fb923c"/>
  <rect x="480" y="80" width="240" height="8" fill="#94a3b8"/>
  <rect x="720" y="80" width="240" height="8" fill="#0ea5e9"/>
  <rect x="960" y="80" width="240" height="8" fill="#1d4ed8"/>
  <!-- Subtitle label -->
  <text x="60" y="145" class="sans" font-size="14" fill="#1a1a1a" opacity="0.5" letter-spacing="3">${subtitle.toUpperCase()}</text>
  <!-- Topic headline — wrap long topics -->
  <text x="60" y="240" class="serif" font-size="${topic.length > 40 ? '52' : topic.length > 25 ? '62' : '72'}" font-weight="900" fill="#1a1a1a">${topic.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
  <!-- Spectrum labels -->
  <text x="60"  y="440" class="sans" font-size="13" fill="#e11d48" font-weight="700">LINKS</text>
  <text x="240" y="440" class="sans" font-size="13" fill="#fb923c" font-weight="700">MITTE-LINKS</text>
  <text x="490" y="440" class="sans" font-size="13" fill="#94a3b8" font-weight="700">MITTE</text>
  <text x="690" y="440" class="sans" font-size="13" fill="#0ea5e9" font-weight="700">MITTE-RECHTS</text>
  <text x="950" y="440" class="sans" font-size="13" fill="#1d4ed8" font-weight="700">RECHTS</text>
  <!-- Spectrum bars (decoration) -->
  <rect x="60"  y="455" width="140" height="6" fill="#e11d48" opacity="0.3"/>
  <rect x="240" y="455" width="200" height="6" fill="#fb923c" opacity="0.3"/>
  <rect x="490" y="455" width="160" height="6" fill="#94a3b8" opacity="0.3"/>
  <rect x="690" y="455" width="220" height="6" fill="#0ea5e9" opacity="0.3"/>
  <rect x="950" y="455" width="190" height="6" fill="#1d4ed8" opacity="0.3"/>
  <!-- Bottom rule -->
  <rect x="0" y="580" width="1200" height="2" fill="#1a1a1a" opacity="0.1"/>
  <text x="60" y="612" class="sans" font-size="13" fill="#1a1a1a" opacity="0.4">neutralnachrichten.de</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(svg);
});

// ── Bot detection: dynamic OG meta tags for social crawlers ──────────────────
// When Twitter, Telegram, WhatsApp etc. fetch a shared URL, they need
// topic-specific OG tags — but SPA sends generic index.html to everyone.
// Solution: detect bot UA → serve minimal HTML with correct meta tags.
const BOT_UA = /Twitterbot|facebookexternalhit|TelegramBot|WhatsApp|LinkedInBot|Slackbot|Googlebot|bingbot|DuckDuckBot|Applebot|vkShare|Discordbot/i;

function buildOGHtml(topic, lang, baseUrl) {
  const safeTopicAttr = topic.replace(/"/g, '&quot;');
  const safeTopicText = topic.replace(/&/g, '&amp;');
  const descriptions = {
    de: `Wie berichten taz, Spiegel, FAZ, Welt und Bild über „${safeTopicText}"? Fünf politische Perspektiven im Vergleich.`,
    en: `How do German media from left to right cover "${safeTopicText}"? Five political perspectives compared.`,
    ru: `Как немецкие СМИ освещают «${safeTopicText}»? Пять политических перспектив в сравнении.`,
  };
  const titles = {
    de: `${safeTopicText} — NeutralNachrichten Medienanalyse`,
    en: `${safeTopicText} — NeutralNews Media Analysis`,
    ru: `${safeTopicText} — НейтральныеНовости Медиаанализ`,
  };
  const desc = descriptions[lang] || descriptions.de;
  const title = titles[lang] || titles.de;
  const imgUrl = `${baseUrl}/api/og-image?topic=${encodeURIComponent(topic)}&lang=${lang}`;
  const pageUrl = `${baseUrl}/?topic=${encodeURIComponent(topic)}&lang=${lang}`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <meta property="og:type" content="article"/>
  <meta property="og:url" content="${pageUrl}"/>
  <meta property="og:title" content="${safeTopicAttr}"/>
  <meta property="og:description" content="${desc.replace(/"/g, '&quot;')}"/>
  <meta property="og:image" content="${imgUrl}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta property="og:site_name" content="NeutralNachrichten"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${safeTopicAttr}"/>
  <meta name="twitter:description" content="${desc.replace(/"/g, '&quot;')}"/>
  <meta name="twitter:image" content="${imgUrl}"/>
  <meta http-equiv="refresh" content="0; url=${pageUrl}"/>
</head>
<body><p>Redirecting…</p></body>
</html>`;
}

// ── GET /api/public/analysis/:slug — load a specific cached analysis ─────────
app.get('/api/public/analysis/:slug', async (req, res) => {
  const slug = req.params.slug;
  if (!slug || slug.length > 200) return res.status(400).json({ error: 'Invalid slug' });

  // Try to find the German base analysis by computing the actual MD5 cache key
  const topicNorm = slug.replace(/-/g, ' ').toLowerCase();
  const deKey = crypto.createHash('md5').update(`${topicNorm}:de-base:v4`).digest('hex');
  const cachedBase = await cacheGetLayered(deKey);
  if (cachedBase?.germanAnalysis) {
    return res.json({ analysis: cachedBase.germanAnalysis, topic: topicNorm });
  }

  // Fallback: check public analyses list
  try {
    const analyses = await getPublicAnalyses(200, null);
    const match = analyses.find(a =>
      (a.topic_norm || '').toLowerCase() === topicNorm ||
      (a.topic_norm || '').replace(/\s+/g, '-').toLowerCase() === slug.toLowerCase()
    );
    if (match) return res.json({ analysis: match, topic: match.topic_norm });
  } catch {}

  res.status(404).json({ error: 'Analysis not found' });
});

// ── A/B Experiment: RSS-direct quality check ──────────────────────────────────
// GET /api/experiment/rss-check?topic=X&lang=de
//
// Runs RSS-Direct analysis and returns full quality metrics for manual inspection.
// Protected by ADMIN_SECRET — sent via HEADER (never query string: query params
// leak into HTTP/proxy logs and browser history).
// Usage: curl -H "x-admin-secret: $ADMIN_SECRET" "https://.../api/experiment/rss-check?topic=Klimawandel"

app.get('/api/experiment/rss-check', async (req, res) => {
  const { topic, lang = 'de' } = req.query;

  const providedSecret = req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SECRET || providedSecret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden — x-admin-secret header required' });
  }
  if (!topic || topic.trim().length < 2) {
    return res.status(400).json({ error: 'topic query param required (min 2 chars)' });
  }

  const start = Date.now();
  const rssKeywords = extractSearchKeywords(topic.trim());

  let rssData = null;
  try {
    rssData = await searchAllFeeds(rssKeywords, { inputWordCount: getInputWordCount(topic.trim()) });
  } catch (err) {
    console.warn('[RssCheck] RSS fetch failed:', err.message);
  }

  const rssSpectra = rssData?.spectra ?? {};

  let analysisResult = null;
  try {
    analysisResult = await callGeminiWithRSSContext(topic.trim(), lang, rssSpectra, {
      timeoutMs: 45000,
      maxPerSpectrum: Infinity,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const { analysis, degraded, meta } = analysisResult;
  const spectra = analysis.news_spectrum || {};

  let totalArticles = 0, articlesWithUrl = 0, summaryCharTotal = 0;
  for (const sp of SPECTRUMS) {
    for (const art of (spectra[sp] || [])) {
      totalArticles++;
      if (art.article_url && !art.url_is_search_fallback) articlesWithUrl++;
      summaryCharTotal += (art.summary_of_perspective || '').length;
    }
  }
  const overallLen = (analysis.overall_non_partisan_analysis || '').length;

  console.log(`[RssCheck] ✅ ${Date.now() - start}ms — ${totalArticles} articles, degraded=${degraded}`);

  res.json({
    topic: topic.trim(),
    lang,
    timestamp: new Date().toISOString(),
    elapsed_ms: Date.now() - start,
    degraded,
    meta,
    quality: {
      totalArticlesInOutput:    totalArticles,
      urlAccuracyPct:           totalArticles > 0 ? Math.round((articlesWithUrl / totalArticles) * 100) : 0,
      avgSummaryLengthChars:    totalArticles > 0 ? Math.round(summaryCharTotal / totalArticles) : 0,
      overallAnalysisLengthChars: overallLen,
      overallAnalysisQuality:   overallLen > 200 ? 'good' : overallLen > 80 ? 'ok' : 'short',
    },
    rss_input: {
      total_articles: rssData?.total_articles ?? 0,
      per_spectrum: Object.fromEntries(SPECTRUMS.map(s => [s, rssSpectra[s]?.articles?.length ?? 0])),
    },
    analysis,
  });
});

// ── sitemap.xml ───────────────────────────────────────────────────────────────
app.get('/sitemap.xml', async (req, res) => {
  const base = 'https://www.neutralenachrichten.com';
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'hourly' },
    { url: '/about', priority: '0.7', changefreq: 'monthly' },
    { url: '/methodology', priority: '0.7', changefreq: 'monthly' },
    { url: '/analyses', priority: '0.8', changefreq: 'daily' },
    { url: '/compare', priority: '0.6', changefreq: 'monthly' },
  ];

  let dynamicUrls = '';
  try {
    const analyses = await getPublicAnalyses(200, null);
    dynamicUrls = analyses.map(a => {
      const slug = (a.topic_norm || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-äöüß]/g, '');
      if (!slug) return '';
      const lastmod = a.last_searched ? new Date(a.last_searched).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      return `  <url><loc>${base}/a/${encodeURIComponent(slug)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`;
    }).filter(Boolean).join('\n');
  } catch {}

  const staticUrls = staticPages.map(p =>
    `  <url><loc>${base}${p.url}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
  ).join('\n');

  res.header('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${dynamicUrls}
</urlset>`);
});

// ── robots.txt ────────────────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin

Sitemap: https://www.neutralenachrichten.com/sitemap.xml`);
});

// ── Bot pre-rendering middleware (inject meta tags server-side for crawlers) ──
app.use(async (req, res, next) => {
  // Only for HTML page requests from bots
  if (!BOT_UA.test(req.headers['user-agent'] || '')) return next();
  if (req.path.startsWith('/api/') || req.path.includes('.')) return next();

  // Read base index.html
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) return next();
  let html = fs.readFileSync(indexPath, 'utf8');

  // Determine page-specific meta
  let title = 'NeutralNachrichten – KI-Analyse der deutschen Medien';
  let description = 'Analysiere wie deutsche Medien über jedes Thema berichten. Echtzeit-Vergleich von 33 Quellen quer durch das politische Spektrum.';
  const canonical = `https://www.neutralenachrichten.com${req.path}`;

  // Analysis page
  const analysisMatch = req.path.match(/^\/a\/(.+)$/);
  if (analysisMatch) {
    const topic = decodeURIComponent(analysisMatch[1]).replace(/-/g, ' ');
    title = `${topic} – Medienspektrum | NeutralNachrichten`;
    description = `Wie berichten deutsche Medien über "${topic}"? KI-Analyse von taz, Spiegel, FAZ, Bild und weiteren Quellen.`;
  } else if (req.path === '/about') {
    title = 'Über uns – NeutralNachrichten';
    description = 'NeutralNachrichten analysiert das deutsche Medienspektrum. Erfahre mehr über unser Team, unsere Prinzipien und unsere Vision.';
  } else if (req.path === '/methodology') {
    title = 'Methodik – NeutralNachrichten';
    description = 'Erfahre, wie NeutralNachrichten 33 deutsche Medien aus 5 politischen Lagern in Echtzeit analysiert.';
  }

  // Inject meta tags after <title>
  const metaTags = `
  <title>${title}</title>
  <meta name="description" content="${description.replace(/"/g, '&quot;')}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${title.replace(/"/g, '&quot;')}">
  <meta property="og:description" content="${description.replace(/"/g, '&quot;')}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="https://www.neutralenachrichten.com/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}">
  <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}">`;

  html = html.replace(/<title>.*?<\/title>/s, metaTags);
  res.send(html);
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      // Never cache HTML — Vite changes asset hashes on every deploy.
      // Stale HTML + new hashes = browser requests missing assets → 404 → HTML fallback → MIME error
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.includes('/assets/')) {
      // Hashed assets are content-addressed — cache forever
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));
app.get(/^(?!\/api\/).*$/, (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const topic = req.query.topic;
  const lang = (req.query.lang === 'en' || req.query.lang === 'ru') ? req.query.lang : 'de';

  // Social crawlers + topic present → serve dynamic OG HTML
  if (topic && BOT_UA.test(ua)) {
    const serverBase = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    console.log(`[OG] Bot "${ua.slice(0, 40)}" requested topic="${topic}"`);
    return res.send(buildOGHtml(topic, lang, serverBase));
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile('index.html', { root: distPath });
});

// ── Cache Warmup ──────────────────────────────────────────────────────────────
// Pre-fetch trending, daily news, and top categories so the first user never
// waits. Runs once on startup, then on a rolling schedule matching each TTL.

async function warmTrending() {
  const key = trendingCacheKey();
  const cached = await cacheGetLayered(key);
  if (cached) { console.log('[Warmup] trending: cache hit, skip'); return; }
  try {
    console.log('[Warmup] trending: fetching…');
    const data = await fetchTrendingFromGemini();
    if (Array.isArray(data?.topics) && data.topics.length > 0) {
      await cacheSetLayered(key, data, 14400);
      console.log(`[Warmup] trending: cached ${data.topics.length} topics`);
    }
  } catch (e) { console.error('[Warmup] trending failed:', e.message); }
}

async function warmDailyNews() {
  const key = dailyNewsCacheKey();
  const cached = await cacheGetLayered(key);
  if (cached) { console.log('[Warmup] daily-news: cache hit, skip'); return; }
  try {
    console.log('[Warmup] daily-news: fetching…');
    const data = await fetchDailyNewsFromGemini();
    if (Array.isArray(data?.stories) && data.stories.length > 0) {
      await cacheSetLayered(key, data, 7200);
      console.log(`[Warmup] daily-news: cached ${data.stories.length} stories`);
    }
  } catch (e) { console.error('[Warmup] daily-news failed:', e.message); }
}

async function warmCategories() {
  // Warm the 4 most-visited categories; others warm on first request
  const priority = ['politics', 'economy', 'international', 'society'];
  for (const cat of priority) {
    const key = categoryNewsCacheKey(cat);
    const cached = await cacheGetLayered(key);
    if (cached) { console.log(`[Warmup] cat-${cat}: cache hit, skip`); continue; }
    try {
      console.log(`[Warmup] cat-${cat}: fetching…`);
      const data = await fetchCategoryNews(cat);
      if (Array.isArray(data?.stories) && data.stories.length > 0) {
        await cacheSetLayered(key, data, 14400);
        console.log(`[Warmup] cat-${cat}: cached ${data.stories.length} stories`);
      }
    } catch (e) { console.error(`[Warmup] cat-${cat} failed:`, e.message); }
    // Small pause between Gemini calls to avoid rate-limit bursts
    await new Promise(r => setTimeout(r, 3000));
  }
}

async function runWarmup() {
  // Stagger the three warmup jobs so they don't all hit Gemini simultaneously
  await warmDailyNews();
  await new Promise(r => setTimeout(r, 4000));
  await warmTrending();
  await new Promise(r => setTimeout(r, 4000));
  await warmCategories();
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Listening on port ${PORT} (env=${IS_PRODUCTION ? 'production' : 'dev'})`);

  // Initial warmup — delayed 8 s to let DB/Redis finish connecting
  setTimeout(runWarmup, 8000);

  // Rolling refresh: daily-news every 2 h, trending + categories every 4 h
  setInterval(warmDailyNews,   2 * 60 * 60 * 1000);
  setInterval(warmTrending,    4 * 60 * 60 * 1000);
  setInterval(warmCategories,  4 * 60 * 60 * 1000);
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
// Railway sends SIGTERM before killing the container. We stop accepting new
// connections, let in-flight requests finish (up to 30 s), then exit cleanly.
async function shutdown(signal) {
  console.log(`[Server] ${signal} — starting graceful shutdown`);

  // Stop new connections immediately
  server.close(async () => {
    console.log('[Server] HTTP server closed — draining connections');
    try {
      await Promise.allSettled([closeRedis(), closeDB()]);
    } catch {}
    console.log('[Server] All connections closed — exiting with code 0');
    process.exit(0);
  });

  // Hard kill after 30 s in case in-flight requests stall
  const forceExit = setTimeout(() => {
    console.error('[Server] Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 30_000);
  forceExit.unref(); // don't let this timer prevent natural exit
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
