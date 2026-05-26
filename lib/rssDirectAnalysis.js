/**
 * lib/rssDirectAnalysis.js
 *
 * "No-grounding" Gemini analysis path.
 * Replaces callGeminiWithRetry (grounding) for A/B testing and eventual migration.
 *
 * Differences from grounding path:
 *   - No googleSearch tool → no grounding cost
 *   - RSS articles passed as context in the prompt
 *   - responseMimeType: 'application/json' → guaranteed valid JSON
 *   - Much faster: no Google Search round-trip (~3-8s vs ~15-30s)
 *
 * Returns the same shape as callGeminiWithRetry: { analysis, degraded, meta }
 * so the rest of the pipeline (enrichWithRSSData, deep analysis, etc.) is unchanged.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildRSSContextPrompt, buildDiagnosticPrompt, countCoveredSpectra } from './buildRSSPrompt.js';
import { validateAnalysisStructure } from './analysisValidator.js';

const SPECTRUM_ORDER = ['left', 'center_left', 'center', 'center_right', 'right'];

const rawKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_KEY = rawKey.replace(/["']/g, '').trim();

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ── Timeout constants ─────────────────────────────────────────────────────────
// No grounding = no Google Search round-trip → faster response budget.
const IS_PRODUCTION = !!process.env.RAILWAY_ENVIRONMENT;
// With thinkingBudget:0 and no search, Gemini 2.5 Flash should respond in 3-10s.
// We give generous budget for safety.
const DEFAULT_TIMEOUT_MS = IS_PRODUCTION ? 45000 : 60000;

// ── Empty fallback ────────────────────────────────────────────────────────────
function buildEmptyFallback(topic) {
  const noResult = () => ({
    source_name:              'Kein Artikel gefunden',
    source_domain:            'n/a',
    article_title:            'Kein Artikel gefunden',
    summary_of_perspective:   'Kein Artikel gefunden',
    article_url:              `https://www.google.com/search?q=${encodeURIComponent(topic + ' deutsche Medien')}`,
    url_is_search_fallback:   true,
  });
  return {
    analysis_topic:                topic,
    response_language:             'de',
    overall_non_partisan_analysis: 'Zu diesem Thema wurden keine aktuellen deutschen Medienberichte in den RSS-Feeds gefunden.',
    news_spectrum:                 Object.fromEntries(SPECTRUM_ORDER.map(s => [s, [noResult()]])),
    coverage_distribution:         Object.fromEntries(SPECTRUM_ORDER.map(s => [s, { estimate: 'none', percent: 0, count: 0 }])),
  };
}

// ── Attempt JSON repair ───────────────────────────────────────────────────────
function extractJSON(raw) {
  let cleaned = (raw || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '');

  const first = cleaned.indexOf('{');
  const last  = cleaned.lastIndexOf('}');
  if (first === -1 || last < first) throw new Error('No JSON object in response');

  const candidate = cleaned.substring(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    const repaired = candidate
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/:\s*undefined/g, ': null');
    return JSON.parse(repaired);
  }
}

/**
 * Call Gemini with RSS articles as context (no grounding).
 *
 * @param {string} topic
 * @param {string} language     — 'de' | 'en' | 'ru'
 * @param {object} rssSpectra   — from searchAllFeeds().spectra
 * @param {object} options
 * @param {number} options.timeoutMs
 * @param {number} options.maxPerSpectrum — articles per spectrum in prompt (default 3)
 * @returns {Promise<{ analysis, degraded, meta }>}
 */
export async function callGeminiWithRSSContext(topic, language, rssSpectra, options = {}) {
  const {
    timeoutMs      = DEFAULT_TIMEOUT_MS,
    maxPerSpectrum = 3,
  } = options;

  const diagnostic = buildDiagnosticPrompt(rssSpectra);
  console.log(`[RSS-Direct] topic="${topic}" articles=${diagnostic.totalArticles} spectra=${diagnostic.coveredSpectra}/5 estimatedTokens~${diagnostic.estimatedInputTokens}`);

  // If RSS found nothing at all, skip Gemini — return degraded immediately
  if (diagnostic.totalArticles === 0) {
    console.warn('[RSS-Direct] No RSS articles found — returning degraded result');
    return { analysis: buildEmptyFallback(topic), degraded: true, meta: diagnostic };
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = buildRSSContextPrompt(topic, language, rssSpectra, maxPerSpectrum);

  const startMs = Date.now();

  let raw;
  try {
    const result = await Promise.race([
      model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:    0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json', // guaranteed valid JSON — no repair needed
          thinkingConfig: { thinkingBudget: 0 }, // no discovery needed — RSS already found articles
        },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('RSS-Direct Gemini timed out')), timeoutMs)
      ),
    ]);

    raw = result.response.text();
  } catch (err) {
    console.error(`[RSS-Direct] Gemini call failed: ${err.message}`);
    return { analysis: buildEmptyFallback(topic), degraded: true, meta: { ...diagnostic, error: err.message } };
  }

  const elapsedMs = Date.now() - startMs;
  console.log(`[RSS-Direct] Gemini responded in ${elapsedMs}ms, raw length=${raw?.length}`);

  let analysis;
  try {
    // With responseMimeType: 'application/json', raw should already be valid JSON.
    // extractJSON as fallback in case of any wrapping.
    analysis = raw.trim().startsWith('{') ? JSON.parse(raw) : extractJSON(raw);
  } catch (err) {
    console.error(`[RSS-Direct] JSON parse failed: ${err.message}`);
    return { analysis: buildEmptyFallback(topic), degraded: true, meta: { ...diagnostic, error: 'json_parse_error', elapsedMs } };
  }

  if (!validateAnalysisStructure(analysis)) {
    console.error('[RSS-Direct] validateAnalysisStructure failed');
    return { analysis: buildEmptyFallback(topic), degraded: true, meta: { ...diagnostic, error: 'validation_failed', elapsedMs } };
  }

  const meta = {
    ...diagnostic,
    elapsedMs,
    mode: 'rss_direct',
    inputTokensEstimate: diagnostic.estimatedInputTokens,
  };

  console.log(`[RSS-Direct] ✅ success in ${elapsedMs}ms`);
  return { analysis, degraded: false, meta };
}
