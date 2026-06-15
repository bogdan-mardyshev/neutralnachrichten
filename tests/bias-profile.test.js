import { describe, it, expect } from 'vitest';
import { analyzeBiasProfile, recommendedOutletsFor, BLINDSPOT_THRESHOLD } from '../lib/biasProfile.js';

describe('recommendedOutletsFor', () => {
  it('returns high/mixed-factual outlets of a camp by reach', () => {
    const out = recommendedOutletsFor('center_left', 2);
    expect(out.length).toBe(2);
    expect(out).toContain('Spiegel'); // highest reach center_left
  });
  it('excludes low-factual outlets', () => {
    // right camp has Nius/Epoch (low) — recommendations should skip them
    const out = recommendedOutletsFor('right', 5);
    expect(out).not.toContain('Nius');
    expect(out).not.toContain('Epoch Times DE');
  });
});

describe('analyzeBiasProfile', () => {
  it('returns null for empty/zero input', () => {
    expect(analyzeBiasProfile(null)).toBeNull();
    expect(analyzeBiasProfile({ left: 0, center_left: 0, center: 0, center_right: 0, right: 0 })).toBeNull();
  });

  it('detects a left lean and flags right-side blind spots', () => {
    const p = analyzeBiasProfile({ left: 50, center_left: 35, center: 15, center_right: 0, right: 0 });
    expect(p.lean).toBe('left');
    expect(p.blindCamps).toEqual(expect.arrayContaining(['center_right', 'right']));
    expect(p.recommendations.some(r => r.spectrum === 'right')).toBe(true);
  });

  it('scores an even reader as well-balanced', () => {
    const p = analyzeBiasProfile({ left: 20, center_left: 20, center: 20, center_right: 20, right: 20 });
    expect(p.balanceScore).toBe(100);
    expect(p.lean).toBe('center');
    expect(p.blindCamps).toEqual([]);
  });

  it('scores a one-camp reader as poorly balanced', () => {
    const p = analyzeBiasProfile({ left: 0, center_left: 0, center: 100, center_right: 0, right: 0 });
    expect(p.balanceScore).toBeLessThan(30);
    expect(p.overweightCamps).toContain('center');
  });

  it('normalizes inputs that do not sum to 100', () => {
    const p = analyzeBiasProfile({ left: 1, center_left: 1, center: 1, center_right: 1, right: 1 });
    expect(p.percentages.left).toBe(20);
    expect(p.balanceScore).toBe(100);
  });

  it('right-leaning reader is flagged as right with left blind spots', () => {
    const p = analyzeBiasProfile({ left: 0, center_left: 5, center: 10, center_right: 40, right: 45 });
    expect(p.lean).toBe('right');
    expect(p.blindCamps).toContain('left');
    expect(p.recommendations[0].outlets.length).toBeGreaterThan(0);
  });
});
