/**
 * lib/rssDirectAnalysis.js
 *
 * RSS-Direct Gemini analysis path (production architecture since 2025).
 *
 * Architecture:
 *   - No googleSearch tool → no grounding cost
 *   - RSS articles fetched first, passed as context in the prompt
 *   - responseMimeType: 'application/json' → guaranteed valid JSON
 *   - Fast: no Google Search round-trip (~3-10s vs ~15-30s for grounding)
 *   - Hallucination filter: removes Gemini-fabricated articles post-call
 *
 * Returns { analysis, degraded, meta } — same shape consumed by enrichWithRSSData.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildRSSContextPrompt, buildDiagnosticPrompt } from './buildRSSPrompt.js';
import { validateAnalysisStructure } from './analysisValidator.js';
import { extractJSON } from './utils.js';

const SPECTRUM_ORDER = ['left', 'center_left', 'center', 'center_right', 'right'];

const rawKey = process.env.GEMINI_API_KEY || '';
const GEMINI_API_KEY = rawKey.replace(/["']/g, '').trim();

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ── Timeout constants ─────────────────────────────────────────────────────────
// No grounding = no Google Search round-trip → faster response budget.
const IS_PRODUCTION = !!process.env.RAILWAY_ENVIRONMENT;
// With thinkingBudget:0 and no search, Gemini 2.5 Flash should respond in 3-10s.
// We give generous budget for safety.
const DEFAULT_TIMEOUT_MS = IS_PRODUCTION ? 45000 : 60000;

// ── Output validation ─────────────────────────────────────────────────────────

/**
 * Patterns that indicate Gemini reverted to "search report" mode instead of
 * analysing the provided RSS articles. These appear in overall_non_partisan_analysis
 * when the model ignores its RSS context and behaves like a grounding search.
 */
const SEARCH_REPORT_PATTERNS = [
  /the search (for|showed?|returned|found)/i,
  /search results? (indicate|show|suggest|reveal)/i,
  /no (specific |relevant |prominent |major )?reports? .{0,40}(found|identified|located)/i,
  /no (specific |recent |relevant )?(incidents?|events?|articles?) .{0,40}(found|identified|reported)/i,
  /searching .{0,30}(returned|showed?|found) no/i,
  /there (have been |were )?no (specific |recent )?reports?/i,
  /has shown that there (have been |were )?no/i,
  /does not appear to have been (widely )?covered/i,
  /could not (find|locate|identify) (any |specific )?articles?/i,
];

/**
 * Check whether Gemini's overall_non_partisan_analysis contains search-report
 * language — i.e. the model described its own failed "search" instead of
 * analysing the RSS articles provided.
 *
 * @param {string} overallText
 * @returns {{ valid: boolean, pattern: string|null }}
 */
export function detectSearchReportLanguage(overallText) {
  if (!overallText || typeof overallText !== 'string') {
    return { valid: false, pattern: 'empty_or_invalid' };
  }
  for (const re of SEARCH_REPORT_PATTERNS) {
    if (re.test(overallText)) {
      return { valid: false, pattern: re.source };
    }
  }
  return { valid: true, pattern: null };
}

/**
 * Generate a reliable server-side overall summary from RSS article titles.
 * Used as last-resort fallback when Gemini refuses to summarize provided articles.
 *
 * @param {string} topic
 * @param {object} rssSpectra
 * @returns {string}
 */
export function buildServerSideSummary(topic, rssSpectra) {
  const SPECTRUM_LABELS = {
    left:         'Linke Medien',
    center_left:  'Mitte-Links',
    center:       'Öffentlich-Rechtliche',
    center_right: 'Mitte-Rechts',
    right:        'Rechte Medien',
  };
  const covered   = [];
  const silent    = [];

  for (const [sp, label] of Object.entries(SPECTRUM_LABELS)) {
    const arts = rssSpectra[sp]?.articles || [];
    if (arts.length > 0) {
      covered.push(`${label} (${arts.length} Artikel)`);
    } else {
      silent.push(label);
    }
  }

  const coveragePart = covered.length > 0
    ? `Das Thema wird von ${covered.join(', ')} abgedeckt.`
    : `Zu diesem Thema wurden in den RSS-Feeds keine aktuellen deutschen Medienberichte gefunden.`;

  const silencePart = silent.length > 0 && covered.length > 0
    ? ` ${silent.join(', ')} berichten ${silent.length === 1 ? 'nicht' : 'nicht oder kaum'} über dieses Thema.`
    : '';

  return `${coveragePart}${silencePart} (Automatische Zusammenfassung basierend auf RSS-Daten — keine KI-Analyse verfügbar.)`;
}

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

// extractJSON imported from ./utils.js

/**
 * Make a single Gemini API call with the given prompt and return parsed analysis.
 * Returns { parsed, error } — parsed is null on failure, error is the message.
 */
