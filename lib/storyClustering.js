/**
 * lib/storyClustering.js — group a topic's retrieved articles into SUB-STORIES.
 *
 * A broad topic ("economy") usually contains several distinct threads (OECD
 * forecast, energy-transition debate, Bundestag summer break…). Clustering the
 * retrieved set surfaces those threads AND reveals sub-angles only one camp tells.
 *
 * Approach: query-time single-linkage agglomerative clustering over the current
 * result set (≤~60 articles), by lexical Jaccard similarity of significant tokens
 * (title + derived summary). Pure + cheap (O(n²)) — no embeddings round-trip, no
 * persistent centroids. Deterministic and fully unit-testable.
 */

import { CORPUS_SPECTRUMS } from './corpusQueries.js';

export const CLUSTER_SIM_THRESHOLD = 0.22;  // Jaccard; tuned for news headlines+ledes
const STOPISH = new Set(['über','unter','gegen','nach','beim','wird','wurde','werden','sein','haben','sind','eine','einen','einer','dass','sich','auch','noch','aber','oder','mehr','sehr','beim','dem','den','der','die','das','und','von','mit','für','ist','im','am','zu','zur','zum']);

/** Significant tokens: lowercased words ≥4 chars, minus a few German stopwords. */
export function tokenize(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-zäöüß0-9]+/)
      .filter(w => w.length >= 4 && !STOPISH.has(w))
  );
}

/** Jaccard similarity of two token sets. */
export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

function articleText(a) {
  return `${a.article_title || a.title || ''} ${a.our_summary || a.content_text || a.description || ''}`;
}

// ── union-find ────────────────────────────────────────────────────────────────
function makeDSU(n) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  return { find, union };
}

/** Pick a short label for a cluster: the most frequent significant tokens. */
function clusterLabel(tokenSets, topN = 3) {
  const freq = new Map();
  for (const ts of tokenSets) for (const w of ts) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([w]) => w)
    .join(' · ');
}

/**
 * Cluster articles into sub-stories.
 * @param {Array} articles — flattened, each with article_title + summary + spectrum
 * @param {object} opts — { threshold=CLUSTER_SIM_THRESHOLD, minSize=2, maxClusters=8 }
 * @returns {{ clusters, meta }}
 *   clusters: [{ id, label, size, spectra:{left:n,...}, coveredCamps, soloCamp, articles:[{title,source_name,url,spectrum}] }]
 *   sorted by size desc. Singletons (size 1) are returned only if they fit under
 *   maxClusters after the multi-article clusters (so nothing is silently dropped).
 */
export function clusterArticles(articles, opts = {}) {
  const threshold = opts.threshold ?? CLUSTER_SIM_THRESHOLD;
  const minSize = opts.minSize ?? 2;
  const maxClusters = opts.maxClusters ?? 8;
  const list = Array.isArray(articles) ? articles.filter(Boolean) : [];
  const n = list.length;
  const tokens = list.map(a => tokenize(articleText(a)));

  const dsu = makeDSU(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (jaccard(tokens[i], tokens[j]) >= threshold) dsu.union(i, j);
    }
  }

  // group indices by root
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const r = dsu.find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }

  let clusters = [...groups.values()].map((idxs, k) => {
    const spectra = Object.fromEntries(CORPUS_SPECTRUMS.map(s => [s, 0]));
    const arts = idxs.map(i => {
      const a = list[i];
      if (CORPUS_SPECTRUMS.includes(a.spectrum)) spectra[a.spectrum]++;
      return {
        title: a.article_title || a.title || '',
        source_name: a.source_name || '',
        url: a.article_url || a.url || '',
        spectrum: a.spectrum || null,
      };
    });
    const coveredCamps = CORPUS_SPECTRUMS.filter(s => spectra[s] > 0);
    return {
      id: k,
      label: clusterLabel(idxs.map(i => tokens[i])),
      size: idxs.length,
      spectra,
      coveredCamps,
      soloCamp: coveredCamps.length === 1 ? coveredCamps[0] : null, // sub-angle only one camp tells
      articles: arts,
    };
  });

  // multi-article clusters first (the real sub-stories), then largest singletons
  clusters.sort((a, b) => b.size - a.size || b.coveredCamps.length - a.coveredCamps.length);
  const multi = clusters.filter(c => c.size >= minSize);
  const result = (multi.length ? multi : clusters).slice(0, maxClusters);

  return {
    clusters: result,
    meta: {
      total: n,
      clusterCount: result.length,
      multiArticleClusters: multi.length,
      // sub-angles told by a single camp (sub-story-level blindspots)
      soloCamps: result.filter(c => c.soloCamp && c.size >= minSize).map(c => ({ label: c.label, camp: c.soloCamp, size: c.size })),
    },
  };
}
