/**
 * lib/rssSearch.js  —  v2
 *
 * Fetches real articles from German-media RSS feeds and scores them
 * for relevance to a user topic.
 *
 * v2 improvements over v1:
 *   1. extractSearchKeywords() moved here from server.js + German stop-words
 *   2. splitGermanCompound()  — "klimawandel" → also searches "klima" + "wandel"
 *   3. recencyMultiplier()    — breaking news scores 3× higher than week-old articles
 *   4. scoreArticle()         — recency-weighted; description-only matches penalised
 *   5. searchAllFeeds()       — maxAgeDays filter (default 30 days);
 *                               results ranked by relevance × freshness
 *
 * "До какого срока выдаёт правду?" (truth window):
 *   < 6 h   — breaking news, highest confidence                (3.0×)
 *   6–24 h  — today's news, very high confidence               (2.0×)
 *   1–3 d   — high confidence                                   (1.5×)
 *   3–7 d   — normal / this week                               (1.0× baseline)
 *   7–14 d  — decreasing relevance, may be superseded          (0.6×)
 *   14–30 d — low confidence for "current" analysis            (0.3×)
 *   > 30 d  — filtered out by default (maxAgeDays = 30)
 */

import NodeCache from 'node-cache';

// ── RSS cache: 15 minutes ─────────────────────────────────────────────────────
const rssCache = new NodeCache({ stdTTL: 15 * 60, checkperiod: 60 });

/** Clear the RSS cache (used in tests to avoid cross-test cache pollution) */
export function clearRSSCache() { rssCache.flushAll(); }

// ── Academically defensible German media spectrum ─────────────────────────────
// Sources: Hans-Bredow-Institut, Reuters Institute Digital News Report DE,
//          Medienwissenschaft publications, §5 MStV for public broadcasters
export const RSS_FEEDS = {
  left: [
    { name: 'taz',        domain: 'taz.de',        url: 'https://taz.de/!p4608;rss/' },
    { name: 'nd-aktuell', domain: 'nd-aktuell.de', url: 'https://www.nd-aktuell.de/rss/aktuell.php' },
    { name: 'Junge Welt', domain: 'jungewelt.de',  url: 'https://www.jungewelt.de/feeds/newsticker.rss' },
  ],
  center_left: [
    { name: 'Spiegel',      domain: 'spiegel.de',      url: 'https://www.spiegel.de/schlagzeilen/index.rss' },
    { name: 'Süddeutsche',  domain: 'sueddeutsche.de', url: 'https://rss.sueddeutsche.de/rss/Topthemen' },
    { name: 'Zeit',         domain: 'zeit.de',         url: 'https://newsfeed.zeit.de/index' },
    { name: 'Tagesspiegel', domain: 'tagesspiegel.de', url: 'https://www.tagesspiegel.de/contentexport/feed/home' },
  ],
  center: [
    { name: 'Tagesschau',      domain: 'tagesschau.de',      url: 'https://www.tagesschau.de/xml/rss2/' },
    { name: 'ZDF',             domain: 'zdf.de',             url: 'https://www.zdfheute.de/rss/zdf/nachrichten' },
    { name: 'Deutschlandfunk', domain: 'deutschlandfunk.de', url: 'https://www.deutschlandfunk.de/die-nachrichten.353.de.rss' },
  ],
  center_right: [
    { name: 'FAZ',          domain: 'faz.net',          url: 'https://www.faz.net/rss/aktuell/' },
    { name: 'Welt',         domain: 'welt.de',          url: 'https://www.welt.de/feeds/topnews.rss' },
    { name: 'Focus',        domain: 'focus.de',         url: 'https://www.focus.de/rss' },
    { name: 'NTV',          domain: 'n-tv.de',          url: 'https://www.n-tv.de/rss' },
    { name: 'Handelsblatt', domain: 'handelsblatt.com', url: 'https://www.handelsblatt.com/contentexport/feed/schlagzeilen' },
  ],
  right: [
    { name: 'Bild',            domain: 'bild.de',            url: 'https://www.bild.de/feed/home.xml' },
    { name: 'Junge Freiheit',  domain: 'jungefreiheit.de',   url: 'https://jungefreiheit.de/feed/' },
    { name: 'Tichys Einblick', domain: 'tichyseinblick.de',  url: 'https://www.tichyseinblick.de/feed/' },
  ],
};

export const SPECTRUM_ORDER = ['left', 'center_left', 'center', 'center_right', 'right'];