async function callGeminiOnce(model, prompt, timeoutMs, maxOutputTokens = 4096) {
  let raw;
  try {
    const result = await Promise.race([
      model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:      0.2,
          maxOutputTokens,
          responseMimeType: 'application/json',
          thinkingConfig:   { thinkingBudget: 0 },
        },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('RSS-Direct Gemini timed out')), timeoutMs)
      ),
    ]);
    raw = result.response.text();
  } catch (err) {
    console.error(`[RSS-Direct] Gemini call failed: ${err.message}`);
    return { parsed: null, error: err.message };
  }

  try {
    let parsed;
    try {
      parsed = JSON.parse(raw);            // fast path (responseMimeType=json → starts with {)
    } catch {
      parsed = extractJSON(raw);           // repair path: trailing commas, control chars, truncation
    }
    return { parsed, error: null };
  } catch (err) {
    console.error(`[RSS-Direct] JSON parse failed: ${err.message}`);
    return { parsed: null, error: `json_parse_error: ${err.message}` };
  }
}

/**
 * Word-overlap score between two title strings (case-insensitive).
 * Uses words ≥ 4 chars to avoid noise from articles/prepositions.
 * Returns 0..1 — 1.0 = identical, 0 = no overlap.
 */
function titleOverlapScore(a, b) {
  const wordsA = (a || '').toLowerCase().split(/\s+/).filter(w => w.length >= 4);
  if (wordsA.length === 0) return 0;
  const bLower = (b || '').toLowerCase();
  const hits = wordsA.filter(w => bLower.includes(w)).length;
  return hits / wordsA.length;
}

/**
 * Remove articles Gemini fabricated (not present in the RSS input we gave it).
 * For each article in news_spectrum, checks if its title matches (≥ 50% word
 * overlap) any RSS article for that spectrum. Articles that don't match are
 * dropped — they were hallucinated from Gemini's training data.
 *
 * Attaches _hallucinationStats to the analysis for logging.
 */
function filterHallucinatedArticles(analysis, rssSpectra) {
  const stats = {};
  for (const spectrum of SPECTRUM_ORDER) {
    const rssArts  = rssSpectra[spectrum]?.articles || [];
    const gemArts  = Array.isArray(analysis.news_spectrum?.[spectrum])
      ? analysis.news_spectrum[spectrum]
      : [];

    if (rssArts.length === 0) {
      // No RSS articles for this spectrum → anything Gemini returned is fabricated
      stats[spectrum] = gemArts.length;
      analysis.news_spectrum[spectrum] = [];
      continue;
    }

    const real = gemArts.filter(art => {
      const gemTitle = art.article_title || '';
      // Accept if any RSS article has ≥50% title word overlap
      return rssArts.some(rss => titleOverlapScore(rss.article_title, gemTitle) >= 0.50
                               || titleOverlapScore(gemTitle, rss.article_title) >= 0.50);
    });
    stats[spectrum]                     = gemArts.length - real.length;
    analysis.news_spectrum[spectrum]    = real;
  }
  analysis._hallucinationStats = stats;
  return analysis;
}

