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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.env.NODE_ENV !== 'production') {
  try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: '.env.local' });
  } catch (err) {
    console.warn('.env.local not found');
  }
}

const PORT = process.env.PORT || 3001;
const BUDGET_CAP = parseFloat(process.env.DAILY_BUDGET_USD || '5.0');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

const app = express();

// --- 3. Обновление Content Security Policy (CSP) ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": [
        "'self'", 
        "'unsafe-inline'", 
        "https://app.posthog.com", 
        "https://eu-assets.i.posthog.com", 
        "https://browser.sentry-cdn.com"
      ],
      "connect-src": [
        "'self'", 
        "https://app.posthog.com", 
        "https://eu.i.posthog.com", 
        "https://eu-assets.i.posthog.com", 
        "https://generativelanguage.googleapis.com", 
        "https://*.sentry.io"
      ],
      "img-src": ["'self'", "data:", "https://eu-assets.i.posthog.com"],
    },
  },
}));

app.use(cors());
app.use(express.json({ limit: '1kb' }));

const cache = new NodeCache({ stdTTL: 21600 });
let dailyCost = 0;
let lastResetDate = new Date().getUTCDate();

const limiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
  handler: (req, res) => {
    res.status(429).json({ error: 'Limit reached. Try again tomorrow.' });
  }
});

// --- 1 & 2. Инициализация Gemini и обработка ответа ---
app.post('/api/analyze', limiter, async (req, res) => {
  const { topic, lang } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });

  const cacheKey = crypto.createHash('md5').update(`${topic}:${lang}`).digest('hex');
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    if (!GEMINI_API_KEY) throw new Error('API Key Missing');
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Инициализация с поддержкой Google Search
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      tools: [{ googleSearch: {} }] 
    });

    const systemPrompt = `Objective, non-partisan AI Political Analyst. Return ONLY valid JSON.`;
    const prompt = `Analyse the topic: "${topic}". Perform a google search for current German news. Respond in language: ${lang}.`;

    const result = await model.generateContent([systemPrompt, prompt]);
    const response = await result.response;

    // Безопасная проверка кандидатов
    if (!response.candidates || response.candidates.length === 0) {
      console.error('[Gemini] No candidates returned. Blocked or Safety filter trigger.');
      return res.status(500).json({ error: 'Google Gemini returned no results. It might be blocked by safety filters or regional restrictions.' });
    }

    const text = response.text();
    const cleanJson = text.replace(/```json\n?|\n?```/g, "").trim();
    const data = JSON.parse(cleanJson);

    cache.set(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error('[Gemini Error]:', error);
    
    // Обработка 403 Forbidden (обычно это бан Grounding в регионе)
    if (error.status === 403) {
      return res.status(500).json({ error: 'Search Grounding is not available for this key/region.' });
    }

    res.status(500).json({ error: 'Analysis failed on server side. Please try a different topic.' });
  }
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get(/^(?!\/api\/).*$/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
