import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
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
import { formatDomainsForPrompt } from './lib/mediaWhitelist.js';
import { validateAnalysis, resolveArticleURL, isRecentEnough } from './lib/validation.js';
import { translateQueryToGerman, translateAnalysis } from './lib/translate.js';
import { initDB, isDBAvailable, cacheGet, cacheSet, logSearch, getUsageDB, incrementUsageDB, createUser, findUserByEmail, findUserById, updateLastLogin, getAdminStats as getAdminStatsDB, getTopTopicsDB, getUsersAdmin } from './db.js';

dotenv.config();

// ── DB init (non-blocking — server starts even without DB) ────────────────────
initDB().then(ok => {
  if (ok) console.log('[Server] PostgreSQL ready');
  else    console.warn('[Server] Running without PostgreSQL (in-memory only)');
});

const JWT_SECRET  = process.env.JWT_SECRET  || 'dev-secret-change-in-prod';
const JWT_EXPIRES = '30d';
const BASE_URL    = process.env.BASE_URL    || 'http://localhost:5173';
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || 3001;

// Adaptive timeouts: local dev is unconstrained; Railway kills requests at ~60s
const IS_PRODUCTION = !!process.env.RAILWAY_ENVIRONMENT;
const GEMINI_ATTEMPT_TIMEOUT = IS_PRODUCTION ? 44000 : 90000;
const GLOBAL_TIMEOUT_MS     = IS_PRODUCTION ? 55000 : 120000;
const GLOBAL_TRANSL_TIMEOUT = IS_PRODUCTION ? 22000 :  40000;

const rawKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
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

// Default 24h TTL; overridden per-item for degraded results
const cache = new NodeCache({ stdTTL: 86400 });

const SPECTRUMS = ['left', 'center_left', 'center', 'center_right', 'right'];

function validateAnalysisStructure(data) {
  if (!data || typeof data !== 'object') return false;
  const topLevel = ['overall_non_partisan_analysis', 'news_spectrum'];
  if (!topLevel.every(key => key in data)) return false;
  return SPECTRUMS.every(key => Array.isArray(data.news_spectrum?.[key]) && data.news_spectrum[key].length > 0);
}

// ── Analytics ─────────────────────────────────────────────────────────────────
// In-memory topic counts. Resets on redeploy — acceptable for MVP.
const topicStats = new Map(); // topic_lower → { topic, count, firstSeen, lastSeen }
let totalAnalyses = 0; // global counter across all topics

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
}

// ── Per-IP Usage Tracking & Daily Limits ─────────────────────────────────────
// Free tier: FREE_DAILY_LIMIT analyses per IP per calendar day (UTC).
// Tokens are estimated (no extra API call needed).
// Admin key bypasses all limits.

const FREE_DAILY_LIMIT = parseInt(process.env.FREE_DAILY_LIMIT || '10');
const ADMIN_KEY        = process.env.ADMIN_KEY || '';

// Estimated Gemini token costs per analysis (approximate):
// - Input prompt:  ~4 000 tokens × $0.075/1M = $0.0003
// - Output JSON:   ~3 000 tokens × $0.30/1M  = $0.0009
// - Search grounding: $0.035 per request
// Total per analysis ≈ $0.036
const COST_PER_ANALYSIS = 0.036;
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

function checkDailyLimit(ip) {
  const usage = getIPUsage(ip);
  return { allowed: usage.count < FREE_DAILY_LIMIT, remaining: Math.max(0, FREE_DAILY_LIMIT - usage.count), usage };
}

function recordAnalysis(ip) {
  const usage = getIPUsage(ip);
  usage.count++;
  usage.tokensIn  += TOKENS_PER_ANALYSIS_INPUT;
  usage.tokensOut += TOKENS_PER_ANALYSIS_OUTPUT;
}

