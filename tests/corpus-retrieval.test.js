import { describe, it, expect, vi } from 'vitest';
import { retrieveCorpusSpectra } from '../lib/corpusRetrieval.js';
import { EMBEDDING_DIM } from '../lib/corpusQueries.js';

const vec = () => Array(EMBEDDING_DIM).fill(0.1);
const grouped = {
  center: [{ id: 1, url: 'https://t.de/1', source_name: 'Tagesschau', source_domain: 'tagesschau.de',
             spectrum: 'center', article_title: 'Rentenreform beschlossen', our_summary: 'Zusammenfassung.',
             short_lead: 'Lead.', pubDate: new Date().toISOString(), _rrfScore: 0.5, _retrievers: ['lexical'] }],
};

describe('retrieveCorpusSpectra', () => {
  it('extracts keywords, embeds, retrieves, and returns spectra', async () => {
    const getEmbedding = vi.fn().mockResolvedValue(vec());
    const searchHybrid = vi.fn().mockResolvedValue({ grouped, meta: { fusedCount: 1 } });
    const out = await retrieveCorpusSpectra('Rentenreform 2027', { getEmbedding, searchHybrid });

    expect(getEmbedding).toHaveBeenCalled();
    expect(searchHybrid).toHaveBeenCalled();
    // embedding passed through to hybrid
    expect(searchHybrid.mock.calls[0][0]).toHaveLength(EMBEDDING_DIM);
    expect(out.total_articles).toBe(1);
    expect(out.spectra.center.articles[0]._corpusId).toBe(1);
    expect(out.search_meta.source).toBe('corpus');
    expect(out.search_meta.usedSemantic).toBe(true);
    expect(out.search_meta.retrieval).toEqual({ fusedCount: 1 });
  });

  it('degrades to lexical when getEmbedding returns null', async () => {
    const getEmbedding = vi.fn().mockResolvedValue(null);
    const searchHybrid = vi.fn().mockResolvedValue({ grouped, meta: {} });
    const out = await retrieveCorpusSpectra('Rentenreform', { getEmbedding, searchHybrid });
    expect(searchHybrid.mock.calls[0][0]).toBeNull();
    expect(out.search_meta.usedSemantic).toBe(false);
  });

  it('degrades to lexical when getEmbedding throws', async () => {
    const getEmbedding = vi.fn().mockRejectedValue(new Error('quota'));
    const searchHybrid = vi.fn().mockResolvedValue({ grouped, meta: {} });
    const out = await retrieveCorpusSpectra('Rentenreform', { getEmbedding, searchHybrid });
    expect(searchHybrid.mock.calls[0][0]).toBeNull();
    expect(out.search_meta.usedSemantic).toBe(false);
  });

  it('works without a getEmbedding dep at all (lexical-only)', async () => {
    const searchHybrid = vi.fn().mockResolvedValue({ grouped, meta: {} });
    const out = await retrieveCorpusSpectra('Rentenreform', { searchHybrid });
    expect(searchHybrid.mock.calls[0][0]).toBeNull();
    expect(out.total_articles).toBe(1);
  });

  it('returns empty spectra for a topic with no usable keywords', async () => {
    const searchHybrid = vi.fn();
    const out = await retrieveCorpusSpectra('', { searchHybrid });
    expect(searchHybrid).not.toHaveBeenCalled();
    expect(out.total_articles).toBe(0);
  });
});
