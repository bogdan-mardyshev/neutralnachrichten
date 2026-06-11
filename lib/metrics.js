/**
 * lib/metrics.js — in-process operational metrics (audit fix A4).
 *
 * Pure counters/histograms, no IO — the admin endpoint reads a snapshot and
 * combines it with DB-side data (feed_health, corpus counts). Process-local by
 * design: resets on redeploy, which is fine for an ops dashboard (long-term
 * trends live in the searches table / Railway metrics).
 *
 * Tracked (the things the audit found us blind on):
 *   - analyses: total, corpus vs live-RSS sourced, degraded, errors
 *   - confidence: histogram buckets + avg (is the score actually discriminating?)
 *   - grounding: avg ratio (how source-backed are the analyses we ship)
 *   - gemini: calls by purpose (analysis/deep/translate/embedding) — cost proxy
 *   - translations: ok/failed; deepAnalysis: ok/failed
 *   - latency: per-stage simple avg + max
 */

export function createMetrics(now = () => Date.now()) {
  const state = {
    startedAt: new Date(now()).toISOString(),
    analyses: { total: 0, corpus: 0, liveRss: 0, degraded: 0, errors: 0, cacheHits: 0 },
    confidence: { count: 0, sum: 0, buckets: { '0-39': 0, '40-59': 0, '60-79': 0, '80-99': 0, '100': 0 } },
    grounding: { count: 0, ratioSum: 0 },
    gemini: { analysis: 0, deep: 0, translate: 0, embedding: 0, entailment: 0 },
    translations: { ok: 0, failed: 0 },
    deepAnalysis: { ok: 0, failed: 0 },
    latency: {}, // stage -> { count, sum, max }
  };

  function recordAnalysis({ source, degraded, cacheHit } = {}) {
    state.analyses.total++;
    if (cacheHit) state.analyses.cacheHits++;
    if (source === 'corpus') state.analyses.corpus++;
    else if (source) state.analyses.liveRss++;
    if (degraded) state.analyses.degraded++;
  }

  function recordError() { state.analyses.errors++; }

  function recordConfidence(score) {
    const s = Number(score);
    if (!Number.isFinite(s)) return;
    state.confidence.count++;
    state.confidence.sum += s;
    const b = s >= 100 ? '100' : s >= 80 ? '80-99' : s >= 60 ? '60-79' : s >= 40 ? '40-59' : '0-39';
    state.confidence.buckets[b]++;
  }

  function recordGrounding(ratio) {
    const r = Number(ratio);
    if (!Number.isFinite(r)) return;
    state.grounding.count++;
    state.grounding.ratioSum += Math.max(0, Math.min(1, r));
  }

  function recordGeminiCall(purpose) {
    if (purpose in state.gemini) state.gemini[purpose]++;
  }

  function recordTranslation(ok) { ok ? state.translations.ok++ : state.translations.failed++; }
  function recordDeepAnalysis(ok) { ok ? state.deepAnalysis.ok++ : state.deepAnalysis.failed++; }

  function recordLatency(stage, ms) {
    const v = Number(ms);
    if (!Number.isFinite(v) || v < 0) return;
    const s = (state.latency[stage] ||= { count: 0, sum: 0, max: 0 });
    s.count++; s.sum += v; if (v > s.max) s.max = v;
  }

  function snapshot() {
    const avg = (sum, count) => (count > 0 ? Math.round((sum / count) * 100) / 100 : null);
    return {
      startedAt: state.startedAt,
      uptimeHours: Math.round(((now() - new Date(state.startedAt).getTime()) / 3600000) * 10) / 10,
      analyses: { ...state.analyses },
      confidence: {
        avg: avg(state.confidence.sum, state.confidence.count),
        count: state.confidence.count,
        buckets: { ...state.confidence.buckets },
      },
      grounding: { avgRatio: avg(state.grounding.ratioSum, state.grounding.count), count: state.grounding.count },
      gemini: { ...state.gemini, totalCalls: Object.values(state.gemini).reduce((a, b) => a + b, 0) },
      translations: { ...state.translations },
      deepAnalysis: { ...state.deepAnalysis },
      latency: Object.fromEntries(
        Object.entries(state.latency).map(([k, s]) => [k, { avgMs: avg(s.sum, s.count), maxMs: s.max, count: s.count }])
      ),
    };
  }

  return {
    recordAnalysis, recordError, recordConfidence, recordGrounding,
    recordGeminiCall, recordTranslation, recordDeepAnalysis, recordLatency,
    snapshot,
  };
}

/** Shared process-wide instance (server imports this). */
export const metrics = createMetrics();
