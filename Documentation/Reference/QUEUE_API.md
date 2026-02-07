# Queue System API Reference

This document describes the database-backed job queue APIs for managing ingestion and vectorization jobs.

## Queue Management Endpoints

### Get Queue Statistics

Returns current queue statistics and recent jobs.

**Endpoint:** `GET /api/admin/queue/stats`

**Authentication:** Required (Manager/Admin)

**Response:**
```typescript
{
  "queueStats": {
    "pending": number,      // Jobs waiting to be processed
    "processing": number,   // Jobs currently being processed
    "completed": number,    // Successfully completed jobs
    "failed": number        // Failed jobs (retries exhausted)
  },
  "recentJobs": Array<{
    "id": string,
    "jobType": "INGEST_DATA" | "VECTORIZE",
    "status": "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
    "priority": number,
    "attempts": number,
    "maxAttempts": number,
    "progress": {
      "current": number,
      "total": number,
      "message": string
    } | null,
    "result": any,
    "createdAt": string,
    "startedAt": string | null,
    "completedAt": string | null
  }>,
  "oldestPendingJob": {
    "id": string,
    "createdAt": string,
    "ageMinutes": number
  } | null
}
```

**Example:**
```bash
curl http://localhost:3000/api/admin/queue/stats \
  -H "Cookie: your-session-cookie"
```

---

### Retry Failed Job

Resets a failed job back to PENDING status for retry.

**Endpoint:** `POST /api/admin/queue/retry`

**Authentication:** Required (Admin only)

**Query Parameters:**
- `jobId` (required): The job ID to retry

**Response:**
```typescript
{
  "success": true,
  "jobId": string
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/admin/queue/retry?jobId=job-123" \
  -H "Cookie: your-session-cookie"
```

**Error Responses:**
- `400`: Missing jobId parameter
- `403`: Forbidden (not admin)
- `404`: Job not found
- `500`: Server error

---

### Cancel Job

Cancels a pending or processing job.

**Endpoint:** `POST /api/admin/queue/cancel`

**Authentication:** Required (Admin only)

**Query Parameters:**
- `jobId` (required): The job ID to cancel

**Response:**
```typescript
{
  "success": true,
  "jobId": string
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/admin/queue/cancel?jobId=job-123" \
  -H "Cookie: your-session-cookie"
```

**Error Responses:**
- `400`: Missing jobId or job already completed
- `403`: Forbidden (not admin)
- `404`: Job not found
- `500`: Server error

---

## Worker Endpoints

These endpoints are called by Vercel Cron workers and require `CRON_SECRET` authentication in production.

### Ingestion Worker

Processes INGEST_DATA jobs from the queue.

**Endpoint:** `GET /api/workers/ingestion`

**Authentication:** `Authorization: Bearer {CRON_SECRET}` (production only)

**Response:**
```typescript
{
  "success": true,
  "processed": number,    // Number of jobs processed
  "duration": number      // Processing time in milliseconds
}
```

**Behavior:**
- Claims up to 3 INGEST_DATA jobs per invocation
- Processes jobs using `processAndStore()` with full feature parity
- Enqueues VECTORIZE jobs if embeddings requested
- Clears payload on completion to free memory

**Cron Schedule:** Every minute (configured in `vercel.json`)

---

### Vectorization Worker

Processes VECTORIZE jobs from the queue.

**Endpoint:** `GET /api/workers/vectorization`

**Authentication:** `Authorization: Bearer {CRON_SECRET}` (production only)

**Response:**
```typescript
{
  "success": true,
  "processed": number,
  "duration": number
}
```

**Behavior:**
- Claims up to 2 VECTORIZE jobs per invocation
- Processes up to 250 records per job (60s timeout limit)
- Re-enqueues job if more records remain
- Clears payload on completion

**Cron Schedule:** Every minute (configured in `vercel.json`)

---

### Cleanup Worker

Removes old completed and failed jobs from the queue.

**Endpoint:** `GET /api/workers/cleanup`

**Authentication:** `Authorization: Bearer {CRON_SECRET}` (production only)

**Response:**
```typescript
{
  "success": true,
  "deletedCount": number
}
```

**Behavior:**
- Deletes jobs with status COMPLETED or FAILED
- Only deletes jobs older than 7 days
- Helps prevent job_queue table bloat

**Cron Schedule:** Daily at 2:00 AM UTC (configured in `vercel.json`)

