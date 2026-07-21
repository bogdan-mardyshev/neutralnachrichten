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

import { readdirSync, readFileSync } from 'node:fs';
import { GOLDEN_SET } from '../eval/golden-set.js';
import { labelledCases } from '../eval/loadLabeled.js';
import { corpusToSpectra } from '../lib/corpusToSpectra.js';
import { groundAnalysis, dedupeArticles } from '../lib/citationGrounding.js';
import { extractClaims, verifyClaims, flattenCorpus } from '../lib/claimVerification.js';
import { scoreRetrievalCase, faithfulnessScore, aggregate } from '../lib/ragEval.js';

const KS = [1, 3, 5];
// Gate on SET-precision (off-topic filler), recall@5 (coverage), MRR (top hit),
// and faithfulness (grounding × support). p@5 is reported but NOT gated — with
// 3–4 relevant docs per topic it is capped below 1 by construction.
const FLOORS = { precision: 0.85, 'r@5': 0.80, mrr: 0.85, faithfulness: 0.60 };
// Real labelled captures carry no authored synthesis → retrieval metrics only.
const REAL_FLOORS = { precision: 0.85, 'r@5': 0.80, mrr: 0.85 };

const realMode = process.argv.includes('--real');
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

  const out = { id: c.id, topic: c.topic, retrieved: rankedIds.length, relevant: c.relevantIds.length, metrics: { ...retrieval } };

  // 2) Faithfulness only when the case carries an authored synthesis (synthetic
  //    golden set). Real captures are retrieval-only until an analysis is attached.
  if (c.analysis) {
    const { report: grounding } = groundAnalysis(c.analysis, spectra);
    const claims = extractClaims(c.analysis);
    const flat = dedupeArticles(flattenCorpus(spectra));
    const { report: claimReport } = await verifyClaims(claims, flat, {}); // lexical
    const faith = faithfulnessScore({ grounding, claims: claimReport });
    Object.assign(out.metrics, { faithfulness: faith.score, grounding: faith.groundingRatio, claimSupport: faith.claimSupport, contradictions: faith.contradictions });
  }
  return out;
}

function pct(n) { return Number.isFinite(n) ? (n * 100).toFixed(0).padStart(3) + '%' : '  —'; }

/** Load + parse human-labelled capture files into scoreable cases. */
function loadRealCases() {
  let files = [];
  try { files = readdirSync(join(here(), '..', 'eval', 'candidates')).filter((f) => f.endsWith('.json')); }
  catch { return []; }
  const parsed = [];
  for (const f of files) {
    try { parsed.push(JSON.parse(readFileSync(join(here(), '..', 'eval', 'candidates', f), 'utf-8'))); }
    catch (e) { console.warn(`  skip ${f}: ${e.message}`); }
  }
  return labelledCases(parsed);
}
function here() { return dirname(fileURLToPath(import.meta.url)); }

(async () => {
  const source = realMode ? loadRealCases() : GOLDEN_SET;
  if (realMode && source.length === 0) {
    log('\n  No labelled captures in eval/candidates/ yet.');
    log('  1) capture:  node scripts/rag-capture.mjs           (needs staging DATABASE_URL + embeddings)');
    log('  2) label:    set "relevant": true/false in each eval/candidates/*.json');
    log('  3) score:    npm run eval:rag -- --real\n');
    process.exit(0);
  }

  const cases = [];
  for (const c of source) cases.push(await runCase(c));

  const agg = aggregate(cases.map((c) => c.metrics));

  const floors = realMode ? REAL_FLOORS : FLOORS;
  const W = 30;
  const rowFmt = (label, m) =>
    '  ' + String(label).slice(0, W - 1).padEnd(W) +
    pct(m.precision) + '  ' + pct(m['p@5']) + '  ' + pct(m['r@5']) + '  ' + pct(m.mrr) + '  ' + pct(m.map) + '  ' +
    pct(m['ndcg@5']) + '   ' + pct(m.grounding) + '  ' + pct(m.claimSupport) + '  ' + pct(m.faithfulness) +
    (m.contradictions ? '  ⚠contra' : '');

  log('\n  RAG EVALUATION — ' + (realMode ? 'REAL labelled corpus' : 'synthetic golden set') + ' (' + cases.length + ' topics)\n');
  log('  ' + 'topic'.padEnd(W) + ' prec  p@5   r@5   MRR   MAP  nDCG@5  ground claim  faith');
  log('  ' + '─'.repeat(W + 58));
  for (const c of cases) log(rowFmt(c.topic, c.metrics));
  log('  ' + '─'.repeat(W + 58));
  log(rowFmt('AGGREGATE', agg));
  if (realMode) log('\n  (real captures are retrieval-only — grounding/claim/faith need an attached synthesis)');

  // Gate.
  const failures = [];
  for (const [k, floor] of Object.entries(floors)) {
    if ((agg[k] ?? 0) < floor) failures.push(`${k}=${(agg[k] ?? 0).toFixed(2)} < floor ${floor}`);
  }

  const outFile = realMode ? 'last-run-real.json' : 'last-run.json';
  const out = { ranAt: new Date().toISOString(), mode: realMode ? 'real' : 'synthetic', ks: KS, floors, aggregate: agg, cases, passed: failures.length === 0, failures };
  writeFileSync(join(here(), '..', 'eval', outFile), JSON.stringify(out, null, 2));

  if (jsonOnly) { console.log(JSON.stringify(out, null, 2)); }
  else {
    log('');
    if (failures.length) { log('  ❌ FAILED gate:'); for (const f of failures) log('     • ' + f); }
    else log('  ✅ PASSED all floors: ' + Object.entries(floors).map(([k, v]) => `${k}≥${v}`).join(', '));
    log('');
  }
  process.exit(failures.length ? 1 : 0);
})();
