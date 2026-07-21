import { describe, it, expect } from 'vitest';
import {
  normalizeUrl,
  titleTokens,
  titleOverlap,
  matchArticle,
  groundAnalysis,
  dedupeArticles,
  normalizeTitle,
} from '../lib/citationGrounding.js';

describe('dedupeArticles', () => {
  const art = (over) => ({ source_domain: 'taz.de', article_title: 'Rentenreform beschlossen', article_url: 'https://taz.de/a/1', ...over });

  it('drops same canonical URL (query/slash variants)', () => {
    const out = dedupeArticles([
      art({ article_url: 'https://taz.de/a/1' }),
      art({ article_url: 'https://www.taz.de/a/1/?utm=rss' }),
    ]);
    expect(out).toHaveLength(1);
  });

  it('drops same outlet + same headline (different paths)', () => {
    const out = dedupeArticles([
      art({ article_url: 'https://taz.de/x' }),
      art({ article_url: 'https://taz.de/y' }),
    ]);
    expect(out).toHaveLength(1);
  });

  it('KEEPS same headline from different outlets (distinct sources)', () => {
    const out = dedupeArticles([
      art({ source_domain: 'taz.de', article_url: 'https://taz.de/x' }),
      art({ source_domain: 'spiegel.de', article_url: 'https://spiegel.de/y' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('keeps distinct articles and preserves order', () => {
    const out = dedupeArticles([
      art({ article_title: 'A', article_url: 'https://taz.de/a' }),
      art({ article_title: 'B', article_url: 'https://taz.de/b' }),
    ]);
    expect(out.map(a => a.article_title)).toEqual(['A', 'B']);
  });

  it('handles empty/garbage', () => {
    expect(dedupeArticles([])).toEqual([]);
    expect(dedupeArticles(null)).toEqual([]);
  });
});

describe('normalizeTitle', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeTitle('  Rentenreform: beschlossen!  ')).toBe('rentenreform beschlossen');
  });
});

describe('normalizeUrl', () => {
  it('strips www, query, hash, trailing slash', () => {
    expect(normalizeUrl('https://www.taz.de/Artikel/!123/?utm=x#frag'))
      .toBe('taz.de/artikel/!123');
  });
  it('returns empty string for falsy', () => {
    expect(normalizeUrl('')).toBe('');
    expect(normalizeUrl(null)).toBe('');
  });
  it('matches two urls differing only by www / trailing slash', () => {
    expect(normalizeUrl('https://taz.de/a/1/')).toBe(normalizeUrl('https://www.taz.de/a/1'));
  });
});

describe('titleTokens / titleOverlap', () => {
  it('keeps only words >= 4 chars', () => {
    expect(titleTokens('Der Bundestag und die Reform')).toEqual(['bundestag', 'reform']);
  });
  it('overlap is 1.0 when one title subset of other', () => {
    expect(titleOverlap('Bundestag Reform', 'Bundestag Reform beschlossen heute')).toBe(1);
  });
  it('overlap 0 when no shared significant words', () => {
    expect(titleOverlap('Klima Gipfel', 'Fussball Bundesliga')).toBe(0);
  });
});

describe('matchArticle', () => {
  const corpus = [
    { id: 10, article_url: 'https://taz.de/a/1', article_title: 'Bundestag beschließt Rentenreform', _corpusId: 10 },
    { id: 11, article_url: 'https://taz.de/a/2', article_title: 'Klimagipfel in Berlin endet', _corpusId: 11 },
  ];

  it('matches by exact normalized url first', () => {
    const m = matchArticle({ article_url: 'https://www.taz.de/a/1/', article_title: 'völlig anderer Titel' }, corpus);
    expect(m.method).toBe('url');
    expect(m.row.id).toBe(10);
  });

  it('falls back to title overlap when url differs', () => {
    const m = matchArticle({ article_url: 'https://other.de/x', article_title: 'Bundestag beschließt Rentenreform heute' }, corpus);
    expect(m.method).toBe('title');
    expect(m.row.id).toBe(10);
    expect(m.score).toBeGreaterThanOrEqual(0.5);
  });

  it('returns null when nothing matches above threshold', () => {
    expect(matchArticle({ article_title: 'Voellig unbezogenes Thema xyz' }, corpus)).toBeNull();
  });

  it('returns null for empty corpus', () => {
    expect(matchArticle({ article_title: 'x' }, [])).toBeNull();
  });
});

describe('groundAnalysis', () => {
  const corpusSpectra = {
    center: { articles: [
      { _corpusId: 10, article_url: 'https://t.de/a/1', article_title: 'Bundestag beschließt Rentenreform' },
    ] },
    left: { articles: [
      { _corpusId: 20, article_url: 'https://taz.de/r/9', article_title: 'Kritik an der Rentenreform waechst' },
    ] },
  };

  const analysis = {
    news_spectrum: {
      center: [
        { source_name: 'Tagesschau', article_title: 'Bundestag beschließt Rentenreform', article_url: 'https://t.de/a/1' },
      ],
      left: [
        { source_name: 'taz', article_title: 'Kritik an der Rentenreform waechst deutlich', article_url: 'https://wrong.de/x' },
        { source_name: 'Fake', article_title: 'Komplett erfundene Schlagzeile ohne Bezug', article_url: 'https://fake.de/z' },
      ],
    },
  };

  it('grounds matched articles and flags unmatched', () => {
    const { analysis: out, report } = groundAnalysis(analysis, corpusSpectra);
    expect(report.total).toBe(3);
    expect(report.grounded).toBe(2);
    expect(report.ungrounded).toBe(1);
    expect(report.groundingRatio).toBeCloseTo(2 / 3, 2);

    expect(out.news_spectrum.center[0]._grounded).toBe(true);
    expect(out.news_spectrum.center[0]._citation.method).toBe('url');

    expect(out.news_spectrum.left[0]._grounded).toBe(true);
    expect(out.news_spectrum.left[0]._citation.method).toBe('title');
    // url canonicalized to the verified corpus url
    expect(out.news_spectrum.left[0].article_url).toBe('https://taz.de/r/9');

    expect(out.news_spectrum.left[1]._grounded).toBe(false);
    expect(out.news_spectrum.left[1]._citation).toBeNull();
  });

  it('stamps the authoritative source_domain from the corpus row', () => {
    const corpus = { center: { articles: [
      { _corpusId: 1, article_url: 'https://t.de/a/1', article_title: 'Bundestag beschließt Rentenreform', source_domain: 'tagesschau.de', source_name: 'Tagesschau' },
    ] } };
    const a = { news_spectrum: { center: [
      // Gemini emitted with EMPTY domain (no domain in its prompt context)
      { source_name: 'Tagesschau', source_domain: '', article_title: 'Bundestag beschließt Rentenreform', article_url: '' },
    ] } };
    const { analysis: out } = groundAnalysis(a, corpus);
    expect(out.news_spectrum.center[0]._grounded).toBe(true);
    expect(out.news_spectrum.center[0].source_domain).toBe('tagesschau.de'); // stamped
    expect(out.news_spectrum.center[0].article_url).toBe('https://t.de/a/1'); // canonicalized
  });

  it('does not mutate the input analysis', () => {
    const before = JSON.parse(JSON.stringify(analysis));
    groundAnalysis(analysis, corpusSpectra);
    expect(analysis).toEqual(before);
  });

  it('reports per-spectrum grounding counts', () => {
    const { report } = groundAnalysis(analysis, corpusSpectra);
    expect(report.perSpectrum.center).toEqual({ emitted: 1, grounded: 1 });
    expect(report.perSpectrum.left).toEqual({ emitted: 2, grounded: 1 });
  });

  it('ratio is 1 when there are no emitted articles', () => {
    const { report } = groundAnalysis({ news_spectrum: {} }, corpusSpectra);
    expect(report.total).toBe(0);
    expect(report.groundingRatio).toBe(1);
  });
});
