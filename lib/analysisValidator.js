/**
 * Analysis validation and prompt helpers.
 * Extracted from server.js for testability.
 */

export const SPECTRUMS = ['left', 'center_left', 'center', 'center_right', 'right'];

/**
 * Validate and normalize a Gemini analysis response.
 * Returns false if the structure is unsalvageable.
 * Side-effect: normalizes missing news_spectrum keys to [].
 */
export function validateAnalysisStructure(data) {
  if (!data || typeof data !== 'object') return false;
  if (!data.overall_non_partisan_analysis || !data.news_spectrum) return false;
  if (typeof data.news_spectrum !== 'object') return false;

  // Normalize: missing spectrum keys → empty array (RSS will fill gaps later)
  for (const key of SPECTRUMS) {
    if (!Array.isArray(data.news_spectrum[key])) {
      data.news_spectrum[key] = [];
    }
  }

  // Accept if overall analysis is non-empty (even if all spectra are empty)
  const hasArticles = SPECTRUMS.some(key => data.news_spectrum[key].length > 0);
  const hasAnalysis =
    typeof data.overall_non_partisan_analysis === 'string' &&
    data.overall_non_partisan_analysis.length > 20;

  return hasArticles || hasAnalysis;
}

/**
 * Build the full prompt for deep (comparative) analysis.
 * Passes up to MAX_ARTICLES_PER_SPECTRUM articles per spectrum so Gemini
 * has full context — not just the first article — for diverging points,
 * silenced topics, and keyword extraction.
 */
// Cap articles per spectrum fed into the deep (comparative) prompt. Comparative
// analysis is about CAMP-LEVEL framing, not per-article detail, so a representative
// subset suffices — and capping keeps the model's JSON output bounded. With the
// corpus path returning ~30 articles, the uncapped (Infinity) prompt produced
// oversized/complex output that intermittently came back as invalid JSON.
const MAX_ARTICLES_PER_SPECTRUM = 6;

export function buildDeepAnalysisPrompt(analysis) {
  const ns = analysis.news_spectrum;

  const isValidSource = a =>
    a && a.source_name &&
    a.source_name !== 'Kein Artikel gefunden' &&
    a.source_domain !== 'n/a';

  /**
   * Format all valid articles for one spectrum as a numbered list.
   * Returns a string like:
   *   taz, Spiegel, Zeit (3 Artikel):
   *     1. taz — "Messerangriff auf Holocaust-Mahnmal"
   *        Zusammenfassung: taz berichtet über den Angriff...
   *     2. Spiegel — "Täter festgenommen"
   *        Zusammenfassung: Der Spiegel schildert...
   *   → (no coverage) if no valid articles
   */
  const formatSpectrum = (spectrumKey, label) => {
    const arr  = Array.isArray(ns[spectrumKey]) ? ns[spectrumKey] : [];
    const real = arr.filter(isValidSource).slice(0, MAX_ARTICLES_PER_SPECTRUM);

    if (real.length === 0) {
      return `${label}:\n  [Keine Berichterstattung gefunden — mögliches Verschweigen]`;
    }

    const sourceNames = [...new Set(real.map(a => a.source_name))].join(', ');
    const lines = real.map((a, i) => {
      const title   = a.article_title            || '(kein Titel)';
      const summary = a.summary_of_perspective   || '(keine Zusammenfassung)';
      const date    = a.publication_date ? ` [${a.publication_date}]` : '';
      return `  ${i + 1}. ${a.source_name}${date} — "${title}"\n     Perspektive: ${summary}`;
    });

    return `${label} (${sourceNames}, ${real.length} Artikel):\n${lines.join('\n')}`;
  };

  const spectrumBlocks = [
    formatSpectrum('left',         'LINKS'),
    formatSpectrum('center_left',  'MITTE-LINKS'),
    formatSpectrum('center',       'MITTE'),
    formatSpectrum('center_right', 'MITTE-RECHTS'),
    formatSpectrum('right',        'RECHTS'),
  ].join('\n\n');

  return `Analyze how the German media spectrum covers a topic. You have up to ${MAX_ARTICLES_PER_SPECTRUM} representative articles per camp — analyse every article provided to capture each camp's framing.

TOPIC: "${analysis.analysis_topic}"

${spectrumBlocks}

OUTPUT RULES:
- Output ONLY the JSON object. No markdown, no code fences, no preamble.
- Response must start with { and end with }.
- Use EXACTLY these English keys — never translate them.
- All text VALUES must be in German.

REQUIRED JSON:
{
  "shared_facts": [
    { "claim": "<factual statement all five agree on>" }
  ],
  "diverging_points": [
    {
      "topic": "<area of divergence>",
      "left_view": "<how far-left frames it, 1 sentence>",
      "center_left_view": "<how center-left frames it, 1 sentence>",
      "center_view": "<how center frames it, 1 sentence>",
      "center_right_view": "<how center-right frames it, 1 sentence>",
      "right_view": "<how far-right frames it, 1 sentence>"
    }
  ],
  "silenced_topics": [
    {
      "topic": "<angle barely mentioned>",
      "only_in": "<left|center_left|center|center_right|right|none>",
      "description": "<1 sentence why this is notable>"
    }
  ],
  "keywords": {
    "left":         ["<word1>", "<word2>", "<word3>", "<word4>", "<word5>", "<word6>"],
    "center_left":  ["<word1>", "<word2>", "<word3>", "<word4>", "<word5>", "<word6>"],
    "center":       ["<word1>", "<word2>", "<word3>", "<word4>", "<word5>", "<word6>"],
    "center_right": ["<word1>", "<word2>", "<word3>", "<word4>", "<word5>", "<word6>"],
    "right":        ["<word1>", "<word2>", "<word3>", "<word4>", "<word5>", "<word6>"]
  },
  "sentiment": {
    "left":         "<positive|neutral|negative>",
    "center_left":  "<positive|neutral|negative>",
    "center":       "<positive|neutral|negative>",
    "center_right": "<positive|neutral|negative>",
    "right":        "<positive|neutral|negative>"
  },
  "experts_cited": {
    "left":         ["<Full Name or Institution>"],
    "center_left":  ["<Full Name or Institution>"],
    "center":       ["<Full Name or Institution>"],
    "center_right": ["<Full Name or Institution>"],
    "right":        ["<Full Name or Institution>"]
  },
  "coverage_volume": {
    "left":         { "week": 0, "month": 0 },
    "center_left":  { "week": 0, "month": 0 },
    "center":       { "week": 0, "month": 0 },
    "center_right": { "week": 0, "month": 0 },
    "right":        { "week": 0, "month": 0 }
  }
}

RULES:
- shared_facts: 2-4 facts ALL five camps agree on, derived from the articles above
- diverging_points: 2-4 areas of clear framing difference ACROSS the camps — use all articles, not just one per camp
- silenced_topics: 1-3 angles present in only one camp or absent from all.
  CRITICAL: if a camp shows "[Keine Berichterstattung gefunden]" OR its articles are CLEARLY about a different topic than "${analysis.analysis_topic}", mark it as silent with only_in: "none" and describe what's missing.
- keywords: 5-6 most characteristic/loaded words each camp uses across ALL its articles (in German)
- sentiment: overall tone of the camp's coverage across all its articles (positive/neutral/negative)
- experts_cited: real names explicitly mentioned across ALL articles for that camp (empty [] if none)
- coverage_volume: SET ALL VALUES TO 0. The server replaces these with real RSS data. Do not estimate.`;
}
