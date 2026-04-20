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

// --- ESM __dirname equivalent ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Load environment variables in development ---
if (process.env.NODE_ENV !== 'production') {
  try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: '.env.local' });
  } catch (err) {
    console.warn('.env.local not found, skipping...');
  }
}

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const BUDGET_CAP = parseFloat(process.env.DAILY_BUDGET_USD || '5.0');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const SENTRY_DSN = process.env.SENTRY_DSN;

// Only init Sentry if it's a real DSN
if (SENTRY_DSN && SENTRY_DSN.startsWith('http')) {
  Sentry.init({ dsn: SENTRY_DSN });
}

const app = express();
const cache = new NodeCache({ stdTTL: 21600 }); // 6 hours
let dailyCost = 0;
let lastResetDate = new Date().getUTCDate();

// --- Security Middleware ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "https://app.posthog.com", "https://browser.sentry-cdn.com"],
      "connect-src": ["'self'", "https://app.posthog.com", "https://*.sentry.io"],
    },
  },
}));
app.use(cors());
app.use(express.json({ limit: '1kb' }));

// --- Cost Counter Reset ---
const checkBudgetReset = () => {
  const now = new Date();
  if (now.getUTCDate() !== lastResetDate) {
    dailyCost = 0;
    lastResetDate = now.getUTCDate();
  }
};

// --- Rate Limiting ---
const limiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
  handler: (req, res) => {
    const lang = req.headers['accept-language-app'] || 'en';
    const messages = {
      de: 'Limit erreicht. Bitte morgen wiederkommen.',
      en: 'Limit reached. Please try again tomorrow.',
      ru: 'Лимит исчерпан. Пожалуйста, попробуйте завтра.'
    };
    res.status(429).json({ error: messages[lang] || messages.en });
  }
});

// --- Gemini Proxy Endpoint ---
app.post('/api/analyze', limiter, async (req, res) => {
  checkBudgetReset();
  const { topic, lang } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic is required' });

  if (dailyCost >= BUDGET_CAP) return res.status(503).json({ error: 'Daily budget reached' });

  const cacheKey = crypto.createHash('md5').update(`${topic}:${lang}`).digest('hex');
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cachedResponse);
  }

  try {
    if (!GEMINI_API_KEY) throw new Error('API Key Missing');
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // Используем Gemini 2.0 Flash + Google Search
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      tools: [{ googleSearch: {} }] 
    });

    const systemPrompt = `You are an objective, non-partisan AI Political Analyst specialized in the German Media Landscape (DACH region). 
    Use the Google Search tool to find current German news articles from different political spectrums (Left, Center, Right). 
    Provide fact-check consensus, narrative split, and blindspot alert. Return ONLY a valid JSON object.`;
    
    const prompt = `Analyse the topic: "${topic}". Respond in ${lang}.`;

    console.log(`[Gemini] Calling API for: ${topic} with Search Grounding...`);
    const result = await model.generateContent([systemPrompt, prompt]);
    const response = await result.response;
    const text = response.text();

    const cleanJson = text.replace(/```json\n?|\n?```/g, "").trim();
    const data = JSON.parse(cleanJson);

    dailyCost += 0.035; 
    cache.set(cacheKey, data);
    res.setHeader('X-Cache', 'MISS');
    res.json(data);
  } catch (error) {
    console.error('[Gemini Error]:', error);
    
    // Если поиск запрещен (403), даем внятный ответ
    if (error.status === 403) {
       return res.status(500).json({ 
         error: 'Google Search Grounding is restricted for this API Key/Region. Please disable Search in code or check AI Studio settings.' 
       });
    }
    
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// --- Static Frontend Serving ---
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get(/^(?!\/api\/).*$/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
