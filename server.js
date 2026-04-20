require('dotenv').config({ path: '.env.local' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const NodeCache = require('node-cache');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');
const path = require('path');
const Sentry = require('@sentry/node');

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const BUDGET_CAP = parseFloat(process.env.DAILY_BUDGET_USD || '5.0');
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
const SENTRY_DSN = process.env.SENTRY_DSN;

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
app.use(express.json({ limit: '1kb' })); // Body limit for sanitization

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
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // Limit to 3 requests per IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res, next, options) => {
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

  // 1. Input Validation
  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    return res.status(400).json({ error: 'Invalid topic' });
  }
  if (topic.length > 200) {
    return res.status(400).json({ error: 'Topic too long' });
  }

  // 2. Budget Cap Check
  if (dailyCost >= BUDGET_CAP) {
    return res.status(503).json({ error: 'Service temporarily unavailable, please try again tomorrow.' });
  }

  // 3. Cache Check
  const cacheKey = crypto.createHash('md5').update(`${topic}:${lang}`).digest('hex');
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cachedResponse);
  }

  // 4. API Request
  try {
    if (!GEMINI_API_KEY) throw new Error('Backend API Key Missing');
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const systemPrompt = `You are a non-partisan political news analyst. Provide a balanced analysis of German media on the topic. Return JSON.`;
    const prompt = `Topic: "${topic}". Lang: ${lang}. Return JSON analysis.`;

    const result = await model.generateContent([systemPrompt, prompt]);
    const response = await result.response;
    const text = response.text();

    // Clean and parse
    const cleanJson = text.replace(/```json\n?|\n?```/g, "").trim();
    const data = JSON.parse(cleanJson);

    // Update cost (estimate)
    dailyCost += 0.035;

    // Cache and return
    cache.set(cacheKey, data);
    res.setHeader('X-Cache', 'MISS');
    res.json(data);

  } catch (error) {
    console.error('[Backend Error]:', error);
    Sentry.captureException(error);
    res.status(500).json({ error: 'Analysis failed on server side.' });
  }
});

// --- Static Frontend Serving (Railway/Production) ---
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
