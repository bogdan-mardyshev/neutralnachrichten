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

app.post('/api/analyze', async (req, res) => {
  const { topic, lang } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });

  console.log(`[Server] Analyzing topic: "${topic}" in ${lang}`);

  try {
    if (!GEMINI_API_KEY) throw new Error('API Key Missing on Server');
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", // Locked to 2.5-flash as requested
      tools: [{ googleSearch: {} }] 
    });

    const systemPrompt = `You are a non-partisan political news analyst. 
    Use Google Search to find current German news articles from Left, Center and Right spectrums. 
    Return ONLY a valid JSON object.`;
    
    const prompt = `Analyse: "${topic}". Response Language: ${lang}.`;

    const result = await model.generateContent([systemPrompt, prompt]);
    const response = await result.response;
    
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('No candidates returned from Gemini');
    }
    
    const text = response.text();
    const cleanJson = text.replace(/```json\n?|\n?```/g, "").trim();
    
    console.log(`[Server] Success. Response length: ${text.length}`);
    res.json(JSON.parse(cleanJson));
  } catch (error) {
    console.error('[Analyze Error]:', error);
    res.status(500).json({ 
      error: 'Analysis failed', 
      message: error.message,
      status: error.status 
    });
  }
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get(/^(?!\/api\/).*$/, (req, res) => res.sendFile(path.join(distPath, 'index.html')));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Increase timeout for long-running Gemini search (60 seconds)
server.timeout = 60000;
server.keepAliveTimeout = 61000;
server.headersTimeout = 62000;
