# Architecture

Technical reference for NeutraleNachrichten. Everything here is verified against the code.

- [1. Topology](#1-topology-two-services-one-database)
- [2. Data layer](#2-data-layer-postgresql-schema)
- [3. Ingestion worker](#3-ingestion-worker)
- [4. Web service](#4-web-service-serverjs)
- [5. Request path](#5-request-path-topic--answer)
- [6. Reliability layer](#6-reliability-layer)
- [7. Hybrid retrieval and RRF](#7-hybrid-retrieval-and-rrf)
- [8. Deployment](#8-deployment)
- [9. Frontend](#9-frontend)
- [10. Module map](#10-module-map-lib)
- [11. Known limitations](#11-known-limitations)
- [12. Design decisions FAQ](#12-design-decisions-faq)

---

## 1. Topology: two services, one database

The system is deliberately split into two independent processes that communicate **only through the
database**, never directly:

```
┌────────────────┐        ┌──────────────────────┐        ┌────────────────┐
│  worker.js     │ writes │  PostgreSQL          │ reads  │  server.js     │
│  (ingestion)   │───────▶│  + pgvector + FTS    │◀───────│  (API + SPA)   │
│  Railway svc 2 │        │                      │        │  Railway svc 1 │
└────────────────┘        └──────────────────────┘        └────────────────┘
        │                                                          │
   RSS · 59 outlets                                          Redis (cache,
   Gemini embeddings                                         rate limiting)
                                                             Gemini (analysis, NLI)
```

**Why.** If news collection lived inside the web server, every user request would fetch RSS live —
slow, expensive per analysis, and legally risky. Splitting them means collection runs on a schedule in
the background while a user request is served from an already-built corpus in milliseconds. The worker
can be restarted, scaled or crash entirely without affecting the API.

Both services share `DATABASE_URL` and `GEMINI_API_KEY`.

---

## 2. Data layer: PostgreSQL schema

Migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) and run at
startup in `initDB()` ([db.js](db.js)). There is no separate migration tool — the schema applies
itself.

### 2.1 Corpus tables

**`corpus_articles`** — the central table. The key detail: **there is no full-text column at all**.
This is derive-and-discard enforced at the schema level — not "we delete the text" but "there is
physically nowhere to put it".

| Column | Type | Purpose |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `url`, `url_hash` | TEXT, UNIQUE | deduplication by URL hash |
| `source_name`, `source_domain` | TEXT | outlet |
| `spectrum` | TEXT | left / center_left / center / center_right / right |
| `title` | TEXT | headline |
| `our_summary` | TEXT | **our** derived summary (≤600 chars) |
| `short_lead` | VARCHAR(200) | short lead |
| `pub_date`, `fetched_at` | TIMESTAMPTZ | |
| `cluster_id` | BIGINT | → story_clusters |
| `lang` | TEXT | defaults to 'de' |
| `fts` | tsvector **GENERATED ALWAYS** | `to_tsvector('german', title ‖ our_summary)` |

Indexes: `GIN(fts)`, `(spectrum)`, `(pub_date DESC)`.

`fts` is a generated column, so PostgreSQL recomputes it on any change to title/summary. Drift between
the text and its search index is impossible by construction.

**`corpus_embeddings`** — vectors in a separate table:

```sql
article_id BIGINT REFERENCES corpus_articles(id) ON DELETE CASCADE,
model      TEXT DEFAULT 'text-embedding-004',
embedding  vector(768) NOT NULL,
PRIMARY KEY (article_id, model)
```

Index: `HNSW (embedding vector_cosine_ops)`. The composite primary key `(article_id, model)` allows
embeddings from different models to coexist, so migrating to a new embedding model does not require
discarding the old ones. `ON DELETE CASCADE` means retention pruning removes vectors automatically.

HNSW index creation is wrapped in `.catch()`: on a large table it is slow and may fail, but that must
never abort startup — queries still work without it, just slower.

**`story_clusters`** — `label`, `article_count`, `first_seen`, `last_seen`, plus `centroid vector(768)`
(added only when pgvector is available).

**`feed_health`** — what separates genuine editorial silence from a broken feed:

```sql
feed_url PK, source_name, spectrum,
last_success, last_failure,
consecutive_failures INTEGER,
status TEXT  -- ok | degraded | down | unknown
```

**`source_ratings`** — outlet classification on **three independent axes**:

- `spectrum` — political position
- `tier` — `flagship | standard | niche` (reach / prominence)
- `factual_rating` — `high | mixed | low` (factual quality, **separate** from spectrum)

Plus `reach_weight` (used to normalize coverage), `rating_source` and `notes` for provenance — the
classification is auditable rather than asserted.

Separating spectrum from factual quality matters: a right-leaning outlet can be highly factual and a
left-leaning one poorly so. Collapsing them into one axis would bake bias into the system itself.

### 2.2 Product tables

`content_cache` (L3 analysis cache), `users`, `searches`, `user_daily_usage`, `user_searches`,
`analysis_likes`, `saved_topics`, `analysis_feedback`, `source_suggestions`.

`nli_results` (`source_domain`, `label`, `topic_norm`) accumulates verification verdicts per domain,
from which measured factuality per source is derived (`getSourceNliStats`, minimum 5 datapoints). A
CHECK constraint governs `label`: **`neutral` verdicts are not persisted** (see §6.3).

---

## 3. Ingestion worker

[worker.js](worker.js) is a thin 160-line wrapper. The orchestration lives in
[lib/ingestionWorker.js](lib/ingestionWorker.js) and is written purely with dependency injection, so it
is unit-tested without network or database.

### 3.1 One pass (`runPass`)

1. **Database check** — if unavailable, the pass is skipped but the loop survives.
2. **`runIngestionOnce(deps)`** — walk the RSS feeds; for each article:
   - `deriveArticle` — turn a raw RSS item into `our_summary` + `short_lead`, discard the full text;
   - `upsertCorpusArticle` — insert/update by `url_hash`;
   - `recordFeedSuccess` / `recordFeedFailure` — update `feed_health`;
   - batch-embed articles that lack embeddings (`listArticleIdsMissingEmbeddings` →
     `getEmbeddingsBatch` → `upsertCorpusEmbedding`).
3. **Retention** — `pruneCorpus(CORPUS_RETENTION_DAYS)`, default 180 days. History is useful for
   trends, but growth stays bounded. Embeddings follow via cascade.
4. **Feed-health alert** — `buildFeedHealthAlert(getDownFeeds())`; `critical` severity goes to
   `console.error` (picked up by Railway/Sentry). A broken feed must never silently masquerade as
   editorial silence and produce a false blind spot.
5. **Clustering** (behind `CLUSTERING_ENABLED=true`) — `assignClusterIds` over a
   `CLUSTERING_WINDOW_DAYS` window (default 3), then `updateClusterIds`, giving stable story ids that
   persist across requests.

### 3.2 Modes and resilience

- `node worker.js` — immediate pass, then `setInterval` every `INGEST_INTERVAL_MINUTES`
  (minimum 5, default 30).
- `node worker.js --once` — a single pass, then exit.
- Every stage has its own `try/catch`: **one failed pass never kills the loop**.
- Graceful degradation on three levels:
  - no pgvector → articles stored, embeddings skipped, FTS still works;
  - no API key → same;
  - no database → the worker logs and idles, still retrying.
- `SIGTERM`/`SIGINT` → `closeDB()` and clean exit, so Railway redeploys never drop the pool.

At startup `seedSourceRatings` runs once — idempotent upserts of the 59 outlet classifications.

---

## 4. Web service: server.js

~2 980 lines, ~40 routes. This is the largest file in the project and the main refactoring candidate
(routes, rate limiters, auth helpers and digest logic currently live together).

### 4.1 Boot order

1. `dotenv` → configuration.
2. **JWT_SECRET guard**: in production, if `JWT_SECRET` is missing or still equals the default
   `dev-secret-change-in-prod`, the server prints `[FATAL]` and **refuses to start**. Better not to
   boot than to boot with a predictable signing key.
3. `helmet` + CSP, CORS allowlist (`CORS_ORIGINS`, defaults to neutralenachrichten.com only).
4. Rate limiters (Redis-backed, so they survive restarts).
5. `initDB()`, `initRedis()`.
6. Vite bundle served statically with SPA fallback.

### 4.2 Rate limiting

Separate limiters per risk profile: `loginLimiter`, `registerLimiter`, `forgotLimiter`,
`feedbackLimiter`, `analyzeLimiter`. Login and analyze can be skipped with a valid `x-admin-key`.

### 4.3 Gemini budget

`geminiBudgetOk()` / `geminiBudgetSpend()` count calls per UTC day against `GEMINI_DAILY_BUDGET`. When
exhausted, model calls stop and an error is reported to Sentry — protection against a surprise bill.
`MAX_CONCURRENT_GEMINI` additionally caps parallelism (visible in `/api/health` as `gemini_active`,
`gemini_queue`, `gemini_limit`).

### 4.4 Three-layer cache

`cacheGetLayered(key)`:

```
L1  NodeCache (in-process, 0 ms)
     ↓ miss
L2  Redis (distributed, ~10 ms, survives restarts)  → on hit, promoted to L1
     ↓ miss
L3  PostgreSQL content_cache (persistent)           → on hit, promoted upward
```

Key: `md5(topic.toLowerCase() : lang : CACHE_SCHEMA)` with `CACHE_SCHEMA = 'v6'`. Bumping the schema
version instantly makes every stale entry unreachable when the response format changes — no manual
cache invalidation needed.

---

## 5. Request path: topic → answer

The main flow, `POST /api/analyze` (and its SSE variant `GET /api/analyze/stream`):

```
topic request
   │
   ├─▶ input validation
   ├─▶ rate/quota check (IP or user)
   ├─▶ cacheGetLayered → HIT? return immediately
   │
   ▼ miss
getSpectraForTopic(topic)
   │
   ├─ CORPUS_ANALYSIS_ENABLED && database up?
   │     ├─ retrieveCorpusSpectra:
   │     │     extractSearchKeywords(topic)
   │     │     getEmbedding(topic)                ← embed the NATURAL topic
   │     │     searchCorpusHybrid(embedding, kw)  ← semantic + lexical
   │     │     corpusToSpectra(...)               ← relevance gate
   │     └─ articles ≥ CORPUS_MIN_ARTICLES (8)? → use corpus
   │
   └─ otherwise → live-RSS fallback (searchAllFeeds)
   │
   ▼
Gemini: cross-spectrum analysis (≤ GEMINI_MAX_PER_SPECTRUM = 12 articles per camp in the prompt)
   │
   ▼
applyCorpusReliability → composeReliability(...)     ← corpus path only
   │  1. citation grounding
   │  2. dedupe
   │  3. verified blind spots (feed_health)
   │  4. NLI claim verification (≤ 8 claims)
   │  5. confidence envelope
   │  6. sub-story clusters
   ▼
cache (L1 + L2 + L3) → JSON response
```

Two subtleties worth knowing:

**Why the natural topic is embedded rather than a keyword bag.** Documents are embedded as
`"title. our_summary"` — connected prose. Embedding the query as `"klima wandel 2026"` creates
query/document asymmetry and measurably weakens semantic recall. So the natural phrasing is embedded,
with expanded keywords used only as a light hint.

**Display and prompt limits are separate.** *All* matching articles are retrieved
(`perSpectrum: Infinity`; the only guard is a 1000-row safety cap inside `searchCorpusHybrid`) and all
of them are shown with real links. Only the Gemini prompt is capped at 12 per camp — that bounds AI
work and latency, never the honesty of the displayed coverage.

---

## 6. Reliability layer

Composed in exactly one place, [lib/reliabilityPipeline.js](lib/reliabilityPipeline.js). Pure steps are
imported directly; everything side-effectful (database reads, the Gemini NLI call, budget accounting,
metrics, persistence) is injected through `deps`, which makes the whole layer testable with fakes.

It runs **only on the corpus path** — the live-RSS path has no stored sources to ground against, so it
returns `reliability: null`.

### 6.1 Citation grounding — [lib/citationGrounding.js](lib/citationGrounding.js)

The Gemini prompt carries `source_name` and `title` but not the domain, so the model cannot return a
real URL. `groundAnalysis` matches the model's output against corpus rows by URL and title overlap and
stamps the **real stored URL**. This is what makes source links genuine and clickable. Anything that
cannot be grounded is flagged rather than presented as fact. `dedupeArticles` then removes duplicates
within each camp.

### 6.2 Verified blind spots — [lib/blindspotVerification.js](lib/blindspotVerification.js)

Turns "no articles" into a **defensible** claim of silence:

- `covered` — at least one article;
- `camp_silent` — nobody in the camp published, **and all feeds are healthy**;
- `flagship_silent` — the camp covered it, but its mass-reach flagship stayed silent;
- `lead_silent` / `leadOnlySilent` — the camp's leading voices are silent while the flagship is not
  (the subtlest signal);
- `unknown` — no articles, **but a feed is degraded** → we cannot tell, so we say nothing.

That last state is the important one: without it, a broken RSS feed would turn into an accusation that
a newsroom suppressed a story.

### 6.3 NLI claim verification — [claimVerification.js](lib/claimVerification.js) + [entailment.js](lib/entailment.js)

`extractClaims` pulls statements out of the synthesis (capped at `MAX_CLAIMS_PER_ANALYSIS = 8` to bound
cost and latency). `topEvidence(claim, articles, k=3)` gathers the top sources, and `verifyClaims`
labels them in **one batched** Gemini call:

- `supported` — the source backs the claim;
- `contradicted` — the source contradicts it (**this is what catches hallucinations and meaning
  inversion**);
- `neutral` — the source simply does not address it.

**`neutral` is not a failure.** It is excluded from `supportRatio`, because unmeasured must not be
penalised as if it were refuted. When every claim is neutral, `supportRatio` returns `null`, not 0. And
`neutral` verdicts are **not persisted** to `nli_results` — doing so would violate the CHECK
constraint.

### 6.4 Confidence envelope — [lib/confidenceScore.js](lib/confidenceScore.js)

```js
CONFIDENCE_WEIGHTS = {
  spectrumBreadth: 0.25,   // how much of the spectrum is covered
  grounding:       0.15,   // share of grounded citations
  claimSupport:    0.35,   // ← highest weight
  volume:          0.25,   // source volume
}
VOLUME_TARGET         = 14    // volume factor saturates at 14 sources
UNMEASURED_FACTOR     = 0.85  // used when a signal was NOT measured
CONTRADICTION_PENALTY = 0.6   // multiplier if any claim is contradicted
```

`claimSupport` carries the most weight because it is **the only signal that checks meaning** against
sources. `grounding` is deliberately demoted to a sanity check — a real link does not make a statement
true.

`UNMEASURED_FACTOR = 0.85` fixes the central score-inflation bug: an unmeasured signal must not count
as perfect (1.0), but must not zero the score either. Hence the principle: *unmeasured is neither
perfect nor zero.*

### 6.5 Sub-story clustering — [lib/storyClustering.js](lib/storyClustering.js)

Groups a topic's retrieved articles into distinguishable sub-stories, so "pension reform" resolves into
separate threads instead of one undifferentiated pile of 40 links.

---

## 7. Hybrid retrieval and RRF

[lib/hybridRetrieval.js](lib/hybridRetrieval.js) is pure — it performs no IO and operates on
already-ranked lists. `db.searchCorpusHybrid` does the IO and calls `fuseRankings()`.

**Why both retrievers:**

- Semantic (vector) recall catches paraphrases and synonyms a keyword index misses:
  *Rentenreform* ↔ *Altersvorsorge-Gesetz*.
- Lexical (FTS) precision nails what vectors blur: proper nouns, numbers, `§219a`, `2027`.

Neither alone is good enough.

**How they are fused — Reciprocal Rank Fusion:**

```
score(d) = Σ_lists  1 / (k + rank_list(d))        k = 60
```

The key property: RRF works on **ranks, not scores**. That sidesteps an otherwise unsolvable problem —
cosine distance and `ts_rank` live on incomparable scales with different distributions, so any
normalization between them would be arbitrary. `k` dampens low-rank contributions; `k = 60` is the
established default (Cormack et al., 2009).

Each fused item carries `_rrfScore` and `_retrievers`, recording which retrievers matched it — useful
for debugging whether a result came from the semantic path, the lexical one, or both.

---

## 8. Deployment

Config-as-code, two files at the repository root:

| File | Service | startCommand | Notes |
|---|---|---|---|
| `railway.json` | web | `node server.js` | healthcheck `/api/health`, restart ON_FAILURE ×10 |
| `railway.worker.json` | worker | `node worker.js` | restart ON_FAILURE ×5 |

**Critical:** the worker service in Railway must have its config file set to `railway.worker.json`.
Otherwise the root `railway.json` overrides the start command and the worker boots `node server.js` —
a second web server instead of an ingester.

Environments: `staging` and `production`, deployed via `scripts/deploy-staging.sh` and
`scripts/deploy-prod.sh`.

**Known trap:** environment-variable names typed on a Cyrillic keyboard layout contain homoglyphs
(С, О, А, Е, Р, Н, К, М, В, Т are visually identical to their Latin counterparts). Nixpacks then fails
with `ENV names can not be blank`. The fix is to retype every affected name in the Raw Editor using a
Latin layout.

### Environment variables

**Required in production:** `DATABASE_URL`, `GEMINI_API_KEY`, `JWT_SECRET`.

**Key flags:** `CORPUS_ANALYSIS_ENABLED` (enables the corpus path), `CORPUS_MIN_ARTICLES` (8),
`GEMINI_MAX_PER_SPECTRUM` (12), `CLUSTERING_ENABLED`, `INGEST_INTERVAL_MINUTES` (30),
`CORPUS_RETENTION_DAYS` (180), `GEMINI_DAILY_BUDGET`, `MAX_CONCURRENT_GEMINI`, `CORS_ORIGINS`,
`REDIS_URL`, `ADMIN_KEY`, `SENTRY_DSN`.

See [.env.example](.env.example) for the full list.

---

## 9. Frontend

React + Vite + TypeScript + Tailwind — 36 components, ~12 100 lines of TSX. Routing via
react-router-dom; state is local (no Redux/Zustand). Three languages through
[translations.ts](translations.ts).

Key components: `App.tsx` (routing, language, onboarding), `SpectrumGrid.tsx` (the five-camp grid,
deduplicated by URL with no per-outlet ceiling), `ReliabilityPanel.tsx` (confidence panel and
lead-silence banner), `AnalysisPage.tsx`, `DeepAnalysisBlock.tsx`, `ComparePage.tsx`, `AdminPage.tsx`,
`UserProfilePage.tsx`.

Monitoring: Sentry (browser + node), PostHog (analytics).

---

## 10. Module map (lib/)

31 modules, ~5 650 lines. The import graph has been verified — no cycles.

**Ingestion and sources**
| Module | Role |
|---|---|
| `rssSearch.js` | feeds, keyword extraction, relevance gate, per-feed backoff (429 → 30 min honouring Retry-After; error → 10 min) |
| `deriveArticle.js` | raw RSS item → summary + lead (full text discarded) |
| `ingestionWorker.js` | pure, DI-based ingestion orchestration |
| `sourceRatingsSeed.js` | 59 outlets classified on 3 axes + `leadOutletsBySpectrum` |
| `embeddings.js` | Gemini embedding wrapper (768 dimensions) |
| `feedHealthAlert.js` | feed_health → actionable alert |

**Retrieval**
| Module | Role |
|---|---|
| `corpusQueries.js` | Corpus V2 SQL builders — the data hub, 15 production consumers |
| `hybridRetrieval.js` | RRF fusion (k=60) |
| `corpusRetrieval.js` | topic → keywords → embedding → hybrid → spectra |
| `corpusToSpectra.js` | adapts corpus output to the `searchAllFeeds` shape + relevance gate |

**Reliability**
| Module | Role |
|---|---|
| `reliabilityPipeline.js` | single composition point for the whole layer |
| `citationGrounding.js` | real-URL grounding + dedupe |
| `claimVerification.js` | claim extraction, top-K evidence, support ratio |
| `entailment.js` | batched NLI call |
| `confidenceScore.js` | final confidence envelope |
| `blindspotVerification.js` | silence levels, feed-health aware |
| `storyClustering.js` / `corpusClustering.js` | sub-stories / persistent ids |
| `deepAnalysisEnrich.js` | makes the deep comparative analysis defensible |

**Other:** `analysisValidator.js`, `buildRSSPrompt.js`, `rssDirectAnalysis.js` (live-RSS path),
`utils.js` (`extractJSON` + `balanceJson` — multi-stage recovery of truncated model JSON),
`metrics.js`, `translate.js`, `email.js`, `oauthCodes.js`, `biasProfile.js`, `ragEval.js`.

---

## 11. Known limitations

Not a bug list — the honest boundary of what the system can currently prove, and the reason the
research programme exists:

1. **Accuracy is not measured on real data.** There is an offline harness and a synthetic golden set
   (15 topics), but no human-labelled metrics. The infrastructure is ready:
   `scripts/rag-capture.mjs` → labelling → `scripts/rag-eval.mjs --real`.
2. **Confidence is not calibrated.** A score of 84/100 is internally consistent, but nobody has
   verified it corresponds to an 84% chance of being right (ECE). Requires the ground truth from (1).
3. **Circular verification.** Gemini writes the analysis and Gemini also runs the NLI check — the model
   verifies itself. There is no independent external anchor yet. This motivates training a dedicated
   verification model.
4. **Retrieval neutrality is unproven.** Whether the retrieval and source weighting introduce bias of
   their own has not been measured.
5. **Cross-lingual parity is untested.** It works in German; accuracy parity in English is unknown.

---

## 12. Design decisions FAQ

**Why PostgreSQL + pgvector instead of Pinecone/Weaviate?** One database instead of two: no
synchronization between an article store and a separate vector index, no drift, real transactions.
Hybrid search (vector + full-text) happens in one place. It is free and already in the stack, and
pgvector's HNSW is comfortably sufficient at our scale.

**Why RRF instead of a weighted score sum?** Cosine distance and `ts_rank` are not comparable in scale
or distribution, so any normalization would be arbitrary. RRF operates on ranks and removes the
question entirely.

**How is copyright handled?** The schema has no column for full text. Only our derived summary, a short
lead and a vector are stored. The original is never reproduced.

**What if Gemini returns malformed JSON?** `extractJSON` in `utils.js` applies staged repair, including
`balanceJson` for truncated responses. Retries happen only for recoverable failures.

**What if an RSS feed goes down?** `feed_health` records the degradation, the blind-spot status becomes
`unknown` instead of a false silence accusation, and a feed-health alert fires. Per-feed backoff stops
us hammering a failing feed.

**What if pgvector is unavailable?** The system degrades to full-text search: articles are still
stored, embeddings are skipped, search keeps working.

**What does one analysis cost?** Roughly €0.08 in inference, on top of about €10/month of
infrastructure.
