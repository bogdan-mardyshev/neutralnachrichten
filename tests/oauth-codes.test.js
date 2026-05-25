import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOAuthCode, consumeOAuthCode, _storeSize } from '../lib/oauthCodes.js';

describe('OAuth one-time exchange codes', () => {
  const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.sig';

  it('createOAuthCode returns a 64-char hex string', () => {
    const code = createOAuthCode(FAKE_JWT);
    expect(code).toMatch(/^[a-f0-9]{64}$/);
  });

  it('each code is unique (CSPRNG)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => createOAuthCode(FAKE_JWT)));
    expect(codes.size).toBe(20);
  });

  it('consumeOAuthCode returns the JWT for a valid code', () => {
    const code = createOAuthCode(FAKE_JWT);
    expect(consumeOAuthCode(code)).toBe(FAKE_JWT);
  });

  it('consumeOAuthCode returns null for an unknown code', () => {
    expect(consumeOAuthCode('deadbeef'.repeat(8))).toBeNull();
  });

  it('consumeOAuthCode is single-use — second call returns null', () => {
    const code = createOAuthCode(FAKE_JWT);
    expect(consumeOAuthCode(code)).toBe(FAKE_JWT);
    // Second use — must be null
    expect(consumeOAuthCode(code)).toBeNull();
  });

  it('code is removed from store after consumption', () => {
    const before = _storeSize();
    const code = createOAuthCode(FAKE_JWT);
    expect(_storeSize()).toBe(before + 1);
    consumeOAuthCode(code);
    expect(_storeSize()).toBe(before);
  });

  it('expired code returns null', () => {
    // Fake time: advance Date.now() by 31 seconds
    const realDateNow = Date.now;
    const frozenNow = realDateNow();

    // Create code at t=0
    vi.spyOn(Date, 'now').mockReturnValue(frozenNow);
    const code = createOAuthCode(FAKE_JWT);

    // Advance time by 31 000 ms (past the 30s TTL)
    vi.spyOn(Date, 'now').mockReturnValue(frozenNow + 31_000);
    expect(consumeOAuthCode(code)).toBeNull();

    vi.restoreAllMocks();
  });

  it('code within TTL is still valid', () => {
    const realDateNow = Date.now;
    const frozenNow = realDateNow();

    vi.spyOn(Date, 'now').mockReturnValue(frozenNow);
    const code = createOAuthCode(FAKE_JWT);

    // Only 10 seconds later — still valid
    vi.spyOn(Date, 'now').mockReturnValue(frozenNow + 10_000);
    expect(consumeOAuthCode(code)).toBe(FAKE_JWT);

    vi.restoreAllMocks();
  });

  it('empty string code returns null', () => {
    expect(consumeOAuthCode('')).toBeNull();
  });
});
