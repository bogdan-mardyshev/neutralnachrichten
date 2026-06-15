/**
 * lib/corpusRetrieval.js — orchestrate corpus-backed retrieval for a topic.
 *
 * topic → keywords (extractSearchKeywords) → query embedding → hybrid retrieval
 * (semantic + lexical, fused) → searchAllFeeds-compatible spectra.
 *
 * Dependency-injected (getEmbedding, searchHybrid) so it's unit-tested without DB
 * or the embedding API. server.js wires the real db.searchCorpusHybrid + embeddings.
 */

import { extractSearchKeywords } from './rssSearch.js';
import { corpusToSpectra } from './corpusToSpectra.js';

/**
 * @param {string} topic
 * @param {object} deps — {
 *   getEmbedding(text) => number[]|null,    // optional; null disables semantic path
 *   searchHybrid(embedding, keywords, opts) => { grouped, meta },
 * }
 * @param {object} opts — { spectra?, sinceDate?, limit?, perSpectrum? }
 * @returns {Promise<{spectra, total_articles, fetched_at, search_meta}>}
 */
export async function retrieveCorpusSpectra(topic, deps, opts = {}) {
  const keywords = extractSearchKeywords(topic);
  if (!keywords.length) {
    return corpusToSpectra({}, { keywords: [] });
  }

  let embedding = null;
  if (typeof deps.getEmbedding === 'function') {
    try {
      embedding = await deps.getEmbedding(keywords.join(' '));
    } catch {
      embedding = null; // semantic off → hybrid degrades to lexical
    }
  }

  const { grouped, meta } = await deps.searchHybrid(embedding, keywords, opts);
  // Original topic words drive the relevance gate (distinct concepts, not expansions).
  const topicWords = String(topic).toLowerCase().split(/[^a-zäöüß0-9]+/).filter(w => w.length >= 3);
  const result = corpusToSpectra(grouped, { keywords, topicWords });
  result.search_meta.retrieval = meta || null;
  result.search_meta.usedSemantic = !!embedding;
  return result;
}