// Middleware: extract real IP behind Railway / Nginx proxy
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function getTopTopics(limit = 10) {
  return [...topicStats.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

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

// ── DB-backed cache helpers (NodeCache = L1, PostgreSQL = L2) ─────────────────
async function cacheGetLayered(key) {
  const mem = cache.get(key);
  if (mem !== undefined) return mem;
  if (!isDBAvailable()) return undefined;
  const row = await cacheGet(key);
  if (!row || row.isStale) return undefined;
  // Repopulate L1 with remaining TTL (or 1h)
  const remainTTL = Math.max(60, row.ttl_seconds - row.ageSeconds);
  cache.set(key, row.data, remainTTL);
  console.log(`[Cache] DB→L1 restored "${key}" (${row.ageSeconds}s old)`);
  return row.data;
}

async function cacheSetLayered(key, data, ttlSeconds) {
  cache.set(key, data, ttlSeconds);
  if (isDBAvailable()) {
    await cacheSet(key, data, ttlSeconds).catch(e => console.error('[Cache] DB write error:', e.message));
  }
}

// ── DB-backed usage tracking (falls back to in-memory if no DB) ───────────────
async function getUsageForIP(ip) {
  if (isDBAvailable()) {
    const count = await getUsageDB(ip);
    return count ?? getIPUsage(ip).count; // fallback to memory
  }
  return getIPUsage(ip).count;
}

async function incrementUsageForIP(ip) {
  getIPUsage(ip).count++; // always update memory
  getIPUsage(ip).tokensIn  += TOKENS_PER_ANALYSIS_INPUT;
  getIPUsage(ip).tokensOut += TOKENS_PER_ANALYSIS_OUTPUT;
  if (isDBAvailable()) await incrementUsageDB(ip).catch(() => {});
}

async function checkDailyLimitDB(ip) {
  const count = await getUsageForIP(ip);
  const remaining = Math.max(0, FREE_DAILY_LIMIT - count);
  return { allowed: count < FREE_DAILY_LIMIT, remaining };
}

function extractJSON(rawText) {
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');

  if (first === -1 || last === -1 || last < first) {
    throw new Error('No JSON object found in Gemini response');
  }

  return JSON.parse(cleaned.substring(first, last + 1));
}

function buildPrompt(topic, language) {
  const langNames = { de: 'German', en: 'English', ru: 'Russian' };
  const targetLang = langNames[language] || 'English';
  const today = new Date().toISOString().split('T')[0];

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const earliestDate = ninetyDaysAgo.toISOString().split('T')[0];

  return `You are a German media analysis assistant. Use Google Search to find ONE real article about "${topic}" from each of the FIVE political spectrums in German-language media.

OUTPUT RULES:
- Output ONLY the JSON object. No markdown, no code fences, no preamble.
- Response must start with { and end with }.
- Use EXACTLY these English keys — NEVER translate keys to another language.
- All text VALUES must be in ${targetLang}.

GERMAN MEDIA SPECTRUM (find ONE article per spectrum):
- LEFT: taz, Junge Welt, nd-aktuell, Freitag — search: "${topic} taz OR nd-aktuell"
- CENTER_LEFT: Spiegel, Süddeutsche, Zeit, Tagesschau — search: "${topic} spiegel OR sueddeutsche OR tagesschau"
- CENTER: FAZ, Tagesspiegel, Handelsblatt — search: "${topic} faz OR tagesspiegel OR handelsblatt"
- CENTER_RIGHT: Welt, Focus, NTV — search: "${topic} welt OR focus OR ntv"
- RIGHT: Bild, Junge Freiheit, Tichys Einblick — search: "${topic} bild OR junge freiheit"

RECENCY: Today: ${today}. Prefer last 90 days (after ${earliestDate}). Never leave a spectrum empty.
publication_date MUST come from search results — omit if uncertain.
DO NOT include article URLs — not part of the schema.

COVERAGE ESTIMATE (per spectrum):
- "high"   → major outlet covered it prominently recently
- "medium" → covered but not a top story
- "low"    → only older or minor coverage found

REQUIRED JSON STRUCTURE (each spectrum is an ARRAY with exactly 1 object):
{
  "analysis_topic": "${topic}",
  "response_language": "${language}",
  "overall_non_partisan_analysis": "<2-3 sentence factual summary in ${targetLang}>",
  "news_spectrum": {
    "left":         [{ "source_name": "taz", "source_domain": "taz.de", "article_title": "<exact headline in ${targetLang}>", "summary_of_perspective": "<1-2 sentences on far-left angle in ${targetLang}>", "publication_date": "<YYYY-MM-DD or omit>", "coverage_estimate": "<high|medium|low>" }],
    "center_left":  [{ "source_name": "Der Spiegel", "source_domain": "spiegel.de", "article_title": "<exact headline in ${targetLang}>", "summary_of_perspective": "<1-2 sentences on center-left angle in ${targetLang}>", "publication_date": "<YYYY-MM-DD or omit>", "coverage_estimate": "<high|medium|low>" }],
    "center":       [{ "source_name": "FAZ", "source_domain": "faz.net", "article_title": "<exact headline in ${targetLang}>", "summary_of_perspective": "<1-2 sentences on centrist angle in ${targetLang}>", "publication_date": "<YYYY-MM-DD or omit>", "coverage_estimate": "<high|medium|low>" }],
    "center_right": [{ "source_name": "Welt", "source_domain": "welt.de", "article_title": "<exact headline in ${targetLang}>", "summary_of_perspective": "<1-2 sentences on center-right angle in ${targetLang}>", "publication_date": "<YYYY-MM-DD or omit>", "coverage_estimate": "<high|medium|low>" }],
    "right":        [{ "source_name": "Bild", "source_domain": "bild.de", "article_title": "<exact headline in ${targetLang}>", "summary_of_perspective": "<1-2 sentences on right-wing angle in ${targetLang}>", "publication_date": "<YYYY-MM-DD or omit>", "coverage_estimate": "<high|medium|low>" }]
  }
}`;
}

function buildDeepAnalysisPrompt(analysis) {
  const ns = analysis.news_spectrum;
  const first = s => Array.isArray(ns[s]) ? ns[s][0] : ns[s];

  return `Analyze how five German media outlets across the full political spectrum cover the same topic.

TOPIC: "${analysis.analysis_topic}"

LEFT (${first('left').source_name}): ${first('left').summary_of_perspective}
CENTER_LEFT (${first('center_left').source_name}): ${first('center_left').summary_of_perspective}
CENTER (${first('center').source_name}): ${first('center').summary_of_perspective}
CENTER_RIGHT (${first('center_right').source_name}): ${first('center_right').summary_of_perspective}
RIGHT (${first('right').source_name}): ${first('right').summary_of_perspective}

OUTPUT RULES:
- Output ONLY the JSON object. No markdown, no code fences, no preamble.
- Response must start with { and end with }.
- Use EXACTLY these English keys — never translate them.
- All text VALUES must be in German.

REQUIRED JSON:
{
  "shared_facts": [
    { "claim": "<factual statement all five agree on>" }
  ],
  "diverging_points": [
    {
      "topic": "<area of divergence>",
      "left_view": "<how far-left frames it, 1 sentence>",
      "center_left_view": "<how center-left frames it, 1 sentence>",
      "center_view": "<how center frames it, 1 sentence>",
      "center_right_view": "<how center-right frames it, 1 sentence>",
      "right_view": "<how far-right frames it, 1 sentence>"
    }
  ],
  "silenced_topics": [
    {
      "topic": "<angle barely mentioned>",
      "only_in": "<left|center_left|center|center_right|right|none>",
      "description": "<1 sentence why this is notable>"
    }
  ],
  "keywords": {
    "left":         ["<word1>", "<word2>", "<word3>", "<word4>", "<word5>", "<word6>"],
    "center_left":  ["<word1>", "<word2>", "<word3>", "<word4>", "<word5>", "<word6>"],
    "center":       ["<word1>", "<word2>", "<word3>", "<word4>", "<word5>", "<word6>"],
    "center_right": ["<word1>", "<word2>", "<word3>", "<word4>", "<word5>", "<word6>"],
    "right":        ["<word1>", "<word2>", "<word3>", "<word4>", "<word5>", "<word6>"]
  },
  "sentiment": {
    "left":         "<positive|neutral|negative>",
    "center_left":  "<positive|neutral|negative>",
    "center":       "<positive|neutral|negative>",
    "center_right": "<positive|neutral|negative>",
    "right":        "<positive|neutral|negative>"
  },
  "experts_cited": {
    "left":         ["<Full Name or Institution>"],
    "center_left":  ["<Full Name or Institution>"],
    "center":       ["<Full Name or Institution>"],
    "center_right": ["<Full Name or Institution>"],
    "right":        ["<Full Name or Institution>"]
  },
  "coverage_volume": {
    "left":         { "week": <int>, "month": <int> },
    "center_left":  { "week": <int>, "month": <int> },
    "center":       { "week": <int>, "month": <int> },
    "center_right": { "week": <int>, "month": <int> },
    "right":        { "week": <int>, "month": <int> }
  }
}

RULES:
- shared_facts: 2-4 facts ALL five sides accept as true
- diverging_points: 2-4 areas where framing clearly differs
- silenced_topics: 1-3 angles present in only one outlet or absent from all
- keywords: 5-6 most characteristic/loaded words or phrases each outlet uses (in German)
- sentiment: overall tone of the outlet's coverage (positive/neutral/negative)
- experts_cited: real names of politicians, scientists, officials, or institutions explicitly mentioned in each outlet's coverage (empty array [] if none)
- coverage_volume: estimated number of articles published on this topic in the past week/month by outlets in that spectrum (realistic estimate based on typical coverage intensity)`;
}

async function callDeepAnalysis(analysis, timeoutMs = 15000) {
  // Text-only call — no googleSearch tool, so we can use responseMimeType: 'application/json'
  // This forces Gemini to always return valid JSON (no markdown, no prose, no broken escaping)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = buildDeepAnalysisPrompt(analysis);

  const DEEP_TIMEOUT = timeoutMs;
  const result = await Promise.race([
    model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      }
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Deep analysis timed out')), DEEP_TIMEOUT)
    )
  ]);

  const rawText = result.response.text();
  console.log(`[DeepAnalysis] Raw length=${rawText?.length}`);
  const deep = extractJSON(rawText); // extractJSON strips any markdown wrapping

  // Basic sanity check on required arrays
  if (!Array.isArray(deep.shared_facts) || !Array.isArray(deep.diverging_points) || !Array.isArray(deep.silenced_topics)) {
    throw new Error('Invalid deep_analysis structure');
  }
  // Ensure optional new fields default to empty structures if Gemini omitted them
  const SPECTRUMS_DA = ['left', 'center_left', 'center', 'center_right', 'right'];
  if (!deep.keywords)        deep.keywords        = Object.fromEntries(SPECTRUMS_DA.map(s => [s, []]));
  if (!deep.sentiment)       deep.sentiment       = Object.fromEntries(SPECTRUMS_DA.map(s => [s, 'neutral']));
  if (!deep.experts_cited)   deep.experts_cited   = Object.fromEntries(SPECTRUMS_DA.map(s => [s, []]));
  if (!deep.coverage_volume) deep.coverage_volume = Object.fromEntries(SPECTRUMS_DA.map(s => [s, { week: 0, month: 0 }]));

  return deep;
}

