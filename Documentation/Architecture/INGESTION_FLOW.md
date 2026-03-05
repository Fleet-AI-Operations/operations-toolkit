# Ingestion & Processing Flow

The ingestion system uses a webhook-driven, two-phase architecture to handle large datasets without blocking Vercel serverless function timeouts.

## How It Works

When a new `ingest_jobs` row is inserted, a Supabase DB trigger fires an async HTTP POST (via `pg_net`) to `/api/ingest/process-job`. That endpoint authenticates the request, responds immediately with `{ received: true }`, then uses Vercel's `waitUntil` to run Phase 1 and Phase 2 in the background — keeping the function alive up to `maxDuration = 300s` after the response is sent.

No polling, no cron job, no third-party queue service required.

## Process Lifecycle

### Standard CSV / API Upload

```mermaid
sequenceDiagram
    participant UI as Frontend (Client)
    participant API as Ingest API Route
    participant DB as Postgres (Supabase)
    participant TRIG as DB Trigger (pg_net)
    participant WH as /api/ingest/process-job
    participant LIB as Ingestion Library
    participant AI as AI Service

    UI->>API: POST /api/ingest/csv (File)
    API->>LIB: startBackgroundIngest()
    LIB->>DB: INSERT ingest_jobs (status: PENDING)
    DB->>TRIG: on_ingest_job_created fires
    TRIG->>WH: async HTTP POST { job_id, environment, status }
    LIB-->>API: { jobId, environment }
    API-->>UI: { jobId }

    Note over WH: Authenticates x-webhook-secret, responds immediately
    WH->>WH: waitUntil(runPhase1 → runPhase2)

    Note over LIB, DB: Phase 1: Data Loading (PROCESSING)
    WH->>LIB: runPhase1(jobId)
    LIB->>DB: CAS: PENDING → PROCESSING
    LIB->>DB: Stream records via async csv-parse (Batch: 100)
    LIB->>DB: Update savedCount (heartbeat)
    LIB->>DB: CAS complete: PROCESSING → QUEUED_FOR_VEC

    Note over LIB, AI: Phase 2: Vectorization (VECTORIZING)
    WH->>LIB: runPhase2(jobId, environment)
    LIB->>DB: CAS: QUEUED_FOR_VEC → VECTORIZING
    LIB->>DB: Fetch records without embeddings
    LIB->>AI: Batch getEmbeddings (Batch: 25)
    LIB->>DB: Update record embeddings
    LIB->>DB: Update Job (COMPLETED)
    LIB->>LIB: startSimilarityDetection() [fire-and-forget]
```

### Chunked Upload (Large Files)

Large CSV files are uploaded in chunks to avoid request body size limits. The ingestion pipeline streams chunks directly from the database during Phase 1 — the full file is **never assembled in memory**, keeping peak memory usage to ~one chunk (~4 MB) regardless of file size.

```mermaid
sequenceDiagram
    participant UI as Frontend (Client)
    participant API as Chunked Upload Route
    participant DB as Postgres
    participant WH as /api/ingest/process-job
    participant LIB as Ingestion Library

    UI->>API: start (uploadId, totalChunks)
    API->>DB: Create upload_sessions row
    API-->>UI: { uploadId }

    loop For each chunk
        UI->>API: chunk (uploadId, chunkIndex, content)
        API->>DB: Upsert into upload_chunks
        API->>DB: Extend session TTL
        API-->>UI: { totalReceived, totalExpected }
    end

    UI->>API: complete (uploadId)
    API->>DB: Validate chunk count + SUM(size)
    API->>LIB: startBackgroundIngestFromSession(sessionId, totalChunks)
    LIB->>DB: INSERT ingest_jobs (status: PENDING)
    DB->>WH: DB trigger fires (async HTTP POST)
    API-->>UI: { jobId }

    Note over LIB, DB: Phase 1: Data Loading (PROCESSING)
    loop For each chunk (fetched one at a time)
        LIB->>DB: SELECT content WHERE chunk_index = i
        LIB->>LIB: Yield chunk into Readable.from(asyncGenerator)
        LIB->>LIB: csv-parse streams records (Batch: 100)
        LIB->>DB: Insert records, update savedCount
    end
    LIB->>DB: DELETE upload_sessions (cascades to chunks)
    LIB->>DB: Update Job (QUEUED_FOR_VEC)
```