---

## Queue Monitor UI

**URL:** `/admin/queue-monitor`

**Authentication:** Required (Manager/Admin)

**Features:**
- Real-time queue statistics (auto-refresh every 5 seconds)
- Recent jobs list with status indicators
- Manual retry and cancel actions
- Oldest pending job age tracking

**Status Indicators:**
- 🟡 PENDING: Yellow badge
- 🔵 PROCESSING: Blue badge with spinner
- 🟢 COMPLETED: Green badge
- 🔴 FAILED: Red badge

---

## Database Queue Library

The `DatabaseQueue` class provides programmatic access to the queue system.

### Methods

#### `enqueue(job: QueueJob)`

Adds a new job to the queue.

```typescript
import { DatabaseQueue } from '@/lib/queue/db-queue';

await DatabaseQueue.enqueue({
  jobType: 'INGEST_DATA',
  payload: {
    ingestJobId: 'ingest-123',
    projectId: 'proj-456',
    records: [...],
    generateEmbeddings: true,
  },
  priority: 1,          // Optional: higher = processed first
  maxAttempts: 3,       // Optional: retry limit
  scheduledFor: new Date(), // Optional: delay execution
});
```

#### `claimJob(workerTypes: JobType[])`

Atomically claims the next available job.

```typescript
const job = await DatabaseQueue.claimJob(['INGEST_DATA']);

if (job) {
  // Process job.payload
  await processJob(job.payload);
  await DatabaseQueue.completeJob(job.job_id);
}
```

#### `completeJob(jobId: string, result?: any)`

Marks a job as successfully completed.

```typescript
await DatabaseQueue.completeJob('job-123', {
  savedCount: 1000,
  skippedCount: 5,
});
```

#### `failJob(jobId: string, error: any)`

Marks a job as failed with automatic retry logic.

```typescript
try {
  await processJob(job.payload);
} catch (error) {
  await DatabaseQueue.failJob(job.job_id, error);
}
```

#### `updateProgress(jobId: string, current: number, total: number, message?: string)`

Updates job progress metadata for UI polling.

```typescript
await DatabaseQueue.updateProgress(
  'job-123',
  500,    // current
  1000,   // total
  'Processing records...'
);
```

#### `getQueueStats()`

Returns current queue statistics.

```typescript
const stats = await DatabaseQueue.getQueueStats();
// { pending: 5, processing: 2, completed: 1000, failed: 3 }
```

#### `cleanup(olderThanDays: number = 7)`

Deletes old completed/failed jobs.

```typescript
const deletedCount = await DatabaseQueue.cleanup(7);
console.log(`Deleted ${deletedCount} old jobs`);
```

#### `retryJob(jobId: string)`

Manually retries a failed job.

```typescript
await DatabaseQueue.retryJob('job-123');
```

---

## Job States & Transitions

```
┌──────────┐
│ PENDING  │ ◄──────────┐
└────┬─────┘            │
     │                  │
     │ claimJob()       │ failJob()
     │                  │ (retries remain)
     ▼                  │
┌──────────┐            │
│PROCESSING│────────────┤
└────┬─────┘            │
     │                  │
     │ completeJob()    │ failJob()
     │                  │ (no retries)
     ▼                  ▼
┌──────────┐      ┌──────────┐
│COMPLETED │      │  FAILED  │
└──────────┘      └──────────┘
```

---

## Error Handling

### Worker Errors

Workers automatically retry failed jobs with exponential backoff:

- **Attempt 1 fails**: Retry after 10 seconds
- **Attempt 2 fails**: Retry after 20 seconds
- **Attempt 3 fails**: Mark as FAILED (no more retries)

### Common Error Scenarios

**Error:** `type "vector" does not exist`
- **Cause:** pgvector extension not enabled
- **Fix:** Run `CREATE EXTENSION IF NOT EXISTS vector;`

**Error:** `column "embedding" is of type double precision[]`
- **Cause:** Wrong embedding column type
- **Fix:** Run migration `20260206000000_enable_pgvector_and_fix_embedding_type.sql`

**Error:** `Unauthorized` on worker endpoints
- **Cause:** Missing or invalid CRON_SECRET
- **Fix:** Set `CRON_SECRET` environment variable in production

**Error:** Jobs stuck in PENDING
- **Cause:** Workers not running or CRON_SECRET mismatch
- **Fix:** Check Vercel Cron logs and environment variables