// ─────────────────────────────────────────────────────────────────────────────
// German NLP helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * German stop words — words that appear in nearly every article but carry
 * no topical information. Filtering them prevents low-quality matches.
 */
export const GERMAN_STOP_WORDS = new Set([
  // articles & determiners
  'der', 'die', 'das', 'ein', 'eine', 'einer', 'einem', 'einen', 'eines',
  'dem', 'den', 'des',
  // conjunctions
  'und', 'oder', 'aber', 'dass', 'wenn', 'weil', 'als', 'wie', 'ob',
  'doch', 'zwar', 'jedoch', 'obwohl', 'sondern',
  // prepositions
  'mit', 'für', 'von', 'bei', 'aus', 'auf', 'an', 'in', 'nach', 'über',
  'unter', 'durch', 'zum', 'zur', 'beim', 'seit', 'vom', 'bis', 'vor',
  'hinter', 'neben', 'zwischen', 'gegen', 'ohne', 'um', 'am', 'im', 'zu',
  // pronouns
  'ich', 'sie', 'wir', 'ihr', 'ihn', 'man', 'sich', 'es', 'er',
  // common verbs
  'ist', 'sind', 'wird', 'wurde', 'war', 'haben', 'hat', 'sein', 'haben',
  'kann', 'muss', 'soll', 'werden', 'hatte', 'worden',
  // noise adjectives / adverbs
  'alle', 'mehr', 'neue', 'neuen', 'neuer', 'neues', 'nicht', 'noch',
  'auch', 'sehr', 'immer', 'schon', 'nur', 'dann', 'hier', 'wann', 'so',
  'nun', 'mal', 'dabei', 'daher', 'darum', 'damit', 'dort', 'heute',
  'morgen', 'gestern', 'jetzt', 'bereits', 'weiter', 'worden', 'dabei',
  'dazu', 'davon', 'daran',
]);

/**
 * Common second-elements of German compound nouns (Determinativkomposita).
 *
 * When a search query ends with one of these, we also search for the prefix
 * (= first element) separately — because news outlets often use other compounds
 * of the same root.
 *
 * Example: "klimawandel" → also search "klima", which matches
 *          "klimakonferenz", "klimapolitik", "klimaaktivisten", etc.
 */
export const COMPOUND_SUFFIXES = [
  // governance / politics
  'politik',  'partei',  'regierung', 'minister', 'ministerium',
  'koalition', 'haushalt', 'beschluss', 'gesetz', 'recht', 'reform', 'reformen',
  'wahl',  'wahlen',  'abstimmung', 'debatte', 'programm', 'plan',
  // conflict / international
  'krieg', 'kriege', 'konflikt', 'angriff', 'angriffe',
  'streit', 'vertrag', 'verhandlung', 'gipfel', 'treffen',
  // society / environment
  'wandel', 'krise', 'schutz', 'pflicht', 'system', 'lage',
  'steuer', 'beitrag', 'beiträge',
];

/**
 * Split a German compound word into its constituent parts.
 *
 * Uses a suffix-list approach: if the word ends with a known compound element,
 * return [original, prefix, suffix].  Handles Fugen-s automatically.
 *
 * Examples:
 *   "bundestagswahl"   → ["bundestagswahl",  "bundestag",  "wahl"]
 *   "klimawandel"      → ["klimawandel",      "klima",      "wandel"]
 *   "ukrainekrieg"     → ["ukrainekrieg",     "ukraine",    "krieg"]
 *   "wirtschaftspolitik" → ["wirtschaftspolitik", "wirtschaft", "politik"]
 *   "rentenreform"     → ["rentenreform",     "renten",     "reform"]
 *   "krieg"            → ["krieg"]  (too short to split)
 *
 * @param {string} word  lowercased
 * @returns {string[]}
 */
export function splitGermanCompound(word) {
  if (word.length < 8) return [word]; // too short to be a compound noun

  const result = new Set([word]);

  for (const suffix of COMPOUND_SUFFIXES) {
    if (!word.endsWith(suffix)) continue;

    const prefixRaw = word.slice(0, word.length - suffix.length);
    if (prefixRaw.length < 3) continue; // prefix too short → likely false split

    // Strip Fugen-s  ("bundestags-wahl" → "bundestag")
    const prefix = (prefixRaw.endsWith('s') && prefixRaw.length > 4)
      ? prefixRaw.slice(0, -1)
      : prefixRaw;

    if (prefix.length >= 4 && !GERMAN_STOP_WORDS.has(prefix)) {
      result.add(prefix);
      result.add(suffix);
    }
  }

  return [...result];
}

