/**
 * eval/loadLabeled.js — turn a human-labelled capture file (eval/candidates/*.json,
 * produced by scripts/rag-capture.mjs) into the same shape the scorer consumes for
 * the synthetic golden set, so REAL cases run through the identical pipeline.
 *
 * A capture row carries `relevant: true|false|null`. Only files with at least one
 * labelled row are scoreable; `relevant === true` rows form the gold set. The raw
 * candidates (all of them) become `grouped`, so corpusToSpectra re-applies the real
 * relevance gate during scoring — recall@k then exposes gate false-negatives and
 * set-precision exposes off-topic survivors, exactly as on the synthetic set.
 *
 * Pure: no IO. The runner reads the JSON and passes the parsed object here.
 */

import { CORPUS_SPECTRUMS } from '../lib/corpusQueries.js';

/** Is this capture file labelled enough to score? (≥1 row with relevant !== null) */
export function isLabelled(captured) {
  const c = Array.isArray(captured?.candidates) ? captured.candidates : [];
  return c.some((r) => r.relevant === true || r.relevant === false);
}

/** A labelled capture → { id, topic, grouped, relevantIds } (golden-set case shape). */
export function toCase(captured) {
  const cands = Array.isArray(captured?.candidates) ? captured.candidates : [];
  const grouped = {};
  for (const sp of CORPUS_SPECTRUMS) grouped[sp] = [];

  for (const c of cands) {
    const sp = CORPUS_SPECTRUMS.includes(c.spectrum) ? c.spectrum : 'center';
    grouped[sp].push({
      id: c.id,
      source_name: c.source_name,
      source_domain: c.source_domain,
      spectrum: sp,
      article_title: c.article_title,
      our_summary: c.our_summary,
      short_lead: (c.our_summary || '').slice(0, 120),
      url: c.url,
      pubDate: captured.capturedAt || new Date().toISOString(),
      _rrfScore: c.score ?? 0,
      _retrievers: c.retrievers || [],
    });
  }

  const relevantIds = cands.filter((c) => c.relevant === true).map((c) => c.id);

  return {
    id: 'real:' + (captured.topic || 'untitled'),
    topic: captured.topic || 'untitled',
    keywords: captured.keywords || [],
    topicWords: captured.topicWords || [],
    grouped,
    relevantIds,
    // diagnostics for the report
    _labelled: cands.filter((c) => c.relevant === true || c.relevant === false).length,
    _relevant: relevantIds.length,
    _raw: cands.length,
  };
}

/** Map an array of parsed capture files → scoreable cases (skips unlabelled). */
export function labelledCases(capturedFiles) {
  return (Array.isArray(capturedFiles) ? capturedFiles : [])
    .filter(isLabelled)
    .map(toCase);
}
