import { describe, it, expect } from 'vitest';
import {
  normalizeWhitespace,
  splitSentences,
  deriveSummary,
  deriveShortLead,
  embeddingInputText,
  normalizePubDate,
  deriveArticle,
  SUMMARY_MAX_CHARS,
  SUMMARY_MAX_SENTENCES,
} from '../lib/deriveArticle.js';
import { SHORT_LEAD_MAX } from '../lib/corpusQueries.js';

const FEED = { name: 'Tagesschau', domain: 'tagesschau.de', spectrum: 'center' };

describe('normalizeWhitespace', () => {
  it('collapses runs of whitespace and trims', () => {
    expect(normalizeWhitespace('  a\n\n b\t\tc  ')).toBe('a b c');
  });
  it('returns empty string for null/undefined', () => {
    expect(normalizeWhitespace(null)).toBe('');
    expect(normalizeWhitespace(undefined)).toBe('');
  });
});

describe('splitSentences', () => {
  it('splits on sentence-ending punctuation + space', () => {
    const out = splitSentences('Erster Satz. Zweiter Satz! Dritter Satz?');
    expect(out).toEqual(['Erster Satz.', 'Zweiter Satz!', 'Dritter Satz?']);
  });
  it('returns [] for empty input', () => {
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences(null)).toEqual([]);
  });
  it('keeps a single unterminated sentence', () => {
    expect(splitSentences('Kein Punkt am Ende')).toEqual(['Kein Punkt am Ende']);
  });
});

