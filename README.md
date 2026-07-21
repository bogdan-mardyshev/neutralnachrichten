# NeutraleNachrichten

**Trustworthy AI for media-bias analysis.** For any topic, see how the entire German political
spectrum reported it — what each camp said, what each camp **omitted**, and a reliability score you
can verify.

[![Node](https://img.shields.io/badge/Node-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Gemini](https://img.shields.io/badge/AI-Gemini_2.5_Flash-4285F4?logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![Tests](https://img.shields.io/badge/tests-659_passing-success)](#testing)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

🌐 **[neutralenachrichten.com](https://neutralenachrichten.com)** — live

---

## The problem

Most people follow one or two outlets that already match their worldview. The same event is framed
very differently across the spectrum, and what one camp **leaves out entirely** is often more
revealing than what it prints. Comparing dozens of outlets by hand is not realistic for a reader.

Existing tools label a whole *outlet* as "left" or "right", once. They never verify whether a specific
claim is actually supported by its sources — you have to *trust* the analysis rather than *check* it.

## What this does differently

Trust is **constructed and shown, not asserted**. Every analysis passes a four-stage verification layer
before a user sees it:

| Stage | What it does |
|---|---|
| **Citation grounding** | every displayed article resolves to a real, stored source with a working link; ungrounded model output is flagged, never presented as fact |
| **NLI claim verification** | each synthesized statement is checked against its top sources as *supported / contradicted / neutral* — this is what catches hallucinations and meaning inversion |
| **Honest confidence** | one defensible 0–100 score from spectrum breadth, grounding, claim support and source volume, where *unmeasured is neither perfect nor zero* |
| **Blind-spot detection** | distinguishes genuine editorial silence from a broken feed, and national-mainstream silence from silence within a camp |

The corpus is **legal by design**: only a derived summary and a vector embedding are stored, never the
full article text.

---

## How it works

```
RSS · 59 classified outlets
        │  (scheduled background worker)
        ▼
derive-and-discard  →  PostgreSQL + pgvector + full-text search
        │
        │  (per user request)
        ▼
hybrid retrieval (semantic + lexical, RRF k=60)  →  relevance gate
        ▼
Gemini cross-spectrum analysis
        ▼
reliability layer: grounding → NLI → confidence → blind spots → clustering
        ▼
verified answer  (cached: memory → Redis → PostgreSQL)
```

Two services share one database: a **worker** collects news on a schedule, and the **API** serves
requests from the ready-built corpus in milliseconds. Neither can take the other down.

📖 **Full technical reference: [ARCHITECTURE.md](ARCHITECTURE.md)**

---

## Features

- **Five-camp analysis** — left, centre-left, centre, centre-right, right, side by side
- **Blind-spot detection** — feed-health aware, so a broken RSS feed is never mistaken for silence
- **Reliability panel** — a measured confidence score with the signals behind it
- **59 classified outlets** on three axes: political spectrum × reach tier × factual rating
- **Hybrid retrieval** — semantic and lexical search fused with Reciprocal Rank Fusion
- **Story clustering** — a topic resolves into distinguishable sub-stories
- **Multilingual** — German, English, Russian UI and analysis
- **Accounts** — JWT + Google OAuth, saved topics, history, GDPR export and deletion
- **Production hardening** — Redis-backed rate limiting, daily model budget, graceful degradation at
  every layer, Sentry monitoring

---

## Quick start

**Prerequisites:** Node.js 20+, PostgreSQL 14+ (with the `vector` extension for semantic search), a
Google Gemini API key. Redis is optional.

```bash
git clone https://github.com/bogdan-mardyshev/neutralnachrichten.git
cd neutralnachrichten
npm install

cp .env.example .env.local     # then fill in DATABASE_URL, GEMINI_API_KEY, JWT_SECRET

npm run dev                    # API + Vite client together
```

The schema applies itself on first boot — migrations are idempotent, no migration tool required.

Fill the corpus (otherwise the app falls back to live RSS):

```bash
npm run worker:once            # one ingestion pass
npm run worker                 # continuous: every INGEST_INTERVAL_MINUTES (default 30)
```

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | API and client together |
| `npm run dev:server` / `dev:client` | either one alone |
| `npm run build` | production client build |
| `npm start` | production server |
| `npm run worker` / `worker:once` | ingestion worker: loop / single pass |
| `npm test` | full test suite |
| `npm run test:watch` / `test:coverage` | watch mode / coverage |
| `npm run eval:rag` | offline RAG-evaluation harness |
| `npm run eval:capture` | capture live answers for labelling |

---

## Testing

```bash
npm test          # 659 tests · 30 files · ~1.5 s
```

The suite needs **no database and no network**: everything that performs IO (PostgreSQL, Gemini, RSS)
is dependency-injected and replaced with fakes in tests. That is why the whole pipeline — retrieval
fusion, grounding, claim verification, confidence scoring, blind-spot logic — verifies in under two
seconds.

```bash
npx vitest run tests/blindspot-verification.test.js   # a single file
npx vitest run -t "confidence"                        # by test name
```

---

## Configuration

Required in production: `DATABASE_URL`, `GEMINI_API_KEY`, `JWT_SECRET`.

| Variable | Default | Purpose |
|---|---|---|
| `CORPUS_ANALYSIS_ENABLED` | `false` | use the corpus path instead of live RSS |
| `CORPUS_MIN_ARTICLES` | `8` | minimum corpus hits before falling back to live RSS |
| `GEMINI_MAX_PER_SPECTRUM` | `12` | articles per camp sent to the model (display is uncapped) |
| `INGEST_INTERVAL_MINUTES` | `30` | worker cadence (minimum 5) |
| `CORPUS_RETENTION_DAYS` | `180` | corpus pruning window |
| `CLUSTERING_ENABLED` | `false` | persistent story clustering in the worker |
| `GEMINI_DAILY_BUDGET` | — | hard cap on model calls per UTC day |
| `MAX_CONCURRENT_GEMINI` | `6` | model-call concurrency limit |
| `CORS_ORIGINS` | production domains | comma-separated allowlist |
| `REDIS_URL` | — | optional; enables L2 cache and distributed rate limiting |

Full list in [.env.example](.env.example).

The server **refuses to start in production** if `JWT_SECRET` is missing or left at its development
default — booting with a predictable signing key is worse than not booting.

---

## Deployment

Deployed on Railway as two services from the same repository, using config-as-code:

| File | Service | Start command |
|---|---|---|
| `railway.json` | web | `node server.js` |
| `railway.worker.json` | worker | `node worker.js` |

> The worker service must have its config file set to `railway.worker.json`, or the root
> `railway.json` overrides the start command and the worker boots a second web server instead.

---

## Project structure

```
server.js              API + static SPA serving (~40 routes)
worker.js              ingestion worker entry point
db.js                  PostgreSQL layer, schema, hybrid search
redis.js               cache and rate-limit store

lib/                   31 modules — ingestion, retrieval, reliability
  ├─ ingestionWorker   pure ingestion orchestration
  ├─ hybridRetrieval   RRF fusion
  ├─ reliabilityPipeline  single composition point for the trust layer
  ├─ citationGrounding · claimVerification · entailment
  ├─ confidenceScore · blindspotVerification · storyClustering
  └─ sourceRatingsSeed 59 outlets on 3 classification axes

components/            36 React components
tests/                 30 test files, 659 tests
eval/ · scripts/       RAG-evaluation harness and ops scripts
```

---

## Status

A working platform with an end-to-end pipeline in production. The engineering foundation is built; the
open questions are scientific — measured accuracy on human-labelled data, calibrated and explainable
confidence, provably bias-neutral retrieval, and cross-lingual parity. Those limitations are documented
honestly in [ARCHITECTURE.md §11](ARCHITECTURE.md#11-known-limitations).

Built at SRH University Berlin.

## License

MIT — see [LICENSE](LICENSE).
