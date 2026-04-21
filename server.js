import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import NodeCache from 'node-cache';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
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

// --- STRICT JSON SCHEMA DEFINITION ---
const ANALYSIS_SCHEMA = {
  description: "News analysis response schema",
  type: SchemaType.OBJECT,
  properties: {
    analysis_topic: { type: SchemaType.STRING },
    response_language: { type: SchemaType.STRING },
    overall_non_partisan_analysis: { type: SchemaType.STRING },
    news_spectrum: {
      type: SchemaType.OBJECT,
      properties: {
        left: {
          type: SchemaType.OBJECT,
          properties: {
            source_name: { type: SchemaType.STRING },
            article_title: { type: SchemaType.STRING },
            article_url: { type: SchemaType.STRING },
            summary_of_perspective: { type: SchemaType.STRING },
            publication_date: { type: SchemaType.STRING }
          },
          required: ["source_name", "article_title", "article_url", "summary_of_perspective", "publication_date"]
        },
        center: {
          type: SchemaType.OBJECT,
          properties: {
            source_name: { type: SchemaType.STRING },
            article_title: { type: SchemaType.STRING },
            article_url: { type: SchemaType.STRING },
            summary_of_perspective: { type: SchemaType.STRING },
            publication_date: { type: SchemaType.STRING }
          },
          required: ["source_name", "article_title", "article_url", "summary_of_perspective", "publication_date"]
        },
        right: {
          type: SchemaType.OBJECT,
          properties: {
            source_name: { type: SchemaType.STRING },
            article_title: { type: SchemaType.STRING },
            article_url: { type: SchemaType.STRING },
            summary_of_perspective: { type: SchemaType.STRING },
            publication_date: { type: SchemaType.STRING }
          },
          required: ["source_name", "article_title", "article_url", "summary_of_perspective", "publication_date"]
        }
      },
      required: ["left", "center", "right"]
    }
  },
  required: ["analysis_topic", "response_language", "overall_non_partisan_analysis", "news_spectrum"]
};

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

async function callGeminiWithRetry(topic, lang, attempt = 1) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  
  // Note: some combinations of tools + schema might require handling. 
  // We use strict prompting as a fallback within the config.
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ANALYSIS_SCHEMA
    }
  });

  const systemPrompt = `You are a neutral news analysis AI. 
  You MUST return a valid JSON object with English keys. 
  NEVER translate JSON keys like "analysis_topic" or "news_spectrum".
  Only the text VALUES should be in ${lang}.
  Find exactly one German news article for each spectrum (left, center, right).`;

  const prompt = `Analyse the topic: "${topic}". Response language: ${lang}.`;

  try {
    const result = await model.generateContent([systemPrompt, prompt]);
    const text = result.response.text();
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    
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
