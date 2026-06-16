#!/usr/bin/env node
/**
 * scripts/rag-capture.mjs — capture REAL retrieval output for human labelling.
 *
 * This is the bridge from the synthetic golden set (hand-authored fixtures that
 * only test our LOGIC) to a real RAG-eval (measures actual accuracy on the live
 * German-news corpus). It runs the EXACT production retrieval path against the
 * configured database + embeddings, then dumps the raw candidates per topic into
 * eval/candidates/<slug>.json with a `relevant: null` field on every row for you
 * to fill in (true/false). No auto-labelling — that would defeat the purpose.
 *
 * Crucially it captures candidates BEFORE the relevance gate and flags which ones
 * the gate kept (`passedGate`), so labelling reveals BOTH:
 *   • gate precision — of what we show, how much is on-topic, and
 *   • gate recall    — relevant articles the gate wrongly dropped (false negatives).
 *
 * Requires DATABASE_URL (+ ingested corpus) and a Gemini API key for embeddings.
 * Run against staging:
 *   DATABASE_URL=... GEMINI_API_KEY=... node scripts/rag-capture.mjs
 *   ... node scripts/rag-capture.mjs -- "Rentenreform" "Heizungsgesetz"   # custom topics
 *
 * Then label eval/candidates/*.json and score with:  npm run eval:rag -- --real
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

import { initDB, isDBAvailable, closeDB, searchCorpusHybrid, getCorpusStats } from '../db.js';
import { getEmbedding, isEmbeddingAvailable } from '../lib/embeddings.js';
import { extractSearchKeywords } from '../lib/rssSearch.js';
import { corpusToSpectra } from '../lib/corpusToSpectra.js';
import { CORPUS_SPECTRUMS } from '../lib/corpusQueries.js';

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(here, '..', 'eval', 'candidates');

// Default topics — broad, real German news themes. Override via `-- topic1 topic2`.
const DEFAULT_TOPICS = [
  'Rentenreform', 'Heizungsgesetz', 'Mietpreisbremse', 'Bürgergeld', 'Migration Asylpolitik',
  'Atomausstieg', 'Tempolimit', 'Wehrpflicht', 'Krankenhausreform', 'Deutschlandticket',
  'Cannabis Legalisierung', 'Strompreis Industrie', 'Klimaschutzgesetz', 'KI-Regulierung', 'Lieferkettengesetz',
];

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// Mirror corpusRetrieval.js EXACTLY so capture reflects production retrieval.
function topicWordsOf(topic) {
  return String(topic).toLowerCase().split(/[^a-zäöüß0-9]+/).filter((w) => w.length >= 3);
}

async function captureTopic(topic, opts) {
  const keywords = extractSearchKeywords(topic);
  if (!keywords.length) return { topic, error: 'no usable keywords' };

  let embedding = null;
  try { embedding = await getEmbedding(String(topic).trim() || keywords.join(' ')); }
  catch (e) { console.warn(`  [embed] ${topic}: ${e.message} — lexical only`); }

  const { grouped, meta } = await searchCorpusHybrid(embedding, keywords, opts);
  const topicWords = topicWordsOf(topic);

  // Which raw candidates survive the production relevance gate?
  const gated = corpusToSpectra(grouped, { keywords, topicWords });
  const keptUrls = new Set();
  for (const sp of CORPUS_SPECTRUMS) for (const a of (gated.spectra[sp]?.articles || [])) keptUrls.add(a.article_url);

  const candidates = [];
  for (const sp of CORPUS_SPECTRUMS) {
    for (const r of (Array.isArray(grouped[sp]) ? grouped[sp] : [])) {
      candidates.push({
        id: r.id ?? null,
        spectrum: sp,
        source_name: r.source_name || '',
        source_domain: r.source_domain || '',
        article_title: r.article_title || r.title || '',
        our_summary: r.our_summary || r.short_lead || '',
        url: r.url || '',
        score: Number((r._rrfScore ?? 0).toFixed?.(4) ?? r._rrfScore ?? 0),
        retrievers: r._retrievers || [],
        passedGate: keptUrls.has(r.url || ''),
        relevant: null, // ← LABEL THIS: true if genuinely on-topic, else false
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  return {
    topic, keywords, topicWords,
    capturedAt: new Date().toISOString(),
    usedSemantic: !!embedding,
    retrieval: meta || null,
    rawCount: candidates.length,
    keptCount: candidates.filter((c) => c.passedGate).length,
    instructions: 'Set "relevant" to true/false on every candidate. Then run: npm run eval:rag -- --real',
    candidates,
  };
}

(async () => {
  const dashIdx = process.argv.indexOf('--');
  const topics = dashIdx >= 0 ? process.argv.slice(dashIdx + 1) : DEFAULT_TOPICS;

  await initDB();
  if (!isDBAvailable()) {
    console.error('\n  ❌ No database. Set DATABASE_URL (staging) and ensure the corpus is ingested.');
    console.error('     DATABASE_URL=... GEMINI_API_KEY=... node scripts/rag-capture.mjs\n');
    process.exit(2);
  }
  if (!isEmbeddingAvailable()) {
    console.warn('\n  ⚠ No embedding key — capturing LEXICAL-ONLY retrieval (set GEMINI_API_KEY for semantic).\n');
  }

  try {
    const stats = await getCorpusStats().catch(() => null);
    if (stats) console.log(`  corpus: ${stats.total ?? stats.totalArticles ?? '?'} articles\n`);
  } catch { /* non-fatal */ }

  mkdirSync(OUT_DIR, { recursive: true });
  const opts = { limit: 250, perSpectrum: 60 };
  let ok = 0;

  for (const topic of topics) {
    try {
      const cap = await captureTopic(topic, opts);
      if (cap.error) { console.warn(`  ⚠ ${topic}: ${cap.error}`); continue; }
      const file = join(OUT_DIR, slug(topic) + '.json');
      writeFileSync(file, JSON.stringify(cap, null, 2));
      console.log(`  ✓ ${topic.padEnd(28)} raw=${String(cap.rawCount).padStart(3)} kept=${String(cap.keptCount).padStart(3)}  semantic=${cap.usedSemantic}  → ${file.split('/').slice(-2).join('/')}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${topic}: ${e.message}`);
    }
  }

  console.log(`\n  Captured ${ok}/${topics.length} topics → eval/candidates/`);
  console.log('  Next: label "relevant" on each candidate, then `npm run eval:rag -- --real`\n');
  await closeDB();
  process.exit(0);
})();
