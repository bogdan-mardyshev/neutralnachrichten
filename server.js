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

// Загружаем переменные (для локалки и на всякий случай для Railway)
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;

// ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ (Видим только ключи, не значения)
console.log('[Server] Startup - All available ENV keys:', Object.keys(process.env));

const rawKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_KEY = rawKey.replace(/["']/g, '').trim();

if (GEMINI_API_KEY) {
  console.log(`[Server] SUCCESS: API Key found. Length: ${GEMINI_API_KEY.length}. Prefix: ${GEMINI_API_KEY.substring(0, 4)}`);
} else {
  console.error('[Server] ERROR: GEMINI_API_KEY is still empty in process.env');
}

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

const limiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 20, // Увеличим лимит для тестов
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
  handler: (req, res) => {
    res.status(429).json({ error: 'Limit reached.' });
  }
});

app.post('/api/analyze', limiter, async (req, res) => {
  const { topic, lang } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });

  try {
    if (!GEMINI_API_KEY) throw new Error('API Key Missing');
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      tools: [{ googleSearch: {} }] 
    });

    const systemPrompt = `You are a non-partisan news analyzer. Respond ONLY in valid JSON.`;
    const prompt = `Topic: "${topic}". Language: ${lang}. Search German news.`;

    const result = await model.generateContent([systemPrompt, prompt]);
    const response = await result.response;
    const text = response.text();
    const cleanJson = text.replace(/```json\n?|\n?```/g, "").trim();
    res.json(JSON.parse(cleanJson));
  } catch (error) {
    console.error('[API Error]:', error);
    res.status(500).json({ error: error.message || 'Analysis failed' });
  }
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get(/^(?!\/api\/).*$/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
