/**
 * lib/tractionMetrics.js — pure traction/growth computations for the admin dashboard.
 *
 * WHY a separate pure module: the admin panel previously answered only "is the
 * server alive and what does it cost" (ops). Growth questions — are people coming
 * back, is usage growing, is the data asset compounding — need different maths on
 * top of the same `searches` rows we already store. Keeping the maths pure (no DB,
 * no dates from the environment) means it is unit-tested exactly like the
 * reliability layer: db.js does the IO and passes rows in.
 *
 * IMPORTANT — honesty rules encoded here:
 *   - A visitor is a distinct ip_hash (already SHA-256 truncated when written).
 *   - "Returning" means active on >= 2 DISTINCT DAYS. Two analyses in one sitting
 *     is curiosity, not retention.
 *   - Internal traffic (the founders' own testing) must be excluded before these
 *     numbers mean anything — see excludeHashes in db.js. Every summary therefore
 *     carries `excludedInternal` so the UI can never silently show polluted data.
 */

/** Safe integer coercion — PG COUNT() comes back as a string. */
function int(n) {
  const x = parseInt(n, 10);
  return Number.isFinite(x) ? x : 0;
}

/** Percentage with one decimal, null-safe (null when the base is 0 — never 0%). */
export function pct(part, total) {
  const p = int(part), t = int(total);
  if (t <= 0) return null;
  return Number(((p / t) * 100).toFixed(1));
}

/**
 * Period-over-period growth for a time series.
 * @param {Array<{count:number|string}>} series — oldest first
 * @returns {{current:number, previous:number, growthPct:number|null}}
 *   growthPct is null when there is no previous period to compare against
 *   (an undefined baseline must not be reported as 0% or ∞).
 */
export function computeGrowth(series) {
  const s = Array.isArray(series) ? series : [];
  if (s.length === 0) return { current: 0, previous: 0, growthPct: null };
  const current = int(s[s.length - 1]?.count);
  if (s.length === 1) return { current, previous: 0, growthPct: null };
  const previous = int(s[s.length - 2]?.count);
  if (previous === 0) return { current, previous, growthPct: null };
  return {
    current,
    previous,
    growthPct: Number((((current - previous) / previous) * 100).toFixed(1)),
  };
}

/**
 * Retention summary from per-visitor activity rows.
 * @param {Array<{active_days:number|string}>} visitors
 */
export function computeRetention(visitors) {
  const rows = Array.isArray(visitors) ? visitors : [];
  const total = rows.length;
  const returning = rows.filter(r => int(r.active_days) >= 2).length;
  const loyal = rows.filter(r => int(r.active_days) >= 3).length;
  const totalDays = rows.reduce((sum, r) => sum + int(r.active_days), 0);
  return {
    totalVisitors: total,
    returningVisitors: returning,
    loyalVisitors: loyal,
    returningRate: pct(returning, total),
    loyalRate: pct(loyal, total),
    avgActiveDays: total > 0 ? Number((totalDays / total).toFixed(2)) : null,
  };
}

/**
 * Weekly cohort retention grid.
 * @param {Array<{cohort_week:string, week_offset:number|string, visitors:number|string}>} rows
 * @param {object} opts — { maxOffset = 4 }
 * @returns {Array<{cohortWeek, size, cells:[{offset, visitors, pct}]}>} newest cohort first
 */
export function buildCohortGrid(rows, { maxOffset = 4 } = {}) {
  const byCohort = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const week = r?.cohort_week;
    if (!week) continue;
    const offset = int(r.week_offset);
    if (offset < 0 || offset > maxOffset) continue;
    const key = typeof week === 'string' ? week : new Date(week).toISOString();
    if (!byCohort.has(key)) byCohort.set(key, new Map());
    byCohort.get(key).set(offset, int(r.visitors));
  }

  const out = [];
  for (const [cohortWeek, offsets] of byCohort) {
    const size = offsets.get(0) ?? 0;
    const cells = [];
    for (let o = 0; o <= maxOffset; o++) {
      const visitors = offsets.get(o);
      // undefined = that week hasn't happened yet for this cohort → null, not 0.
      cells.push(
        visitors === undefined
          ? { offset: o, visitors: null, pct: null }
          : { offset: o, visitors, pct: pct(visitors, size) }
      );
    }
    out.push({ cohortWeek, size, cells });
  }
  return out.sort((a, b) => (a.cohortWeek < b.cohortWeek ? 1 : -1));
}

/**
 * Engagement funnel. Note the first step is "ran an analysis", not "visited" —
 * the `searches` table only sees people who actually used the product. Visit-level
 * numbers come from web analytics and are deliberately NOT mixed in here.
 */
export function buildFunnel({ analysed = 0, repeat = 0, returning = 0, registered = 0 } = {}) {
  const base = int(analysed);
  return [
    { key: 'analysed',   label: 'Analyse gestartet',      value: base,             pct: base > 0 ? 100 : null },
    { key: 'repeat',     label: '≥ 2 Analysen',           value: int(repeat),      pct: pct(repeat, base) },
    { key: 'returning',  label: 'An ≥ 2 Tagen aktiv',     value: int(returning),   pct: pct(returning, base) },
    { key: 'registered', label: 'Registriert',            value: int(registered),  pct: pct(registered, base) },
  ];
}

/**
 * Data-asset summary — the part that compounds without any marketing spend.
 * Articles/day is derived from observed ingestion days, not assumed.
 */
export function summarizeAsset({ articles = 0, embeddings = 0, nliTotal = 0, dailyIngest = [], outlets = 0 } = {}) {
  const days = Array.isArray(dailyIngest) ? dailyIngest.filter(d => int(d.count) > 0) : [];
  const totalIngested = days.reduce((s, d) => s + int(d.count), 0);
  const perDay = days.length > 0 ? Math.round(totalIngested / days.length) : null;
  return {
    articles: int(articles),
    embeddings: int(embeddings),
    nliVerdicts: int(nliTotal),
    outlets: int(outlets),
    articlesPerDay: perDay,
    embeddingCoverage: pct(embeddings, articles),
    observedDays: days.length,
  };
}

/** Split rows like [{lang,count}] into a share table. */
export function shareTable(rows, key = 'lang') {
  const list = Array.isArray(rows) ? rows : [];
  const total = list.reduce((s, r) => s + int(r.count), 0);
  return list
    .map(r => ({ label: r[key] ?? '—', count: int(r.count), pct: pct(r.count, total) }))
    .sort((a, b) => b.count - a.count);
}
