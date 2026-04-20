import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import NodeCache from 'node-cache';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as Sentry from '@sentry/node';

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
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const SENTRY_DSN = process.env.VITE_SENTRY_DSN || process.env.SENTRY_DSN;

if (SENTRY_DSN) {
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
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    const lang = req.headers['accept-language-app'] || 'en';
    const messages = {
      de: 'Tägliches Limit erreicht. Bitte versuchen Sie es morgen erneut oder registrieren Sie sich.',
      en: 'Daily limit reached. Please try again tomorrow or sign up.',
      ru: 'Дневной лимит исчерпан. Пожалуйста, попробуйте завтра или зарегистрируйтесь.'
    };
    res.status(429).json({ error: messages[lang] || messages.en });
  }
});

// --- Gemini Proxy Endpoint ---
app.post('/api/analyze', limiter, async (req, res) => {
  checkBudgetReset();

  const { topic, lang } = req.body;

  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    return res.status(400).json({ error: 'Invalid topic' });
  }
  if (topic.length > 200) {
    return res.status(400).json({ error: 'Topic too long' });
  }

  if (dailyCost >= BUDGET_CAP) {
    return res.status(503).json({ error: 'Service temporarily unavailable, please try again tomorrow.' });
  }

  const cacheKey = crypto.createHash('md5').update(`${topic}:${lang}`).digest('hex');
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cachedResponse);
  }

  try {
    if (!GEMINI_API_KEY) throw new Error('Backend API Key Missing');
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const systemPrompt = `You are an objective, non-partisan AI Political Analyst specialized in the German Media Landscape (DACH region). Your goal is to de-polarize news by comparing how different media outlets report on the same topic. You expose bias, identify factual discrepancies, and highlight "Blindspots".
    Return ONLY a valid JSON object following the established structure.`;
    
    const prompt = `Analyse the topic: "${topic}". Perform a search for German news articles. Respond in ${lang}.`;

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
    console.error('[Backend Error]:', error);
    Sentry.captureException(error);
    res.status(500).json({ error: 'Analysis failed on server side.' });
  }
});

// --- Static Frontend Serving ---
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  // If request is not for API, serve index.html
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    res.status(404).json({ error: 'API route not found' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