/**
 * Extract and expand search keywords from a user topic string.
 *
 * Improvements over v1 (was in server.js):
 *   - German stop-word filtering
 *   - Compound splitting: "Bundestagswahl" → also "bundestag" + "wahl"
 *   - Deduplication
 *   - Configurable keyword cap
 *
 * @param {string} topic
 * @param {number} maxKeywords — default 10
 * @returns {string[]}
 */
export function extractSearchKeywords(topic, maxKeywords = 10) {
  const baseWords = topic
    .toLowerCase()
    .replace(/[^a-züäöß\s-]/gi, ' ')
    .split(/[\s-]+/)
    .filter(w => w.length >= 3 && !GERMAN_STOP_WORDS.has(w));

  // Expand each word with compound splits
  const expanded = [];
  for (const word of baseWords) {
    for (const variant of splitGermanCompound(word)) {
      if (!GERMAN_STOP_WORDS.has(variant)) {
        expanded.push(variant);
      }
    }
  }

  // Deduplicate (preserving order) and cap
  const seen = new Set();
  const result = [];
  for (const w of expanded) {
    if (!seen.has(w)) {
      seen.add(w);
      result.push(w);
    }
  }
  return result.slice(0, maxKeywords);
}

// ─────────────────────────────────────────────────────────────────────────────
// Recency scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Freshness multiplier for relevance scoring.
 *
 * "Truth window" — how far back RSS data is reliable for current-events analysis:
 *   < 6 h   →  3.0  breaking news, maximum confidence
 *   6–24 h  →  2.0  today's news
 *   1–3 d   →  1.5  recent, high confidence
 *   3–7 d   →  1.0  this week  (baseline)
 *   7–14 d  →  0.6  ageing, may have been superseded
 *   14–30 d →  0.3  low confidence for current analysis
 *   > 30 d  →  0.1  stale — filtered out at the searchAllFeeds level by default
 *   unknown →  0.8  no pubDate: treat as slightly below baseline
 *   future  →  0.5  clock-skew artefact
 *
 * @param {Date|null} pubDate
 * @returns {number}
 */
export function recencyMultiplier(pubDate) {
  if (!pubDate || isNaN(pubDate.getTime())) return 0.8;

  const ageHours = (Date.now() - pubDate.getTime()) / (1000 * 3600);

  if (ageHours < 0)    return 0.5;  // future-dated (clock skew)
  if (ageHours < 6)    return 3.0;  // breaking news
  if (ageHours < 24)   return 2.0;  // today
  if (ageHours < 72)   return 1.5;  // last 3 days
  if (ageHours < 168)  return 1.0;  // this week (baseline)
  if (ageHours < 336)  return 0.6;  // last 2 weeks
  if (ageHours < 720)  return 0.3;  // last month
  return 0.1;                        // older than 1 month
}

// ─────────────────────────────────────────────────────────────────────────────
// Article relevance scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score an article's relevance to a set of topic keywords.
 *
 * Scoring model:
 *   rawScore = (titleMatches × 2) + (descriptionMatches × 1)
 *
 *   finalScore = rawScore × effectiveRecency
 *     where effectiveRecency = recencyMultiplier          (title-matched articles)
 *                             = recencyMultiplier × 0.6   (description-only matches)
 *
 * The 0.6 penalty for description-only matches prevents loosely-related articles
 * from outranking genuinely relevant but slightly older articles.
 *
 * @param {{ title: string, description: string, pubDate: Date|null }} item
 * @param {string[]} topicWords — lowercased
 * @returns {{ score, rawScore, titleScore, descScore, titleOnly, recency }}
 */
