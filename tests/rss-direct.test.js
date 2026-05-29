/**
 * tests/rss-direct.test.js
 *
 * Comprehensive test suite for the RSS-direct (no-grounding) architecture:
 *   - lib/buildRSSPrompt.js  — prompt builder
 *   - lib/rssDirectAnalysis.js — Gemini caller (Gemini mocked at module level)
 *
 * Coverage:
 *   1. buildRSSContextPrompt — structure, language, token budget, edge cases
 *   2. buildDiagnosticPrompt — counts, estimates
 *   3. countCoveredSpectra   — logic
 *   4. estimateContextTokens — rough accuracy
 *   5. callGeminiWithRSSContext — success path, degraded paths, timeout, JSON errors
 *   6. Cost / speed projection — deterministic unit math
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildRSSContextPrompt,
  buildDiagnosticPrompt,
  countCoveredSpectra,
  estimateContextTokens,
} from '../lib/buildRSSPrompt.js';
import {
  detectSearchReportLanguage,
  buildServerSideSummary,
} from '../lib/rssDirectAnalysis.js';

// ── Module-level mock (hoisted by Vitest) ─────────────────────────────────────
// vi.hoisted() ensures mockGenerateContent is defined BEFORE vi.mock() runs,
// so the factory closure can safely reference it.
// GoogleGenerativeAI must be mocked as a real constructor (regular function/class),
// not an arrow function — arrow functions cannot be called with `new`.

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(function () {
    this.getGenerativeModel = vi.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    });
  }),
}));

// Import after mock is set up
import { callGeminiWithRSSContext } from '../lib/rssDirectAnalysis.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const SPECTRUM_ORDER = ['left', 'center_left', 'center', 'center_right', 'right'];

/** Minimal valid RSS article */
function makeArticle(overrides = {}) {
  return {
    source_name:   'Tagesschau',
    source_domain: 'tagesschau.de',
    article_title: 'Scholz kündigt Rentenreform an',
    article_url:   'https://tagesschau.de/article/1',
    description:   'Der Bundeskanzler hat heute eine umfassende Reform des Rentensystems angekündigt.',
    pubDate:       '2025-05-20T10:00:00Z',
    score:         2,
    ...overrides,
  };
}

/** Build a full rssSpectra object with configurable article counts per spectrum */
function makeSpectra(counts = {}) {
  const spectra = {};
  for (const s of SPECTRUM_ORDER) {
    const n = counts[s] ?? 2;
    spectra[s] = {
      articles: Array.from({ length: n }, (_, i) =>
        makeArticle({
          source_name:   `Source-${s}-${i}`,
          source_domain: `${s}-${i}.de`,
          article_title: `Artikel ${i + 1} von ${s}`,
          description:   `Beschreibung ${i + 1} für Thema aus ${s} Perspektive.`,
          pubDate:       `2025-05-${String(20 + i).padStart(2, '0')}T10:00:00Z`,
        })
      ),
    };
  }
  return spectra;
}

/** Empty spectra (no articles in any spectrum) */
const EMPTY_SPECTRA = Object.fromEntries(
  SPECTRUM_ORDER.map(s => [s, { articles: [] }])
);

/** Build a valid analysis JSON that passes validateAnalysisStructure */
function makeValidAnalysis(topic = 'Rentenreform') {
  return {
    analysis_topic: topic,
    response_language: 'de',
    overall_non_partisan_analysis:
      'Die deutsche Medienlandschaft berichtet umfassend über die Rentenreform und zeigt verschiedene Perspektiven auf.',
    news_spectrum: {
      left:         [{ source_name: 'taz',        source_domain: 'taz.de',        article_title: 'Rente ist Menschenrecht',       summary_of_perspective: 'Die taz betont soziale Gerechtigkeit.' }],
      center_left:  [{ source_name: 'Spiegel',    source_domain: 'spiegel.de',    article_title: 'Rentenreform: Was ändert sich?', summary_of_perspective: 'Spiegel beleuchtet die Auswirkungen.' }],
      center:       [{ source_name: 'Tagesschau', source_domain: 'tagesschau.de', article_title: 'Scholz stellt Reform vor',        summary_of_perspective: 'Tagesschau berichtet sachlich neutral.' }],
      center_right: [{ source_name: 'FAZ',        source_domain: 'faz.net',       article_title: 'Reform belastet Wirtschaft',     summary_of_perspective: 'FAZ fokussiert wirtschaftliche Kosten.' }],
      right:        [{ source_name: 'Bild',       source_domain: 'bild.de',       article_title: 'Renten-Schock!',                 summary_of_perspective: 'Bild alarmiert deutsche Rentner.' }],
    },
  };
}

