#!/usr/bin/env node
/**
 * scripts/rag-eval.mjs — offline RAG-evaluation harness.
 *
 * Runs the golden set through the REAL pure pipeline (no Gemini, no DB) and prints
 * a scorecard for the two reliability dimensions:
 *   • RETRIEVAL  — precision@k / recall@k / MRR / MAP / nDCG@k after the relevance
 *                  gate (corpusToSpectra), vs hand-labelled relevant ids.
 *   • FAITHFULNESS — grounding ratio (groundAnalysis) × claim support (verifyClaims,
 *                  lexical mode), with a contradiction penalty.
 *
 * Exit code is non-zero if the aggregate drops below the floors below, so this can
 * gate CI / pre-deploy. Writes eval/last-run.json for trend tracking.
 *
 *   node scripts/rag-eval.mjs           # run + gate
 *   node scripts/rag-eval.mjs --json    # machine-readable only
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { GOLDEN_SET } from '../eval/golden-set.js';
import { corpusToSpectra } from '../lib/corpusToSpectra.js';
import { groundAnalysis, dedupeArticles } from '../lib/citationGrounding.js';
import { extractClaims, verifyClaims, flattenCorpus } from '../lib/claimVerification.js';
import { scoreRetrievalCase, faithfulnessScore, aggregate } from '../lib/ragEval.js';

const KS = [1, 3, 5];
// Gate on SET-precision (off-topic filler), recall@5 (coverage), MRR (top hit),
// and faithfulness (grounding × support). p@5 is reported but NOT gated — with
// 3–4 relevant docs per topic it is capped below 1 by construction.
const FLOORS = { precision: 0.85, 'r@5': 0.80, mrr: 0.85, faithfulness: 0.60 };

const jsonOnly = process.argv.includes('--json');
const log = (...a) => { if (!jsonOnly) console.log(...a); };

async function runCase(c) {
  // 1) REAL relevance gate.
  const { spectra } = corpusToSpectra(c.grouped, { keywords: c.keywords, topicWords: c.topicWords });
  // Flatten survivors, globally score-sorted → the ranked retrieved list.
  const survivors = [];
  for (const sp of Object.keys(spectra)) for (const a of spectra[sp].articles) survivors.push(a);
  survivors.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const rankedIds = survivors.map((a) => a._corpusId);

  const retrieval = scoreRetrievalCase(rankedIds, c.relevantIds, { ks: KS });

  // 2) REAL grounding + claim verification (lexical — no model in offline mode).
  const { report: grounding } = groundAnalysis(c.analysis, spectra);
  const claims = extractClaims(c.analysis);
  const flat = dedupeArticles(flattenCorpus(spectra));
  const { report: claimReport } = await verifyClaims(claims, flat, {}); // no batchEntailmentFn → lexical
  const faith = faithfulnessScore({ grounding, claims: claimReport });

  return {
    id: c.id,
    topic: c.topic,
    retrieved: rankedIds.length,
    relevant: c.relevantIds.length,
    metrics: { ...retrieval, faithfulness: faith.score, grounding: faith.groundingRatio, claimSupport: faith.claimSupport, contradictions: faith.contradictions },
  };
}

function pct(n) { return (n * 100).toFixed(0).padStart(3) + '%'; }

(async () => {
  const cases = [];
  for (const c of GOLDEN_SET) cases.push(await runCase(c));

  const agg = aggregate(cases.map((c) => c.metrics));

  const W = 30;
  const rowFmt = (label, m) =>
    '  ' + String(label).slice(0, W - 1).padEnd(W) +
    pct(m.precision) + '  ' + pct(m['p@5']) + '  ' + pct(m['r@5']) + '  ' + pct(m.mrr) + '  ' + pct(m.map) + '  ' +
    pct(m['ndcg@5']) + '   ' + pct(m.grounding) + '  ' + pct(m.claimSupport) + '  ' + pct(m.faithfulness) +
    (m.contradictions ? '  ⚠contra' : '');

  log('\n  RAG EVALUATION — golden set (' + cases.length + ' topics, offline)\n');
  log('  ' + 'topic'.padEnd(W) + ' prec  p@5   r@5   MRR   MAP  nDCG@5  ground claim  faith');
  log('  ' + '─'.repeat(W + 58));
  for (const c of cases) log(rowFmt(c.topic, c.metrics));
  log('  ' + '─'.repeat(W + 58));
  log(rowFmt('AGGREGATE', agg));

  // Gate.
  const failures = [];
  for (const [k, floor] of Object.entries(FLOORS)) {
    if ((agg[k] ?? 0) < floor) failures.push(`${k}=${(agg[k] ?? 0).toFixed(2)} < floor ${floor}`);
  }

  const out = { ranAt: new Date().toISOString(), ks: KS, floors: FLOORS, aggregate: agg, cases, passed: failures.length === 0, failures };
  const here = dirname(fileURLToPath(import.meta.url));
  writeFileSync(join(here, '..', 'eval', 'last-run.json'), JSON.stringify(out, null, 2));

  if (jsonOnly) { console.log(JSON.stringify(out, null, 2)); }
  else {
    log('');
    if (failures.length) { log('  ❌ FAILED gate:'); for (const f of failures) log('     • ' + f); }
    else log('  ✅ PASSED all floors: ' + Object.entries(FLOORS).map(([k, v]) => `${k}≥${v}`).join(', '));
    log('');
  }
  process.exit(failures.length ? 1 : 0);
})();
