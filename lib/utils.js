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
  const last  = cleaned.lastIndexOf('}');
  if (first === -1 || last < first) throw new Error('No JSON object found in response');

  const candidate = cleaned.substring(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    // Attempt repair: trailing commas, `undefined` values (common Gemini artefacts)
    const repaired = candidate
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/:\s*undefined/g, ': null');
    return JSON.parse(repaired);
  }
}
