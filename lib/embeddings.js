/**
 * lib/embeddings.js — thin, testable wrapper around Gemini text-embedding-004.
 *
 * Used by the ingestion worker to turn each article's derived text (title +
 * our_summary, see deriveArticle.embeddingInputText) into a 768-dim vector for
 * pgvector semantic retrieval.
 *
 * DESIGN:
 *   - makeEmbedder(getModel) takes a factory so tests can inject a fake model with
 *     no network. The default embedder uses the real @google/generative-ai client.
 *   - embedBatch() runs with a bounded concurrency instead of the SDK's
 *     batchEmbedContents — embeddings are cheap+fast, and per-item calls give us
 *     per-item error isolation (one bad article never fails the whole batch).
 *   - Every vector is validated to EMBEDDING_DIM. A wrong-dim vector is rejected
 *     (returns null) — we NEVER hand garbage to pgvector, which would corrupt the
 *     index / cosine distances. Same fail-loud philosophy as toVectorLiteral().
 *   - Graceful degradation: if no API key, the default embedder is null and
 *     getEmbedding() returns null. The worker then stores the article without an
 *     embedding and FTS retrieval still works.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { EMBEDDING_DIM, DEFAULT_EMBEDDING_MODEL } from './corpusQueries.js';

const rawKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_KEY = rawKey.replace(/["']/g, '').trim();

// Default concurrency for embedBatch — keeps us well under rate limits while
// still embedding a feed's worth of articles quickly.
export const DEFAULT_EMBED_CONCURRENCY = 5;

/**
 * Validate a raw embedding result into a clean number[] of EMBEDDING_DIM, or null.
 * Accepts either an array, or the SDK shape { embedding: { values: [...] } }.
 */
export function extractVector(result) {
  let values = null;
  if (Array.isArray(result)) {
    values = result;
  } else if (result && result.embedding && Array.isArray(result.embedding.values)) {
    values = result.embedding.values;
  } else if (result && Array.isArray(result.values)) {
    values = result.values;
  }
  if (!values || values.length !== EMBEDDING_DIM) return null;
  for (const v of values) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  }
  return values;
}

/**
 * Build an embedder from a model factory.
 * @param {() => { embedContent: Function }} getModel
 * @param {object} opts — { outputDimensionality? } when set, requests a specific
 *        vector size (needed for models like gemini-embedding-001 whose native dim
 *        is larger than our pgvector(768) column).
 */
export function makeEmbedder(getModel, opts = {}) {
  if (typeof getModel !== 'function') {
    throw new Error('makeEmbedder requires a model factory function');
  }
  const outputDimensionality = opts.outputDimensionality;

  /** Embed one text → number[EMBEDDING_DIM] or null (empty input / bad result / error).
   *  Silent on error (returns null) — the caller aggregates/logs, so one failing
   *  model can't spam thousands of identical lines during a corpus run. */
  async function embed(text) {
    const input = String(text || '').trim();
    if (!input) return null;
    try {
      const model = getModel();
      // Use the object request form only when we need outputDimensionality, so the
      // simple string path (and its tests) stay unchanged for native-768 models.
      const res = outputDimensionality
        ? await model.embedContent({ content: { parts: [{ text: input }] }, outputDimensionality })
        : await model.embedContent(input);
      return extractVector(res);
    } catch {
      return null;
    }
  }

  /**
   * Embed many texts with bounded concurrency. Returns an array aligned 1:1 with
   * the input (null where embedding failed), so callers can zip results back onto
   * their articles by index.
   */
  async function embedBatch(texts, { concurrency = DEFAULT_EMBED_CONCURRENCY } = {}) {
    const list = Array.isArray(texts) ? texts : [];
    const out = new Array(list.length).fill(null);
    let cursor = 0;

    const worker = async () => {
      while (cursor < list.length) {
        const i = cursor++;
        out[i] = await embed(list[i]);
      }
    };

    const lanes = Math.max(1, Math.min(concurrency, list.length || 1));
    await Promise.all(Array.from({ length: lanes }, worker));
    return out;
  }

  return { embed, embedBatch };
}

// ── Default (real) embedder with model fallback ─────────────────────────────────
//
// Different API keys/projects expose different embedding models: text-embedding-004
// 404'd on the production key ("not found for v1beta embedContent"). Rather than
// hard-code one model, we try a candidate chain and LOCK onto the first that works,
// so the worker self-heals regardless of which model the key supports. All target
// EMBEDDING_DIM (768): text-embedding-004 / embedding-001 are native-768;
// gemini-embedding-001 is requested at 768 via outputDimensionality.

export const EMBEDDING_MODEL_CANDIDATES = [
  ...(process.env.EMBEDDING_MODEL ? [process.env.EMBEDDING_MODEL] : []),
  DEFAULT_EMBEDDING_MODEL,   // text-embedding-004
  'gemini-embedding-001',
  'embedding-001',
];

/** Build a fallback embedder over a list of model names (deduped, in order). */
export function makeFallbackEmbedder(getModelByName, modelNames) {
  const names = [...new Set(modelNames.filter(Boolean))];
  const cache = new Map();
  let locked = null;

  const embedderFor = (name) => {
    if (!cache.has(name)) {
      const opts = name.includes('gemini-embedding') ? { outputDimensionality: EMBEDDING_DIM } : {};
      cache.set(name, makeEmbedder(() => getModelByName(name), opts));
    }
    return cache.get(name);
  };

  async function embed(text) {
    if (!String(text || '').trim()) return null;
    if (locked) return embedderFor(locked).embed(text);
    for (const name of names) {
      const v = await embedderFor(name).embed(text);
      if (v) {
        locked = name;
        console.log(`[embeddings] using model: ${name}`);
        return v;
      }
    }
    if (!embed._warned) {
      embed._warned = true;
      console.warn(`[embeddings] no working model in [${names.join(', ')}] — storing articles without vectors (FTS-only)`);
    }
    return null;
  }

  async function embedBatch(texts, { concurrency = DEFAULT_EMBED_CONCURRENCY } = {}) {
    const list = Array.isArray(texts) ? texts : [];
    if (list.length === 0) return [];
    // Resolve the working model once (sequentially) before fanning out, so the
    // whole batch uses the locked model and we don't probe in parallel.
    const first = await embed(list[0]);
    const out = new Array(list.length).fill(null);
    out[0] = first;
    let cursor = 1;
    const worker = async () => {
      while (cursor < list.length) {
        const i = cursor++;
        out[i] = await embed(list[i]);
      }
    };
    const lanes = Math.max(1, Math.min(concurrency, Math.max(1, list.length - 1)));
    await Promise.all(Array.from({ length: lanes }, worker));
    return out;
  }

  return { embed, embedBatch, get lockedModel() { return locked; } };
}

let _defaultEmbedder = null;
if (GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  _defaultEmbedder = makeFallbackEmbedder(
    (name) => genAI.getGenerativeModel({ model: name }),
    EMBEDDING_MODEL_CANDIDATES
  );
}

/** True when an API key is configured and the default embedder is usable. */
export function isEmbeddingAvailable() {
  return _defaultEmbedder !== null;
}

/** Embed one text with the default embedder. Returns null when unavailable. */
export async function getEmbedding(text) {
  if (!_defaultEmbedder) return null;
  return _defaultEmbedder.embed(text);
}

/** Embed many texts with the default embedder. Returns all-null when unavailable. */
export async function getEmbeddingsBatch(texts, opts) {
  if (!_defaultEmbedder) return (Array.isArray(texts) ? texts : []).map(() => null);
  return _defaultEmbedder.embedBatch(texts, opts);
}
