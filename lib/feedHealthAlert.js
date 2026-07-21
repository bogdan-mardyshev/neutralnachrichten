/**
 * lib/feedHealthAlert.js — turn the feed_health table into an actionable alert.
 *
 * Why it matters for RELIABILITY: blindspot verification trusts feed_health to
 * tell real editorial silence apart from a broken feed. If feeds quietly rot, a
 * camp can look "silent" when it is really just unreachable — a false blindspot.
 * This surfaces unhealthy feeds after each ingestion pass so they get fixed.
 *
 * Pure: takes the rows getDownFeeds() returns, decides whether to alert and how
 * severe. The worker logs the message (Railway/Sentry visible).
 */

/**
 * @param {Array} downFeeds — rows from getDownFeeds(): { source_name, spectrum, status, consecutive_failures, feed_url }
 * @param {object} opts — { minConsecutiveFailures = 3, spectrumsTotal = 5 }
 * @returns {{ shouldAlert, severity, count, bySpectrum, darkSpectrums, message }}
 */
export function buildFeedHealthAlert(downFeeds, { minConsecutiveFailures = 3 } = {}) {
  const rows = (Array.isArray(downFeeds) ? downFeeds : []).filter(f =>
    (f.status && f.status !== 'ok') || (Number(f.consecutive_failures) || 0) >= minConsecutiveFailures
  );

  if (rows.length === 0) {
    return { shouldAlert: false, severity: 'ok', count: 0, bySpectrum: {}, darkSpectrums: [], message: '' };
  }

  const bySpectrum = {};
  for (const f of rows) {
    const sp = f.spectrum || 'unknown';
    (bySpectrum[sp] ||= []).push({
      name: f.source_name || f.feed_url || 'unknown',
      fails: Number(f.consecutive_failures) || 0,
      status: f.status || 'down',
    });
  }

  // A spectrum is "dark" when ≥2 of its feeds are unhealthy — high risk of a
  // false blindspot for that camp. Drives severity to critical.
  const darkSpectrums = Object.entries(bySpectrum)
    .filter(([, feeds]) => feeds.length >= 2)
    .map(([sp]) => sp);

  const severity = darkSpectrums.length ? 'critical' : 'warning';
  const detail = Object.entries(bySpectrum)
    .map(([sp, feeds]) => `${sp}[${feeds.map(f => `${f.name}×${f.fails}`).join(', ')}]`)
    .join(' · ');
  const message = `${rows.length} feed(s) unhealthy${darkSpectrums.length ? ` — DARK camps: ${darkSpectrums.join(', ')}` : ''}: ${detail}`;

  return { shouldAlert: true, severity, count: rows.length, bySpectrum, darkSpectrums, message };
}
