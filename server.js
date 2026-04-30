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
import { formatDomainsForPrompt } from './lib/mediaWhitelist.js';
import { validateAnalysis, resolveArticleURL, isRecentEnough } from './lib/validation.js';
import { translateQueryToGerman, translateAnalysis } from './lib/translate.js';

dotenv.config();

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

function getTopTopics(limit = 10) {
  return [...topicStats.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
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

  // ── Time budget breakdown (Railway hard-kills at ~60s) ─────────────────────
  // Main Gemini call (5 spectrum searches): ≤ 44s
  // Translation (non-DE):                  ≤ 10s
  // Buffer:                                  1s
  // Total ceiling:                          55s  (5s margin before Railway kills)
  const TIMEOUT_MS = GLOBAL_TIMEOUT_MS;
  const TRANSLATION_TIMEOUT = GLOBAL_TRANSL_TIMEOUT;

  // v4 cache — 5-spectrum format, deep_analysis fetched separately
  const cacheKey = crypto.createHash('md5').update(`${topic.toLowerCase()}:${lang}:v4`).digest('hex');
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[Cache] HIT for "${topic}" (${lang})`);
    return res.json(cached);
  }

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

    const cachedBase = cache.get(deKey);
    if (cachedBase) {
      console.log(`[Cache] HIT German base for "${topic}"`);
      ({ germanAnalysis, degraded } = cachedBase);
    } else {
      ({ analysis: germanAnalysis, degraded } = await callGeminiWithRetry(topic, 'de', 1));
      // Always cache the German base so /api/deep-analysis can find it.
      // Degraded results use a short TTL (5 min) so the next request retries Gemini.
      cache.set(deKey, { germanAnalysis, degraded }, degraded ? 300 : 86400);
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
      cache.set(cacheKey, response, 86400);
    }

    clearTimeout(timeoutHandle);
    if (!res.headersSent) res.json(response);
  } catch (error) {
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
  const cachedDeep = cache.get(deepKey);
  if (cachedDeep) {
    console.log(`[DeepAnalysis] Cache hit for "${topic}"`);
    // For non-DE: check if we have a translated version stored
    if (lang !== 'de') {
      const translatedKey = crypto.createHash('md5').update(`${topic.toLowerCase()}:deep:${lang}:v4`).digest('hex');
      const translatedDeep = cache.get(translatedKey);
      if (translatedDeep) return res.json({ deep_analysis: translatedDeep });
    } else {
      return res.json({ deep_analysis: cachedDeep });
    }
  }

  // Fetch the German base analysis from cache (must run /api/analyze first)
  const deKey = crypto.createHash('md5').update(`${topic.toLowerCase()}:de-base:v4`).digest('hex');
  const cachedBase = cache.get(deKey);
  if (!cachedBase?.germanAnalysis) {
    return res.status(404).json({ error: 'Base analysis not cached yet — run /api/analyze first' });
  }

  const { germanAnalysis } = cachedBase;

  try {
    // Run deep analysis on the German base (45s budget — this request has its own Railway window)
    const deep = await callDeepAnalysis(germanAnalysis, 45000);
    console.log(`[DeepAnalysis] Done — ${deep.shared_facts.length} facts, ${deep.diverging_points.length} diverging, ${deep.silenced_topics.length} silenced`);

    // Cache German deep analysis
    cache.set(deepKey, deep, 86400);

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
        cache.set(translatedKey, finalDeep, 86400);
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
  const cached = cache.get(key);
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
    cache.set(key, data, 14400); // 4-hour TTL
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
  const cached = cache.get(key);
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
    cache.set(key, data, 7200); // 2-hour TTL
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
  const cached = cache.get(key);
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
    cache.set(key, data, 14400); // 4-hour TTL
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

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get(/^(?!\/api\/).*$/, (req, res) => res.sendFile('index.html', { root: distPath }));

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
