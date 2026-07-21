/**
 * lib/utils.js — shared utility helpers
 *
 * Functions shared between server.js and lib/ modules to avoid duplication.
 */

/**
 * Extract and parse a JSON object from a raw string that may contain markdown
 * fences, leading/trailing prose, or minor syntax errors (trailing commas, `undefined`).
 *
 * Returns the parsed object, or throws on failure.
 *
 * @param {string} raw
 * @returns {object}
 */
export function extractJSON(raw) {
  let cleaned = (raw || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '');

  const first = cleaned.indexOf('{');
  if (first === -1) throw new Error('No JSON object found in response');
  const last = cleaned.lastIndexOf('}');
  // When there is no proper closing brace (truncated output), keep everything from
  // the first '{' to the end and let the repair/balance stages recover it.
  const candidate = last > first ? cleaned.substring(first, last + 1) : cleaned.substring(first);
  try {
    return JSON.parse(candidate);
  } catch {
    // Stage 1 — common Gemini artefacts: trailing commas, `undefined`, and raw
    // control characters that are illegal inside JSON strings (stray tabs/newlines).
    const repaired = candidate
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/:\s*undefined/g, ': null')
      .replace(/[\x00-\x1F]/g, ' ');
    try {
      return JSON.parse(repaired);
    } catch {
      // Stage 2 — truncation (output token limit): balance unclosed brackets/quotes
      // by trimming to the last complete element, then closing what's still open.
      return JSON.parse(balanceJson(repaired));
    }
  }
}

/**
 * Best-effort recovery of a truncated JSON object: scan tracking string/escape
 * state and the bracket stack, cut any dangling partial token, and append the
 * closing brackets needed to make it parseable. Lossy (drops the incomplete tail)
 * but turns a hard parse failure into a usable object.
 */
export function balanceJson(s) {
  const stack = [];
  let inStr = false, esc = false;
  let lastSafe = -1, safeStack = null;     // position + bracket stack at the last complete element
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') {
      stack.pop();
      lastSafe = i; safeStack = stack.slice();   // a complete container closed here
    }
  }
  let out, closeStack;
  if (lastSafe >= 0 && lastSafe < s.length - 1) {
    // Truncated after a complete element — keep up to it, close its enclosing containers.
    out = s.slice(0, lastSafe + 1).replace(/,\s*$/, '');
    closeStack = safeStack;
  } else {
    // Truncated mid-value — close any open string, drop a dangling comma, close brackets.
    out = (inStr ? s + '"' : s).replace(/,\s*$/, '');
    closeStack = stack;
  }
  for (let i = closeStack.length - 1; i >= 0; i--) out += closeStack[i];
  return out;
}