export function scoreArticle(item, topicWords) {
  const titleLower = (item.title       || '').toLowerCase();
  const descLower  = (item.description || '').toLowerCase();

  let titleScore = 0;
  let descScore  = 0;

  for (const word of topicWords) {
    if (word.length < 3) continue;
    if (titleLower.includes(word)) titleScore += 2;
    if (descLower.includes(word))  descScore  += 1;
  }

  const rawScore = titleScore + descScore;
  if (rawScore === 0) {
    return { score: 0, rawScore: 0, titleScore: 0, descScore: 0, titleOnly: false, recency: 0 };
  }

  const recency          = recencyMultiplier(item.pubDate);
  const effectiveRecency = titleScore > 0 ? recency : recency * 0.6;
  const score            = rawScore * effectiveRecency;

  return {
    score,
    rawScore,
    titleScore,
    descScore,
    titleOnly: titleScore > 0,
    recency,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// XML helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractTag(xml, tag) {
  const cd = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'));
  if (cd) return cd[1].trim();
  const plain = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (plain) return plain[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return '';
}

function extractLink(xml) {
  const href = xml.match(/<link[^>]+href="([^"]+)"/i);
  if (href) return href[1].trim();
  const tagContent = xml.match(/<link>([^<]+)<\/link>/i);
  if (tagContent && tagContent[1].startsWith('http')) return tagContent[1].trim();
  const guidPerma = xml.match(/<guid[^>]*isPermaLink="true"[^>]*>([^<]+)<\/guid>/i);
  if (guidPerma) return guidPerma[1].trim();
  const guid = xml.match(/<guid[^>]*>([^<]+)<\/guid>/i);
  if (guid && guid[1].startsWith('http')) return guid[1].trim();
  return '';
}

function decodeHTML(str) {
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function parseRSSItems(xml) {
  const items = [];

  // RSS <item>
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const raw = match[1];
    const title       = decodeHTML(extractTag(raw, 'title'));
    const description = decodeHTML(extractTag(raw, 'description'));
    const link        = extractLink(raw);
    const pubDateStr  = extractTag(raw, 'pubDate') || extractTag(raw, 'published') || extractTag(raw, 'updated');
    const pubDate     = pubDateStr ? new Date(pubDateStr) : null;
    if (title || link) items.push({ title, description, link, pubDate });
  }

  // Atom <entry>
  const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  while ((match = entryRegex.exec(xml)) !== null) {
    const raw = match[1];
    const title       = decodeHTML(extractTag(raw, 'title'));
    const description = decodeHTML(extractTag(raw, 'summary') || extractTag(raw, 'content'));
    const link        = extractLink(raw);
    const pubDateStr  = extractTag(raw, 'published') || extractTag(raw, 'updated');
    const pubDate     = pubDateStr ? new Date(pubDateStr) : null;
    if (title || link) items.push({ title, description, link, pubDate });
  }

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feed fetcher
// ─────────────────────────────────────────────────────────────────────────────

async function fetchRSSFeed(feed, timeoutMs = 5000) {
  const cacheKey = `rss:${feed.url}`;
  const cached = rssCache.get(cacheKey);
  if (cached) return { feed, items: cached, fromCache: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[RSS] ${feed.name}: HTTP ${res.status}`);
      return { feed, items: [], error: `HTTP ${res.status}` };
    }

    const text  = await res.text();
    const items = parseRSSItems(text);
    rssCache.set(cacheKey, items);
    console.log(`[RSS] ${feed.name}: ${items.length} items fetched`);
    return { feed, items, fromCache: false };
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[RSS] ${feed.name}: ${err.message}`);
    return { feed, items: [], error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search all RSS feeds for articles matching topicWords.
 *
 * @param {string[]} topicWords — from extractSearchKeywords()
 * @param {object}   options
 * @param {number}   options.maxAgeDays   — exclude articles older than this (default 30)
 * @param {number}   options.maxPerFeed   — max articles per feed in result (default 5)
 * @param {number}   options.minRawScore  — minimum raw keyword score to include (default 1)
 * @returns {Promise<{ spectra, total_articles, fetched_at, search_meta }>}
 */
export async function searchAllFeeds(topicWords, {
  maxAgeDays  = 30,
  maxPerFeed  = 5,
  minRawScore = 1,
} = {}) {
  const oldestAllowed = new Date(Date.now() - maxAgeDays * 24 * 3600 * 1000);

  // Flatten all feeds with spectrum label
  const allFeeds = SPECTRUM_ORDER.flatMap(spectrum =>
    RSS_FEEDS[spectrum].map(feed => ({ ...feed, spectrum }))
  );

  // Fetch all feeds in parallel
  const fetchResults = await Promise.allSettled(
    allFeeds.map(feed => fetchRSSFeed(feed))
  );

  // Per-spectrum result containers
  const results = {};
  for (const spectrum of SPECTRUM_ORDER) {
    results[spectrum] = { articles: [], count_week: 0, count_month: 0 };
  }

  const now       = Date.now();
  const oneWeek   = now - 7  * 24 * 3600 * 1000;
  const oneMonth  = now - 30 * 24 * 3600 * 1000;

  // Per-feed diagnostic log
  const feedLog = [];
  let totalTooOld = 0;
  let totalBelowScore = 0;

  for (const settled of fetchResults) {
    if (settled.status !== 'fulfilled') continue;
    const { feed, items, error } = settled.value;
    if (error || !items.length) continue;

    let tooOldCount = 0;
    let belowScoreCount = 0;
    const matches = [];

    for (const item of items) {
      // ── Age filter ──────────────────────────────────────────────────────────
      if (item.pubDate && !isNaN(item.pubDate.getTime())) {
        if (item.pubDate < oldestAllowed) {
          tooOldCount++;
          continue;
        }
      }

      // ── Relevance scoring ───────────────────────────────────────────────────
      const { score, rawScore, titleScore, descScore, titleOnly, recency } =
        scoreArticle(item, topicWords);

      if (rawScore < minRawScore) {
        belowScoreCount++;
        continue;
      }

      matches.push({ item, score, rawScore, titleScore, descScore, titleOnly, recency });
    }

    totalTooOld     += tooOldCount;
    totalBelowScore += belowScoreCount;

    feedLog.push({
      feed:        feed.name,
      spectrum:    feed.spectrum,
      total:       items.length,
      too_old:     tooOldCount,
      below_score: belowScoreCount,
      matched:     matches.length,
    });

    if (!matches.length) continue;

    // Sort: recency-weighted score desc
    const sorted = matches
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPerFeed);

    const spectrum = feed.spectrum;
    for (const { item, score, rawScore, titleScore, recency } of sorted) {
      const pubMs = (item.pubDate && !isNaN(item.pubDate.getTime())) ? item.pubDate.getTime() : 0;
      results[spectrum].articles.push({
        source_name:    feed.name,
        source_domain:  feed.domain,
        article_title:  item.title,
        article_url:    item.link,
        description:    (item.description || '').slice(0, 400),
        pubDate:        (item.pubDate && !isNaN(item.pubDate.getTime()))
                          ? item.pubDate.toISOString()
                          : null,
        score,
        rawScore,
        titleScore,
        recency,
        title_match:    titleScore > 0,
      });
      if (pubMs > oneWeek)  results[spectrum].count_week++;
      if (pubMs > oneMonth) results[spectrum].count_month++;
    }
  }

  // Final sort within each spectrum: recency-weighted score desc
  for (const spectrum of SPECTRUM_ORDER) {
    results[spectrum].articles.sort((a, b) => b.score - a.score);
  }

  const totalArticles = SPECTRUM_ORDER.reduce((s, sp) => s + results[sp].articles.length, 0);

  // ── Summary log ─────────────────────────────────────────────────────────────
  const titleMatches = feedLog.reduce((s, r) => s + (r.matched || 0), 0);
  console.log(
    `[RSS v2] topic="${topicWords.slice(0, 3).join(',')}..." ` +
    `found=${totalArticles} tooOld=${totalTooOld} belowScore=${totalBelowScore} ` +
    `maxAgeDays=${maxAgeDays}`
  );
  console.log('[RSS v2] Per-feed:', JSON.stringify(
    feedLog.filter(r => r.matched > 0 || r.too_old > 0)
           .map(r => ({ feed: r.feed, matched: r.matched, tooOld: r.too_old }))
  ));

  return {
    spectra:        results,
    total_articles: totalArticles,
    fetched_at:     new Date().toISOString(),
    search_meta: {
      keywords:       topicWords,
      maxAgeDays,
      totalTooOld,
      totalBelowScore,
      feedLog,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Downstream helpers (unchanged API)
// ─────────────────────────────────────────────────────────────────────────────

export function buildCoverageDistribution(spectraResults) {
  const total = SPECTRUM_ORDER.reduce((s, sp) => s + spectraResults[sp].articles.length, 0);
  const dist  = {};
  for (const spectrum of SPECTRUM_ORDER) {
    const count   = spectraResults[spectrum].articles.length;
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    dist[spectrum] = {
      count,
      percent,
      estimate: count === 0 ? 'none' : count <= 2 ? 'low' : count <= 6 ? 'medium' : 'high',
    };
  }
  return dist;
}

export function detectSilence(spectraResults, totalArticles) {
  const SILENCE_THRESHOLD_TOTAL = 8;
  const silenced = [];
  if (totalArticles < SILENCE_THRESHOLD_TOTAL) return silenced;
  for (const spectrum of SPECTRUM_ORDER) {
    if (spectraResults[spectrum].articles.length === 0) silenced.push(spectrum);
  }
  return silenced;
}

export function buildCoverageVolume(spectraResults) {
  const volume = {};
  for (const spectrum of SPECTRUM_ORDER) {
    volume[spectrum] = {
      week:  spectraResults[spectrum].count_week,
      month: spectraResults[spectrum].count_month,
    };
  }
  return volume;
}