---

## Security Considerations

### CRON_SECRET

**Production:**
- **Required**: Workers return 500 error if CRON_SECRET not set
- **Format**: `Authorization: Bearer {CRON_SECRET}`
- **Generate**: Use a strong random string (e.g., `openssl rand -hex 32`)

**Development:**
- **Optional**: Workers log warning if not set but still process
- **Local script**: `./run-workers.sh` calls endpoints without auth

### Role-Based Access

- **Queue Monitor**: Manager/Admin only (`/admin/queue-monitor`)
- **Queue Stats**: Manager/Admin only (`/api/admin/queue/stats`)
- **Retry/Cancel**: Admin only (`/api/admin/queue/retry`, `/api/admin/queue/cancel`)
- **Workers**: CRON_SECRET authentication (production)

### Payload Security

- **Sensitive Data**: Avoid storing PII in job payloads
- **Cleanup**: Payloads automatically cleared on completion (set to `Prisma.JsonNull`)
- **Retention**: Jobs deleted after 7 days by cleanup worker

---

## Performance Tuning

### Batch Sizes

**Data Loading:**
- Default: 100 records per database transaction
- Adjust: Modify `BATCH_SIZE` in ingestion worker

**Vectorization:**
- Default: 25 records per AI request
- Adjust: Modify `BATCH_SIZE` in vectorization worker

### Worker Frequency

**Current:** Every minute (Vercel Cron)
- For higher throughput: Reduce to every 30 seconds
- For lower costs: Increase to every 5 minutes

### Concurrency

**Data Loading:** Parallel (unlimited projects)
**Vectorization:** Sequential per project (AI protection)

To increase vectorization throughput:
1. Use faster AI provider (e.g., OpenRouter vs LM Studio)
2. Upgrade AI hardware (GPU for LM Studio)
3. Increase per-job record limit (adjust timeout accordingly)

---

## Monitoring & Observability

### Metrics to Track

1. **Queue Depth**: Number of PENDING jobs
2. **Processing Time**: Average job duration
3. **Failure Rate**: Percentage of FAILED jobs
4. **Throughput**: Jobs completed per minute
5. **Oldest Pending**: Age of oldest waiting job

### Vercel Logs

```bash
# View worker logs
vercel logs --function=api/workers/ingestion
vercel logs --function=api/workers/vectorization
vercel logs --function=api/workers/cleanup

# Filter for errors
vercel logs --function=api/workers/ingestion | grep ERROR
```

### Database Queries

```sql
-- Queue depth by type
SELECT job_type, status, COUNT(*)
FROM job_queue
GROUP BY job_type, status;

-- Average processing time
SELECT
  job_type,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_seconds
FROM job_queue
WHERE status = 'COMPLETED'
GROUP BY job_type;

-- Failed jobs with errors
SELECT id, job_type, result->>'error' as error, attempts
FROM job_queue
WHERE status = 'FAILED'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Migration Guide

### From Old Queue System

The old in-memory queue system (`processQueuedJobs()`, `startBackgroundIngest()`) is **deprecated** but still functional. New ingestion automatically uses the database queue.

**No code changes required** - the API routes automatically enqueue to the database queue.

**To verify migration:**
1. Check `/admin/queue-monitor` for active jobs
2. Verify `job_queue` table has entries
3. Monitor worker logs for processing activity

**To fully remove old system:**
1. Remove `processQueuedJobs()` and related functions from `src/lib/ingestion.ts`
2. Remove old `IngestJob` polling logic from UI components
3. Update tests to use `DatabaseQueue` instead

---

## Troubleshooting Checklist

- [ ] Is pgvector extension enabled? (`CREATE EXTENSION vector;`)
- [ ] Is embedding column type `vector(1536)`?
- [ ] Is CRON_SECRET set in production environment variables?
- [ ] Are Vercel Cron jobs configured in `vercel.json`?
- [ ] Are workers being invoked? (check Vercel dashboard)
- [ ] Are there zombie jobs in PROCESSING? (restart should fail them)
- [ ] Is AI service accessible? (LM Studio running or OpenRouter key valid)
- [ ] Is database connection healthy? (check connection pool)
- [ ] Are there rate limits on AI provider? (check OpenRouter limits)
- [ ] Is payload size reasonable? (large CSVs may timeout)
