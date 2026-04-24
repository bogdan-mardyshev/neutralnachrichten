import { isWhitelistedDomain, getAllWhitelistedDomains } from './mediaWhitelist.js';

const GROUNDING_REDIRECT_HOST = 'vertexaisearch.cloud.google.com';

function isAnyWhitelistedDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    // Grounding redirect URLs are always legitimate — they come from Google Search
    if (hostname === GROUNDING_REDIRECT_HOST) return true;
    return getAllWhitelistedDomains().some(
      domain => hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * If this is a Google grounding redirect URL, follow it and return the final URL.
 * This converts vertexaisearch.cloud.google.com/... into the actual article URL.
 */
export async function resolveArticleURL(url) {
  if (!url || !url.includes(GROUNDING_REDIRECT_HOST)) return url;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NeutralNachrichten/1.0)' }
    });
    clearTimeout(timeout);
    const finalUrl = res.url;
    if (finalUrl && finalUrl !== url) {
      console.log(`[Redirect] ${url.substring(0, 80)}... → ${finalUrl}`);
    }
    return finalUrl || url;
  } catch {
    clearTimeout(timeout);
    return url;
  }
}

const URL_VALIDATION_TIMEOUT_MS = 3000;
const MAX_ARTICLE_AGE_DAYS = 90;

/**
 * Validates URL returns success response. Uses HEAD first, falls back to GET
 * because some servers (notably bild.de, welt.de) reject HEAD requests.
 */
export async function validateURL(url) {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_VALIDATION_TIMEOUT_MS);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; NeutralNachrichten/1.0; +https://neutralnachrichten-production.up.railway.app)',
    'Accept': 'text/html,application/xhtml+xml'
  };

  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers
    });

    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers
      });
    }

    clearTimeout(timeout);
    const ok = res.status >= 200 && res.status < 400;
    console.log(`[URL] ${ok ? '✓' : '✗'} ${res.status} ${url}`);
    return ok;
  } catch (err) {
    clearTimeout(timeout);
    console.log(`[URL] ✗ ERROR(${err.name}) ${url}`);
    return false;
  }
}

/**
 * Validates that a date string represents an article published within maxAgeDays.
 * Accepts ISO format and German format "15. April 2026".
 */
export function isRecentEnough(dateStr, maxAgeDays = MAX_ARTICLE_AGE_DAYS) {
  if (!dateStr) return false;

  let pubDate = new Date(dateStr);

  if (isNaN(pubDate.getTime())) {
    const germanMonths = {
      'januar': 0, 'februar': 1, 'märz': 2, 'april': 3, 'mai': 4, 'juni': 5,
      'juli': 6, 'august': 7, 'september': 8, 'oktober': 9, 'november': 10, 'dezember': 11
    };
    const match = dateStr.match(/(\d{1,2})\.\s*(\w+)\s*(\d{4})/);
    if (match) {
      const [, day, monthName, year] = match;
      const month = germanMonths[monthName.toLowerCase()];
      if (month !== undefined) {
        pubDate = new Date(parseInt(year), month, parseInt(day));
      }
    }
  }

  if (isNaN(pubDate.getTime())) return false;

  const ageMs = Date.now() - pubDate.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  return ageDays >= 0 && ageDays <= maxAgeDays;
}

export async function validateArticle(article, expectedSpectrum) {
  const issues = [];

  if (!article || typeof article !== 'object') {
    return { valid: false, issues: ['missing_article'] };
  }

  // Check source_domain is a whitelisted German outlet
  const domain = article.source_domain || '';
  const domainUrl = domain ? `https://${domain}/` : '';
  if (!domainUrl || !isAnyWhitelistedDomain(domainUrl)) {
    issues.push('not_whitelisted');
  }

  return { valid: issues.length === 0, issues };
}

export async function validateAnalysis(analysis) {
  if (!analysis?.news_spectrum) {
    return { valid: false, reason: 'missing_news_spectrum', details: {} };
  }

  const spectrum = analysis.news_spectrum;
  const spectrumTypes = ['left', 'center', 'right'];

  const results = await Promise.all(
    spectrumTypes.map(type =>
      validateArticle(spectrum[type], type).then(r => [type, r])
    )
  );

  const details = Object.fromEntries(results);
  const validCount = results.filter(([, r]) => r.valid).length;

  return {
    valid: validCount === 3,
    validCount,
    details,
    acceptable: validCount >= 2
  };
}
