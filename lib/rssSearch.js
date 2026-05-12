/**
 * lib/rssSearch.js
 *
 * Fetches real articles from German media RSS feeds, searches for topic
 * keywords, and returns structured results per political spectrum.
 *
 * Search modes (both run and results are logged for comparison):
 *   "title"  — keywords matched only in article title
 *   "full"   — keywords matched in title (weight 2) + description (weight 1)
 *
 * The chosen deployment mode is determined by SEARCH_MODE env var
 * (default: "full"). Logs allow post-hoc comparison.
 */

import NodeCache from 'node-cache';

// ── RSS cache: 15 minutes ─────────────────────────────────────────────────────
const rssCache = new NodeCache({ stdTTL: 15 * 60, checkperiod: 60 });

// ── Academically defensible German media spectrum ─────────────────────────────
// Sources: Hans-Bredow-Institut, Reuters Institute Digital News Report DE,
//          Medienwissenschaft publications, §5 MStV for public broadcasters
export const RSS_FEEDS = {
  left: [
    { name: 'taz',        domain: 'taz.de',        url: 'https://taz.de/!p4608;rss/' },
    { name: 'nd-aktuell', domain: 'nd-aktuell.de', url: 'https://www.nd-aktuell.de/rss' },
    { name: 'Junge Welt', domain: 'jungewelt.de',  url: 'https://www.jungewelt.de/rss.php' },
  ],
  center_left: [
    { name: 'Spiegel',       domain: 'spiegel.de',      url: 'https://www.spiegel.de/schlagzeilen/index.rss' },
    { name: 'Süddeutsche',   domain: 'sueddeutsche.de', url: 'https://rss.sueddeutsche.de/rss/Topthemen' },
    { name: 'Zeit',          domain: 'zeit.de',         url: 'https://newsfeed.zeit.de/index' },
    { name: 'Tagesspiegel',  domain: 'tagesspiegel.de', url: 'https://www.tagesspiegel.de/feed' },
  ],
  center: [
    { name: 'Tagesschau',      domain: 'tagesschau.de',      url: 'https://www.tagesschau.de/xml/rss2/' },
    { name: 'ZDF',             domain: 'zdf.de',             url: 'https://www.zdf.de/rss/zdf/nachrichten100.xml' },
    { name: 'Deutschlandfunk', domain: 'deutschlandfunk.de', url: 'https://www.deutschlandfunk.de/die-nachrichten.353.de.rss' },
  ],
  center_right: [
    { name: 'FAZ',          domain: 'faz.net',          url: 'https://www.faz.net/rss/aktuell/' },
    { name: 'Welt',         domain: 'welt.de',          url: 'https://www.welt.de/feeds/topnews.rss' },
    { name: 'Focus',        domain: 'focus.de',         url: 'https://rss.focus.de/fol/XML/rss_folnews.xml' },
    { name: 'NTV',          domain: 'n-tv.de',          url: 'https://www.n-tv.de/rss' },
    { name: 'Handelsblatt', domain: 'handelsblatt.com', url: 'https://www.handelsblatt.com/contentexport/feed/schlagzeilen' },
  ],
  right: [
    { name: 'Bild',             domain: 'bild.de',             url: 'https://www.bild.de/rssfeeds/rss3-20745882,short,sortNewest,thumb.bild.xml' },
    { name: 'Junge Freiheit',   domain: 'jungefreiheit.de',    url: 'https://jungefreiheit.de/feed/' },
    { name: 'Tichys Einblick',  domain: 'tichyseinblick.de',   url: 'https://www.tichyseinblick.de/feed/' },
  ],
};

export const SPECTRUM_ORDER = ['left', 'center_left', 'center', 'center_right', 'right'];

// ── XML helpers ───────────────────────────────────────────────────────────────

function extractTag(xml, tag) {
  // CDATA
  const cd = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'));
  if (cd) return cd[1].trim();
  // Plain content (strip inner tags)
  const plain = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (plain) return plain[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return '';
}

function extractLink(xml) {
  // <link href="..."/> (Atom style)
  const href = xml.match(/<link[^>]+href="([^"]+)"/i);
  if (href) return href[1].trim();
  // <link>url</link> — but skip <link rel="..."> tags
  const tagContent = xml.match(/<link>([^<]+)<\/link>/i);
  if (tagContent) return tagContent[1].trim();
  // <guid isPermaLink="true">url</guid>
  const guid = xml.match(/<guid[^>]*isPermaLink="true"[^>]*>([^<]+)<\/guid>/i);
  if (guid) return guid[1].trim();
  return '';
}

