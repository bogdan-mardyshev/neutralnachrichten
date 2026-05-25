/**
 * One-time OAuth exchange codes.
 *
 * Security model:
 *  - JWT is NEVER placed in the URL (prevents it leaking into browser history,
 *    server logs, analytics, and Referer headers).
 *  - Instead, the OAuth callback issues a short-lived (30s), single-use random
 *    code. The frontend immediately exchanges it for the JWT via POST.
 *  - The code is 32 bytes of CSPRNG data → 256 bits of entropy.
 *  - Consumed immediately on first use (single-use guarantee).
 *  - A 60-second sweep removes any leaked/unused codes.
 */

import crypto from 'crypto';

const TTL_MS = 30_000; // 30 seconds

// Map: code → { jwt: string, exp: number }
const _store = new Map();

// Periodic cleanup of expired codes (runs only while process is alive)
const _sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _store) {
    if (v.exp < now) _store.delete(k);
  }
}, 60_000);

// Allow Node to exit without waiting for the timer
if (_sweep.unref) _sweep.unref();

/**
 * Create a new one-time exchange code wrapping the given JWT.
 * @param {string} jwtToken
 * @returns {string} hex code (64 chars)
 */
export function createOAuthCode(jwtToken) {
  const code = crypto.randomBytes(32).toString('hex');
  _store.set(code, { jwt: jwtToken, exp: Date.now() + TTL_MS });
  return code;
}

/**
 * Consume a code, returning the JWT — or null if invalid / expired.
 * Deletes the code on first use (single-use).
 * @param {string} code
 * @returns {string|null}
 */
export function consumeOAuthCode(code) {
  const entry = _store.get(code);
  if (!entry) return null;
  _store.delete(code); // single-use: delete before any async work
  if (entry.exp < Date.now()) return null; // expired
  return entry.jwt;
}

/** Exposed for tests only */
export function _storeSize() {
  return _store.size;
}
