import crypto from 'crypto';

const queryCache = new Map();
const analysisCache = new Map();
const MAX_CACHE = 500;

/** Stable short hash of the source content, so the translation cache key changes
 *  whenever the underlying German analysis changes (different articles, added
 *  deep_analysis, etc.). Keying by topic alone returned stale translations. */
function contentHash(obj) {
  return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex').slice(0, 16);
}

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
      generationConfig: { temperature: 0.1, maxOutputTokens: 60, thinkingConfig: { thinkingBudget: 0 } }
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

  // Key by target language + a hash of the actual content, NOT just the topic.
  // Two analyses of the same topic (re-run with different articles, or with vs
  // without deep_analysis) must not collide and return a stale translation.
  const key = `${targetLang}:${analysis.analysis_topic}:${contentHash(analysis)}`;
  if (analysisCache.has(key)) return analysisCache.get(key);

  const langName = targetLang === 'en' ? 'English' : 'Russian';
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Build a LEAN copy for the model: strip everything that is large and never
  // translated (it is restored from the original after translation anyway). With
  // the corpus path returning ~30+ articles, the full JSON blew past the output
  // token cap and came back as truncated/invalid JSON → German fallback. Sending
  // only the fields that actually need translating keeps the payload small.
  const lean = JSON.parse(JSON.stringify(analysis));
  delete lean._rss;
  delete lean._reliability;
  delete lean.analyzed_at;
  for (const s of ['left', 'center_left', 'center', 'center_right', 'right']) {
    for (const a of (lean.news_spectrum?.[s] || [])) {
      // keep: source_name (anchor), article_title, summary_of_perspective
      delete a._citation;
      delete a._grounded;
      delete a.source_domain;
      delete a.article_url;
      delete a.url_is_search_fallback;
      delete a.publication_date;
    }
  }

  const prompt = `Translate specific fields of this JSON from German to ${langName}.

RULES:
- Translate ONLY these text fields:
  overall_non_partisan_analysis, article_title, summary_of_perspective,
  deep_analysis.shared_facts[*].claim,
  deep_analysis.diverging_points[*].topic, deep_analysis.diverging_points[*].left_view, deep_analysis.diverging_points[*].center_left_view, deep_analysis.diverging_points[*].center_view, deep_analysis.diverging_points[*].center_right_view, deep_analysis.diverging_points[*].right_view,
  deep_analysis.silenced_topics[*].topic, deep_analysis.silenced_topics[*].description,
  deep_analysis.keywords[*][*] (translate each keyword/phrase to ${langName}),
  deep_analysis.experts_cited[*][*] (keep names as-is — they are proper nouns)
- Keep UNCHANGED: source_name, source_domain, article_url, publication_date, url_is_search_fallback, analysis_topic, response_language, only_in, all JSON keys, all numeric/boolean values, deep_analysis.sentiment (keep as positive/neutral/negative), deep_analysis.coverage_volume (all numbers)
- Output ONLY the JSON object, no markdown, no explanation

Input JSON:
${JSON.stringify(lean, null, 2)}

Translated JSON (${langName}):`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 16384, thinkingConfig: { thinkingBudget: 0 } }
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
    for (const s of ['left', 'center_left', 'center', 'center_right', 'right']) {
      const origArr = analysis.news_spectrum?.[s];
      const transArr = translated.news_spectrum?.[s];
      if (Array.isArray(origArr) && Array.isArray(transArr)) {
        origArr.forEach((orig, i) => {
          if (transArr[i]) {
            transArr[i].source_name = orig.source_name;
            transArr[i].source_domain = orig.source_domain;
            transArr[i].article_url = orig.article_url;
            transArr[i].url_is_search_fallback = orig.url_is_search_fallback;
            if (orig.publication_date) transArr[i].publication_date = orig.publication_date;
          }
        });
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
