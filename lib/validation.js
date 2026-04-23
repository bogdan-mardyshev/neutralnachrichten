import { isWhitelistedDomain } from './mediaWhitelist.js';

const URL_VALIDATION_TIMEOUT_MS = 6000;
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

    // Some sites block HEAD — retry with GET but limit body read
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers
      });
    }

    clearTimeout(timeout);
    return res.status >= 200 && res.status < 400;
  } catch {
    clearTimeout(timeout);
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

  const { article_url, publication_date } = article;

  if (!isWhitelistedDomain(article_url, expectedSpectrum)) {
    issues.push('not_whitelisted');
  }

  if (!isRecentEnough(publication_date)) {
    issues.push('too_old_or_invalid_date');
  }

  // Only check URL liveness if domain/recency passed
  if (issues.length === 0) {
    const urlValid = await validateURL(article_url);
    if (!urlValid) {
      issues.push('url_unreachable');
    }
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
