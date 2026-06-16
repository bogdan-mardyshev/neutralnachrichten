# RAG evaluation

Turns "the analysis is reliable" into tracked numbers — **offline, deterministic,
no Gemini/DB in the scoring loop**, so it can gate CI and catch regressions.

Two metric families:

- **Retrieval** — `precision` (set-precision: of what survives the relevance gate,
  how much is on-topic), `recall@k`, `MRR`, `MAP`, `nDCG@k`. This is the direct
  guard against off-topic filler (the "missile article under a football topic" bug).
- **Faithfulness** — `grounding` (cards resolve to real corpus rows) × `claimSupport`
  (synthesis sentences entailed by evidence), with a contradiction penalty. Low
  hallucination risk = high faithfulness.

## Two modes

### 1. Synthetic golden set (logic check) — `npm run eval:rag`

[`golden-set.js`](golden-set.js) holds hand-authored German topics with labelled
relevant ids and an authored synthesis each. Every case probes one failure mode
(gate slip-through, gate over-filtering, ungrounded citation, unsupported sentence,
contradiction). It verifies the **pipeline logic** end-to-end, but the articles and
labels are invented — it does **not** measure accuracy on real data.

Gates on aggregate floors; exits non-zero below them. Writes `eval/last-run.json`.

### 2. Real labelled corpus (reality check)

Replace synthetic fixtures with real retrieval output, independently labelled:

```bash
# 1) CAPTURE — runs the EXACT production retrieval path against staging
DATABASE_URL=... GEMINI_API_KEY=... npm run eval:capture
#    (custom topics: ... npm run eval:capture -- "Rentenreform" "Heizungsgesetz")
#    → writes eval/candidates/<topic>.json, raw candidates incl. pre-gate rows

# 2) LABEL — open each eval/candidates/*.json and set "relevant": true|false
#    on every candidate (your judgement, independent of what the gate did)

# 3) SCORE — same metrics, real data
npm run eval:rag -- --real
#    → writes eval/last-run-real.json
```

Because captures include candidates **before** the relevance gate (flagged with
`passedGate`), labelling reveals both gate **precision** (off-topic survivors) and
gate **recall** (relevant articles wrongly dropped). Real captures are
**retrieval-only** until a synthesis is attached — faithfulness columns show `—`.

Labelled `eval/candidates/*.json` files are the real golden data — commit them.
`eval/last-run*.json` are run artifacts (git-ignored).
