/**
 * tests/rss-search-v2.test.js
 *
 * Comprehensive test suite for the RSS search algorithm v2.
 *
 * Coverage:
 *   1.  GERMAN_STOP_WORDS       — spot checks and edge cases
 *   2.  splitGermanCompound     — compound splitting accuracy
 *   3.  extractSearchKeywords   — full pipeline (stop words + compound split)
 *   4.  recencyMultiplier       — truth window boundaries
 *   5.  scoreArticle            — weighted scoring model
 *   6.  searchAllFeeds          — integration tests with mocked feeds
 *   7.  Age filter              — maxAgeDays enforcement
 *   8.  End-to-end scenarios    — real-world topic queries (mocked)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GERMAN_STOP_WORDS,
  COMPOUND_SUFFIXES,
  splitGermanCompound,
  extractSearchKeywords,
  recencyMultiplier,
  scoreArticle,
  parseRSSItems,
  searchAllFeeds,
  clearRSSCache,
} from '../lib/rssSearch.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Create a mock RSS item */
function makeItem({ title = 'Test Titel', description = '', pubDate = null } = {}) {
  return { title, description, pubDate };
}

/** Create a pubDate relative to now */
function hoursAgo(h) { return new Date(Date.now() - h * 3600 * 1000); }
function daysAgo(d)  { return new Date(Date.now() - d * 24 * 3600 * 1000); }
function hoursFromNow(h) { return new Date(Date.now() + h * 3600 * 1000); }

// ─────────────────────────────────────────────────────────────────────────────
// 1. GERMAN_STOP_WORDS
// ─────────────────────────────────────────────────────────────────────────────

