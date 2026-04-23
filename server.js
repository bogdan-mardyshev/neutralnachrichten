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
import { validateAnalysis } from './lib/validation.js';

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

  const sourceFields = ['source_name', 'article_title', 'article_url', 'summary_of_perspective', 'publication_date'];
  return spectrum.every(key => {
    const source = data.news_spectrum[key];
    return sourceFields.every(field => typeof source[field] === 'string');
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

  return `You are a media analysis assistant. Find recent German media coverage of the topic "${topic}" from three political perspectives and return a JSON object.

OUTPUT RULES:
- Output ONLY the JSON object. No markdown, no code fences, no preamble.
- Response must start with { and end with }.
- Use EXACTLY these English keys — NEVER translate keys to another language.
- All VALUES must be in ${targetLang}.

RECENCY REQUIREMENTS (CRITICAL):
- Today's date: ${today}
- Articles MUST be published on or after ${earliestDate} (last 90 days)
- Strongly prefer articles from the last 14 days
- Reject any article older than 90 days and find a newer alternative
- Include the exact publication date as ISO format: YYYY-MM-DD

DOMAIN REQUIREMENTS (CRITICAL):
${formatDomainsForPrompt()}

- Each article MUST come from a domain in the approved list
- Match the article to its correct spectrum (left/center/right)
- The article_url must be the full article URL, not the homepage
- Do NOT invent or guess URLs — only return URLs you found in search results

REQUIRED JSON STRUCTURE:
{
  "analysis_topic": "${topic}",
  "response_language": "${language}",
  "overall_non_partisan_analysis": "<2-3 sentence consensus summary in ${targetLang}>",
  "news_spectrum": {
    "left": {
      "source_name": "<outlet name, e.g. taz>",
      "article_title": "<exact article headline in ${targetLang}>",
      "article_url": "<full https URL to the specific article>",
      "summary_of_perspective": "<2-3 sentences describing the left-leaning angle in ${targetLang}>",
      "publication_date": "<YYYY-MM-DD>"
    },
    "center": {
      "source_name": "<outlet name, e.g. Spiegel>",
      "article_title": "<exact article headline in ${targetLang}>",
      "article_url": "<full https URL>",
      "summary_of_perspective": "<2-3 sentences in ${targetLang}>",
      "publication_date": "<YYYY-MM-DD>"
    },
    "right": {
      "source_name": "<outlet name, e.g. Welt>",
      "article_title": "<exact article headline in ${targetLang}>",
      "article_url": "<full https URL>",
      "summary_of_perspective": "<2-3 sentences in ${targetLang}>",
      "publication_date": "<YYYY-MM-DD>"
    }
  }
}

If you cannot find a valid article from the approved domains for a spectrum within the recency window, still output the JSON but set that spectrum's fields to "insufficient_coverage" strings. Do NOT invent articles.`;
}

async function callGeminiWithRetry(topic, language, maxAttempts = 3) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }]
  });

  let lastError = null;
  let lastAnalysis = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Gemini] Attempt ${attempt}/${maxAttempts} for topic="${topic}" lang=${language}`);

      const prompt = buildPrompt(topic, language);
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
      });

      const rawText = result.response.text();
      const analysis = extractJSON(rawText);

      if (!validateAnalysisStructure(analysis)) {
        throw new Error('Invalid response structure');
      }

      const validation = await validateAnalysis(analysis);
      console.log(`[Gemini] Validation attempt ${attempt}:`, {
        valid: validation.valid,
        validCount: validation.validCount,
        details: Object.fromEntries(
          Object.entries(validation.details).map(([k, v]) => [k, v.issues])
        )
      });

      lastAnalysis = { analysis, validation };

      if (validation.valid) {
        return { analysis, validation, degraded: false };
      }

      if (attempt === maxAttempts && validation.acceptable) {
        console.warn('[Gemini] Returning partially valid result after max attempts');
        return { analysis, validation, degraded: true };
      }

      console.warn(`[Gemini] Validation failed, retrying...`);
    } catch (err) {
      console.error(`[Gemini] Attempt ${attempt} failed:`, err.message);
      lastError = err;
    }
  }

  if (lastAnalysis?.validation?.acceptable) {
    return { ...lastAnalysis, degraded: true };
  }

  throw lastError || new Error('All Gemini attempts failed validation');
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
    console.error('[Analyze Error]:', error);
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get(/^(?!\/api\/).*$/, (req, res) => res.sendFile(path.join(distPath, 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
