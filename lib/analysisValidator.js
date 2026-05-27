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
 * Safely falls back to EMPTY placeholder for any missing spectrum.
 */
export function buildDeepAnalysisPrompt(analysis) {
  const ns = analysis.news_spectrum;
  const EMPTY = { source_name: 'n/a', summary_of_perspective: 'Keine Berichterstattung gefunden.' };

  const isValidSource = a => a && a.source_name && a.source_name !== 'Kein Artikel gefunden';
  const first = s => {
    const arr = Array.isArray(ns[s]) ? ns[s] : (ns[s] ? [ns[s]] : []);
    // Find the first item with a real source name (not the "Kein Artikel gefunden" placeholder)
    const found = arr.find(isValidSource);
    if (found) return found;
    // If arr[0] exists but is the placeholder, still use EMPTY for a cleaner prompt
    const fallback = arr[0];
    if (fallback && isValidSource(fallback)) return fallback;
    return EMPTY;
  };

  return `Analyze how five German media outlets across the full political spectrum cover the same topic.

TOPIC: "${analysis.analysis_topic}"

LEFT (${first('left').source_name}): ${first('left').summary_of_perspective}
CENTER_LEFT (${first('center_left').source_name}): ${first('center_left').summary_of_perspective}
CENTER (${first('center').source_name}): ${first('center').summary_of_perspective}
CENTER_RIGHT (${first('center_right').source_name}): ${first('center_right').summary_of_perspective}
RIGHT (${first('right').source_name}): ${first('right').summary_of_perspective}

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
- shared_facts: 2-4 facts ALL five sides accept as true
- diverging_points: 2-4 areas where framing clearly differs
- silenced_topics: 1-3 angles present in only one outlet or absent from all. IMPORTANT: if an outlet's provided article is CLEARLY about a DIFFERENT topic than "${analysis.analysis_topic}", treat that outlet as having no coverage — note it in silenced_topics with only_in: "none" and describe the gap.
- keywords: 5-6 most characteristic/loaded words or phrases each outlet uses (in German)
- sentiment: overall tone of the outlet's coverage (positive/neutral/negative)
- experts_cited: real names of politicians, scientists, officials, or institutions explicitly mentioned in each outlet's coverage (empty array [] if none)
- coverage_volume: SET ALL VALUES TO 0. The server replaces these with real RSS data. Do not estimate or invent numbers.`;
}
