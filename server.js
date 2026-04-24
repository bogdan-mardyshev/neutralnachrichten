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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || 3001;

const rawKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_KEY = rawKey.replace(/["']/g, '').trim();

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
      "publication_date": "<YYYY-MM-DD from search results, or omit if uncertain>"
    },
    "center": {
      "source_name": "<outlet name>",
      "source_domain": "<domain>",
      "article_title": "<exact headline in ${targetLang}>",
      "summary_of_perspective": "<2-3 sentences in ${targetLang}>",
      "publication_date": "<YYYY-MM-DD or omit>"
    },
    "right": {
      "source_name": "<outlet name>",
      "source_domain": "<domain>",
      "article_title": "<exact headline in ${targetLang}>",
      "summary_of_perspective": "<2-3 sentences in ${targetLang}>",
      "publication_date": "<YYYY-MM-DD or omit>"
    }
  }
}`;
}

async function callGeminiWithRetry(topic, language, maxAttempts = 3) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
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

      // Always return — no more retries based on domain. Whitelist is prompt guidance only.
      const degraded = directCount < 3;
      return { analysis, validation: { valid: !degraded, validCount: directCount, details: {}, acceptable: directCount >= 2 }, degraded };
    } catch (err) {
      console.error(`[Gemini] Attempt ${attempt} failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini attempts failed');
}

app.post('/api/analyze', async (req, res) => {
  const { topic, lang } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });

  const cacheKey = crypto.createHash('md5').update(`${topic}:${lang}:v1`).digest('hex');
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    if (!GEMINI_API_KEY) throw new Error('API Key Missing');

    const { analysis, validation, degraded } = await callGeminiWithRetry(topic, lang);

    const response = {
      ...analysis,
      _meta: {
        degraded,
        ...(degraded && {
          validation_summary: {
            valid_sources: validation.validCount,
            total_sources: 3,
            issues: Object.fromEntries(
              Object.entries(validation.details)
                .filter(([, v]) => !v.valid)
                .map(([k, v]) => [k, v.issues])
            )
          }
        })
      }
    };

    // Cache duration: 24h for fully valid, 30min for degraded
    const ttl = degraded ? 1800 : 86400;
    cache.set(cacheKey, response, ttl);

    res.json(response);
  } catch (error) {
    console.error('[Analyze Error]:', error.message);
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get(/^(?!\/api\/).*$/, (req, res) => res.sendFile(path.join(distPath, 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
