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

function validateAnalysisStructure(data) {
  if (!data || typeof data !== 'object') return false;
  // Only require top-level keys and that news_spectrum has the three objects
  const topLevel = ['overall_non_partisan_analysis', 'news_spectrum'];
  if (!topLevel.every(key => key in data)) return false;
  const spectrum = ['left', 'center', 'right'];
  return spectrum.every(key => data.news_spectrum?.[key] && typeof data.news_spectrum[key] === 'object');
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

  return `You are a German media analysis assistant. Use Google Search to find REAL articles about "${topic}" in German-language media. You MUST return one real article for each of the three political spectrums.

OUTPUT RULES:
- Output ONLY the JSON object. No markdown, no code fences, no preamble.
- Response must start with { and end with }.
- Use EXACTLY these English keys — NEVER translate keys to another language.
- All text VALUES must be in ${targetLang}.

MANDATORY: You MUST find a real article for LEFT, CENTER, and RIGHT. Never leave any spectrum empty or use placeholder text. If a preferred outlet has no coverage, search any German-language outlet with that political leaning.

SEARCH STRATEGY — run these searches:
1. LEFT: "${topic} taz" OR "${topic} nd-aktuell" OR "${topic} freitag.de" OR "${topic} linke perspektive"
2. CENTER: "${topic} spiegel" OR "${topic} sueddeutsche" OR "${topic} zeit.de" OR "${topic} tagesspiegel" OR "${topic} faz"
3. RIGHT: "${topic} welt.de" OR "${topic} bild.de" OR "${topic} focus.de" OR "${topic} cicero" OR "${topic} konservativ"

RECENCY:
- Today: ${today}
- Prefer articles from the last 90 days (after ${earliestDate})
- If no article found in 90 days, use the most recent available article — do NOT leave the spectrum empty
- publication_date MUST come from search results — omit if uncertain

DO NOT include article URLs — not part of the schema.

COVERAGE ESTIMATE (per spectrum):
- "high"   → 3+ outlets in that spectrum covered this recently
- "medium" → 1-2 outlets covered it
- "low"    → only older articles found

REQUIRED JSON STRUCTURE:
{
  "analysis_topic": "${topic}",
  "response_language": "${language}",
  "overall_non_partisan_analysis": "<2-3 sentence factual summary in ${targetLang}>",
  "news_spectrum": {
    "left": {
      "source_name": "<outlet name, e.g. taz>",
      "source_domain": "<domain, e.g. taz.de>",
      "article_title": "<exact headline from search in ${targetLang}>",
      "summary_of_perspective": "<2-3 sentences on left-leaning angle in ${targetLang}>",
      "publication_date": "<YYYY-MM-DD or omit>",
      "coverage_estimate": "<high|medium|low>"
    },
    "center": {
      "source_name": "<outlet name>",
      "source_domain": "<domain>",
      "article_title": "<exact headline in ${targetLang}>",
      "summary_of_perspective": "<2-3 sentences in ${targetLang}>",
      "publication_date": "<YYYY-MM-DD or omit>",
      "coverage_estimate": "<high|medium|low>"
    },
    "right": {
      "source_name": "<outlet name>",
      "source_domain": "<domain>",
      "article_title": "<exact headline in ${targetLang}>",
      "summary_of_perspective": "<2-3 sentences in ${targetLang}>",
      "publication_date": "<YYYY-MM-DD or omit>",
      "coverage_estimate": "<high|medium|low>"
    }
  }
}`;
}

