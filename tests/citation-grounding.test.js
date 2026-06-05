import { describe, it, expect } from 'vitest';
import {
  normalizeUrl,
  titleTokens,
  titleOverlap,
  matchArticle,
  groundAnalysis,
} from '../lib/citationGrounding.js';

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
