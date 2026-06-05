import { describe, it, expect, vi } from 'vitest';
import {
  isWithinAge,
  ingestFeed,
  summarizeRun,
  runIngestionOnce,
  DEFAULT_INGEST_OPTS,
} from '../lib/ingestionWorker.js';
import { EMBEDDING_DIM } from '../lib/corpusQueries.js';

const FEED = { name: 'Tagesschau', domain: 'tagesschau.de', url: 'https://t.de/rss', spectrum: 'center' };
const vec = () => Array(EMBEDDING_DIM).fill(0.1);

const item = (over = {}) => ({
  title: 'Bundestag beschließt Reform',
  description: 'Teaser.',
  contentText: 'Der Bundestag hat heute eine Reform beschlossen. Mehr Details folgen. Inkrafttreten 2027.',
  link: 'https://t.de/a/' + Math.random().toString(36).slice(2),
  pubDate: new Date(),
  ...over,
});

/** Build a deps object with sensible spies; override per test. */
function makeDeps(over = {}) {
  return {
    fetchFeed: vi.fn().mockResolvedValue({ feed: FEED, items: [item(), item()] }),
    upsertArticle: vi.fn().mockResolvedValue({ id: 1, inserted: true }),
    embedBatch: vi.fn().mockImplementation(async (texts) => texts.map(() => vec())),
    upsertEmbedding: vi.fn().mockResolvedValue(true),
    recordSuccess: vi.fn().mockResolvedValue(undefined),
    recordFailure: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe('isWithinAge', () => {
  it('includes recent dates', () => {
    expect(isWithinAge(new Date(), 14)).toBe(true);
  });
  it('excludes old dates', () => {
    const old = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    expect(isWithinAge(old, 14)).toBe(false);
  });
  it('includes unknown/invalid dates (treated as unknown age)', () => {
    expect(isWithinAge(null, 14)).toBe(true);
    expect(isWithinAge(new Date('garbage'), 14)).toBe(true);
  });
});

describe('ingestFeed — happy path', () => {
  it('records success, derives, embeds, and upserts every article', async () => {
    const deps = makeDeps();
    const stats = await ingestFeed(FEED, deps);
    expect(deps.recordSuccess).toHaveBeenCalledWith(FEED.url, FEED.name, FEED.spectrum);
    expect(deps.recordFailure).not.toHaveBeenCalled();
    expect(stats.ok).toBe(true);
    expect(stats.fetched).toBe(2);
    expect(stats.eligible).toBe(2);
    expect(stats.inserted).toBe(2);
    expect(stats.embedded).toBe(2);
    expect(deps.upsertArticle).toHaveBeenCalledTimes(2);
    expect(deps.upsertEmbedding).toHaveBeenCalledTimes(2);
  });

  it('passes ONLY derived fields to upsertArticle (no full body leak)', async () => {
    const fourSentenceBody =
      'Der Bundestag hat heute eine Reform beschlossen. Die Opposition kritisierte das. '
      + 'Inkrafttreten ist 2027. Weitere Details folgen in den kommenden Wochen.';
    const deps = makeDeps({
      fetchFeed: vi.fn().mockResolvedValue({ items: [item({ contentText: fourSentenceBody })] }),
    });
    await ingestFeed(FEED, deps);
    const arg = deps.upsertArticle.mock.calls[0][0];
    expect(arg).not.toHaveProperty('contentText');
    expect(arg).not.toHaveProperty('content_text');
    expect(arg).not.toHaveProperty('body');
    expect(arg).toHaveProperty('our_summary');
    expect(arg).toHaveProperty('short_lead');
    // 4th sentence is beyond the 3-sentence lede budget → must be dropped.
    expect(arg.our_summary).not.toContain('Weitere Details folgen');
  });

  it('counts updates vs inserts from the upsert result', async () => {
    const deps = makeDeps({
      upsertArticle: vi.fn()
        .mockResolvedValueOnce({ id: 1, inserted: true })
        .mockResolvedValueOnce({ id: 2, inserted: false }),
    });
    const stats = await ingestFeed(FEED, deps);
    expect(stats.inserted).toBe(1);
    expect(stats.updated).toBe(1);
  });
});

describe('ingestFeed — failures & edge cases', () => {
  it('records failure when fetch errors and stores nothing', async () => {
    const deps = makeDeps({ fetchFeed: vi.fn().mockResolvedValue({ error: 'HTTP 500', items: [] }) });
    const stats = await ingestFeed(FEED, deps);
    expect(deps.recordFailure).toHaveBeenCalledWith(FEED.url, FEED.name, FEED.spectrum);
    expect(deps.recordSuccess).not.toHaveBeenCalled();
    expect(stats.ok).toBe(false);
    expect(stats.inserted).toBe(0);
    expect(deps.upsertArticle).not.toHaveBeenCalled();
  });

  it('records failure when fetch throws', async () => {
    const deps = makeDeps({ fetchFeed: vi.fn().mockRejectedValue(new Error('network')) });
    const stats = await ingestFeed(FEED, deps);
    expect(deps.recordFailure).toHaveBeenCalled();
    expect(stats.ok).toBe(false);
  });

  it('treats an empty item list as feed failure', async () => {
    const deps = makeDeps({ fetchFeed: vi.fn().mockResolvedValue({ items: [] }) });
    const stats = await ingestFeed(FEED, deps);
    expect(deps.recordFailure).toHaveBeenCalled();
    expect(stats.ok).toBe(false);
  });

  it('marks feed ok but skips un-derivable items (no URL)', async () => {
    const deps = makeDeps({
      fetchFeed: vi.fn().mockResolvedValue({ items: [item({ link: '' }), item()] }),
    });
    const stats = await ingestFeed(FEED, deps);
    expect(stats.ok).toBe(true);
    expect(stats.skipped).toBe(1);
    expect(stats.eligible).toBe(1);
    expect(stats.inserted).toBe(1);
  });

  it('filters out articles older than maxAgeDays', async () => {
    const old = item({ pubDate: new Date(Date.now() - 60 * 24 * 3600 * 1000) });
    const deps = makeDeps({ fetchFeed: vi.fn().mockResolvedValue({ items: [old, item()] }) });
    const stats = await ingestFeed(FEED, deps, { maxAgeDays: 14 });
    expect(stats.fetched).toBe(2);
    expect(stats.eligible).toBe(1);
  });

  it('caps at maxPerFeed (newest first)', async () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      item({ pubDate: new Date(Date.now() - i * 3600 * 1000) }));
    const deps = makeDeps({ fetchFeed: vi.fn().mockResolvedValue({ items }) });
    const stats = await ingestFeed(FEED, deps, { maxPerFeed: 3 });
    expect(stats.eligible).toBe(3);
    expect(deps.upsertArticle).toHaveBeenCalledTimes(3);
  });

  it('stores the article even when embedding fails (null vector)', async () => {
    const deps = makeDeps({ embedBatch: vi.fn().mockResolvedValue([null, null]) });
    const stats = await ingestFeed(FEED, deps);
    expect(stats.inserted).toBe(2);
    expect(stats.embedded).toBe(0);
    expect(deps.upsertEmbedding).not.toHaveBeenCalled();
  });

  it('skips embedding entirely when withEmbeddings=false', async () => {
    const deps = makeDeps();
    const stats = await ingestFeed(FEED, deps, { withEmbeddings: false });
    expect(deps.embedBatch).not.toHaveBeenCalled();
    expect(stats.embedded).toBe(0);
    expect(stats.inserted).toBe(2);
  });

  it('counts upsert errors without aborting the loop', async () => {
    const deps = makeDeps({
      upsertArticle: vi.fn()
        .mockResolvedValueOnce({ id: 1, inserted: true })
        .mockRejectedValueOnce(new Error('db down')),
    });
    const stats = await ingestFeed(FEED, deps);
    expect(stats.inserted).toBe(1);
    expect(stats.errors).toBe(1);
  });

  it('survives embedBatch throwing (stores articles w/o vectors)', async () => {
    const deps = makeDeps({ embedBatch: vi.fn().mockRejectedValue(new Error('quota')) });
    const stats = await ingestFeed(FEED, deps);
    expect(stats.inserted).toBe(2);
    expect(stats.embedded).toBe(0);
  });
});

