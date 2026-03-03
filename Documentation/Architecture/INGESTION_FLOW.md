# Ingestion & Queuing Flow

The tool implements a high-performance, asynchronous, and parallelized queuing system designed to handle large datasets while maintaining a responsive UI and preventing local AI server overload.

## Process Lifecycle (Decoupled Phases)

Ingestion is split into two distinct phases to optimize for immediate data availability.

### Standard CSV / API Upload

```mermaid
sequenceDiagram
    participant UI as Frontend (Client)
    participant API as API Route
    participant LIB as Ingestion Library
    participant VEC as Vector Worker
    participant DB as Postgres (Prisma)

    UI->>API: POST /api/ingest/csv (File)
    API->>LIB: startBackgroundIngest()
    LIB->>DB: Create Job (PENDING, payload stored)
    LIB-->>UI: Return JobId

    Note over LIB, DB: Phase 1: Data Loading (PROCESSING)
    LIB->>DB: Stream records via async csv-parse (Batch: 100)
    LIB->>DB: Update savedCount (HEARTBEAT)

    Note over LIB, VEC: Transition to Vector Queue
    LIB->>DB: Update Job (QUEUED_FOR_VEC)
    LIB->>VEC: Trigger processVectorQueues()

    Note over VEC, DB: Phase 2: Vectorizing (VECTORIZING)
    VEC->>DB: Fetch records without embeddings
    VEC->>AI: Batch getEmbeddings (Batch: 25)
    VEC->>DB: Update record embeddings
    VEC->>DB: Update Job (COMPLETED)
```

### Chunked Upload (Large Files)

Large CSV files are uploaded in chunks to avoid request timeouts. The ingestion pipeline streams chunks directly from the database during processing — the full file is **never assembled as a single string** in memory, keeping peak memory usage to ~one chunk (~4 MB) regardless of file size.

```mermaid
sequenceDiagram
    participant UI as Frontend (Client)
    participant API as Chunked Upload Route
    participant LIB as Ingestion Library
    participant DB as Postgres (Prisma)

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
    LIB->>DB: Create Job (PENDING, payload: null, options: { sessionId })
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

## Internal Mechanics

### 1. Parallel Execution
Unlike typical sequential queues, this system allows **Phase 1 (Data Loading)** of Job B to run while **Phase 2 (Vectorizing)** of Job A is still active.
- **Why?** Data loading is DB-bound and very fast. Vectorizing is GPU-bound and slow.
- **Result**: Users see their new records in the dashboard almost instantly, while AI enrichment happens in the background.

### 2. Multi-Stage Status Lifecycle
- **PENDING**: Job is queued, waiting for its turn to load data.
- **PROCESSING**: The system is currently parsing the source and saving records to PostgreSQL.
- **QUEUED_FOR_VEC**: Data is safely stored, but the AI server is currently busy with another job.
- **VECTORIZING**: The AI server is actively generating embeddings for this job.
- **COMPLETED/FAILED/CANCELLED**: Terminal states.

### 3. Queue Locking & Stability
- **Data Lock**: Only one job per environment can be in `PROCESSING` at a time to ensure database write order and prevent primary key collisions.
- **AI Lock**: Only one job per environment can be in `VECTORIZING` at a time to prevent overlapping requests from crashing local AI hosts (like LM Studio).

### 4. Recovery & Resumption
- **Zombie Cleanup**: On server restart, any jobs left in `PROCESSING` are automatically failed. For `CSV_SESSION` jobs, the upload session rows remain in `upload_chunks` until either the processor completes successfully or the session TTL expires (10 minutes), at which point opportunistic cleanup removes them.
- **Vector Resumption**: Any jobs in `QUEUED_FOR_VEC` or `VECTORIZING` can be resumed. The system scans for records missing embeddings and picks up exactly where it left off.

### 5. Performance Optimizations
- **Initial Load**: Using a `CHUNK_SIZE` of 100 for database insertions.
- **AI Batching**: We use a `BATCH_SIZE` of 25 for embeddings, significantly reducing network overhead to the local AI server.
- **Deduplication**: Every record is checked for uniqueness using `task_id`, `task_key`, or `id` before insertion.
- **Memory-Bounded Streaming**: Both standard and chunked CSV paths use the async `csv-parse` API. Records are processed in batches of 100 — only one batch is held in memory at a time regardless of total file size.

### 6. Cost Considerations (OpenRouter)

When using OpenRouter for embeddings:
- Each batch of 25 records incurs an API cost based on token count
- Large ingestion jobs may accumulate significant embedding costs
- Consider using LM Studio for high-volume ingestion to avoid costs
- The dashboard displays your remaining balance for monitoring
