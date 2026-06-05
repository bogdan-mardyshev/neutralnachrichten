/**
 * lib/hybridRetrieval.js — fuse semantic (pgvector) + lexical (FTS) retrieval.
 *
 * WHY hybrid:
 *   - Semantic (vector) recall catches paraphrases & synonyms the keyword index
 *     misses ("Rentenreform" ↔ "Altersvorsorge-Gesetz").
 *   - Lexical (FTS) precision nails exact entities/numbers vectors blur over
 *     (names, "§219a", "2027").
 *   Fusing both beats either alone — the reliability win behind Corpus V2 retrieval.
 *
 * HOW — Reciprocal Rank Fusion (RRF):
 *   score(d) = Σ_lists 1 / (k + rank_list(d))
 *   RRF is rank-based, so it needs NO score normalization between two retrievers
 *   that return incomparable scales (cosine distance vs ts_rank). k dampens the
 *   weight of low ranks; k=60 is the well-established default (Cormack et al. 2009).
 *
 * Pure module: operates on already-fetched ranked lists. db.searchCorpusHybrid
 * does the IO and calls fuseRankings() here.
 */

import { CORPUS_SPECTRUMS } from './corpusQueries.js';

export const RRF_K = 60;

/**
 * Reciprocal Rank Fusion over N ranked lists of items.
 *
 * @param {Array<{name:string, items:Array<{id:any}>}>} lists
 *        Each list is already sorted best-first; items must have a stable `id`.
 * @param {object} opts — { k=RRF_K, limit? }
 * @returns {Array} fused items (best-first), each annotated with:
 *          _rrfScore (number) and _retrievers (string[] — which lists matched it).
 */
export function fuseRankings(lists, { k = RRF_K, limit } = {}) {
  const acc = new Map(); // id -> { item, score, retrievers:Set, bestRank }
  const safeLists = Array.isArray(lists) ? lists : [];

  for (const list of safeLists) {
    const name = list?.name || 'list';
    const items = Array.isArray(list?.items) ? list.items : [];
    items.forEach((item, idx) => {
      if (!item || item.id == null) return;
      const rank = idx + 1;
      const contrib = 1 / (k + rank);
      const cur = acc.get(item.id);
      if (cur) {
        cur.score += contrib;
        cur.retrievers.add(name);
        // Keep the richer item if the existing one is sparser (defensive).
        if (!cur.item.our_summary && item.our_summary) cur.item = item;
      } else {
        acc.set(item.id, { item, score: contrib, retrievers: new Set([name]) });
      }
    });
  }

  let fused = [...acc.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ item, score, retrievers }) => ({
      ...item,
      _rrfScore: score,
      _retrievers: [...retrievers],
    }));

  if (Number.isInteger(limit) && limit > 0) fused = fused.slice(0, limit);
  return fused;
}

/**
 * Cap how many items each spectrum contributes, preserving fused order.
 * Defends balanced analysis: prevents one over-publishing camp (e.g. a 400-item
 * feed) from crowding out quieter spectra in the retrieved set.
 *
 * @param {Array} items — fused items (best-first), each with a `spectrum`
 * @param {object} opts — { perSpectrum=Infinity, total? }
 */
export function balanceBySpectrum(items, { perSpectrum = Infinity, total } = {}) {
  const counts = Object.create(null);
  const out = [];
  for (const it of Array.isArray(items) ? items : []) {
    const sp = it?.spectrum;
    const n = counts[sp] || 0;
    if (n >= perSpectrum) continue;
    counts[sp] = n + 1;
    out.push(it);
    if (Number.isInteger(total) && total > 0 && out.length >= total) break;
  }
  return out;
}

/** Group fused items into the per-spectrum shape the analysis pipeline consumes. */
export function groupBySpectrum(items) {
  const grouped = {};
  for (const s of CORPUS_SPECTRUMS) grouped[s] = [];
  for (const it of Array.isArray(items) ? items : []) {
    if (it && CORPUS_SPECTRUMS.includes(it.spectrum)) grouped[it.spectrum].push(it);
  }
  return grouped;
}

/**
 * Pure end-to-end fusion: take the two raw retriever outputs and produce the
 * final ranked + balanced + grouped result. Kept pure so it's fully testable;
 * db.searchCorpusHybrid only supplies the two fetched lists.
 *
 * @param {object} args — {
 *   semantic: Array,   // from searchCorpusSemantic (may be [] when pgvector off)
 *   lexical:  Array,   // from searchCorpusFTS
 *   k?, limit?, perSpectrum?
 * }
 * @returns {{ ranked:Array, grouped:object, meta:object }}
 */
export function combineRetrieval({ semantic = [], lexical = [], k = RRF_K, limit = 50, perSpectrum } = {}) {
  const fused = fuseRankings(
    [
      { name: 'semantic', items: semantic },
      { name: 'lexical',  items: lexical },
    ],
    { k }
  );

  const balanced = perSpectrum
    ? balanceBySpectrum(fused, { perSpectrum, total: limit })
    : fused.slice(0, limit);

  return {
    ranked: balanced,
    grouped: groupBySpectrum(balanced),
    meta: {
      semanticCount: semantic.length,
      lexicalCount: lexical.length,
      fusedCount: fused.length,
      returnedCount: balanced.length,
      bothRetrieversCount: fused.filter(x => x._retrievers.length > 1).length,
    },
  };
}