describe('summarizeRun', () => {
  it('aggregates per-feed stats', () => {
    const perFeed = [
      { ok: true, fetched: 5, eligible: 4, inserted: 3, updated: 1, embedded: 4, skipped: 0, errors: 0 },
      { ok: false, fetched: 0, eligible: 0, inserted: 0, updated: 0, embedded: 0, skipped: 0, errors: 0 },
    ];
    const s = summarizeRun(perFeed);
    expect(s.feeds).toBe(2);
    expect(s.feedsOk).toBe(1);
    expect(s.feedsDown).toBe(1);
    expect(s.inserted).toBe(3);
    expect(s.embedded).toBe(4);
  });
});

describe('runIngestionOnce', () => {
  it('runs every configured feed and returns a summary', async () => {
    const deps = makeDeps();
    const summary = await runIngestionOnce(deps, { maxPerFeed: 1 });
    // 33 feeds configured across the spectrum (18 original + 15 added in Step 11)
    expect(summary.feeds).toBe(33);
    expect(summary.feedsOk).toBe(33);
    expect(deps.fetchFeed).toHaveBeenCalledTimes(33);
    expect(summary.inserted).toBeGreaterThan(0);
  });
});

describe('DEFAULT_INGEST_OPTS', () => {
  it('has sane defaults', () => {
    expect(DEFAULT_INGEST_OPTS.maxAgeDays).toBeGreaterThan(0);
    expect(DEFAULT_INGEST_OPTS.maxPerFeed).toBeGreaterThan(0);
    expect(DEFAULT_INGEST_OPTS.withEmbeddings).toBe(true);
  });
});
