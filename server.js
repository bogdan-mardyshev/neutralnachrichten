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

const cache = new NodeCache({ stdTTL: 21600 });

// Validation Helper
function validateResponse(data) {
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

// Robust JSON Extraction
function extractJSON(rawText) {
  let cleaned = rawText.trim();
  // Strip markdown fences if present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  
  if (first === -1 || last === -1 || last < first) {
    throw new Error('No JSON object found in Gemini response');
  }
  
  return JSON.parse(cleaned.substring(first, last + 1));
}

async function callGeminiWithRetry(topic, lang, attempt = 1) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  
  // CRITICAL: We REMOVE responseMimeType and responseSchema because they conflict with googleSearch tool
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }]
  });

  const langNames = { de: 'German', en: 'English', ru: 'Russian' };
  const targetLang = langNames[lang] || 'English';

  const systemPrompt = `You are a neutral news analysis AI. 
  You MUST return a valid JSON object. Output ONLY raw JSON — no markdown, no code fences, no commentary.
  
  REQUIRED JSON SCHEMA (Use these EXACT English keys, NEVER translate them):
  {
    "analysis_topic": "${topic}",
    "response_language": "${lang}",
    "overall_non_partisan_analysis": "<2-3 sentence consensus in ${targetLang}>",
    "news_spectrum": {
      "left": {
        "source_name": "<outlet>",
        "article_title": "<title in ${targetLang}>",
        "article_url": "<https URL>",
        "summary_of_perspective": "<summary in ${targetLang}>",
        "publication_date": "<date in ${targetLang}>"
      },
      "center": { ... },
      "right": { ... }
    }
  }

  Rules:
  - JSON keys must be in English.
  - Text values must be in ${targetLang}.
  - Exactly one German article per spectrum (left, center, right).
  - Start response with { and end with }.`;

  const prompt = `Analyse the topic: "${topic}" in the context of German media. Return JSON in ${targetLang}.`;

  try {
    const result = await model.generateContent([systemPrompt, prompt]);
    const text = result.response.text();
    const parsed = extractJSON(text);
    
    if (!validateResponse(parsed)) {
      throw new Error('Invalid schema in AI response');
    }
    return parsed;
  } catch (err) {
    console.warn(`[Gemini] Attempt ${attempt} failed:`, err.message);
    if (attempt < 2) return callGeminiWithRetry(topic, lang, attempt + 1);
    throw err;
  }
}

app.post('/api/analyze', async (req, res) => {
  const { topic, lang } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });

  const cacheKey = crypto.createHash('md5').update(`${topic}:${lang}`).digest('hex');
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    if (!GEMINI_API_KEY) throw new Error('API Key Missing');
    const data = await callGeminiWithRetry(topic, lang);
    cache.set(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error('[Analyze Error]:', error);
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get(/^(?!\/api\/).*$/, (req, res) => res.sendFile(path.join(distPath, 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