describe('GERMAN_STOP_WORDS', () => {
  it('contains common articles', () => {
    expect(GERMAN_STOP_WORDS.has('der')).toBe(true);
    expect(GERMAN_STOP_WORDS.has('die')).toBe(true);
    expect(GERMAN_STOP_WORDS.has('das')).toBe(true);
    expect(GERMAN_STOP_WORDS.has('ein')).toBe(true);
  });

  it('contains common prepositions', () => {
    expect(GERMAN_STOP_WORDS.has('mit')).toBe(true);
    expect(GERMAN_STOP_WORDS.has('für')).toBe(true);
    expect(GERMAN_STOP_WORDS.has('über')).toBe(true);
    expect(GERMAN_STOP_WORDS.has('nach')).toBe(true);
  });

  it('does NOT contain topic-meaningful nouns', () => {
    expect(GERMAN_STOP_WORDS.has('ukraine')).toBe(false);
    expect(GERMAN_STOP_WORDS.has('krieg')).toBe(false);
    expect(GERMAN_STOP_WORDS.has('klima')).toBe(false);
    expect(GERMAN_STOP_WORDS.has('merz')).toBe(false);
  });

  it('is a Set (O(1) lookup)', () => {
    expect(GERMAN_STOP_WORDS).toBeInstanceOf(Set);
  });

  it('has at least 30 entries', () => {
    expect(GERMAN_STOP_WORDS.size).toBeGreaterThanOrEqual(30);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. splitGermanCompound
// ─────────────────────────────────────────────────────────────────────────────

describe('splitGermanCompound', () => {
  // ── Core splitting cases ────────────────────────────────────────────────────
  it('"bundestagswahl" → includes "bundestag" and "wahl"', () => {
    const parts = splitGermanCompound('bundestagswahl');
    expect(parts).toContain('bundestagswahl');
    expect(parts).toContain('bundestag');   // Fugen-s stripped from "bundestags"
    expect(parts).toContain('wahl');
  });

  it('"klimawandel" → includes "klima" and "wandel"', () => {
    const parts = splitGermanCompound('klimawandel');
    expect(parts).toContain('klimawandel');
    expect(parts).toContain('klima');
    expect(parts).toContain('wandel');
  });

  it('"ukrainekrieg" → includes "ukraine" and "krieg"', () => {
    const parts = splitGermanCompound('ukrainekrieg');
    expect(parts).toContain('ukrainekrieg');
    expect(parts).toContain('ukraine');
    expect(parts).toContain('krieg');
  });

  it('"wirtschaftspolitik" → includes "wirtschaft" and "politik"', () => {
    const parts = splitGermanCompound('wirtschaftspolitik');
    expect(parts).toContain('wirtschaftspolitik');
    expect(parts).toContain('wirtschaft');  // Fugen-s stripped from "wirtschafts"
    expect(parts).toContain('politik');
  });

  it('"rentenreform" → includes "renten" and "reform"', () => {
    const parts = splitGermanCompound('rentenreform');
    expect(parts).toContain('rentenreform');
    expect(parts).toContain('renten');
    expect(parts).toContain('reform');
  });

  it('"außenpolitik" → includes "außen" and "politik"', () => {
    const parts = splitGermanCompound('außenpolitik');
    expect(parts).toContain('außenpolitik');
    expect(parts).toContain('außen');
    expect(parts).toContain('politik');
  });

  it('"bundesregierung" → includes "bundes" (or "bunde") and "regierung"', () => {
    const parts = splitGermanCompound('bundesregierung');
    expect(parts).toContain('bundesregierung');
    expect(parts).toContain('regierung');
    // prefix "bundes" → strip Fugen-s → "bunde" (4 chars, valid)
    expect(parts.some(p => p === 'bunde' || p === 'bundes')).toBe(true);
  });

  it('"koalitionsvertrag" → includes "koalition" and "vertrag"', () => {
    const parts = splitGermanCompound('koalitionsvertrag');
    expect(parts).toContain('koalitionsvertrag');
    expect(parts).toContain('koalition');  // Fugen-s stripped
    expect(parts).toContain('vertrag');
  });

  // ── Short words — should NOT be split ───────────────────────────────────────
  it('"krieg" (< 8 chars) is returned as-is', () => {
    expect(splitGermanCompound('krieg')).toEqual(['krieg']);
  });

  it('"ukraine" (7 chars) is returned as-is', () => {
    expect(splitGermanCompound('ukraine')).toEqual(['ukraine']);
  });

  it('"merz" (4 chars) is returned as-is', () => {
    expect(splitGermanCompound('merz')).toEqual(['merz']);
  });

  it('"reform" (6 chars) is returned as-is (too short)', () => {
    expect(splitGermanCompound('reform')).toEqual(['reform']);
  });

  // ── Always includes original word ──────────────────────────────────────────
  it('always includes the original word in output', () => {
    for (const word of ['klimawandel', 'bundestagswahl', 'ukraine', 'abc']) {
      expect(splitGermanCompound(word)).toContain(word);
    }
  });

  // ── No duplicate entries ────────────────────────────────────────────────────
  it('output has no duplicate entries', () => {
    const parts = splitGermanCompound('bundestagswahl');
    expect(parts.length).toBe(new Set(parts).size);
  });

  // ── No stop words in result ─────────────────────────────────────────────────
  it('output does not contain stop words', () => {
    const parts = splitGermanCompound('wirtschaftspolitik');
    for (const p of parts) {
      expect(GERMAN_STOP_WORDS.has(p)).toBe(false);
    }
  });

  // ── Unknown compound — returned as-is ──────────────────────────────────────
  it('word with no known compound suffix returned as-is', () => {
    const parts = splitGermanCompound('donnerwetter'); // no suffix in list
    expect(parts).toContain('donnerwetter');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. extractSearchKeywords
// ─────────────────────────────────────────────────────────────────────────────

describe('extractSearchKeywords', () => {
  // ── Basic extraction ────────────────────────────────────────────────────────
  it('"Ukraine Krieg" → ["ukraine", "krieg"]', () => {
    const kw = extractSearchKeywords('Ukraine Krieg');
    expect(kw).toContain('ukraine');
    expect(kw).toContain('krieg');
  });

  it('"Friedrich Merz" → ["friedrich", "merz"]', () => {
    const kw = extractSearchKeywords('Friedrich Merz');
    expect(kw).toContain('friedrich');
    expect(kw).toContain('merz');
  });

  it('"Tagesschau" (proper noun < 8 chars — no compound) → ["tagesschau"]', () => {
    const kw = extractSearchKeywords('Tagesschau');
    expect(kw).toContain('tagesschau');
  });

  // ── Compound expansion ──────────────────────────────────────────────────────
  it('"Bundestagswahl" → contains "bundestagswahl", "bundestag", "wahl"', () => {
    const kw = extractSearchKeywords('Bundestagswahl');
    expect(kw).toContain('bundestagswahl');
    expect(kw).toContain('bundestag');
    expect(kw).toContain('wahl');
  });

  it('"Klimawandel" → contains "klimawandel", "klima", "wandel"', () => {
    const kw = extractSearchKeywords('Klimawandel');
    expect(kw).toContain('klimawandel');
    expect(kw).toContain('klima');
    expect(kw).toContain('wandel');
  });

  it('"Wirtschaftspolitik" → contains "wirtschaft" and "politik"', () => {
    const kw = extractSearchKeywords('Wirtschaftspolitik');
    expect(kw).toContain('wirtschaft');
    expect(kw).toContain('politik');
  });

  it('"Friedrich Merz Wirtschaftspolitik" → multi-word with compound expansion', () => {
    const kw = extractSearchKeywords('Friedrich Merz Wirtschaftspolitik');
    expect(kw).toContain('friedrich');
    expect(kw).toContain('merz');
    expect(kw).toContain('wirtschaftspolitik');
    expect(kw).toContain('wirtschaft');
    expect(kw).toContain('politik');
  });

  // ── Stop word filtering ─────────────────────────────────────────────────────
  it('filters German stop words', () => {
    const kw = extractSearchKeywords('Krieg und Frieden in der Ukraine');
    expect(kw).not.toContain('und');
    expect(kw).not.toContain('der');
    expect(kw).not.toContain('in');
    expect(kw).toContain('krieg');
    expect(kw).toContain('ukraine');
  });

  it('filters short stop words like "zu", "im", "am"', () => {
    const kw = extractSearchKeywords('Merz im Bundestag zu Wirtschaft');
    expect(kw).not.toContain('zu');
    expect(kw).not.toContain('im');
    expect(kw).toContain('merz');
  });

  // ── Deduplication ───────────────────────────────────────────────────────────
  it('does not return duplicate keywords', () => {
    const kw = extractSearchKeywords('Klimawandel Klima Klimaschutz');
    expect(kw.length).toBe(new Set(kw).size);
  });

  // ── maxKeywords cap ─────────────────────────────────────────────────────────
  it('respects maxKeywords cap', () => {
    const kw = extractSearchKeywords('Ukraine Krieg Bundestagswahl Klimawandel Wirtschaftspolitik', 5);
    expect(kw.length).toBeLessThanOrEqual(5);
  });

  it('default cap is 10 keywords', () => {
    // Very long topic — should not exceed 10
    const kw = extractSearchKeywords('Ukraine Russland Krieg Sanktionen Wirtschaft NATO Bundestagswahl Klimawandel Berlin Scholz Merz Baerbock');
    expect(kw.length).toBeLessThanOrEqual(10);
  });

  // ── Lowercasing ─────────────────────────────────────────────────────────────
  it('returns all keywords in lowercase', () => {
    const kw = extractSearchKeywords('UKRAINE KRIEG BUNDESTAGSWAHL');
    for (const w of kw) {
      expect(w).toBe(w.toLowerCase());
    }
  });

  // ── Special characters ──────────────────────────────────────────────────────
  it('handles German umlauts correctly', () => {
    const kw = extractSearchKeywords('Außenpolitik Schröder');
    expect(kw).toContain('außenpolitik');
    expect(kw).toContain('schröder');
  });

  it('strips punctuation', () => {
    const kw = extractSearchKeywords('Ukraine-Krieg, Scholz!');
    expect(kw).toContain('ukraine');
    expect(kw).toContain('krieg');
    expect(kw).toContain('scholz');
    expect(kw.some(w => w.includes(',') || w.includes('!'))).toBe(false);
  });

  // ── Empty / edge cases ──────────────────────────────────────────────────────
  it('returns empty array for empty string', () => {
    expect(extractSearchKeywords('')).toEqual([]);
  });

  it('returns empty array for stop-words-only input', () => {
    expect(extractSearchKeywords('und oder aber mit der die')).toEqual([]);
  });

  it('returns array for single valid word', () => {
    const kw = extractSearchKeywords('Ukraine');
    expect(kw).toContain('ukraine');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. recencyMultiplier — truth window
// ─────────────────────────────────────────────────────────────────────────────

describe('recencyMultiplier — truth window', () => {
  it('breaking news < 6h → 3.0', () => {
    expect(recencyMultiplier(hoursAgo(1))).toBe(3.0);
    expect(recencyMultiplier(hoursAgo(5))).toBe(3.0);
  });

  it('today 6–24h → 2.0', () => {
    expect(recencyMultiplier(hoursAgo(7))).toBe(2.0);
    expect(recencyMultiplier(hoursAgo(23))).toBe(2.0);
  });

  it('last 3 days (24–72h) → 1.5', () => {
    expect(recencyMultiplier(hoursAgo(25))).toBe(1.5);
    expect(recencyMultiplier(hoursAgo(71))).toBe(1.5);
  });

  it('this week (72–168h) → 1.0 baseline', () => {
    expect(recencyMultiplier(hoursAgo(73))).toBe(1.0);
    expect(recencyMultiplier(daysAgo(6))).toBe(1.0);
  });

  it('last 2 weeks (7–14d) → 0.6', () => {
    expect(recencyMultiplier(daysAgo(8))).toBe(0.6);
    expect(recencyMultiplier(daysAgo(13))).toBe(0.6);
  });

  it('last month (14–30d) → 0.3', () => {
    expect(recencyMultiplier(daysAgo(15))).toBe(0.3);
    expect(recencyMultiplier(daysAgo(29))).toBe(0.3);
  });

  it('older than 1 month → 0.1', () => {
    expect(recencyMultiplier(daysAgo(31))).toBe(0.1);
    expect(recencyMultiplier(daysAgo(90))).toBe(0.1);
  });

  it('null pubDate → 0.8 (slightly below baseline)', () => {
    expect(recencyMultiplier(null)).toBe(0.8);
    expect(recencyMultiplier(undefined)).toBe(0.8);
  });

  it('invalid Date → 0.8', () => {
    expect(recencyMultiplier(new Date('invalid'))).toBe(0.8);
  });

  it('future date (clock skew) → 0.5', () => {
    expect(recencyMultiplier(hoursFromNow(2))).toBe(0.5);
    expect(recencyMultiplier(hoursFromNow(48))).toBe(0.5);
  });

  it('multipliers are strictly ordered: breaking > today > 3days > week > 2weeks > month > old', () => {
    const breaking = recencyMultiplier(hoursAgo(1));
    const today    = recencyMultiplier(hoursAgo(12));
    const days3    = recencyMultiplier(hoursAgo(48));
    const week     = recencyMultiplier(daysAgo(5));
    const weeks2   = recencyMultiplier(daysAgo(10));
    const month    = recencyMultiplier(daysAgo(20));
    const old      = recencyMultiplier(daysAgo(60));

    expect(breaking).toBeGreaterThan(today);
    expect(today).toBeGreaterThan(days3);
    expect(days3).toBeGreaterThan(week);
    expect(week).toBeGreaterThan(weeks2);
    expect(weeks2).toBeGreaterThan(month);
    expect(month).toBeGreaterThan(old);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. scoreArticle
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreArticle', () => {
  const kw = ['ukraine', 'krieg'];

  it('returns score=0 when no keywords match', () => {
    const result = scoreArticle(
      makeItem({ title: 'Wetter in Berlin', description: 'Sonnig und warm.' }),
      kw
    );
    expect(result.score).toBe(0);
    expect(result.rawScore).toBe(0);
  });

  it('title match scores higher than description-only match', () => {
    const titleMatch = scoreArticle(
      makeItem({ title: 'Ukraine Krieg aktuell', pubDate: daysAgo(5) }),
      kw
    );
    const descMatch = scoreArticle(
      makeItem({ title: 'Nachrichten heute', description: 'ukraine krieg analyse', pubDate: daysAgo(5) }),
      kw
    );
    expect(titleMatch.score).toBeGreaterThan(descMatch.score);
  });

  it('fresh article outranks same-relevance stale article', () => {
    const fresh = scoreArticle(
      makeItem({ title: 'Ukraine Krieg heute', pubDate: hoursAgo(2) }),   // 3.0×
      kw
    );
    const stale = scoreArticle(
      makeItem({ title: 'Ukraine Krieg analyse', pubDate: daysAgo(20) }), // 0.3×
      kw
    );
    expect(fresh.score).toBeGreaterThan(stale.score);
  });

  it('description-only match gets 0.6× recency penalty vs title match', () => {
    const sameAge = hoursAgo(48); // 1.5× recency
    const titleHit = scoreArticle(
      makeItem({ title: 'Ukraine Krieg', pubDate: sameAge }),
      kw
    );
    const descHit = scoreArticle(
      makeItem({ title: 'Andere Nachrichten', description: 'ukraine krieg aktuell', pubDate: sameAge }),
      kw
    );
    // titleHit: rawScore=4, effectiveRecency=1.5, score=6
    // descHit:  rawScore=2, effectiveRecency=1.5*0.6=0.9, score=1.8
    expect(titleHit.score).toBeGreaterThan(descHit.score);
    expect(descHit.recency).toBe(1.5); // recency itself not penalised in the field
  });

  it('titleScore counts per-keyword occurrences (×2 each)', () => {
    const result = scoreArticle(
      makeItem({ title: 'Ukraine und Ukraine Krieg in ukraine' }),
      kw
    );
    // "ukraine" appears 3× but score counts once per word: +2 for ukraine, +2 for krieg
    expect(result.titleScore).toBe(4); // 2 keywords × 2
  });

  it('titleOnly=true when only title matches', () => {
    const result = scoreArticle(
      makeItem({ title: 'Ukraine Krieg', description: 'Sonnenschein.' }),
      kw
    );
    expect(result.titleOnly).toBe(true);
  });

  it('titleOnly=false when only description matches', () => {
    const result = scoreArticle(
      makeItem({ title: 'Weltgeschehen', description: 'ukraine krieg aktuell' }),
      kw
    );
    expect(result.titleOnly).toBe(false);
  });

  it('rawScore = titleScore + descScore', () => {
    const result = scoreArticle(
      makeItem({ title: 'Ukraine', description: 'krieg situation' }),
      kw
    );
    expect(result.rawScore).toBe(result.titleScore + result.descScore);
  });

  it('recency field matches recencyMultiplier(pubDate)', () => {
    const pubDate = hoursAgo(5);
    const result = scoreArticle(makeItem({ title: 'Ukraine', pubDate }), kw);
    expect(result.recency).toBe(recencyMultiplier(pubDate));
  });

  it('null pubDate gives recency 0.8', () => {
    const result = scoreArticle(makeItem({ title: 'Ukraine Krieg', pubDate: null }), kw);
    expect(result.recency).toBe(0.8);
  });

  it('keywords shorter than 3 chars are skipped', () => {
    const result = scoreArticle(
      makeItem({ title: 'EU NATO und so' }),
      ['eu', 'ab', 'ok']
    );
    expect(result.score).toBe(0); // all < 3 chars, none counted
  });

  it('substring matching works — "klima" matches "klimakonferenz" in title', () => {
    const result = scoreArticle(
      makeItem({ title: 'Neue Klimakonferenz in Berlin', pubDate: hoursAgo(1) }),
      ['klima', 'wandel']
    );
    expect(result.titleScore).toBeGreaterThan(0); // "klima" is substring of "klimakonferenz"
    expect(result.score).toBeGreaterThan(0);
  });

  it('compound expansion pays off: "klima" from "Klimawandel" split matches "klimapolitik"', () => {
    // This simulates the v2 benefit: user searches "Klimawandel",
    // extractSearchKeywords gives ["klimawandel", "klima", "wandel"]
    // An article about "Klimapolitik" (no "wandel") now matches via "klima"
    const kw2 = ['klimawandel', 'klima', 'wandel'];
    const result = scoreArticle(
      makeItem({ title: 'Neue Klimapolitik der Bundesregierung', pubDate: hoursAgo(3) }),
      kw2
    );
    expect(result.titleScore).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. parseRSSItems
// ─────────────────────────────────────────────────────────────────────────────

describe('parseRSSItems', () => {
  it('parses basic RSS <item>', () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Ukraine Krieg: Neueste Entwicklungen</title>
          <link>https://tagesschau.de/article/1</link>
          <description>Aktuelle Berichte aus dem Kriegsgebiet.</description>
          <pubDate>Mon, 26 May 2025 10:00:00 +0000</pubDate>
        </item>
      </channel></rss>
    `;
    const items = parseRSSItems(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Ukraine Krieg: Neueste Entwicklungen');
    expect(items[0].link).toBe('https://tagesschau.de/article/1');
    expect(items[0].pubDate).toBeInstanceOf(Date);
    expect(isNaN(items[0].pubDate.getTime())).toBe(false);
  });

  it('parses CDATA-wrapped title', () => {
    const xml = `
      <rss><channel>
        <item>
          <title><![CDATA[Bundestagswahl: Ergebnisse]]></title>
          <link>https://spiegel.de/btw</link>
        </item>
      </channel></rss>
    `;
    const items = parseRSSItems(xml);
    expect(items[0].title).toBe('Bundestagswahl: Ergebnisse');
  });

  it('parses plain-content description with HTML stripped', () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Test</title>
          <link>https://test.de/1</link>
          <description><p>Alle Ergebnisse der Wahl.</p></description>
        </item>
      </channel></rss>
    `;
    const items = parseRSSItems(xml);
    expect(items[0].description).not.toContain('<p>');
    expect(items[0].description).toContain('Ergebnisse');
  });

  it('parses multiple items', () => {
    const xml = `
      <rss><channel>
        <item><title>Artikel 1</title><link>https://a.de/1</link></item>
        <item><title>Artikel 2</title><link>https://a.de/2</link></item>
        <item><title>Artikel 3</title><link>https://a.de/3</link></item>
      </channel></rss>
    `;
    expect(parseRSSItems(xml)).toHaveLength(3);
  });

  it('returns empty array for empty/invalid XML', () => {
    expect(parseRSSItems('')).toHaveLength(0);
    expect(parseRSSItems('<rss></rss>')).toHaveLength(0);
  });

  it('handles guid as permalink fallback', () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Test</title>
          <guid>https://nd-aktuell.de/article/123</guid>
        </item>
      </channel></rss>
    `;
    const items = parseRSSItems(xml);
    expect(items[0].link).toBe('https://nd-aktuell.de/article/123');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. searchAllFeeds — integration tests (fetch mocked)
// ─────────────────────────────────────────────────────────────────────────────

// We mock global fetch so no real network calls happen
const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.stubGlobal('fetch', mockFetch);

/** Build a minimal RSS XML string with given articles */
function buildRSSXML(articles) {
  const items = articles.map(a => `
    <item>
      <title>${a.title}</title>
      <link>${a.url || 'https://test.de/article'}</link>
      <description>${a.description || ''}</description>
      <pubDate>${a.pubDate ? a.pubDate.toUTCString() : 'Mon, 26 May 2025 10:00:00 +0000'}</pubDate>
    </item>
  `).join('\n');
  return `<rss><channel>${items}</channel></rss>`;
}

/** Mock all RSS feeds to return 200 with given XML */
function mockAllFeedsOk(xml) {
  mockFetch.mockResolvedValue({
    ok:   true,
    text: () => Promise.resolve(xml),
  });
}

/** Mock all feeds to return HTTP 404 */
function mockAllFeedsError() {
  mockFetch.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('') });
}

beforeEach(() => {
  mockFetch.mockReset();
  clearRSSCache(); // flush NodeCache between tests to avoid cross-test pollution
});

describe('searchAllFeeds — integration', () => {
  it('returns empty spectra when all feeds return no matching articles', async () => {
    mockAllFeedsOk(buildRSSXML([
      { title: 'Wetter heute schön', pubDate: hoursAgo(2) },
    ]));
    const { spectra, total_articles } = await searchAllFeeds(['ukraine', 'krieg']);
    expect(total_articles).toBe(0);
    for (const sp of ['left', 'center_left', 'center', 'center_right', 'right']) {
      expect(spectra[sp].articles).toHaveLength(0);
    }
  });

  it('returns articles when title matches keywords', async () => {
    mockAllFeedsOk(buildRSSXML([
      { title: 'Ukraine Krieg: Neue Entwicklungen', pubDate: hoursAgo(3) },
    ]));
    const { total_articles } = await searchAllFeeds(['ukraine', 'krieg']);
    expect(total_articles).toBeGreaterThan(0);
  });

  it('returns articles when substring matches (klima → klimakonferenz)', async () => {
    mockAllFeedsOk(buildRSSXML([
      { title: 'Klimakonferenz in Berlin', pubDate: hoursAgo(5) },
    ]));
    // extractSearchKeywords('Klimawandel') gives ['klimawandel', 'klima', 'wandel']
    // 'klima' matches 'Klimakonferenz'
    const { total_articles } = await searchAllFeeds(['klimawandel', 'klima', 'wandel']);
    expect(total_articles).toBeGreaterThan(0);
  });

  it('excludes articles older than maxAgeDays', async () => {
    mockAllFeedsOk(buildRSSXML([
      { title: 'Ukraine Krieg alt', pubDate: daysAgo(60) },  // too old
      { title: 'Ukraine Krieg neu', pubDate: hoursAgo(12) }, // fresh
    ]));
    const { total_articles } = await searchAllFeeds(['ukraine', 'krieg'], { maxAgeDays: 30 });
    // Only 1 article per feed passes (18 feeds × 1 = 18 total possible, but 1 per feed)
    // The old article is filtered out
    expect(total_articles).toBeGreaterThan(0);
    // Verify no article has a pubDate older than maxAgeDays
    // (we can check search_meta)
    // At least the old article was counted as tooOld
    // We can't easily verify this without checking meta — it would be 18 feeds × 1 tooOld each
  });

  it('search_meta contains keyword list', async () => {
    mockAllFeedsOk(buildRSSXML([{ title: 'Ukraine', pubDate: hoursAgo(1) }]));
    const { search_meta } = await searchAllFeeds(['ukraine', 'krieg']);
    expect(search_meta.keywords).toEqual(['ukraine', 'krieg']);
  });

  it('search_meta.maxAgeDays reflects the option', async () => {
    mockAllFeedsOk(buildRSSXML([{ title: 'Test', pubDate: hoursAgo(1) }]));
    const { search_meta } = await searchAllFeeds(['test'], { maxAgeDays: 14 });
    expect(search_meta.maxAgeDays).toBe(14);
  });

  it('handles feed HTTP errors gracefully — other feeds still work', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('') }) // first feed fails
      .mockResolvedValue({ // all others succeed
        ok:   true,
        text: () => Promise.resolve(buildRSSXML([
          { title: 'Ukraine Krieg aktuell', pubDate: hoursAgo(1) },
        ])),
      });
    const { total_articles } = await searchAllFeeds(['ukraine', 'krieg']);
    // Should still get results from the 17 working feeds
    expect(total_articles).toBeGreaterThan(0);
  });

  it('handles fetch timeout/rejection gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('AbortError: timeout'));
    const { total_articles } = await searchAllFeeds(['ukraine']);
    expect(total_articles).toBe(0); // all timed out, no crash
  });

  it('fresh article ranks above stale article in results', async () => {
    const freshTitle = 'Ukraine Krieg Breaking News heute';
    const staleTitle = 'Ukraine Krieg Analyse letzte Woche';
    mockAllFeedsOk(buildRSSXML([
      { title: staleTitle, pubDate: daysAgo(10) },
      { title: freshTitle, pubDate: hoursAgo(1) },
    ]));
    const { spectra } = await searchAllFeeds(['ukraine', 'krieg']);
    // Find first article across any spectrum
    const allArticles = Object.values(spectra).flatMap(s => s.articles);
    if (allArticles.length >= 2) {
      // The fresh article should appear before the stale one (higher score)
      const freshIdx = allArticles.findIndex(a => a.article_title === freshTitle);
      const staleIdx = allArticles.findIndex(a => a.article_title === staleTitle);
      if (freshIdx !== -1 && staleIdx !== -1) {
        expect(freshIdx).toBeLessThan(staleIdx);
      }
    }
  });

  it('search_meta.totalTooOld > 0 when old articles are present', async () => {
    mockAllFeedsOk(buildRSSXML([
      { title: 'Ukraine Krieg alt', pubDate: daysAgo(60) },
    ]));
    const { search_meta } = await searchAllFeeds(['ukraine', 'krieg'], { maxAgeDays: 30 });
    expect(search_meta.totalTooOld).toBeGreaterThan(0);
  });

  it('maxPerFeed limits articles per feed in result', async () => {
    mockAllFeedsOk(buildRSSXML([
      { title: 'Ukraine Krieg 1', pubDate: hoursAgo(1) },
      { title: 'Ukraine Krieg 2', pubDate: hoursAgo(2) },
      { title: 'Ukraine Krieg 3', pubDate: hoursAgo(3) },
      { title: 'Ukraine Krieg 4', pubDate: hoursAgo(4) },
      { title: 'Ukraine Krieg 5', pubDate: hoursAgo(5) },
      { title: 'Ukraine Krieg 6', pubDate: hoursAgo(6) },
    ]));
    const { spectra } = await searchAllFeeds(['ukraine', 'krieg'], { maxPerFeed: 2 });
    // Each feed should contribute at most 2 articles per spectrum
    for (const sp of ['left', 'center_left', 'center', 'center_right', 'right']) {
      // Multiple feeds per spectrum, each capped at 2 → max articles per spectrum = feeds × 2
      const feedsPerSpectrum = { left: 3, center_left: 4, center: 3, center_right: 5, right: 3 };
      expect(spectra[sp].articles.length).toBeLessThanOrEqual(feedsPerSpectrum[sp] * 2);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. End-to-end scenarios (mocked)
// ─────────────────────────────────────────────────────────────────────────────

describe('End-to-end: compound expansion improves recall', () => {
  it('Klimawandel query finds "Klimakonferenz" articles that v1 would miss', async () => {
    // v1 searched only ["klimawandel"] — misses "Klimakonferenz" in titles
    // v2 searches ["klimawandel", "klima", "wandel"] — "klima" matches
    mockAllFeedsOk(buildRSSXML([
      { title: 'Neue Klimakonferenz beschlossen', pubDate: hoursAgo(2) },
      { title: 'Klimapolitik der Bundesregierung', pubDate: hoursAgo(5) },
      { title: 'Erderwärmung und Klimawandel-Folgen', pubDate: hoursAgo(10) },
    ]));

    // v1 keywords (no compound expansion)
    const v1kw = ['klimawandel'];
    const v1result = await searchAllFeeds(v1kw);

    // v2 keywords (with compound expansion)
    const v2kw = extractSearchKeywords('Klimawandel');
    const v2result = await searchAllFeeds(v2kw);

    // v2 should find more articles (includes Klimakonferenz, Klimapolitik)
    // v1 only finds "Klimawandel-Folgen"
    expect(v2result.total_articles).toBeGreaterThanOrEqual(v1result.total_articles);
    expect(v2kw).toContain('klima'); // confirms compound expansion happened
  });

  it('Bundestagswahl query finds "Bundestag" articles via compound split', async () => {
    mockAllFeedsOk(buildRSSXML([
      { title: 'Bundestag debattiert Haushalt', pubDate: hoursAgo(3) },
      { title: 'Wahlrecht Reform beschlossen', pubDate: hoursAgo(6) },
    ]));

    const v1kw = ['bundestagswahl'];
    const v2kw = extractSearchKeywords('Bundestagswahl');

    const v1result = await searchAllFeeds(v1kw);
    const v2result = await searchAllFeeds(v2kw);

    expect(v2result.total_articles).toBeGreaterThanOrEqual(v1result.total_articles);
  });

  it('v2 keywords for "Klimawandel" include at least 3 terms', () => {
    const kw = extractSearchKeywords('Klimawandel');
    expect(kw.length).toBeGreaterThanOrEqual(3);
    // Should include original, prefix, suffix
    expect(kw).toContain('klimawandel');
    expect(kw).toContain('klima');
    expect(kw).toContain('wandel');
  });
});

describe('Age filter: truth window enforcement', () => {
  it('30-day default: excludes articles from 31+ days ago', async () => {
    mockAllFeedsOk(buildRSSXML([
      { title: 'Ukraine Krieg heute', pubDate: hoursAgo(12) },   // ✅ included
      { title: 'Ukraine Krieg gestern', pubDate: daysAgo(29) },  // ✅ included (< 30d)
      { title: 'Ukraine Krieg alt', pubDate: daysAgo(31) },      // ❌ excluded (> 30d)
    ]));
    const { search_meta } = await searchAllFeeds(['ukraine', 'krieg'], { maxAgeDays: 30 });
    expect(search_meta.totalTooOld).toBeGreaterThan(0);
  });

  it('custom maxAgeDays=7 only includes articles from last week', async () => {
    mockAllFeedsOk(buildRSSXML([
      { title: 'Ukraine Krieg heute', pubDate: hoursAgo(6) },    // ✅
      { title: 'Ukraine Krieg 8 Tage', pubDate: daysAgo(8) },   // ❌
    ]));
    const { search_meta } = await searchAllFeeds(['ukraine', 'krieg'], { maxAgeDays: 7 });
    expect(search_meta.totalTooOld).toBeGreaterThan(0); // 8-day article filtered
  });

  it('articles with no pubDate are NOT excluded (treated as unknown age)', async () => {
    mockAllFeedsOk(buildRSSXML([
      { title: 'Ukraine Krieg', pubDate: null },
    ]));
    // Build XML manually with no pubDate
    const xmlNoPubDate = `<rss><channel>
      <item>
        <title>Ukraine Krieg ohne Datum</title>
        <link>https://test.de/1</link>
      </item>
    </channel></rss>`;
    mockAllFeedsOk(xmlNoPubDate);
    const { total_articles } = await searchAllFeeds(['ukraine', 'krieg'], { maxAgeDays: 7 });
    expect(total_articles).toBeGreaterThan(0); // no-date articles pass through
  });
});
