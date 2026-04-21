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

// Очищаем ключ от возможных кавычек или пробелов
const rawKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_KEY = rawKey.replace(/["']/g, '').trim();

// --- API Key Verification on Startup ---
if (GEMINI_API_KEY) {
  console.log(`[Server] API Key loaded: ${GEMINI_API_KEY.substring(0, 4)}...${GEMINI_API_KEY.substring(GEMINI_API_KEY.length - 4)} (Length: ${GEMINI_API_KEY.length})`);
} else {
  console.error('[Server] CRITICAL: GEMINI_API_KEY is empty!');
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
  limit: 10,
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
  handler: (req, res) => {
    res.status(429).json({ error: 'Limit reached.' });
  }
});

app.post('/api/analyze', limiter, async (req, res) => {
  const { topic, lang } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });

  try {
    // Проверка ключа перед вызовом
    if (!GEMINI_API_KEY || GEMINI_API_KEY.length < 10) {
      console.error('[Server] CRITICAL: GEMINI_API_KEY is missing or too short.');
      return res.status(500).json({ error: 'Server configuration error: API Key is missing.' });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Используем максимально стабильную 1.5 Flash для поиска
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      tools: [{ googleSearch: {} }] 
    });

    const systemPrompt = `Objective, non-partisan AI Political Analyst. Provide fact-check consensus and narrative split. Return ONLY valid JSON.`;
    const prompt = `Analyse the topic: "${topic}" using Google Search for German media. Language: ${lang}.`;

    console.log(`[Gemini] Requesting analysis for: ${topic}...`);
    const result = await model.generateContent([systemPrompt, prompt]);
    const response = await result.response;

    if (!response.candidates || response.candidates.length === 0) {
      return res.status(500).json({ error: 'Gemini returned no results. Try again.' });
    }

    const text = response.text();
    const cleanJson = text.replace(/```json\n?|\n?```/g, "").trim();
    const data = JSON.parse(cleanJson);

    res.json(data);
  } catch (error) {
    console.error('[Gemini Error]:', error);
    
    if (error.status === 403) {
      return res.status(500).json({ 
        error: 'Google Search is restricted. Try disabling grounding or check billing at AI Studio.' 
      });
    }

    res.status(500).json({ error: 'Analysis failed. Please try a different topic.' });
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
