const queryCache = new Map();
const analysisCache = new Map();
const MAX_CACHE = 500;

function cacheSet(map, key, value) {
  if (map.size >= MAX_CACHE) map.delete(map.keys().next().value);
  map.set(key, value);
}

/**
 * Translates a short search query to German for consistent grounding results.
 * Cached aggressively — same query always produces the same German translation.
 */
export async function translateQueryToGerman(query, sourceLang, genAI) {
  if (sourceLang === 'de') return query;

  const key = `${sourceLang}:${query.toLowerCase().trim()}`;
  if (queryCache.has(key)) return queryCache.get(key);

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `Translate the following search query to German. Output only the German translation, no quotes, no explanation.\n\nQuery: ${query}\n\nGerman translation:`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 60 }
    });
    const raw = result.response.text();
    const translated = raw.trim().replace(/^["']|["']$/g, '').split('\n')[0].trim();
    console.log(`[Translate] "${query}" (${sourceLang}) → "${translated}" (de)`);
    cacheSet(queryCache, key, translated);
    return translated;
  } catch (err) {
    console.warn('[Translate] Query translation failed, using original:', err.message);
    return query;
  }
}

/**
 * Translates analysis text fields from German to the target language.
 * Only translates: overall_non_partisan_analysis, article_title, summary_of_perspective.
 * Preserves: source_name, source_domain, article_url, publication_date, all JSON keys.
 */
export async function translateAnalysis(analysis, targetLang, genAI) {
  if (targetLang === 'de') return analysis;

  const key = `${targetLang}:${analysis.analysis_topic}`;
  if (analysisCache.has(key)) return analysisCache.get(key);

  const langName = targetLang === 'en' ? 'English' : 'Russian';
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Translate specific fields of this JSON from German to ${langName}.

RULES:
- Translate ONLY these text fields:
  overall_non_partisan_analysis, article_title, summary_of_perspective,
  deep_analysis.shared_facts[*].claim,
  deep_analysis.diverging_points[*].topic, deep_analysis.diverging_points[*].left_view, deep_analysis.diverging_points[*].center_view, deep_analysis.diverging_points[*].right_view,
  deep_analysis.silenced_topics[*].topic, deep_analysis.silenced_topics[*].description
- Keep UNCHANGED: source_name, source_domain, article_url, publication_date, url_is_search_fallback, analysis_topic, response_language, only_in, all JSON keys, all numeric/boolean values
- Output ONLY the JSON object, no markdown, no explanation

Input JSON:
${JSON.stringify(analysis, null, 2)}

Translated JSON (${langName}):`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
    });

    const raw = result.response.text().trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first === -1 || last === -1) {
      console.error('[Translate] Bad translation response (no JSON):', raw.substring(0, 200));
      throw new Error('No JSON in translation response');
    }

    const translated = JSON.parse(raw.substring(first, last + 1));

    // Safety: force-preserve fields that must never be translated
    translated.analysis_topic = analysis.analysis_topic;
    translated.response_language = targetLang;
    // coverage_distribution is numeric/enum — never needs translation
    if (analysis.coverage_distribution) {
      translated.coverage_distribution = analysis.coverage_distribution;
    }
    for (const s of ['left', 'center', 'right']) {
      if (translated.news_spectrum?.[s] && analysis.news_spectrum?.[s]) {
        const orig = analysis.news_spectrum[s];
        const t = translated.news_spectrum[s];
        t.source_name = orig.source_name;
        t.source_domain = orig.source_domain;
        t.article_url = orig.article_url;
        t.url_is_search_fallback = orig.url_is_search_fallback;
        if (orig.publication_date) t.publication_date = orig.publication_date;
      }
    }
    // Preserve only_in enum values in silenced_topics (must never be translated)
    if (analysis.deep_analysis?.silenced_topics && translated.deep_analysis?.silenced_topics) {
      analysis.deep_analysis.silenced_topics.forEach((orig, i) => {
        if (translated.deep_analysis.silenced_topics[i]) {
          translated.deep_analysis.silenced_topics[i].only_in = orig.only_in;
        }
      });
    }

    cacheSet(analysisCache, key, translated);
    return translated;
  } catch (err) {
    console.error('[Translate] Analysis translation failed, returning German:', err.message);
    return analysis;
  }
}
