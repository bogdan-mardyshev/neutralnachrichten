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
  const topLevel = ['analysis_topic', 'response_language', 'overall_non_partisan_analysis', 'news_spectrum'];
  if (!topLevel.every(key => key in data)) return false;

  const spectrum = ['left', 'center', 'right'];
  if (!spectrum.every(key => data.news_spectrum?.[key] && typeof data.news_spectrum[key] === 'object')) return false;

  const requiredFields = ['source_name', 'article_title', 'summary_of_perspective'];
  return spectrum.every(key => {
    const source = data.news_spectrum[key];
    return requiredFields.every(field => typeof source[field] === 'string' && source[field].length > 0);
  });
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

  return `You are a media analysis assistant. Use Google Search to find real, recent articles about "${topic}" in German media. Analyze coverage from three political perspectives.

OUTPUT RULES:
- Output ONLY the JSON object. No markdown, no code fences, no preamble.
- Response must start with { and end with }.
- Use EXACTLY these English keys — NEVER translate keys to another language.
- All text VALUES must be in ${targetLang}.

RECENCY (CRITICAL):
- Today: ${today}
- Only include articles published on or after ${earliestDate} (last 90 days)
- Strongly prefer articles from the last 14 days
- publication_date MUST come from your Google Search results — NOT from memory
- If you are not certain of the date from search results, omit the publication_date field entirely

DO NOT include article URLs — they are not part of the response schema.

PREFERRED GERMAN MEDIA DOMAINS:
${formatDomainsForPrompt()}

COVERAGE ESTIMATE (per spectrum):
For each spectrum, set "coverage_estimate" based on your search results:
- "high"   → 3 or more outlets in that spectrum have recent articles on this topic
- "medium" → 1 or 2 outlets have recent articles
- "low"    → no outlets in that spectrum covered this topic recently

REQUIRED JSON STRUCTURE:
{
  "analysis_topic": "${topic}",
  "response_language": "${language}",
  "overall_non_partisan_analysis": "<2-3 sentence consensus summary in ${targetLang}>",
  "news_spectrum": {
    "left": {
      "source_name": "<outlet name, e.g. taz>",
      "source_domain": "<domain only, e.g. taz.de>",
      "article_title": "<exact headline from search results in ${targetLang}>",
      "summary_of_perspective": "<2-3 sentences describing the left-leaning angle in ${targetLang}>",
      "publication_date": "<YYYY-MM-DD from search results, or omit if uncertain>",
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
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: attempt === 1 ? 0.2 : 0.4 }
      });

      const rawText = result.response.text();
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

      // Always return — no more retries based on domain. Whitelist is prompt guidance only.
      const degraded = directCount < 3;
      return { analysis: { ...analysis, coverage_distribution }, validation: { valid: !degraded, validCount: directCount, details: {}, acceptable: directCount >= 2 }, degraded };
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

  // Translated result cache (per topic+lang)
  const cacheKey = crypto.createHash('md5').update(`${topic.toLowerCase()}:${lang}:v2`).digest('hex');
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[Cache] HIT for "${topic}" (${lang})`);
    return res.json(cached);
  }

  // Hard timeout: Railway kills connections after ~60s, so we respond before that
  const TIMEOUT_MS = 55000;
  const timeoutHandle = setTimeout(() => {
    if (!res.headersSent) {
      console.error('[Timeout] Analysis exceeded 55s, returning error');
      res.status(503).json({ error: 'Analysis timed out. Please try again.' });
    }
  }, TIMEOUT_MS);

  try {
    // Step 1: German search — shared base for all languages on the same topic
    const deKey = crypto.createHash('md5').update(`${topic.toLowerCase()}:de-base:v2`).digest('hex');
    let germanAnalysis, degraded;

    const cachedBase = cache.get(deKey);
    if (cachedBase) {
      console.log(`[Cache] HIT German base for "${topic}"`);
      ({ germanAnalysis, degraded } = cachedBase);
    } else {
      ({ analysis: germanAnalysis, degraded } = await callGeminiWithRetry(topic, 'de', 2));
      const ttl = degraded ? 1800 : 86400;
      cache.set(deKey, { germanAnalysis, degraded }, ttl);
    }

    // Step 2: Translate output to user language (skip if German)
    let finalAnalysis = germanAnalysis;
    if (lang !== 'de') {
      try {
        finalAnalysis = await translateAnalysis(germanAnalysis, lang, genAI);
        console.log(`[Translate] Analysis → ${lang} done`);
      } catch (err) {
        console.error('[Translate] Falling back to German:', err.message);
        finalAnalysis = germanAnalysis;
      }
    }

    // Restore original topic and language
    finalAnalysis = { ...finalAnalysis, analysis_topic: topic, response_language: lang };

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
