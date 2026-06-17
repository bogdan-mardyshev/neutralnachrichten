/**
 * lib/corpusClustering.js — assign STABLE, persistent story (cluster) ids to corpus
 * articles, so sub-stories survive across requests instead of being recomputed
 * per analysis. A worker pass clusters the recent window and writes cluster_id.
 *
 * Stability: a cluster's id is the SMALLEST article id in the group. As long as
 * the earliest article persists, the story keeps its id; new articles joining an
 * existing story adopt that id. Deterministic and order-independent.
 *
 * Reuses the proven lexical similarity (Jaccard over title+lede tokens) from the
 * per-request clusterer, so persisted clusters match what the UI already shows.
 * Pure: no IO.
 */

import { tokenize, jaccard, CLUSTER_SIM_THRESHOLD } from './storyClustering.js';

const articleText = (a) => `${a.title || a.article_title || ''} ${a.our_summary || a.summary || a.description || ''}`;

/**
 * @param {Array<{id, title, our_summary, spectrum}>} articles — recent corpus rows
 * @param {object} opts — { threshold = CLUSTER_SIM_THRESHOLD }
 * @returns {Array<{ id, clusterId }>} one assignment per input article (singletons
 *          get their own id as clusterId). Skips rows without a numeric id.
 */
export function assignClusterIds(articles, { threshold = CLUSTER_SIM_THRESHOLD } = {}) {
  const list = (Array.isArray(articles) ? articles : []).filter(a => a && a.id != null && !Number.isNaN(Number(a.id)));
  const n = list.length;
  if (n === 0) return [];

  const toks = list.map(a => tokenize(articleText(a)));

  // Union-find over pairwise Jaccard similarity.
  const parent = list.map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (jaccard(toks[i], toks[j]) >= threshold) union(i, j);
    }
  }

  // Group members by root, then stamp each group with the minimum article id.
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }

  const out = [];
  for (const members of groups.values()) {
    const ids = members.map(i => Number(list[i].id));
    const clusterId = Math.min(...ids);
    for (const i of members) out.push({ id: Number(list[i].id), clusterId });
  }
  return out;
}

/** Number of distinct stories among assignments (diagnostic). */
export function countClusters(assignments) {
  return new Set((Array.isArray(assignments) ? assignments : []).map(a => a.clusterId)).size;
}