/** Helper: set mockGenerateContent to resolve with a given JSON string */
function mockGeminiSuccess(analysis) {
  mockGenerateContent.mockResolvedValue({
    response: { text: () => JSON.stringify(analysis) },
  });
}

/** Helper: set mockGenerateContent to reject */
function mockGeminiError(message) {
  mockGenerateContent.mockRejectedValue(new Error(message));
}

// Reset mock before each test to avoid cross-test bleed
beforeEach(() => {
  mockGenerateContent.mockReset();
  mockGeminiSuccess(makeValidAnalysis());
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. countCoveredSpectra
// ─────────────────────────────────────────────────────────────────────────────

describe('countCoveredSpectra', () => {
  it('returns 5 when all spectra have articles', () => {
    expect(countCoveredSpectra(makeSpectra())).toBe(5);
  });

  it('returns 0 for empty spectra', () => {
    expect(countCoveredSpectra(EMPTY_SPECTRA)).toBe(0);
  });

  it('counts only spectra with at least 1 article', () => {
    const spectra = makeSpectra({ left: 0, right: 0, center: 3 });
    // left=0, center_left=2, center=3, center_right=2, right=0 → 3 covered
    expect(countCoveredSpectra(spectra)).toBe(3);
  });

  it('handles missing spectrum key gracefully', () => {
    const spectra = makeSpectra();
    delete spectra.left;
    expect(countCoveredSpectra(spectra)).toBe(4);
  });

  it('handles null articles array', () => {
    const spectra = { ...makeSpectra(), left: { articles: null } };
    expect(countCoveredSpectra(spectra)).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. estimateContextTokens
// ─────────────────────────────────────────────────────────────────────────────

describe('estimateContextTokens', () => {
  it('returns 0 for empty spectra', () => {
    expect(estimateContextTokens(EMPTY_SPECTRA)).toBe(0);
  });

  it('returns a positive number for non-empty spectra', () => {
    const tokens = estimateContextTokens(makeSpectra());
    expect(tokens).toBeGreaterThan(0);
  });

  it('returns more tokens for more articles per spectrum', () => {
    const small = estimateContextTokens(makeSpectra(), 1);
    const large = estimateContextTokens(makeSpectra(), 5);
    expect(large).toBeGreaterThan(small);
  });

  it('respects maxPerSpectrum cap', () => {
    const spectra = makeSpectra({ center: 10 });
    const capped   = estimateContextTokens(spectra, 2);
    const baseline = estimateContextTokens(makeSpectra({ center: 2 }), 2);
    // With cap of 2, having 10 articles should give same result as having 2
    expect(capped).toBe(baseline);
  });

  it('scales roughly linearly with article count', () => {
    const oneArt   = makeSpectra({ center: 1, left: 0, center_left: 0, center_right: 0, right: 0 });
    const threeArt = makeSpectra({ center: 3, left: 0, center_left: 0, center_right: 0, right: 0 });
    const one   = estimateContextTokens(oneArt, 1);
    const three = estimateContextTokens(threeArt, 3);
    expect(three).toBeGreaterThan(one * 2);
    expect(three).toBeLessThan(one * 4);
  });

  it('truncates description to 400 chars in estimate', () => {
    const longDesc  = 'x'.repeat(800);
    const shortDesc = 'x'.repeat(400);
    const long  = { ...EMPTY_SPECTRA, center: { articles: [makeArticle({ description: longDesc })] } };
    const short = { ...EMPTY_SPECTRA, center: { articles: [makeArticle({ description: shortDesc })] } };
    expect(estimateContextTokens(long, 1)).toBe(estimateContextTokens(short, 1));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. buildDiagnosticPrompt
// ─────────────────────────────────────────────────────────────────────────────

describe('buildDiagnosticPrompt', () => {
  it('returns correct total article count', () => {
    const spectra = makeSpectra({ left: 3, center_left: 2, center: 1, center_right: 4, right: 0 });
    expect(buildDiagnosticPrompt(spectra).totalArticles).toBe(10);
  });

  it('returns per-spectrum counts', () => {
    const spectra = makeSpectra({ left: 3, center: 1, right: 0 });
    const diag = buildDiagnosticPrompt(spectra);
    expect(diag.perSpectrum.left).toBe(3);
    expect(diag.perSpectrum.center).toBe(1);
    expect(diag.perSpectrum.right).toBe(0);
  });

  it('returns coveredSpectra count', () => {
    const spectra = makeSpectra({ left: 0, right: 0 });
    expect(buildDiagnosticPrompt(spectra).coveredSpectra).toBe(3);
  });

  it('returns estimatedInputTokens > 0 for non-empty spectra', () => {
    expect(buildDiagnosticPrompt(makeSpectra()).estimatedInputTokens).toBeGreaterThan(0);
  });

  it('returns all zeros for empty spectra', () => {
    const diag = buildDiagnosticPrompt(EMPTY_SPECTRA);
    expect(diag.totalArticles).toBe(0);
    expect(diag.coveredSpectra).toBe(0);
    expect(diag.estimatedInputTokens).toBe(0);
  });

  it('has all five spectrum keys in perSpectrum', () => {
    expect(Object.keys(buildDiagnosticPrompt(makeSpectra()).perSpectrum)).toEqual(SPECTRUM_ORDER);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. buildRSSContextPrompt — structure
// ─────────────────────────────────────────────────────────────────────────────

describe('buildRSSContextPrompt — structure', () => {
  const spectra = makeSpectra();
  let prompt;

  beforeEach(() => {
    prompt = buildRSSContextPrompt('Rentenreform 2025', 'de', spectra, 3);
  });

  it('includes the topic', () => {
    expect(prompt).toContain('Rentenreform 2025');
  });

  it('includes today\'s date in ISO format', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(prompt).toContain(today);
  });

  it('contains all five spectrum labels', () => {
    expect(prompt).toContain('LEFT');
    expect(prompt).toContain('CENTER-LEFT');
    expect(prompt).toContain('CENTER');
    expect(prompt).toContain('CENTER-RIGHT');
    expect(prompt).toContain('RIGHT');
  });

  it('includes article titles from all spectra', () => {
    for (const s of SPECTRUM_ORDER) {
      expect(prompt).toContain(`Artikel 1 von ${s}`);
    }
  });

  it('includes source names', () => {
    expect(prompt).toContain('Source-left-0');
    expect(prompt).toContain('Source-center-0');
  });

  it('includes descriptions', () => {
    expect(prompt).toContain('Perspektive.');
  });

  it('contains the required JSON keys in the output template', () => {
    expect(prompt).toContain('"analysis_topic"');
    expect(prompt).toContain('"overall_non_partisan_analysis"');
    expect(prompt).toContain('"news_spectrum"');
    expect(prompt).toContain('"summary_of_perspective"');
    expect(prompt).toContain('"source_name"');
    expect(prompt).toContain('"source_domain"');
  });

  it('instructs Gemini NOT to search the internet', () => {
    expect(prompt).toContain('DO NOT search the internet');
    expect(prompt).toContain('ONLY use the articles provided below');
  });

  it('instructs to output ONLY JSON (no markdown)', () => {
    expect(prompt).toContain('Output ONLY the JSON object');
  });

  it('includes all coverage estimate labels', () => {
    expect(prompt).toContain('"high"');
    expect(prompt).toContain('"medium"');
    expect(prompt).toContain('"low"');
    expect(prompt).toContain('"none"');
  });

  it('is a non-empty string over 200 chars', () => {
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. buildRSSContextPrompt — language support
// ─────────────────────────────────────────────────────────────────────────────

describe('buildRSSContextPrompt — language', () => {
  const spectra = makeSpectra();

  it('outputs "German" for language de', () => {
    expect(buildRSSContextPrompt('Test', 'de', spectra)).toContain('German');
  });

  it('outputs "English" for language en', () => {
    expect(buildRSSContextPrompt('Test', 'en', spectra)).toContain('English');
  });

  it('outputs "Russian" for language ru', () => {
    expect(buildRSSContextPrompt('Test', 'ru', spectra)).toContain('Russian');
  });

  it('falls back to German for unknown language code', () => {
    expect(buildRSSContextPrompt('Test', 'zz', spectra)).toContain('German');
  });

  it('embeds response_language in JSON template', () => {
    expect(buildRSSContextPrompt('Test', 'en', spectra)).toContain('"response_language": "en"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. buildRSSContextPrompt — maxPerSpectrum token budget
// ─────────────────────────────────────────────────────────────────────────────

describe('buildRSSContextPrompt — maxPerSpectrum', () => {
  it('includes at most maxPerSpectrum articles per spectrum', () => {
    const spectra = makeSpectra({ center: 5 });
    const prompt1 = buildRSSContextPrompt('Test', 'de', spectra, 1);
    const prompt3 = buildRSSContextPrompt('Test', 'de', spectra, 3);
    expect(prompt1).toContain('Artikel 1 von center');
    expect(prompt1).not.toContain('Artikel 2 von center');
    expect(prompt3).toContain('Artikel 1 von center');
    expect(prompt3).toContain('Artikel 2 von center');
  });

  it('larger maxPerSpectrum produces a longer prompt', () => {
    const spectra = makeSpectra({ center: 5 });
    const small = buildRSSContextPrompt('Test', 'de', spectra, 1);
    const large = buildRSSContextPrompt('Test', 'de', spectra, 5);
    expect(large.length).toBeGreaterThan(small.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. buildRSSContextPrompt — edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('buildRSSContextPrompt — edge cases', () => {
  it('handles empty spectra gracefully (no crash)', () => {
    expect(() => buildRSSContextPrompt('Test', 'de', EMPTY_SPECTRA)).not.toThrow();
  });

  it('shows "Keine Artikel" placeholder for empty spectra', () => {
    const prompt = buildRSSContextPrompt('Test', 'de', EMPTY_SPECTRA);
    expect(prompt).toContain('Keine Artikel');
  });

  it('handles article without description', () => {
    const spectra = { ...EMPTY_SPECTRA, center: { articles: [makeArticle({ description: '' })] } };
    expect(() => buildRSSContextPrompt('Test', 'de', spectra)).not.toThrow();
    expect(buildRSSContextPrompt('Test', 'de', spectra)).toContain('Scholz kündigt Rentenreform an');
  });

  it('handles article without pubDate', () => {
    const spectra = { ...EMPTY_SPECTRA, center: { articles: [makeArticle({ pubDate: null })] } };
    expect(() => buildRSSContextPrompt('Test', 'de', spectra)).not.toThrow();
  });

  it('truncates long descriptions to 400 chars in the prompt', () => {
    const longDesc = 'Z'.repeat(800);
    const spectra = { ...EMPTY_SPECTRA, center: { articles: [makeArticle({ description: longDesc })] } };
    const prompt = buildRSSContextPrompt('Test', 'de', spectra);
    expect(prompt).toContain('Z'.repeat(400));
    expect(prompt).not.toContain('Z'.repeat(401));
  });

  it('includes total article count in prompt header', () => {
    const spectra = makeSpectra({ left: 2, center_left: 0, center: 1, center_right: 3, right: 0 });
    const prompt = buildRSSContextPrompt('Test', 'de', spectra);
    expect(prompt).toContain('6 total');
  });

  it('handles special characters in topic without crashing', () => {
    expect(() => buildRSSContextPrompt('A & B: "Test" <test>', 'de', EMPTY_SPECTRA)).not.toThrow();
    const prompt = buildRSSContextPrompt('A & B: "Test" <test>', 'de', EMPTY_SPECTRA);
    expect(prompt).toContain('A & B');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. callGeminiWithRSSContext — happy path
// ─────────────────────────────────────────────────────────────────────────────

describe('callGeminiWithRSSContext — happy path', () => {
  it('returns degraded=false on success', async () => {
    const result = await callGeminiWithRSSContext('Rentenreform', 'de', makeSpectra());
    expect(result.degraded).toBe(false);
  });

  it('returns the analysis object', async () => {
    const result = await callGeminiWithRSSContext('Rentenreform', 'de', makeSpectra());
    expect(result.analysis).toBeDefined();
    expect(result.analysis.overall_non_partisan_analysis).toBeTruthy();
  });

  it('returns correct analysis_topic', async () => {
    const result = await callGeminiWithRSSContext('Rentenreform', 'de', makeSpectra());
    expect(result.analysis.analysis_topic).toBe('Rentenreform');
  });

  it('returns news_spectrum with all five keys as arrays', async () => {
    const result = await callGeminiWithRSSContext('Rentenreform', 'de', makeSpectra());
    for (const s of SPECTRUM_ORDER) {
      expect(Array.isArray(result.analysis.news_spectrum[s])).toBe(true);
    }
  });

  it('meta contains elapsedMs >= 0', async () => {
    const result = await callGeminiWithRSSContext('Rentenreform', 'de', makeSpectra());
    expect(result.meta.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('meta contains mode=rss_direct', async () => {
    const result = await callGeminiWithRSSContext('Rentenreform', 'de', makeSpectra());
    expect(result.meta.mode).toBe('rss_direct');
  });

  it('meta contains article count data', async () => {
    const spectra = makeSpectra({ left: 3, center: 1, right: 2 });
    const result = await callGeminiWithRSSContext('Test', 'de', spectra);
    expect(result.meta.totalArticles).toBeGreaterThan(0);
    expect(result.meta.coveredSpectra).toBeGreaterThan(0);
  });

  it('meta.inputTokensEstimate is a positive number', async () => {
    const result = await callGeminiWithRSSContext('Test', 'de', makeSpectra());
    expect(result.meta.inputTokensEstimate).toBeGreaterThan(0);
  });

  it('handles JSON wrapped in markdown code fences (fallback repair)', async () => {
    const wrapped = '```json\n' + JSON.stringify(makeValidAnalysis()) + '\n```';
    mockGenerateContent.mockResolvedValue({ response: { text: () => wrapped } });
    const result = await callGeminiWithRSSContext('Rentenreform', 'de', makeSpectra());
    expect(result.degraded).toBe(false);
    expect(result.analysis.analysis_topic).toBe('Rentenreform');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. callGeminiWithRSSContext — degraded path: no articles
// ─────────────────────────────────────────────────────────────────────────────

describe('callGeminiWithRSSContext — degraded: no articles', () => {
  it('returns degraded=true immediately when 0 RSS articles', async () => {
    const result = await callGeminiWithRSSContext('Test', 'de', EMPTY_SPECTRA);
    expect(result.degraded).toBe(true);
  });

  it('fallback analysis contains the topic', async () => {
    const result = await callGeminiWithRSSContext('Klimawandel', 'de', EMPTY_SPECTRA);
    expect(result.analysis.analysis_topic).toBe('Klimawandel');
  });

  it('fallback overall_analysis mentions no articles found', async () => {
    const result = await callGeminiWithRSSContext('Test', 'de', EMPTY_SPECTRA);
    expect(result.analysis.overall_non_partisan_analysis).toContain('keine');
  });

  it('fallback news_spectrum has all five keys', async () => {
    const result = await callGeminiWithRSSContext('Test', 'de', EMPTY_SPECTRA);
    for (const s of SPECTRUM_ORDER) {
      expect(result.analysis.news_spectrum[s]).toBeDefined();
    }
  });

  it('does not call Gemini when 0 articles', async () => {
    mockGenerateContent.mockReset(); // reset call count
    await callGeminiWithRSSContext('Test', 'de', EMPTY_SPECTRA);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. callGeminiWithRSSContext — degraded: error paths
// ─────────────────────────────────────────────────────────────────────────────

describe('callGeminiWithRSSContext — degraded: errors', () => {
  it('returns degraded on Gemini API error', async () => {
    mockGeminiError('API quota exceeded');
    const result = await callGeminiWithRSSContext('Test', 'de', makeSpectra());
    expect(result.degraded).toBe(true);
    expect(result.meta.error).toContain('API quota exceeded');
  });

  it('returns degraded when Gemini returns invalid JSON', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'This is not JSON at all — plain text response' },
    });
    const result = await callGeminiWithRSSContext('Test', 'de', makeSpectra());
    expect(result.degraded).toBe(true);
  });

  it('meta.error is set when JSON parse fails', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'not json' },
    });
    const result = await callGeminiWithRSSContext('Test', 'de', makeSpectra());
    expect(result.meta.error).toBeDefined();
  });

  it('returns degraded when Gemini response fails structural validation', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify({ analysis_topic: 'X' }) }, // missing required fields
    });
    const result = await callGeminiWithRSSContext('Test', 'de', makeSpectra());
    expect(result.degraded).toBe(true);
    expect(result.meta.error).toBe('validation_failed');
  });

  it('returns degraded when Gemini times out', async () => {
    vi.useFakeTimers();
    mockGenerateContent.mockImplementation(() => new Promise(() => {})); // never resolves
    const resultPromise = callGeminiWithRSSContext('Test', 'de', makeSpectra(), { timeoutMs: 100 });
    vi.advanceTimersByTime(200);
    const result = await resultPromise;
    expect(result.degraded).toBe(true);
    expect(result.meta.error).toContain('timed out');
    vi.useRealTimers();
  });

  it('fallback analysis still has correct analysis_topic on error', async () => {
    mockGeminiError('Network error');
    const result = await callGeminiWithRSSContext('Bundestagswahl', 'de', makeSpectra());
    expect(result.analysis.analysis_topic).toBe('Bundestagswahl');
  });

  it('fallback news_spectrum search URLs contain the topic', async () => {
    mockGeminiError('Network error');
    const result = await callGeminiWithRSSContext('Klimawandel', 'de', makeSpectra());
    const leftArticle = result.analysis.news_spectrum.left[0];
    expect(leftArticle.article_url).toContain('Klimawandel');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Cost / speed analysis — deterministic unit math
// ─────────────────────────────────────────────────────────────────────────────

describe('Cost analysis: RSS-direct vs grounding (unit estimates)', () => {
  /**
   * Grounding cost (Gemini 2.5 Flash, 2025 pricing):
   *   - googleSearch grounding:  $35 / 1000 requests = $0.035/request
   *   - No grounding:            $0 grounding cost
   *
   * Token costs (Gemini 2.5 Flash):
   *   - Input:  $0.075 / 1M tokens (≤200k context)
   *   - Output: $0.30  / 1M tokens
   *
   * Assumptions for projection:
   *   - 5 spectra × 3 articles = 15 articles in prompt (typical full result)
   *   - ~500 tokens for prompt template boilerplate
   *   - ~1200 tokens output (analysis JSON with 5 perspectives + overall)
   */

  const GROUNDING_COST_PER_REQUEST = 0.035;        // USD
  const INPUT_COST_PER_TOKEN  = 0.075 / 1_000_000; // USD
  const OUTPUT_COST_PER_TOKEN = 0.30  / 1_000_000; // USD
  const ESTIMATED_OUTPUT_TOKENS = 1200;
  const PROMPT_TEMPLATE_OVERHEAD_TOKENS = 500;

  function estimatePerRequestCost(spectra, maxPerSpectrum = 3) {
    const inputTokens = estimateContextTokens(spectra, maxPerSpectrum) + PROMPT_TEMPLATE_OVERHEAD_TOKENS;
    return (inputTokens * INPUT_COST_PER_TOKEN) + (ESTIMATED_OUTPUT_TOKENS * OUTPUT_COST_PER_TOKEN);
  }

  it('grounding cost per request is $0.035', () => {
    expect(GROUNDING_COST_PER_REQUEST).toBe(0.035);
  });

  it('RSS-direct input token cost is below $0.001/request for typical spectra (3 articles each)', () => {
    const spectra = makeSpectra();
    const inputCost = (estimateContextTokens(spectra, 3) + PROMPT_TEMPLATE_OVERHEAD_TOKENS) * INPUT_COST_PER_TOKEN;
    expect(inputCost).toBeLessThan(0.001);
  });

  it('total RSS-direct cost per request is at least 10x cheaper than grounding', () => {
    const rssCost = estimatePerRequestCost(makeSpectra(), 3);
    expect(rssCost * 10).toBeLessThan(GROUNDING_COST_PER_REQUEST);
  });

  it('at 1000 requests/day: grounding ~$35/day, RSS-direct < $2/day', () => {
    const DAILY = 1000;
    const groundingDaily = DAILY * GROUNDING_COST_PER_REQUEST;
    const rssDaily = DAILY * estimatePerRequestCost(makeSpectra(), 3);
    expect(groundingDaily).toBeGreaterThan(30); // ~$35
    expect(rssDaily).toBeLessThan(2);
  });

  it('at 10k requests/month: grounding ~$350, RSS-direct < $20', () => {
    const MONTHLY = 10_000;
    const groundingMonthly = MONTHLY * GROUNDING_COST_PER_REQUEST;
    const rssMonthly = MONTHLY * estimatePerRequestCost(makeSpectra(), 3);
    expect(groundingMonthly).toBeGreaterThan(300);
    expect(rssMonthly).toBeLessThan(20);
  });

  it('monthly savings at 10k requests exceeds $300', () => {
    const MONTHLY = 10_000;
    const savings = (MONTHLY * GROUNDING_COST_PER_REQUEST) - (MONTHLY * estimatePerRequestCost(makeSpectra(), 3));
    expect(savings).toBeGreaterThan(300);
  });

  it('RSS-direct is viable even at 100k requests/month (< $200 total)', () => {
    const MONTHLY = 100_000;
    const rssMonthly = MONTHLY * estimatePerRequestCost(makeSpectra(), 3);
    expect(rssMonthly).toBeLessThan(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. detectSearchReportLanguage
// ─────────────────────────────────────────────────────────────────────────────

describe('detectSearchReportLanguage', () => {
  it('returns valid=true for a clean factual summary', () => {
    const text = 'Die deutschen Medien berichten ausführlich über den Angriff auf das Holocaust-Mahnmal. Tagesschau und Spiegel betonen die Schwere der Tat.';
    expect(detectSearchReportLanguage(text).valid).toBe(true);
  });

  it('detects "The search showed no articles" pattern', () => {
    const text = 'The search for recent articles on this topic has shown that there have been no specific reports of such an incident in the last 90 days.';
    const result = detectSearchReportLanguage(text);
    expect(result.valid).toBe(false);
    expect(result.pattern).toBeTruthy();
  });

  it('detects "no specific reports were found" pattern', () => {
    const text = 'No specific reports of this kind were found in the German media landscape over the past three months.';
    expect(detectSearchReportLanguage(text).valid).toBe(false);
  });

  it('detects "search results indicate" pattern', () => {
    const text = 'Search results indicate that this event was not widely covered by German media.';
    expect(detectSearchReportLanguage(text).valid).toBe(false);
  });

  it('detects "could not find any articles" pattern', () => {
    const text = 'I could not find any articles about this specific incident in the provided context.';
    expect(detectSearchReportLanguage(text).valid).toBe(false);
  });

  it('detects "has shown that there have been no" pattern', () => {
    const text = 'Die Suche has shown that there have been no prominent incidents of this kind during this period.';
    expect(detectSearchReportLanguage(text).valid).toBe(false);
  });

  it('returns valid=true for empty-ish summaries that do not use search language', () => {
    const text = 'Zu diesem Thema liegt aktuell keine Berichterstattung in den deutschen Medien vor.';
    expect(detectSearchReportLanguage(text).valid).toBe(true);
  });

  it('returns valid=false for null/undefined input', () => {
    expect(detectSearchReportLanguage(null).valid).toBe(false);
    expect(detectSearchReportLanguage(undefined).valid).toBe(false);
  });

  it('returns valid=false for empty string', () => {
    expect(detectSearchReportLanguage('').valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. buildServerSideSummary
// ─────────────────────────────────────────────────────────────────────────────

describe('buildServerSideSummary', () => {
  it('lists covered spectra with article counts', () => {
    const spectra = makeSpectra({ left: 3, center_left: 2, center: 0, center_right: 1, right: 0 });
    const summary = buildServerSideSummary('Klimawandel', spectra);
    expect(summary).toContain('Linke Medien (3 Artikel)');
    expect(summary).toContain('Mitte-Links (2 Artikel)');
    expect(summary).toContain('Mitte-Rechts (1 Artikel)');
  });

  it('mentions silent spectra when others have coverage', () => {
    const spectra = makeSpectra({ left: 2, center_left: 0, center: 1, center_right: 0, right: 2 });
    const summary = buildServerSideSummary('Ukraine', spectra);
    expect(summary).toContain('Mitte-Links');
    expect(summary).toContain('Mitte-Rechts');
    // Should mention they don't cover
    expect(summary).toMatch(/berichten? nicht/);
  });

  it('returns "no coverage" message when all spectra are empty', () => {
    const spectra = makeSpectra({ left: 0, center_left: 0, center: 0, center_right: 0, right: 0 });
    const summary = buildServerSideSummary('UnbekanntesThema', spectra);
    expect(summary).toContain('keine aktuellen deutschen Medienberichte');
  });

  it('always includes the fallback label', () => {
    const summary = buildServerSideSummary('Test', makeSpectra());
    expect(summary).toContain('Automatische Zusammenfassung');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. callGeminiWithRSSContext — retry + validation
// ─────────────────────────────────────────────────────────────────────────────

describe('callGeminiWithRSSContext — output validation & retry', () => {
  it('returns analysis as-is when overall has no search-report language', async () => {
    mockGeminiSuccess(makeValidAnalysis());
    const { analysis, degraded, meta } = await callGeminiWithRSSContext('Rentenreform', 'de', makeSpectra());
    expect(degraded).toBe(false);
    expect(meta.overallPatched).toBe(false);
    expect(analysis.overall_non_partisan_analysis).toContain('Rentenreform');
  });

  it('retries and patches overall when search-report language detected with ≥3 articles', async () => {
    // First call returns search-report language
    const badAnalysis = makeValidAnalysis();
    badAnalysis.overall_non_partisan_analysis =
      'The search for recent articles on this topic has shown that there have been no specific reports in the last 90 days.';

    // Second call (retry) returns clean analysis
    const goodAnalysis = makeValidAnalysis();
    goodAnalysis.overall_non_partisan_analysis =
      'Die deutschen Medien berichten intensiv über das Thema Rentenreform.';

    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify(badAnalysis) } })
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify(goodAnalysis) } });

    const spectra = makeSpectra(); // 5 spectra × 2 articles = 10 ≥ 3
    const { analysis, degraded, meta } = await callGeminiWithRSSContext('Rentenreform', 'de', spectra);

    expect(degraded).toBe(false);
    expect(meta.overallPatched).toBe(false); // clean retry, no patching needed
    expect(analysis.overall_non_partisan_analysis).toContain('deutschen Medien berichten');
    // Gemini was called twice (initial + retry)
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('patches overall with server-side summary when retry still has search-report language', async () => {
    const badAnalysis = makeValidAnalysis();
    badAnalysis.overall_non_partisan_analysis =
      'Search results indicate that no articles were found for this topic.';

    // Both calls return bad analysis
    mockGenerateContent
      .mockResolvedValue({ response: { text: () => JSON.stringify(badAnalysis) } });

    const spectra = makeSpectra();
    const { analysis, degraded, meta } = await callGeminiWithRSSContext('Rentenreform', 'de', spectra);

    expect(degraded).toBe(false);
    expect(meta.overallPatched).toBe(true);
    // Server-side summary should be present
    expect(analysis.overall_non_partisan_analysis).toContain('Automatische Zusammenfassung');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry for topics with fewer than 3 RSS articles (search language may be accurate)', async () => {
    const badAnalysis = makeValidAnalysis();
    badAnalysis.overall_non_partisan_analysis =
      'No specific reports were found for this obscure topic.';

    mockGeminiSuccess(badAnalysis);

    // Only 1 article total → search language might be valid (topic genuinely not covered)
    const sparseSpectra = makeSpectra({ left: 1, center_left: 0, center: 0, center_right: 0, right: 0 });
    const { analysis, meta } = await callGeminiWithRSSContext('ObskuresThema', 'de', sparseSpectra);

    // No retry triggered — only 1 article
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(meta.overallPatched).toBe(false);
  });
});

// ── Hallucination filter ───────────────────────────────────────────────────────

describe('callGeminiWithRSSContext — hallucination filter', () => {
  const makeRssSpectra = () => ({
    left:         { articles: [{ article_title: 'Telekom und Ver.di einigen sich', source_name: 'taz', source_domain: 'taz.de' }] },
    center_left:  { articles: [{ article_title: 'Tarifvertrag bei der Deutschen Telekom', source_name: 'Spiegel', source_domain: 'spiegel.de' }] },
    center:       { articles: [] },
    center_right: { articles: [] },
    right:        { articles: [] },
  });

  const makeValidAnalysis = (rightArticles = []) => ({
    analysis_topic: 'Telekom Tarifvertrag',
    overall_non_partisan_analysis: 'Telekom und Ver.di haben einen neuen Tarifvertrag abgeschlossen.',
    news_spectrum: {
      left:         [{ source_name: 'taz', source_domain: 'taz.de', article_title: 'Telekom und Ver.di einigen sich', summary_of_perspective: 'taz-Sicht' }],
      center_left:  [{ source_name: 'Spiegel', source_domain: 'spiegel.de', article_title: 'Tarifvertrag bei der Deutschen Telekom', summary_of_perspective: 'Spiegel-Sicht' }],
      center:       [],
      center_right: [],
      right:        rightArticles,
    },
  });

  function mockGeminiWith(analysis) {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify(analysis) },
    });
  }

  beforeEach(() => mockGenerateContent.mockReset());

  it('keeps articles whose titles match RSS input (≥50% word overlap)', async () => {
    mockGeminiWith(makeValidAnalysis());
    const { analysis } = await callGeminiWithRSSContext('Telekom Tarifvertrag', 'de', makeRssSpectra());
    expect(analysis.news_spectrum.left).toHaveLength(1);
    expect(analysis.news_spectrum.left[0].article_title).toBe('Telekom und Ver.di einigen sich');
    expect(analysis.news_spectrum.center_left).toHaveLength(1);
  });

  it('removes fabricated articles from spectra that had NO RSS articles', async () => {
    // Gemini fabricated a right-spectrum article despite no RSS data for it
    const fabricated = { source_name: 'Bild', source_domain: 'bild.de', article_title: 'Contract until 2027 - Energie extends with Butler', summary_of_perspective: 'irrelevant' };
    mockGeminiWith(makeValidAnalysis([fabricated]));
    const { analysis } = await callGeminiWithRSSContext('Telekom Tarifvertrag', 'de', makeRssSpectra());
    // right had no RSS articles → anything Gemini returned is removed
    expect(analysis.news_spectrum.right).toHaveLength(0);
  });

  it('removes articles with low title overlap even when spectrum has RSS articles', async () => {
    // Gemini swapped the left article with an unrelated one
    const unrelated = { source_name: 'taz', source_domain: 'taz.de', article_title: 'Berufsverbote in Baden-Württemberg', summary_of_perspective: 'unrelated' };
    const spectra = makeRssSpectra();
    mockGeminiWith({
      ...makeValidAnalysis(),
      news_spectrum: { ...makeValidAnalysis().news_spectrum, left: [unrelated] },
    });
    const { analysis } = await callGeminiWithRSSContext('Telekom Tarifvertrag', 'de', spectra);
    // "Berufsverbote in Baden-Württemberg" has <50% overlap with "Telekom und Ver.di einigen sich"
    expect(analysis.news_spectrum.left).toHaveLength(0);
  });

  it('logs hallucination stats on the analysis object', async () => {
    const fabricated = { source_name: 'Bild', source_domain: 'bild.de', article_title: 'Energie Butler Contract', summary_of_perspective: 'x' };
    mockGeminiWith(makeValidAnalysis([fabricated]));
    const { analysis } = await callGeminiWithRSSContext('Telekom Tarifvertrag', 'de', makeRssSpectra());
    expect(analysis._hallucinationStats).toBeDefined();
    expect(analysis._hallucinationStats.right).toBe(1); // 1 fabricated article removed
    expect(analysis._hallucinationStats.left).toBe(0);  // real article kept
  });
});