function buildDeepAnalysisPrompt(analysis) {
  const left = analysis.news_spectrum.left;
  const center = analysis.news_spectrum.center;
  const right = analysis.news_spectrum.right;

  return `Analyze how three German media outlets cover the same topic from different political perspectives.

TOPIC: "${analysis.analysis_topic}"

LEFT (${left.source_name}): ${left.summary_of_perspective}
CENTER (${center.source_name}): ${center.summary_of_perspective}
RIGHT (${right.source_name}): ${right.summary_of_perspective}

OUTPUT RULES:
- Output ONLY the JSON object. No markdown, no code fences, no preamble.
- Response must start with { and end with }.
- Use EXACTLY these English keys — never translate them.
- All text VALUES must be in German.

REQUIRED JSON:
{
  "shared_facts": [
    { "claim": "<factual statement all three agree on>" },
    { "claim": "<another shared fact>" }
  ],
  "diverging_points": [
    {
      "topic": "<area of divergence>",
      "left_view": "<how left frames it, 1 sentence>",
      "center_view": "<how center frames it, 1 sentence>",
      "right_view": "<how right frames it, 1 sentence>"
    }
  ],
  "silenced_topics": [
    {
      "topic": "<angle barely mentioned>",
      "only_in": "<left|center|right|none>",
      "description": "<1 sentence why this is notable>"
    }
  ]
}

RULES:
- shared_facts: 2-4 facts ALL three sides accept as true (no spin, no interpretation)
- diverging_points: 2-3 areas where framing clearly differs between spectrums
- silenced_topics: 1-3 angles present in only one outlet or absent from all`;
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

  // Basic sanity check
  if (!Array.isArray(deep.shared_facts) || !Array.isArray(deep.diverging_points) || !Array.isArray(deep.silenced_topics)) {
    throw new Error('Invalid deep_analysis structure');
  }

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
      const GEMINI_ATTEMPT_TIMEOUT = 38000; // 38s leaves ~17s for deep analysis within 55s hard limit
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

      // Match grounding URLs to spectrum sources by source_domain
      for (const spectrum of ['left', 'center', 'right']) {
        const source = analysis.news_spectrum[spectrum];
        const domain = (source.source_domain || '').replace(/^www\./, '');
        const matched = resolvedGroundingURLs.find(url => {
          try { return new URL(url).hostname.replace(/^www\./, '').includes(domain); } catch { return false; }
        });

        if (matched) {
          source.article_url = matched;
          source.url_is_search_fallback = false;
          console.log(`[Grounding] ${spectrum} → direct link: ${matched}`);
        } else {
          // Fallback: Google Search for this outlet + topic (always works)
          const fallbackDomain = (domain && domain !== 'n/a') ? domain : null;
          const q = encodeURIComponent(fallbackDomain ? `site:${fallbackDomain} ${topic}` : `${topic} deutsche medien`);
          source.article_url = `https://www.google.com/search?q=${q}`;
          source.url_is_search_fallback = true;
          console.log(`[Grounding] ${spectrum} → search fallback for ${fallbackDomain || 'no domain'}`);
        }
      }

      // Strip any fake/old dates — only keep dates within the 90-day window
      for (const spectrum of ['left', 'center', 'right']) {
        const source = analysis.news_spectrum[spectrum];
        if (source.publication_date && !isRecentEnough(source.publication_date)) {
          console.warn(`[Date] Dropping fake date "${source.publication_date}" for ${spectrum}`);
          delete source.publication_date;
        }
      }

      // Count how many sources got a direct grounding URL (not search fallback)
      const directCount = ['left', 'center', 'right'].filter(
        s => !analysis.news_spectrum[s].url_is_search_fallback
      ).length;
      console.log(`[Gemini] ${directCount}/3 sources have direct article links`);

      // Build coverage_distribution from Gemini's coverage_estimate fields
      const coverage_distribution = {};
      for (const spectrum of ['left', 'center', 'right']) {
        const source = analysis.news_spectrum[spectrum];
        const estimate = ['high', 'medium', 'low'].includes(source.coverage_estimate)
          ? source.coverage_estimate
          : 'medium';
        coverage_distribution[spectrum] = { estimate, percent: coverageToPercent(estimate) };
        delete source.coverage_estimate; // keep news_spectrum clean
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
  const noResult = (label) => ({
    source_name: label,
    source_domain: 'n/a',
    article_title: label,
    summary_of_perspective: label,
    article_url: `https://www.google.com/search?q=${encodeURIComponent(topic + ' deutsche Medien')}`,
    url_is_search_fallback: true,
  });
  const emptyAnalysis = {
    analysis_topic: topic,
    response_language: 'de',
    overall_non_partisan_analysis: `Zu diesem Thema wurden keine aktuellen deutschen Medienberichte gefunden.`,
    news_spectrum: {
      left: noResult('Kein Artikel gefunden'),
      center: noResult('Kein Artikel gefunden'),
      right: noResult('Kein Artikel gefunden'),
    },
    coverage_distribution: {
      left: { estimate: 'low', percent: 5 },
      center: { estimate: 'low', percent: 5 },
      right: { estimate: 'low', percent: 5 },
    },
  };
  return { analysis: emptyAnalysis, degraded: true };
}

app.post('/api/analyze', async (req, res) => {
  const { topic, lang } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });

  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'API Key Missing' });

  // Translated result cache (per topic+lang) — v3 includes deep_analysis
  const cacheKey = crypto.createHash('md5').update(`${topic.toLowerCase()}:${lang}:v3`).digest('hex');
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[Cache] HIT for "${topic}" (${lang})`);
    return res.json(cached);
  }

  // Hard timeout: Railway kills connections after ~60s, so we respond before that
  const TIMEOUT_MS = 55000;
  const requestStart = Date.now();
  const timeoutHandle = setTimeout(() => {
    if (!res.headersSent) {
      console.error('[Timeout] Analysis exceeded 55s, returning error');
      res.status(503).json({ error: 'Analysis timed out. Please try again.' });
    }
  }, TIMEOUT_MS);

  try {
    // Step 1: German search — shared base for all languages on the same topic
    // v3: also caches germanDeepAnalysis so non-DE requests don't recompute it
    const deKey = crypto.createHash('md5').update(`${topic.toLowerCase()}:de-base:v3`).digest('hex');
    let germanAnalysis, degraded, germanDeepAnalysis;

    const cachedBase = cache.get(deKey);
    if (cachedBase) {
      console.log(`[Cache] HIT German base for "${topic}"`);
      ({ germanAnalysis, degraded, germanDeepAnalysis } = cachedBase);
    } else {
      ({ analysis: germanAnalysis, degraded } = await callGeminiWithRetry(topic, 'de', 1));

      // Step 2a: Deep analysis right after main call, while no translation overhead yet
      // Reserve 14s for translation if non-DE; 4s buffer always
      if (!degraded) {
        const elapsed = Date.now() - requestStart;
        const translationReserve = lang !== 'de' ? 14000 : 0;
        const deepBudget = Math.max(0, TIMEOUT_MS - elapsed - translationReserve - 4000);
        console.log(`[DeepAnalysis] Budget: ${deepBudget}ms (elapsed: ${elapsed}ms, translReserve: ${translationReserve}ms)`);
        if (deepBudget > 5000) {
          try {
            germanDeepAnalysis = await callDeepAnalysis(germanAnalysis, deepBudget);
            console.log(`[DeepAnalysis] OK — ${germanDeepAnalysis.shared_facts.length} facts, ${germanDeepAnalysis.diverging_points.length} diverging, ${germanDeepAnalysis.silenced_topics.length} silenced`);
          } catch (err) {
            console.warn('[DeepAnalysis] Skipped:', err.message);
          }
        } else {
          console.warn(`[DeepAnalysis] Skipped — budget too small (${deepBudget}ms)`);
        }
      }

      const ttl = degraded ? 1800 : 86400;
      cache.set(deKey, { germanAnalysis, degraded, germanDeepAnalysis: germanDeepAnalysis ?? null }, ttl);
    }

    let deepAnalysis = germanDeepAnalysis ?? null;

    // Step 2b: Translate output to user language (skip if German)
    let finalAnalysis = germanAnalysis;
    if (lang !== 'de') {
      try {
        const baseForTranslation = deepAnalysis
          ? { ...germanAnalysis, deep_analysis: deepAnalysis }
          : germanAnalysis;
        finalAnalysis = await translateAnalysis(baseForTranslation, lang, genAI);
        console.log(`[Translate] Analysis → ${lang} done`);
        deepAnalysis = finalAnalysis.deep_analysis ?? deepAnalysis;
      } catch (err) {
        console.error('[Translate] Falling back to German:', err.message);
        finalAnalysis = germanAnalysis;
      }
    }

    // Restore original topic and language
    finalAnalysis = { ...finalAnalysis, analysis_topic: topic, response_language: lang };
    if (deepAnalysis) finalAnalysis.deep_analysis = deepAnalysis;

    const response = { ...finalAnalysis, _meta: { degraded } };

    const ttl = degraded ? 1800 : 86400;
    cache.set(cacheKey, response, ttl);

    clearTimeout(timeoutHandle);
    if (!res.headersSent) res.json(response);
  } catch (error) {
    clearTimeout(timeoutHandle);
    console.error('[Analyze Error]:', error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Analysis failed', message: error.message });
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