/**
 * Call Gemini with RSS articles as context (no grounding).
 *
 * Includes output validation + 1 retry:
 *   - If Gemini's overall_non_partisan_analysis contains "search report" language
 *     (e.g. "The search showed no articles…") despite RSS articles being present,
 *     we retry once with an explicit corrective instruction.
 *   - If retry still fails validation, we patch overall_non_partisan_analysis
 *     with a server-generated summary from RSS article titles (reliable fallback).
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
  const startMs    = Date.now();
  console.log(`[RSS-Direct] topic="${topic}" articles=${diagnostic.totalArticles} spectra=${diagnostic.coveredSpectra}/5 estimatedTokens~${diagnostic.estimatedInputTokens}`);

  // If RSS found nothing at all, skip Gemini — return degraded immediately
  if (diagnostic.totalArticles === 0) {
    console.warn('[RSS-Direct] No RSS articles found — returning degraded result');
    return { analysis: buildEmptyFallback(topic), degraded: true, meta: { ...diagnostic, elapsedMs: Date.now() - startMs } };
  }

  const model     = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt    = buildRSSContextPrompt(topic, language, rssSpectra, maxPerSpectrum);

  // Scale output token budget with the number of articles we passed in.
  // Each article needs a ~2-3 sentence summary_of_perspective (~120 tokens) plus the
  // overall analysis and JSON scaffolding. A fixed 4096 cap truncated the JSON on
  // high-coverage topics, which produced json_parse_error → degraded result. With
  // the corpus path analysing many more articles per request, raise the ceiling to
  // 16384 (≈90 articles worth of summaries) so full-coverage analyses don't truncate.
  const maxOutputTokens = Math.min(16384, Math.max(4096, diagnostic.totalArticles * 160 + 1500));

  // ── Attempt 1 (+ one retry ONLY on a recoverable parse/shape failure) ──────
  // A single malformed-JSON response used to drop the whole analysis to a degraded
  // fallback (confidence floored). The parse repair can't fix every mid-array
  // glitch, so we re-ask once — at temperature 0.2 the retry almost always returns
  // valid JSON. We do NOT retry hard failures (timeout / API error): retrying a
  // timeout only doubles latency for the same outcome.
  let attempt1 = await callGeminiOnce(model, prompt, timeoutMs, maxOutputTokens);
  const recoverable = (attempt1.parsed && !validateAnalysisStructure(attempt1.parsed))
    || (typeof attempt1.error === 'string' && attempt1.error.startsWith('json_parse_error'));
  if (recoverable) {
    console.warn(`[RSS-Direct] Attempt 1 unusable (${attempt1.error || 'validation_failed'}) — retrying once`);
    attempt1 = await callGeminiOnce(model, prompt, timeoutMs, maxOutputTokens);
  }

  if (!attempt1.parsed || !validateAnalysisStructure(attempt1.parsed)) {
    const errMsg = attempt1.error || 'validation_failed';
    console.error(`[RSS-Direct] Attempts exhausted: ${errMsg} — returning degraded`);
    return {
      analysis: buildEmptyFallback(topic),
      degraded: true,
      meta: { ...diagnostic, error: errMsg, elapsedMs: Date.now() - startMs },
    };
  }

  let analysis = attempt1.parsed;

  // ── RSS truth check: remove hallucinated articles ─────────────────────────
  // Gemini sometimes fabricates articles for spectra where RSS had no coverage.
  // Any article whose title doesn't match (≥50% word overlap) a real RSS article
  // we provided is considered hallucinated and removed.
  analysis = filterHallucinatedArticles(analysis, rssSpectra);
  const removedCount = Object.values(analysis._hallucinationStats ?? {}).reduce((s, n) => s + n, 0);
  if (removedCount > 0) {
    console.warn(`[RSS-Direct] Hallucination filter: removed ${removedCount} fabricated articles`);
  }

  // ── Validate overall_non_partisan_analysis for search-report language ──────
  const overallCheck = detectSearchReportLanguage(analysis.overall_non_partisan_analysis);

  if (!overallCheck.valid && diagnostic.totalArticles >= 3) {
    console.warn(`[RSS-Direct] Search-report language detected (pattern: ${overallCheck.pattern}) — retrying`);

    // Build a corrective prompt that explicitly calls out the bad response
    const retryPrompt = `${prompt}

KORREKTUR-HINWEIS: Deine vorherige Antwort enthielt Formulierungen wie "die Suche ergab..." oder
"es wurden keine Artikel gefunden", obwohl dir oben ${diagnostic.totalArticles} echte RSS-Artikel
bereitgestellt wurden. Das ist falsch.

WICHTIG: Schreibe overall_non_partisan_analysis NUR auf Basis der oben genannten Artikel.
Beginne NICHT mit "Die Suche..." oder "Es wurden keine...". Fasse direkt zusammen, was diese
Medien berichten.`;

    const retry = await callGeminiOnce(model, retryPrompt, timeoutMs, maxOutputTokens);

    if (retry.parsed && validateAnalysisStructure(retry.parsed)) {
      const retryCheck = detectSearchReportLanguage(retry.parsed.overall_non_partisan_analysis);
      if (retryCheck.valid) {
        console.log('[RSS-Direct] Retry ✅ — search-report language resolved');
        analysis = retry.parsed;
      } else {
        // Retry still has search-report language → patch with server-side summary
        console.warn('[RSS-Direct] Retry still has search-report language — patching with server-side summary');
        retry.parsed.overall_non_partisan_analysis = buildServerSideSummary(topic, rssSpectra);
        retry.parsed._overallPatched = true;
        analysis = retry.parsed;
      }
    } else {
      // Retry failed validation → patch original
      console.warn('[RSS-Direct] Retry failed validation — patching original with server-side summary');
      analysis.overall_non_partisan_analysis = buildServerSideSummary(topic, rssSpectra);
      analysis._overallPatched = true;
    }
  }

  const elapsedMs = Date.now() - startMs;
  const meta = {
    ...diagnostic,
    elapsedMs,
    mode:                'rss_direct',
    inputTokensEstimate: diagnostic.estimatedInputTokens,
    overallPatched:      analysis._overallPatched ?? false,
  };

  console.log(`[RSS-Direct] ✅ success in ${elapsedMs}ms${analysis._overallPatched ? ' (overall patched)' : ''}`);
  return { analysis, degraded: false, meta };
}