function coverageToPercent(estimate) {
  switch (estimate) {
    case 'high': return 75;
    case 'medium': return 40;
    case 'low': return 5;
    default: return 40;
  }
}

async function callGeminiWithRetry(topic, language, maxAttempts = 3) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }]
  });

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Gemini] Attempt ${attempt}/${maxAttempts} for topic="${topic}" lang=${language}`);

      const prompt = buildPrompt(topic, language);
      // Timeout per Gemini attempt — shorter on Railway (hard 60s kill), longer for local dev
      const result = await Promise.race([
        model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini attempt timed out')), GEMINI_ATTEMPT_TIMEOUT)
        )
      ]);

      const rawText = result.response.text();
      if (!rawText || rawText.trim().length < 10) {
        throw new Error('Empty or too-short response from Gemini');
      }
      const analysis = extractJSON(rawText);

      if (!validateAnalysisStructure(analysis)) {
        throw new Error('Invalid response structure');
      }

      // Extract real article URLs from grounding chunks (resolved redirects)
      const groundingChunks = result.response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const resolvedGroundingURLs = await Promise.all(
        groundingChunks.map(chunk => resolveArticleURL(chunk?.web?.uri).catch(() => null))
      );
      console.log(`[Grounding] ${resolvedGroundingURLs.filter(Boolean).length} real URLs from grounding`);

      // Match grounding URLs to spectrum sources by source_domain (arrays)
      for (const spectrum of SPECTRUMS) {
        const articles = analysis.news_spectrum[spectrum];
        for (const source of articles) {
          const domain = (source.source_domain || '').replace(/^www\./, '');
          const matched = resolvedGroundingURLs.find(url => {
            try { return new URL(url).hostname.replace(/^www\./, '').includes(domain); } catch { return false; }
          });
          if (matched) {
            source.article_url = matched;
            source.url_is_search_fallback = false;
            console.log(`[Grounding] ${spectrum}/${source.source_name} → direct link`);
          } else {
            const fallbackDomain = (domain && domain !== 'n/a') ? domain : null;
            const q = encodeURIComponent(fallbackDomain ? `site:${fallbackDomain} ${topic}` : `${topic} deutsche medien`);
            source.article_url = `https://www.google.com/search?q=${q}`;
            source.url_is_search_fallback = true;
          }
        }
      }

      // Strip fake/old dates
      for (const spectrum of SPECTRUMS) {
        for (const source of analysis.news_spectrum[spectrum]) {
          if (source.publication_date && !isRecentEnough(source.publication_date)) {
            delete source.publication_date;
          }
        }
      }

      const directCount = SPECTRUMS.reduce((acc, s) =>
        acc + analysis.news_spectrum[s].filter(a => !a.url_is_search_fallback).length, 0);
      const totalArticles = SPECTRUMS.reduce((acc, s) => acc + analysis.news_spectrum[s].length, 0);
      console.log(`[Gemini] ${directCount}/${totalArticles} articles have direct links`);

      // Build coverage_distribution from first article's coverage_estimate per spectrum
      const coverage_distribution = {};
      for (const spectrum of SPECTRUMS) {
        const articles = analysis.news_spectrum[spectrum];
        const firstArticle = articles[0];
        const estimate = ['high', 'medium', 'low'].includes(firstArticle?.coverage_estimate)
          ? firstArticle.coverage_estimate
          : (articles.length >= 3 ? 'high' : articles.length === 2 ? 'medium' : 'low');
        coverage_distribution[spectrum] = { estimate, percent: coverageToPercent(estimate) };
        // clean up coverage_estimate from all articles
        for (const art of articles) delete art.coverage_estimate;
      }
      console.log(`[Coverage] ${JSON.stringify(coverage_distribution)}`);

      // degraded = true only when Gemini returned the empty fallback (no articles found at all)
      // search-fallback URLs are acceptable — content is still valid
      return { analysis: { ...analysis, coverage_distribution }, degraded: false };
    } catch (err) {
      console.error(`[Gemini] Attempt ${attempt} failed:`, err.message);
      lastError = err;
    }
  }

  // All attempts failed — return a graceful "no coverage" result instead of throwing
  console.warn(`[Gemini] All attempts failed for "${topic}", returning empty result`);
  const noResult = () => ({
    source_name: 'Kein Artikel gefunden',
    source_domain: 'n/a',
    article_title: 'Kein Artikel gefunden',
    summary_of_perspective: 'Kein Artikel gefunden',
    article_url: `https://www.google.com/search?q=${encodeURIComponent(topic + ' deutsche Medien')}`,
    url_is_search_fallback: true,
  });
  const emptyAnalysis = {
    analysis_topic: topic,
    response_language: 'de',
    overall_non_partisan_analysis: `Zu diesem Thema wurden keine aktuellen deutschen Medienberichte gefunden.`,
    news_spectrum: Object.fromEntries(SPECTRUMS.map(s => [s, [noResult()]])),
    coverage_distribution: Object.fromEntries(SPECTRUMS.map(s => [s, { estimate: 'low', percent: 5 }])),
  };
  return { analysis: emptyAnalysis, degraded: true };
}

