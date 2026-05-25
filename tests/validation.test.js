import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isRecentEnough } from '../lib/validation.js';

// ────────────────────────────────────────────────────────────
// isRecentEnough — date parsing and age validation
// ────────────────────────────────────────────────────────────

describe('isRecentEnough', () => {
  const NOW = new Date('2026-05-25T12:00:00Z').getTime();

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts an article published today', () => {
    expect(isRecentEnough('2026-05-25')).toBe(true);
  });

  it('accepts an article published 30 days ago', () => {
    expect(isRecentEnough('2026-04-25')).toBe(true);
  });

  it('accepts an article published 89 days ago (within 90-day default)', () => {
    // 89 days before 2026-05-25 = 2026-02-25
    expect(isRecentEnough('2026-02-25')).toBe(true);
  });

  it('rejects an article published 91 days ago (beyond 90-day default)', () => {
    // 91 days before 2026-05-25 = 2026-02-23
    expect(isRecentEnough('2026-02-23')).toBe(false);
  });

  it('accepts German date format "15. April 2026"', () => {
    expect(isRecentEnough('15. April 2026')).toBe(true);
  });

  it('accepts German date format "3. März 2026"', () => {
    expect(isRecentEnough('3. März 2026')).toBe(true);
  });

  it('rejects an old German date "1. Januar 2020"', () => {
    expect(isRecentEnough('1. Januar 2020')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isRecentEnough(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isRecentEnough(undefined)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isRecentEnough('')).toBe(false);
  });

  it('returns false for a completely invalid date string', () => {
    expect(isRecentEnough('nicht-ein-datum')).toBe(false);
  });

  it('returns false for a future date', () => {
    expect(isRecentEnough('2027-01-01')).toBe(false);
  });

  it('respects custom maxAgeDays', () => {
    // 5 days ago
    expect(isRecentEnough('2026-05-20', 7)).toBe(true);
    expect(isRecentEnough('2026-05-20', 3)).toBe(false);
  });
});
