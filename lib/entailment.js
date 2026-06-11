/**
 * lib/entailment.js — real NLI verification via ONE batched Gemini call (audit A2).
 *
 * The lexical layer in claimVerification catches "no evidence at all", but it
 * cannot catch MEANING reversal ("X tritt zurück" vs "X lehnt Rücktritt ab" share
 * vocabulary). This module asks Gemini to judge entailment for all claim/evidence
 * pairs of one analysis in a single small call (≈300-700 output tokens), so the
 * cost per analysis is one cheap request — not one per claim.
 *
 * Pure prompt-building + parsing; the genAI client is injected (testable).
 */

export const ENTAILMENT_LABELS = ['entailment', 'contradiction', 'neutral'];

/** Build the batched NLI prompt. pairs: [{ claim, evidence }] */
export function buildEntailmentPrompt(pairs) {
  const items = pairs.map((p, i) =>
    `${i + 1}. CLAIM: ${p.claim}\n   EVIDENCE: ${p.evidence}`).join('\n');
  return `You are a precise NLI (natural language inference) judge for German news.
For each numbered pair below, decide whether the EVIDENCE supports the CLAIM:
- "entailment"    — the evidence clearly supports the claim
- "contradiction" — the evidence states the OPPOSITE of the claim
- "neutral"       — the evidence neither supports nor contradicts it

${items}

Output ONLY a JSON array of ${pairs.length} strings, one label per pair, in order.
Example: ["entailment","neutral"]`;
}

/** Parse the model output into a labels array aligned with the input length. */
export function parseEntailmentResponse(raw, expectedLength) {
  try {
    const cleaned = String(raw || '').trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const first = cleaned.indexOf('[');
    const last = cleaned.lastIndexOf(']');
    if (first === -1 || last < first) return null;
    const arr = JSON.parse(cleaned.slice(first, last + 1));
    if (!Array.isArray(arr) || arr.length !== expectedLength) return null;
    return arr.map(l => (ENTAILMENT_LABELS.includes(l) ? l : 'neutral'));
  } catch {
    return null;
  }
}

/**
 * Build a batch entailment function bound to a genAI client.
 * Returns async (pairs) => labels[] | null (null = judging unavailable; callers
 * keep the lexical labels — verification degrades, never blocks).
 */
export function makeBatchEntailment(genAI, { model = 'gemini-2.5-flash', timeoutMs = 10000 } = {}) {
  return async function batchEntailment(pairs) {
    if (!Array.isArray(pairs) || pairs.length === 0) return [];
    try {
      const m = genAI.getGenerativeModel({ model });
      const result = await Promise.race([
        m.generateContent({
          contents: [{ role: 'user', parts: [{ text: buildEntailmentPrompt(pairs) }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('entailment timeout')), timeoutMs)),
      ]);
      return parseEntailmentResponse(result.response.text(), pairs.length);
    } catch (err) {
      console.warn('[Entailment] skipped:', err.message);
      return null;
    }
  };
}