app.post('/api/analyze', async (req, res) => {
  const { topic, lang } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'API Key Missing' });

  serverStats.totalRequests++;

  const clientIP = getClientIP(req);
  const adminKeyHeader = req.headers['x-admin-key'] || req.query.adminKey;

  // ── JWT user extraction (optional — enriches DB log) ─────────────────────
  let jwtUser = null;
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      jwtUser = jwt.verify(authHeader.slice(7), JWT_SECRET);
    }
  } catch { /* anonymous */ }

  // ── Daily limit check (bypass for admin key) ──────────────────────────────
  const isAdmin = ADMIN_KEY && adminKeyHeader === ADMIN_KEY;
  if (!isAdmin) {
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
    // Still count as usage even on cache hit (reading data costs resources)
    if (!isAdmin) await incrementUsageForIP(clientIP);
    const { remaining } = await checkDailyLimitDB(clientIP);
    res.set('X-RateLimit-Remaining', String(remaining));
    logSearch({ topic, lang, degraded: cached._meta?.degraded ?? false, cacheHit: true, userId: jwtUser?.id, ipHash: crypto.createHash('sha256').update(clientIP).digest('hex').slice(0, 16) }).catch(() => {});
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
      ({ analysis: germanAnalysis, degraded } = await callGeminiWithRetry(topic, 'de', 1));
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
      // Strip deep_analysis before translation — it's fetched separately and makes JSON much larger
      const { deep_analysis: _stripped, ...analysisForTranslation } = germanAnalysis;
      try {
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
      }
    }

    finalAnalysis = { ...finalAnalysis, analysis_topic: topic, response_language: lang };
    const response = { ...finalAnalysis, _meta: { degraded } };

    // Only cache if Gemini succeeded AND translation succeeded (avoid caching empty/German fallbacks)
    if (!degraded && translationSucceeded) {
      await cacheSetLayered(cacheKey, response, 86400);
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
    if (!res.headersSent) res.status(500).json({ error: 'Analysis failed', message: error.message });
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
    // Run deep analysis on the German base (45s budget — this request has its own Railway window)
    const deep = await callDeepAnalysis(germanAnalysis, 45000);
    console.log(`[DeepAnalysis] Done — ${deep.shared_facts.length} facts, ${deep.diverging_points.length} diverging, ${deep.silenced_topics.length} silenced`);

    // Cache German deep analysis
    await cacheSetLayered(deepKey, deep, 86400);

    // Translate if needed, cache result separately
    // Pass only deep_analysis in a minimal wrapper — translating full spectrum JSON is too slow
    let finalDeep = deep;
    if (lang !== 'de') {
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
      generationConfig: { temperature: 0.2 },
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Trending timeout')), 40000)),
  ]);

  const raw = result.response.text();
  return extractJSON(raw);
}

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
app.get('/api/stats', (req, res) => {
  const topTopic = [...topicStats.values()].sort((a, b) => b.count - a.count)[0] || null;
  res.json({
    total_analyses: totalAnalyses,
    unique_topics: topicStats.size,
    top_topic: topTopic ? { topic: topTopic.topic, count: topTopic.count } : null,
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
      generationConfig: { temperature: 0.1 },
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
      generationConfig: { temperature: 0.1 },
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

app.post('/api/suggest-source', (req, res) => {
  const { name, email, url, spectrum, why } = req.body;
  if (!url || !why) return res.status(400).json({ error: 'url and why are required' });

  const entry = {
    timestamp: new Date().toISOString(),
    name: (name || '').trim().substring(0, 100),
    email: (email || '').trim().substring(0, 200),
    url: (url || '').trim().substring(0, 500),
    spectrum: ['left', 'center', 'right', 'unsure'].includes(spectrum) ? spectrum : 'unsure',
    why: (why || '').trim().substring(0, 1000),
  };

  const suggestionsFile = path.join(__dirname, 'suggestions.json');
  try {
    const existing = fs.existsSync(suggestionsFile)
      ? JSON.parse(fs.readFileSync(suggestionsFile, 'utf8'))
      : [];
    existing.push(entry);
    fs.writeFileSync(suggestionsFile, JSON.stringify(existing, null, 2));
    console.log(`[Suggest] New submission: ${entry.url} (${entry.spectrum})`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Suggest] Write error:', err.message);
    res.status(500).json({ error: 'storage error' });
  }
});

// ── Auth Routes ───────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });

  try {
    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser(email.toLowerCase().trim(), passwordHash);
    const token = jwt.sign({ id: user.id, email: user.email, tier: user.tier }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.status(201).json({ token, user: { id: user.id, email: user.email, tier: user.tier, daily_limit: user.daily_limit } });
  } catch (err) {
    console.error('[Auth/register]', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (!isDBAvailable()) return res.status(503).json({ error: 'Database not available' });

  try {
    const user = await findUserByEmail(email);
    if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    await updateLastLogin(user.id);
    const token = jwt.sign({ id: user.id, email: user.email, tier: user.tier }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.json({ token, user: { id: user.id, email: user.email, tier: user.tier, daily_limit: user.daily_limit } });
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

// ── Admin Dashboard API ───────────────────────────────────────────────────────
// Protected by ADMIN_KEY env var. Returns full platform analytics.
app.get('/api/admin/stats', async (req, res) => {
  const key = req.headers['x-admin-key'] || req.query.key;
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

  // DB stats (non-blocking)
  const [dbStats, dbTopTopics, dbUsers] = await Promise.all([
    getAdminStatsDB().catch(() => null),
    getTopTopicsDB(20).catch(() => null),
    getUsersAdmin(50).catch(() => []),
  ]);

  res.json({
    server: {
      startedAt: serverStats.startedAt,
      uptime_hours: Math.round((Date.now() - new Date(serverStats.startedAt).getTime()) / 3600000 * 10) / 10,
      totalRequests: serverStats.totalRequests,
      cacheHits: serverStats.cacheHits,
      cacheMisses: serverStats.cacheMisses,
      cacheHitRate: `${cacheHitRate}%`,
      errors: serverStats.errors,
      cachedItems: cacheKeys.length,
      dbAvailable: isDBAvailable(),
    },
    usage: {
      today,
      totalAnalysesAllTime: dbStats?.totalSearches ?? totalAnalyses,
      totalAnalysesToday: dbStats?.searchesToday ?? totalAnalysesToday,
      uniqueTopicsAllTime: topicStats.size,
      activeIPsToday: activeIPsToday.length,
      freeDailyLimit: FREE_DAILY_LIMIT,
    },
    costs: {
      estimatedTokensToday,
      estimatedCostToday: `$${estimatedCostToday.toFixed(3)}`,
      estimatedCostMonth: `$${estimatedCostMonth.toFixed(2)}`,
      costPerAnalysis: `$${COST_PER_ANALYSIS}`,
      note: 'Estimates only. Includes Gemini tokens + Search Grounding.',
    },
    topTopics: dbTopTopics ?? topTopics,
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

    // Decode id_token (JWT payload — no signature verify needed, came directly from Google)
    const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString());
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

    const jwtToken = jwt.sign({ id: user.id, email: user.email, tier: user.tier }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    console.log(`[Auth/Google] ${email} signed in`);

    // Redirect frontend — picks up token from URL param
    res.redirect(`${BASE_URL}/?auth_token=${encodeURIComponent(jwtToken)}`);
  } catch (err) {
    console.error('[Auth/Google] Error:', err.message);
    res.redirect(`${BASE_URL}/?auth_error=oauth_failed`);
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

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
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

  res.sendFile('index.html', { root: distPath });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
