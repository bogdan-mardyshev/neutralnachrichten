import { describe, it, expect } from 'vitest';
import { createMetrics } from '../lib/metrics.js';

describe('createMetrics', () => {
  it('counts analyses by source / degraded / cacheHit', () => {
    const m = createMetrics();
    m.recordAnalysis({ source: 'corpus' });
    m.recordAnalysis({ source: 'live', degraded: true });
    m.recordAnalysis({ cacheHit: true });
    const s = m.snapshot();
    expect(s.analyses.total).toBe(3);
    expect(s.analyses.corpus).toBe(1);
    expect(s.analyses.liveRss).toBe(1);
    expect(s.analyses.degraded).toBe(1);
    expect(s.analyses.cacheHits).toBe(1);
  });

  it('builds a confidence histogram + average', () => {
    const m = createMetrics();
    [100, 85, 62, 45, 20].forEach(v => m.recordConfidence(v));
    const s = m.snapshot();
    expect(s.confidence.count).toBe(5);
    expect(s.confidence.buckets['100']).toBe(1);
    expect(s.confidence.buckets['80-99']).toBe(1);
    expect(s.confidence.buckets['60-79']).toBe(1);
    expect(s.confidence.buckets['40-59']).toBe(1);
    expect(s.confidence.buckets['0-39']).toBe(1);
    expect(s.confidence.avg).toBeCloseTo(62.4, 1);
  });

  it('ignores garbage confidence values', () => {
    const m = createMetrics();
    m.recordConfidence(NaN); m.recordConfidence('x'); m.recordConfidence(undefined);
    expect(m.snapshot().confidence.count).toBe(0);
    expect(m.snapshot().confidence.avg).toBeNull();
  });

  it('tracks grounding ratio average (clamped 0..1)', () => {
    const m = createMetrics();
    m.recordGrounding(1); m.recordGrounding(0.5); m.recordGrounding(5); // clamped → 1
    expect(m.snapshot().grounding.avgRatio).toBeCloseTo(0.83, 1);
  });

  it('counts gemini calls by purpose + total', () => {
    const m = createMetrics();
    m.recordGeminiCall('analysis'); m.recordGeminiCall('deep');
    m.recordGeminiCall('translate'); m.recordGeminiCall('embedding');
    m.recordGeminiCall('bogus'); // ignored
    const s = m.snapshot();
    expect(s.gemini.totalCalls).toBe(4);
    expect(s.gemini.analysis).toBe(1);
  });

  it('tracks per-stage latency avg/max', () => {
    const m = createMetrics();
    m.recordLatency('analysis', 100); m.recordLatency('analysis', 300);
    m.recordLatency('analysis', -5); // ignored
    const s = m.snapshot();
    expect(s.latency.analysis.count).toBe(2);
    expect(s.latency.analysis.avgMs).toBe(200);
    expect(s.latency.analysis.maxMs).toBe(300);
  });

  it('tracks translations and deep analysis success/failure', () => {
    const m = createMetrics();
    m.recordTranslation(true); m.recordTranslation(false);
    m.recordDeepAnalysis(true); m.recordDeepAnalysis(false);
    const s = m.snapshot();
    expect(s.translations).toEqual({ ok: 1, failed: 1 });
    expect(s.deepAnalysis).toEqual({ ok: 1, failed: 1 });
  });

  it('snapshot is a copy (no live mutation leak)', () => {
    const m = createMetrics();
    const s1 = m.snapshot();
    m.recordAnalysis({});
    expect(s1.analyses.total).toBe(0);
    expect(m.snapshot().analyses.total).toBe(1);
  });
});