describe('deriveSummary', () => {
  it('takes the leading N sentences as the lede', () => {
    const body = 'Eins. Zwei. Drei. Vier. Fünf.';
    const out = deriveSummary('Titel', body);
    expect(out).toBe('Eins. Zwei. Drei.');
    expect(out.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(SUMMARY_MAX_SENTENCES);
  });

  it('never exceeds SUMMARY_MAX_CHARS', () => {
    const longSentence = 'Wort '.repeat(400).trim() + '.'; // ~2000 chars, one sentence
    const out = deriveSummary('Titel', longSentence);
    expect(out.length).toBeLessThanOrEqual(SUMMARY_MAX_CHARS);
  });

  it('hard-truncates a single very long first sentence to the budget', () => {
    const giant = 'x'.repeat(SUMMARY_MAX_CHARS + 500) + '.';
    const out = deriveSummary('Titel', giant);
    expect(out.length).toBe(SUMMARY_MAX_CHARS);
  });

  it('falls back to the title when there is no body', () => {
    expect(deriveSummary('Nur ein Titel', '')).toBe('Nur ein Titel');
  });

  it('does NOT include sentences beyond the budget (no full-body leak)', () => {
    const body = 'A. B. C. D. E. F. G.';
    const out = deriveSummary('T', body);
    expect(out).not.toContain('D.');
    expect(out).not.toContain('G.');
  });
});

describe('deriveShortLead', () => {
  it('uses the first sentence of the body', () => {
    expect(deriveShortLead('Titel', 'Lead-Satz hier. Rest.')).toBe('Lead-Satz hier.');
  });
  it('clamps to SHORT_LEAD_MAX', () => {
    const body = 'x'.repeat(SHORT_LEAD_MAX + 100) + '.';
    expect(deriveShortLead('Titel', body).length).toBe(SHORT_LEAD_MAX);
  });
  it('falls back to the title when body is empty', () => {
    expect(deriveShortLead('Mein Titel', '')).toBe('Mein Titel');
  });
});

describe('normalizePubDate', () => {
  it('passes through a valid Date as ISO', () => {
    const d = new Date('2026-06-01T10:00:00Z');
    expect(normalizePubDate(d)).toBe('2026-06-01T10:00:00.000Z');
  });
  it('parses a valid date string', () => {
    expect(normalizePubDate('2026-06-01T10:00:00Z')).toBe('2026-06-01T10:00:00.000Z');
  });
  it('returns null for invalid/empty dates', () => {
    expect(normalizePubDate(null)).toBeNull();
    expect(normalizePubDate('not a date')).toBeNull();
    expect(normalizePubDate(new Date('garbage'))).toBeNull();
  });
});

describe('embeddingInputText', () => {
  it('combines title + our_summary using only derived text', () => {
    const out = embeddingInputText({ title: 'Schlagzeile', our_summary: 'Die Zusammenfassung.' });
    expect(out).toBe('Schlagzeile. Die Zusammenfassung.');
  });
  it('handles missing fields gracefully', () => {
    expect(embeddingInputText({ title: 'Nur Titel' })).toBe('Nur Titel.');
  });
});

describe('deriveArticle (integration of the transformation)', () => {
  const RAW = {
    title: 'Bundestag beschließt Reform',
    description: 'Kurzer Teaser.',
    contentText: 'Der Bundestag hat heute eine weitreichende Reform beschlossen. '
      + 'Die Opposition kritisierte das Vorgehen scharf. '
      + 'Inkrafttreten ist für 2027 geplant. '
      + 'Weitere Details folgen in den kommenden Wochen.',
    link: 'https://www.tagesschau.de/inland/reform-123.html',
    pubDate: new Date('2026-06-01T08:00:00Z'),
  };

  it('produces the exact shape upsertCorpusArticle expects', () => {
    const a = deriveArticle(RAW, FEED);
    expect(a).toMatchObject({
      url: 'https://www.tagesschau.de/inland/reform-123.html',
      source_name: 'Tagesschau',
      source_domain: 'tagesschau.de',
      spectrum: 'center',
      title: 'Bundestag beschließt Reform',
      lang: 'de',
      pub_date: '2026-06-01T08:00:00.000Z',
    });
    expect(typeof a.our_summary).toBe('string');
    expect(typeof a.short_lead).toBe('string');
  });

  it('NEVER returns the full body (derive-and-discard guarantee)', () => {
    const a = deriveArticle(RAW, FEED);
    // No field on the result should equal or contain the full 4-sentence body.
    expect(a).not.toHaveProperty('contentText');
    expect(a).not.toHaveProperty('content_text');
    expect(a).not.toHaveProperty('body');
    // our_summary is capped well below the body and must not contain the 4th sentence.
    expect(a.our_summary).not.toContain('Weitere Details folgen');
    expect(a.short_lead.length).toBeLessThanOrEqual(SHORT_LEAD_MAX);
  });

  it('short_lead is the first sentence, summary is the lede (≤3 sentences)', () => {
    const a = deriveArticle(RAW, FEED);
    expect(a.short_lead).toBe('Der Bundestag hat heute eine weitreichende Reform beschlossen.');
    expect(a.our_summary).toContain('Der Bundestag hat heute');
    expect(a.our_summary).toContain('Inkrafttreten ist für 2027');
    expect(a.our_summary).not.toContain('Weitere Details');
  });

  it('falls back to description when contentText is absent', () => {
    const a = deriveArticle({ ...RAW, contentText: '' }, FEED);
    expect(a.our_summary).toContain('Kurzer Teaser');
  });

  it('returns null when URL is missing', () => {
    expect(deriveArticle({ ...RAW, link: '' }, FEED)).toBeNull();
  });

  it('returns null when title is missing', () => {
    expect(deriveArticle({ ...RAW, title: '   ' }, FEED)).toBeNull();
  });

  it('flags thin articles via _thin (diagnostic, not persisted)', () => {
    const thin = deriveArticle({ ...RAW, title: 'Hi', description: '', contentText: 'Ok.' }, FEED);
    expect(thin._thin).toBe(true);
  });

  it('returns null for null inputs', () => {
    expect(deriveArticle(null, FEED)).toBeNull();
    expect(deriveArticle(RAW, null)).toBeNull();
  });
});
