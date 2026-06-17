import { describe, it, expect } from 'vitest';
import { buildFeedHealthAlert } from '../lib/feedHealthAlert.js';

const feed = (over) => ({ source_name: 'X', spectrum: 'center', status: 'down', consecutive_failures: 5, feed_url: 'u', ...over });

describe('buildFeedHealthAlert', () => {
  it('no alert when nothing is unhealthy', () => {
    const a = buildFeedHealthAlert([]);
    expect(a.shouldAlert).toBe(false);
    expect(a.severity).toBe('ok');
  });

  it('ignores feeds below the consecutive-failure threshold and status ok', () => {
    const a = buildFeedHealthAlert([feed({ status: 'ok', consecutive_failures: 1 })]);
    expect(a.shouldAlert).toBe(false);
  });

  it('warns on a single unhealthy feed', () => {
    const a = buildFeedHealthAlert([feed({ source_name: 'taz', spectrum: 'left' })]);
    expect(a.shouldAlert).toBe(true);
    expect(a.severity).toBe('warning');
    expect(a.count).toBe(1);
    expect(a.message).toContain('taz');
  });

  it('escalates to critical when a camp goes dark (≥2 feeds down)', () => {
    const a = buildFeedHealthAlert([
      feed({ source_name: 'FAZ', spectrum: 'center_right' }),
      feed({ source_name: 'Welt', spectrum: 'center_right' }),
    ]);
    expect(a.severity).toBe('critical');
    expect(a.darkSpectrums).toContain('center_right');
    expect(a.message).toContain('DARK');
  });

  it('counts a feed as unhealthy via status even with low failure count', () => {
    const a = buildFeedHealthAlert([feed({ status: 'degraded', consecutive_failures: 1 })]);
    expect(a.shouldAlert).toBe(true);
  });
});