### Phase 3: Similarity Detection

After Phase 2 completes, `startSimilarityDetection(jobId, environment)` is called as a fire-and-forget task (errors are logged but do not fail the job). It compares the cosine similarity of each new task's embedding against historical task embeddings from the same user. Any pair exceeding the configured threshold (default: 80%) is written to the `similarity_flags` table as an `OPEN` flag. Flags are surfaced in the **Similarity Flags** dashboard (Core app) for CORE, FLEET, MANAGER, and ADMIN users.

## Webhook Configuration

The trigger reads its URL and secret from `public.ingest_webhook_config`:

```sql
INSERT INTO public.ingest_webhook_config (key, value) VALUES
    ('url',    'https://your-fleet-app.vercel.app/api/ingest/process-job'),
    ('secret', 'your-secret')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

The `WEBHOOK_SECRET` environment variable in Vercel must match the `secret` value. If `url` is not set or empty, the trigger is a safe no-op — no requests are sent.

## Idempotency & Concurrency

Both phase functions use **atomic Compare-And-Swap (CAS)** status transitions:

```sql
UPDATE public.ingest_jobs SET status = 'PROCESSING', "updatedAt" = NOW()
WHERE id = $jobId AND status = 'PENDING'
```

`pg_net` delivers at-least-once, so a job may receive duplicate webhook calls. The CAS update returns 0 rows affected if the job has already been claimed, making all duplicate deliveries safe no-ops.

## Status Lifecycle

```
PENDING → PROCESSING → QUEUED_FOR_VEC → VECTORIZING → COMPLETED
                                                      → FAILED
                                                      → CANCELLED
```

| Status | Meaning |
|---|---|
| `PENDING` | Job created; webhook not yet received or processed |
| `PROCESSING` | Phase 1 running — parsing source and writing records to DB |
| `QUEUED_FOR_VEC` | Data loaded; Phase 2 not yet started |
| `VECTORIZING` | Phase 2 running — generating AI embeddings |
| `COMPLETED` | Both phases complete; embeddings available |
| `FAILED` | An error occurred; `error` column has details |
| `CANCELLED` | Cancelled by user before completion |

**Similarity job statuses** (tracked separately in `similarity_jobs`):

| Status | Meaning |
|---|---|
| `PENDING` | Queued but not yet scanning |
| `PROCESSING` | Actively computing cosine similarity and writing flags |
| `COMPLETED` | All pairs evaluated; `flagsFound` reflects new flags inserted |
| `FAILED` | Error during detection; ingestion job itself is unaffected |

## Error Handling & Recovery

### Errors During Processing

Both `runPhase1` and `runPhase2` wrap all processing in a try-catch. On any error:
1. The job is updated to `FAILED` with the error message
2. The payload is cleared (null) to free storage
3. The error is re-thrown so it appears in Vercel logs

### Zombie Detection

The `GET /api/ingest/status` endpoint detects jobs stuck in `PROCESSING` or `VECTORIZING` for more than 10 minutes (2× the 300s `maxDuration`). These are assumed to have been killed by a Vercel timeout and are automatically marked `FAILED` with an actionable message:

- `PROCESSING` → `FAILED`: "Ingestion timed out. Please re-upload the file."
- `VECTORIZING` → `FAILED`: "Vectorization timed out. Use retroactive vectorization to resume."

### Retroactive Vectorization

Jobs that fail during Phase 2 can be resumed via `POST /api/ingest/retroactive-vectorization`. This creates a new `ingest_job` row with status `QUEUED_FOR_VEC`, which triggers the webhook and runs Phase 2 directly — Phase 1 is skipped since records are already in the database.

## Performance

- **Phase 1 batch size**: 100 records per DB insert
- **Phase 2 batch size**: 25 records per AI embedding request
- **Memory**: Only one batch held in memory at a time (both standard and chunked paths)
- **Deduplication**: Records checked for uniqueness via `task_id`, `task_key`, or `id` before insertion
- **Parallelism**: Multiple jobs can load data simultaneously; vectorization is per-environment to avoid overloading AI hosts

## Cost Considerations (OpenRouter)

When using OpenRouter for embeddings:
- Each batch of 25 records incurs an API cost based on token count
- Large ingestion jobs may accumulate significant embedding costs
- Consider using LM Studio for high-volume ingestion to avoid costs
- The dashboard displays your remaining balance for monitoring
