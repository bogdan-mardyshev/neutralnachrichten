/**
 * lib/buildRSSPrompt.js
 *
 * Builds a Gemini prompt that uses RSS articles as context instead of
 * Google Search grounding. This is the "no-grounding" architecture:
 *
 *   RSS feeds (real articles) → context in prompt → Gemini generates summaries
 *
 * vs current architecture:
 *
 *   Gemini + googleSearch → finds articles + generates summaries (grounding)
 *
 * What changes:
 *   - No googleSearch tool needed → eliminates $0.035/request grounding cost
 *   - Gemini gets real article titles + descriptions from RSS as input
 *   - Gemini only needs to: (1) write perspective summaries, (2) write overall analysis
 *   - URLs, dates, source names come directly from RSS (no hallucination risk)
 *
 * What stays the same:
 *   - JSON output schema identical to grounding path
 *   - enrichWithRSSData() still runs afterward (coverage_distribution etc.)
 *   - Validation and error handling unchanged
 */

const SPECTRUM_LABEL = {
  left:         'LEFT (linke Medien)',
  center_left:  'CENTER-LEFT (mitte-links Medien)',
  center:       'CENTER (öffentlich-rechtliche Medien)',
  center_right: 'CENTER-RIGHT (mitte-rechts Medien)',
  right:        'RIGHT (rechte Medien)',
};

const SPECTRUM_ORDER = ['left', 'center_left', 'center', 'center_right', 'right'];

/**
 * Format RSS articles for a single spectrum into a readable context block.
 * @param {string} spectrum
 * @param {Array}  articles  — from rssSearch.searchAllFeeds().spectra[spectrum].articles
 * @param {number} maxPerSpectrum — max articles to include (token budget)
 */
function formatSpectrumContext(spectrum, articles, maxPerSpectrum = 3) {
  const label = SPECTRUM_LABEL[spectrum];
  if (!articles || articles.length === 0) {
    return `${label}:\n  [Keine Artikel in RSS gefunden]`;
  }

  const selected = articles.slice(0, maxPerSpectrum);
  const lines = selected.map((art, i) => {
    const date = art.pubDate ? ` (${art.pubDate.slice(0, 10)})` : '';
    const desc = (art.description || '').trim().slice(0, 400);
    return [
      `  Artikel ${i + 1}: ${art.source_name}${date}`,
      `  Titel: ${art.article_title}`,
      desc ? `  Inhalt: ${desc}` : null,
    ].filter(Boolean).join('\n');
  });

  return `${label}:\n${lines.join('\n\n')}`;
}

/**
 * Count how many spectra have at least one article.
 */
export function countCoveredSpectra(rssSpectra) {
  return SPECTRUM_ORDER.filter(s => (rssSpectra[s]?.articles?.length ?? 0) > 0).length;
}

/**
 * Estimate token count for the RSS context (rough: 1 token ≈ 4 chars).
 */
export function estimateContextTokens(rssSpectra, maxPerSpectrum = 3) {
  let chars = 0;
  for (const s of SPECTRUM_ORDER) {
    const arts = (rssSpectra[s]?.articles || []).slice(0, maxPerSpectrum);
    for (const a of arts) {
      chars += (a.article_title || '').length;
      chars += (a.description || '').slice(0, 400).length;
      chars += (a.source_name || '').length + 50; // overhead
    }
  }
  return Math.ceil(chars / 4);
}

/**
 * Build the full prompt for the no-grounding Gemini call.
 *
 * @param {string} topic
 * @param {string} language   — 'de' | 'en' | 'ru'
 * @param {object} rssSpectra — from rssSearch.searchAllFeeds().spectra
 * @param {number} maxPerSpectrum — max articles per spectrum (token budget control)
 * @returns {string}
 */
export function buildRSSContextPrompt(topic, language, rssSpectra, maxPerSpectrum = 3) {
  const langNames = { de: 'German', en: 'English', ru: 'Russian' };
  const targetLang = langNames[language] || 'German';
  const today = new Date().toISOString().split('T')[0];

  // Build article context blocks
  const contextBlocks = SPECTRUM_ORDER.map(s =>
    formatSpectrumContext(s, rssSpectra[s]?.articles || [], maxPerSpectrum)
  ).join('\n\n');

  const totalArticles = SPECTRUM_ORDER.reduce(
    (sum, s) => sum + (rssSpectra[s]?.articles?.length ?? 0), 0
  );

  return `You are a German media analysis assistant. Today is ${today}.

Below are REAL articles from German media RSS feeds about the topic "${topic}".
Your task: analyze how different parts of the German media spectrum cover this topic.

DO NOT search the internet. DO NOT make up articles. ONLY use the articles provided below.
If an outlet has no articles below, note it as low/none coverage.

════════════════════════════════════════
ARTICLES FROM RSS (${totalArticles} total):
════════════════════════════════════════

${contextBlocks}

════════════════════════════════════════
YOUR TASK:
════════════════════════════════════════

1. Write an "overall_non_partisan_analysis": 3-4 sentences summarizing what the articles
   PROVIDED ABOVE collectively report about "${topic}" — factual, no bias, covering all angles present.
   IMPORTANT: Base this ONLY on the articles listed above. DO NOT write "the search showed",
   "search results indicate", "no articles were found", or any search-report language.
   If the provided articles are relevant: directly summarize what German media collectively says.
   If NO relevant articles were provided (all spectra show "[Keine Artikel in RSS gefunden]"):
   write exactly: "Die analysierten RSS-Feeds enthalten aktuell keine relevante Berichterstattung zu diesem Thema." (in German) or the equivalent in the target language.

2. For each spectrum, write a "summary_of_perspective" for each article:
   - 2-3 sentences describing THIS outlet's specific angle/framing
   - What aspects do they emphasize? What do they leave out?
   - Use the article title and description as your source

OUTPUT RULES:
- Output ONLY the JSON object. No markdown, no code fences, no preamble.
- Response must start with { and end with }
- Use EXACTLY these English keys
- All text VALUES must be in ${targetLang}
- For source_name, source_domain, article_title, publication_date: copy EXACTLY from the articles above
- DO NOT include article_url (handled separately)

COVERAGE ESTIMATE per spectrum (based on articles provided):
- "high"   → 3+ articles found
- "medium" → 1-2 articles
- "low"    → 0-1 articles, weak coverage
- "none"   → no articles found

REQUIRED JSON STRUCTURE:
{
  "analysis_topic": "${topic}",
  "response_language": "${language}",
  "overall_non_partisan_analysis": "<3-4 sentence factual summary in ${targetLang}>",
  "news_spectrum": {
    "left": [
      { "source_name": "<exact>", "source_domain": "<exact>", "article_title": "<exact headline>", "summary_of_perspective": "<2-3 sentences in ${targetLang}>", "publication_date": "<YYYY-MM-DD or omit>", "coverage_estimate": "<high|medium|low|none>" }
    ],
    "center_left": [ ... ],
    "center": [ ... ],
    "center_right": [ ... ],
    "right": [ ... ]
  }
}`;
}

/**
 * Build a minimal diagnostic prompt to verify that Gemini received
 * the RSS context correctly (used in tests).
 */
export function buildDiagnosticPrompt(rssSpectra) {
  const counts = Object.fromEntries(
    SPECTRUM_ORDER.map(s => [s, rssSpectra[s]?.articles?.length ?? 0])
  );
  return {
    totalArticles: Object.values(counts).reduce((a, b) => a + b, 0),
    perSpectrum: counts,
    coveredSpectra: countCoveredSpectra(rssSpectra),
    estimatedInputTokens: estimateContextTokens(rssSpectra),
  };
}