function decodeHTML(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function parseRSSItems(xml) {
  const items = [];
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
  // Also handle Atom <entry> format
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

// ── Relevance scoring ─────────────────────────────────────────────────────────
// Returns { score, titleScore, descScore } for a single article
export function scoreArticle(item, topicWords) {
  const titleLower = item.title.toLowerCase();
  const descLower  = (item.description || '').toLowerCase();

  let titleScore = 0;
  let descScore  = 0;

  for (const word of topicWords) {
    if (word.length < 3) continue; // skip stop words
    if (titleLower.includes(word)) titleScore += 2;
    if (descLower.includes(word))  descScore  += 1;
  }

  return {
    score:      titleScore + descScore,
    titleScore,
    descScore,
    titleOnly:  titleScore > 0,
  };
}

// ── Fetch single RSS feed with timeout ───────────────────────────────────────
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
        'User-Agent': 'NeutralNachrichten/1.0 Media Monitor (https://neutralenachrichten.com)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[RSS] ${feed.name}: HTTP ${res.status}`);
      return { feed, items: [], error: `HTTP ${res.status}` };
    }

    const text = await res.text();
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

// ── Main: search all feeds for a topic ───────────────────────────────────────
// topicWords: string[] — German keywords (lowercased)
// Returns: { left, center_left, center, center_right, right, meta }
// Each spectrum entry: { articles: [{source_name, domain, title, url, pubDate, score}], count_week, count_month }
export async function searchAllFeeds(topicWords) {
  const MIN_SCORE_TITLE = 2; // must match in title
  const MIN_SCORE_FULL  = 1; // any match counts for full mode

  const now     = Date.now();
  const oneWeek  = now - 7  * 24 * 3600 * 1000;
  const oneMonth = now - 30 * 24 * 3600 * 1000;

  // Flatten all feeds with their spectrum label
  const allFeeds = SPECTRUM_ORDER.flatMap(spectrum =>
    RSS_FEEDS[spectrum].map(feed => ({ ...feed, spectrum }))
  );

  // Fetch all feeds in parallel (Promise.allSettled — one failure doesn't break others)
  const fetchResults = await Promise.allSettled(
    allFeeds.map(feed => fetchRSSFeed(feed))
  );

  // Build per-spectrum results
  const results = {};
  for (const spectrum of SPECTRUM_ORDER) {
    results[spectrum] = { articles: [], count_week: 0, count_month: 0 };
  }

  // Comparison log
  const comparisonLog = [];

  for (const settled of fetchResults) {
    if (settled.status !== 'fulfilled') continue;
    const { feed, items, error } = settled.value;
    if (error || !items.length) continue;

    const matchesTitle = [];
    const matchesFull  = [];

    for (const item of items) {
      const { score, titleScore, titleOnly } = scoreArticle(item, topicWords);

      if (titleScore >= MIN_SCORE_TITLE) {
        matchesTitle.push({ item, score, titleScore });
      }
      if (score >= MIN_SCORE_FULL) {
        matchesFull.push({ item, score, titleScore });
      }
    }

    // Log comparison
    comparisonLog.push({
      feed: feed.name,
      spectrum: feed.spectrum,
      total_items: items.length,
      title_matches: matchesTitle.length,
      full_matches: matchesFull.length,
    });

    // Use FULL mode results (title + description) as primary
    // Articles that only match in description (no title hit) get lower priority
    const matches = matchesFull
      .sort((a, b) => {
        // Prefer: (1) title matches (2) higher score (3) more recent
        if (b.titleScore !== a.titleScore) return b.titleScore - a.titleScore;
        if (b.score !== a.score) return b.score - a.score;
        const dateA = a.item.pubDate?.getTime() ?? 0;
        const dateB = b.item.pubDate?.getTime() ?? 0;
        return dateB - dateA;
      })
      .slice(0, 5); // max 5 articles per feed

    const spectrum = feed.spectrum;
    for (const { item, score, titleScore } of matches) {
      const pubMs = item.pubDate?.getTime() ?? 0;
      const article = {
        source_name:    feed.name,
        source_domain:  feed.domain,
        article_title:  item.title,
        article_url:    item.link,
        description:    item.description?.slice(0, 300) || '',
        pubDate:        item.pubDate?.toISOString() ?? null,
        score,
        title_match:    titleScore > 0,
      };
      results[spectrum].articles.push(article);
      if (pubMs > oneWeek)  results[spectrum].count_week++;
      if (pubMs > oneMonth) results[spectrum].count_month++;
    }
  }

  // Sort each spectrum's articles by date desc, then score
  for (const spectrum of SPECTRUM_ORDER) {
    results[spectrum].articles.sort((a, b) => {
      // Title matches first
      if (b.title_match !== a.title_match) return b.title_match ? 1 : -1;
      const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;
      return b.score - a.score;
    });
  }

  // Log comparison summary
  const titleTotal = comparisonLog.reduce((s, r) => s + r.title_matches, 0);
  const fullTotal  = comparisonLog.reduce((s, r) => s + r.full_matches, 0);
  console.log(`[RSS Search] Mode comparison — title-only: ${titleTotal} articles, full: ${fullTotal} articles`);
  console.log('[RSS Search] Per-feed:', JSON.stringify(
    comparisonLog.map(r => ({ feed: r.feed, t: r.title_matches, f: r.full_matches }))
  ));

  // Total across all spectra
  const totalArticles = SPECTRUM_ORDER.reduce((s, sp) => s + results[sp].articles.length, 0);

  return {
    spectra: results,
    total_articles: totalArticles,
    fetched_at: new Date().toISOString(),
    comparison_log: comparisonLog,
  };
}

// ── Build coverage_distribution from real RSS counts ─────────────────────────
export function buildCoverageDistribution(spectraResults) {
  const total = SPECTRUM_ORDER.reduce((s, sp) => s + spectraResults[sp].articles.length, 0);
  const dist  = {};

  for (const spectrum of SPECTRUM_ORDER) {
    const count   = spectraResults[spectrum].articles.length;
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    dist[spectrum] = {
      count,
      percent,
      // Keep estimate label for backward compatibility with frontend
      estimate: count === 0 ? 'none' : count <= 2 ? 'low' : count <= 6 ? 'medium' : 'high',
    };
  }

  return dist;
}

// ── Detect potential deliberate silence ───────────────────────────────────────
// Returns list of spectra that may have deliberately ignored the topic
export function detectSilence(spectraResults, totalArticles) {
  const SILENCE_THRESHOLD_TOTAL = 8; // need at least 8 articles overall to claim silence
  const silenced = [];

  if (totalArticles < SILENCE_THRESHOLD_TOTAL) return silenced;

  for (const spectrum of SPECTRUM_ORDER) {
    if (spectraResults[spectrum].articles.length === 0) {
      silenced.push(spectrum);
    }
  }

  return silenced;
}

// ── Build coverage_volume from RSS dates ──────────────────────────────────────
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
