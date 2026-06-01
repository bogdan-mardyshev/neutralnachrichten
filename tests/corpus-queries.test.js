import { describe, it, expect } from 'vitest';
import {
  urlHash,
  clampShortLead,
  toVectorLiteral,
  sanitizeTsToken,
  buildTsQueryExpr,
  computeFeedStatus,
  isValidSpectrum,
  buildUpsertArticleQuery,
  buildFTSQuery,
  buildVectorQuery,
  buildUpsertEmbeddingQuery,
  buildFeedSuccessQuery,
  buildFeedFailureQuery,
  buildDownFeedsQuery,
  buildUpsertSourceRatingQuery,
  normalizeArticleRow,
  EMBEDDING_DIM,
  SHORT_LEAD_MAX,
  CORPUS_SPECTRUMS,
} from '../lib/corpusQueries.js';

const vec = (fill = 0.1, dim = EMBEDDING_DIM) => Array(dim).fill(fill);

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

describe('urlHash', () => {
  it('is stable for the same URL', () => {
    expect(urlHash('https://taz.de/x')).toBe(urlHash('https://taz.de/x'));
  });
  it('trims surrounding whitespace before hashing', () => {
    expect(urlHash('  https://taz.de/x  ')).toBe(urlHash('https://taz.de/x'));
  });
  it('differs for different URLs', () => {
    expect(urlHash('https://taz.de/a')).not.toBe(urlHash('https://taz.de/b'));
  });
  it('is a 32-char md5 hex', () => {
    expect(urlHash('https://x.de')).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe('clampShortLead', () => {
  it('clamps to SHORT_LEAD_MAX chars', () => {
    expect(clampShortLead('z'.repeat(500)).length).toBe(SHORT_LEAD_MAX);
  });
  it('trims and leaves short text intact', () => {
    expect(clampShortLead('  hi  ')).toBe('hi');
  });
  it('handles null/undefined', () => {
    expect(clampShortLead(null)).toBe('');
    expect(clampShortLead(undefined)).toBe('');
  });
});

describe('toVectorLiteral', () => {
  it('renders a pgvector literal', () => {
    expect(toVectorLiteral([0.1, 0.2, 0.3], 3)).toBe('[0.1,0.2,0.3]');
  });
  it('throws on wrong dimension', () => {
    expect(() => toVectorLiteral([0.1, 0.2], 3)).toThrow(/3 dims/);
  });
  it('throws on non-array', () => {
    expect(() => toVectorLiteral('nope')).toThrow(/array/);
  });
  it('throws on non-finite values', () => {
    expect(() => toVectorLiteral([NaN, 1, 2], 3)).toThrow(/finite/);
    expect(() => toVectorLiteral([Infinity, 1, 2], 3)).toThrow(/finite/);
  });
  it('accepts a full 768-dim vector', () => {
    expect(() => toVectorLiteral(vec())).not.toThrow();
  });
});

describe('sanitizeTsToken', () => {
  it('lowercases and keeps letters/digits', () => {
    expect(sanitizeTsToken('Klima2024')).toBe('klima2024');
  });
  it('keeps German umlauts and ß', () => {
    expect(sanitizeTsToken('Größe')).toBe('größe');
  });
  it('strips tsquery operators (injection safety)', () => {
    expect(sanitizeTsToken("a&b|c!d:e()")).toBe('abcde');
  });
  it('returns empty for pure punctuation', () => {
    expect(sanitizeTsToken('!@#$%')).toBe('');
  });
});

describe('buildTsQueryExpr', () => {
  it('OR-joins sanitized tokens', () => {
    expect(buildTsQueryExpr(['Klima', 'Wandel'])).toBe('klima | wandel');
  });
  it('dedupes tokens', () => {
    expect(buildTsQueryExpr(['klima', 'Klima'])).toBe('klima');
  });
  it('drops empty tokens', () => {
    expect(buildTsQueryExpr(['klima', '!!!', ''])).toBe('klima');
  });
  it('returns empty string when nothing usable', () => {
    expect(buildTsQueryExpr(['!!!', '@@@'])).toBe('');
  });
  it('accepts a single string', () => {
    expect(buildTsQueryExpr('Rente')).toBe('rente');
  });
});

describe('computeFeedStatus', () => {
  it('0 failures → ok', () => expect(computeFeedStatus(0)).toBe('ok'));
  it('1-2 failures → degraded', () => {
    expect(computeFeedStatus(1)).toBe('degraded');
    expect(computeFeedStatus(2)).toBe('degraded');
  });
  it('3+ failures → down', () => {
    expect(computeFeedStatus(3)).toBe('down');
    expect(computeFeedStatus(10)).toBe('down');
  });
  it('treats missing as 0/ok', () => expect(computeFeedStatus(undefined)).toBe('ok'));
});

describe('isValidSpectrum', () => {
  it('accepts all 5 spectrums', () => {
    for (const s of CORPUS_SPECTRUMS) expect(isValidSpectrum(s)).toBe(true);
  });
  it('rejects unknown', () => {
    expect(isValidSpectrum('far_left')).toBe(false);
    expect(isValidSpectrum('')).toBe(false);
    expect(isValidSpectrum(null)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// corpus_articles
// ─────────────────────────────────────────────────────────────────────────────

describe('buildUpsertArticleQuery', () => {
  const base = {
    url: 'https://taz.de/klima',
    source_name: 'taz',
    source_domain: 'taz.de',
    spectrum: 'left',
    title: 'Klima-Titel',
    our_summary: 'Unsere Zusammenfassung.',
    short_lead: 'Kurzer Lead.',
    pub_date: '2026-05-01',
    lang: 'de',
  };

  it('produces an ON CONFLICT (url_hash) upsert', () => {
    const q = buildUpsertArticleQuery(base);
    expect(q.text).toContain('INSERT INTO corpus_articles');
    expect(q.text).toContain('ON CONFLICT (url_hash) DO UPDATE');
    expect(q.text).toContain('(xmax = 0) AS inserted');
  });

  it('passes 10 positional values with the url_hash second', () => {
    const q = buildUpsertArticleQuery(base);
    expect(q.values).toHaveLength(10);
    expect(q.values[1]).toBe(urlHash(base.url));
  });

  it('clamps short_lead to the legal extract ceiling', () => {
    const q = buildUpsertArticleQuery({ ...base, short_lead: 'z'.repeat(500) });
    expect(q.values[7].length).toBe(SHORT_LEAD_MAX);
  });

  it('does NOT include any full-body column (derive-and-discard)', () => {
    const q = buildUpsertArticleQuery(base);
    expect(q.text).not.toMatch(/\bbody\b/);
    expect(q.text).not.toMatch(/content_text/);
    expect(q.text).not.toMatch(/content_encoded/);
  });

  it('throws on missing url', () => {
    expect(() => buildUpsertArticleQuery({ ...base, url: undefined })).toThrow(/url is required/);
  });

  it('throws on invalid spectrum', () => {
    expect(() => buildUpsertArticleQuery({ ...base, spectrum: 'nonsense' })).toThrow(/invalid spectrum/);
  });

  it('defaults lang to de', () => {
    const q = buildUpsertArticleQuery({ ...base, lang: undefined });
    expect(q.values[9]).toBe('de');
  });
});

describe('buildFTSQuery', () => {
  it('returns null when no usable keywords', () => {
    expect(buildFTSQuery(['!!!'])).toBeNull();
  });

  it('builds a German to_tsquery search ordered by rank', () => {
    const q = buildFTSQuery(['Klima', 'Wandel']);
    expect(q.text).toContain("to_tsquery('german', $1)");
    expect(q.text).toContain('fts @@ query');
    expect(q.text).toContain('ORDER BY rank DESC');
    expect(q.values[0]).toBe('klima | wandel');
  });

  it('adds a spectrum filter with ANY()', () => {
    const q = buildFTSQuery(['klima'], { spectra: ['left', 'right'] });
    expect(q.text).toContain('spectrum = ANY($2)');
    expect(q.values[1]).toEqual(['left', 'right']);
  });

  it('ignores invalid spectra in the filter', () => {
    const q = buildFTSQuery(['klima'], { spectra: ['bogus'] });
    expect(q.text).not.toContain('spectrum = ANY');
  });

  it('adds a sinceDate filter', () => {
    const q = buildFTSQuery(['klima'], { sinceDate: '2026-01-01' });
    expect(q.text).toContain('pub_date >= $2');
    expect(q.values).toContain('2026-01-01');
  });

  it('clamps limit to [1,200] and binds it last', () => {
    const q = buildFTSQuery(['klima'], { limit: 9999 });
    expect(q.values[q.values.length - 1]).toBe(200);
    const q2 = buildFTSQuery(['klima'], { limit: -5 });
    expect(q2.values[q2.values.length - 1]).toBe(1);
  });

  it('defaults limit to 50', () => {
    const q = buildFTSQuery(['klima']);
    expect(q.values[q.values.length - 1]).toBe(50);
  });
});

describe('buildVectorQuery', () => {
  it('builds a cosine-distance search using <=>', () => {
    const q = buildVectorQuery(vec());
    expect(q.text).toContain('e.embedding <=> $1');
    expect(q.text).toContain('ORDER BY e.embedding <=> $1');
    expect(q.text).toContain('JOIN corpus_articles a ON a.id = e.article_id');
  });

  it('binds the vector literal and model', () => {
    const q = buildVectorQuery(vec(0.2), { model: 'custom-model' });
    expect(q.values[0]).toContain('0.2');
    expect(q.values[1]).toBe('custom-model');
  });

  it('defaults to text-embedding-004', () => {
    const q = buildVectorQuery(vec());
    expect(q.values[1]).toBe('text-embedding-004');
  });

  it('throws on wrong embedding dimension', () => {
    expect(() => buildVectorQuery([0.1, 0.2])).toThrow(/dims/);
  });

  it('adds spectrum + sinceDate filters with correct placeholders', () => {
    const q = buildVectorQuery(vec(), { spectra: ['center'], sinceDate: '2026-02-02' });
    expect(q.text).toContain('a.spectrum = ANY($3)');
    expect(q.text).toContain('a.pub_date >= $4');
    expect(q.values[2]).toEqual(['center']);
    expect(q.values[3]).toBe('2026-02-02');
  });
});

describe('buildUpsertEmbeddingQuery', () => {
  it('upserts on (article_id, model)', () => {
    const q = buildUpsertEmbeddingQuery(42, vec());
    expect(q.text).toContain('ON CONFLICT (article_id, model) DO UPDATE');
    expect(q.values[0]).toBe(42);
    expect(q.values[1]).toBe('text-embedding-004');
    expect(q.values[2]).toContain('0.1');
  });
  it('throws on non-positive article id', () => {
    expect(() => buildUpsertEmbeddingQuery(0, vec())).toThrow(/positive integer/);
    expect(() => buildUpsertEmbeddingQuery(-1, vec())).toThrow(/positive integer/);
  });
  it('throws on bad embedding dim', () => {
    expect(() => buildUpsertEmbeddingQuery(1, [0.1])).toThrow(/dims/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// feed_health
// ─────────────────────────────────────────────────────────────────────────────

describe('buildFeedSuccessQuery', () => {
  it('resets the failure counter to 0 and status ok', () => {
    const q = buildFeedSuccessQuery('https://taz.de/rss', 'taz', 'left');
    expect(q.text).toContain('consecutive_failures = 0');
    expect(q.text).toContain("status               = 'ok'");
    expect(q.values).toEqual(['https://taz.de/rss', 'taz', 'left']);
  });
  it('throws on invalid spectrum', () => {
    expect(() => buildFeedSuccessQuery('u', 'n', 'bad')).toThrow(/invalid spectrum/);
  });
});

describe('buildFeedFailureQuery', () => {
  it('increments counter and escalates to down at >=3', () => {
    const q = buildFeedFailureQuery('https://x.de/rss', 'X', 'right');
    expect(q.text).toContain('feed_health.consecutive_failures + 1');
    expect(q.text).toContain("THEN 'down'");
    expect(q.text).toContain("ELSE 'degraded'");
  });
  it('throws on invalid spectrum', () => {
    expect(() => buildFeedFailureQuery('u', 'n', 'bad')).toThrow(/invalid spectrum/);
  });
});

describe('buildDownFeedsQuery', () => {
  it('selects only non-ok feeds', () => {
    const q = buildDownFeedsQuery();
    expect(q.text).toContain("status <> 'ok'");
    expect(q.values).toEqual([]);
  });
  it('filters by spectrum when provided', () => {
    const q = buildDownFeedsQuery(['left']);
    expect(q.text).toContain('spectrum = ANY($1)');
    expect(q.values).toEqual([['left']]);
  });
  it('ignores invalid spectra', () => {
    const q = buildDownFeedsQuery(['bogus']);
    expect(q.text).not.toContain('spectrum = ANY');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// source_ratings
// ─────────────────────────────────────────────────────────────────────────────

describe('buildUpsertSourceRatingQuery', () => {
  const base = { source_domain: 'Spiegel.de', source_name: 'Der Spiegel', spectrum: 'center_left' };

  it('upserts on source_domain and normalizes the domain', () => {
    const q = buildUpsertSourceRatingQuery({ ...base, source_domain: 'www.Spiegel.de' });
    expect(q.text).toContain('ON CONFLICT (source_domain) DO UPDATE');
    expect(q.values[0]).toBe('spiegel.de');
  });
  it('defaults rating_source to editorial and confidence to 0.5', () => {
    const q = buildUpsertSourceRatingQuery(base);
    expect(q.values[3]).toBe('editorial');
    expect(q.values[4]).toBe(0.5);
  });
  it('clamps confidence to [0,1]', () => {
    expect(buildUpsertSourceRatingQuery({ ...base, confidence: 5 }).values[4]).toBe(1);
    expect(buildUpsertSourceRatingQuery({ ...base, confidence: -2 }).values[4]).toBe(0);
  });
  it('floors reach_weight at 0', () => {
    expect(buildUpsertSourceRatingQuery({ ...base, reach_weight: -3 }).values[5]).toBe(0);
  });
  it('throws on missing domain / bad spectrum', () => {
    expect(() => buildUpsertSourceRatingQuery({ ...base, source_domain: undefined })).toThrow(/source_domain is required/);
    expect(() => buildUpsertSourceRatingQuery({ ...base, spectrum: 'x' })).toThrow(/invalid spectrum/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Row shaping
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeArticleRow', () => {
  it('returns null for falsy input', () => {
    expect(normalizeArticleRow(null)).toBeNull();
  });
  it('maps title → article_title and carries rank', () => {
    const out = normalizeArticleRow({
      id: 1, url: 'u', source_name: 's', source_domain: 'd', spectrum: 'left',
      title: 'T', our_summary: 'S', short_lead: 'L', pub_date: '2026-01-01',
      cluster_id: 7, rank: '0.42',
    });
    expect(out.article_title).toBe('T');
    expect(out.rank).toBe(0.42);
    expect(out.cluster_id).toBe(7);
    expect(out.distance).toBeUndefined();
  });
  it('carries distance from the vector path', () => {
    const out = normalizeArticleRow({ id: 1, title: 'T', distance: '0.13' });
    expect(out.distance).toBe(0.13);
    expect(out.rank).toBeUndefined();
  });
  it('defaults missing derived fields to empty strings', () => {
    const out = normalizeArticleRow({ id: 1, title: 'T' });
    expect(out.our_summary).toBe('');
    expect(out.short_lead).toBe('');
    expect(out.cluster_id).toBeNull();
  });
});
