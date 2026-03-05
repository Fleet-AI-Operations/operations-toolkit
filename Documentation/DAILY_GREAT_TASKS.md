# Daily Great Tasks

A fleet management tool for flagging high-quality ("daily great") task records from `data_records` and automatically comparing newly ingested tasks against them during the similarity detection pipeline. Flags surface in the Core app Similarity Flags page with a dedicated "Daily Great Task" badge.

## Table of Contents

- [Overview](#overview)
- [Access & Permissions](#access--permissions)
- [Using the Daily Great Tasks Tab](#using-the-daily-great-tasks-tab)
  - [Searching and Flagging Records](#searching-and-flagging-records)
  - [Managing Currently Flagged Records](#managing-currently-flagged-records)
  - [On-Demand Compare](#on-demand-compare)
- [Automatic Detection During Ingestion](#automatic-detection-during-ingestion)
- [Reviewing Flags in the Core App](#reviewing-flags-in-the-core-app)
- [Technical Reference](#technical-reference)
  - [Database Schema Changes](#database-schema-changes)
  - [Prisma Model Changes](#prisma-model-changes)
  - [API Endpoints](#api-endpoints)
  - [Similarity Detection Integration](#similarity-detection-integration)
- [Related Documentation](#related-documentation)

---

## Overview

"Daily Great Tasks" are `data_records` rows that have been manually flagged by fleet operators as high-quality reference tasks. Once flagged, these records serve two purposes:

1. **Automatic detection**: Every time an ingest job completes and runs the similarity pipeline, newly ingested TASK records are compared against all flagged daily great records. Pairs with cosine similarity ≥ the configured threshold are stored as `DAILY_GREAT` similarity flags.
2. **On-demand comparison**: Fleet operators can run an ad-hoc comparison of all tasks in an environment against the flagged records at any time.

This complements the [Exemplar Tasks](./EXEMPLAR_TASKS.md) feature: exemplars are a curated library managed independently, while daily great tasks are existing `data_records` records elevated to reference status.

---

## Access & Permissions

| Role | Access |
|------|--------|
| FLEET | ✅ Full access |
| MANAGER | ✅ Full access |
| ADMIN | ✅ Full access |
| CORE, QA, USER | ❌ Forbidden |

Navigate to **Fleet app → Tasks & Feedback Tools → Exemplar Tasks** (`/exemplar-tasks`) and select the **Daily Great Tasks** tab.

---

## Using the Daily Great Tasks Tab

The Daily Great Tasks tab is the third tab on the Exemplar Tasks page. It has three sections:

### Searching and Flagging Records

Use the **Search by task key** section to find specific task records by their `task_key` metadata field.

1. Enter a `task_key` value in the search input (e.g. `T-1234`).
2. Click **Search**.
3. Results show the most recent submission per worker for that task key, with columns:
   - **Task Key** — the metadata `task_key` value
   - **Content** — first 200 characters of the task
   - **Environment** — the record's environment
   - **Creator** — name and email of the submitting worker
   - **Status** — whether the record is currently flagged as a daily great task
4. Click **Flag** or **Unflag** on any row to toggle the `is_daily_great` status.

> **Note**: The search excludes workers with `@fleet.io` or `@fleet.so` email addresses (internal fleet staff).

### Managing Currently Flagged Records

The **Currently Flagged** section lists all `data_records` currently marked with `is_daily_great = true`, paginated in sets of 20. Columns:

| Column | Description |
|--------|-------------|
| Task Key | `metadata->>'task_key'` |
| Content | First 200 characters |
| Environment | Record's environment |
| Creator | Worker name and email |
| Flagged date | `createdAt` of the record |

Click **Unflag** on any row to remove the daily great designation. The list refreshes automatically.

Pagination controls appear when more than 20 records are flagged (`← Prev` / `Page X of Y` / `Next →`).

### On-Demand Compare

The **On-Demand Compare** section runs an immediate comparison of tasks in a given environment against all flagged daily great records.

1. Select a specific environment from the dropdown (required).
2. Adjust the **Similarity threshold** (default: 80%) — only matches at or above this score are returned.
3. Click **Run Comparison**.
4. Results appear in a table:
   - **Worker** — task author
   - **Task snippet** — the submitted task content (truncated)
   - **→ Daily Great snippet** — the matching daily great record content (truncated)
   - **Similarity** — percentage score, colour-coded: green ≥ 80%, yellow 60–79%, red < 60%

> **Note**: Tasks that are themselves flagged as daily great (`is_daily_great = true`) are excluded from the comparison set to prevent self-matches. Results are returned inline and are not persisted.

---

## Automatic Detection During Ingestion

When an ingest job completes vectorization, the similarity detection pipeline runs automatically via `startSimilarityDetection()`. The pipeline now includes a **second pass** after the existing user-vs-history comparison:

1. Fetch all `data_records` where `is_daily_great = true AND type = 'TASK' AND embedding IS NOT NULL`.
2. For each newly ingested TASK record with a valid embedding, compare against every daily great record using cosine similarity.
3. Skip pairs with identical content.
4. Pairs with similarity ≥ `SIMILARITY_THRESHOLD` (default: `0.80`) are stored as `similarity_flags` with `match_type = 'DAILY_GREAT'`.

Both USER_HISTORY and DAILY_GREAT flags are recorded in the same `SimilarityJob` and included in the notification email. The `records_checked` counter on the job includes comparisons from both passes.

**Unique constraint**: `(source_record_id, matched_record_id, match_type)` — re-ingesting the same records will not create duplicate flags (`ON CONFLICT DO NOTHING`).

---

## Reviewing Flags in the Core App

Daily great task flags appear in the **Core app → Similarity Flags** page (`/similarity-flags`).

### Match Type Filter

The Similarity Flags page has a match type filter row alongside the existing status filters:

| Button | Filters to |
|--------|------------|
| All | All match types |
| User History | `match_type = 'USER_HISTORY'` flags only |
| Daily Great Task | `match_type = 'DAILY_GREAT'` flags only |

### Daily Great Task Badge

Rows with `match_type = 'DAILY_GREAT'` display an amber **Daily Great Task** badge in the Match column alongside the matched record snippet. When available, the `task_key` of the matched daily great record is also shown.

---

## Technical Reference

### Database Schema Changes

Migration: `supabase/migrations/20260304000004_daily_great_tasks.sql`

```sql
-- Flag column on data_records
ALTER TABLE public.data_records
    ADD COLUMN IF NOT EXISTS is_daily_great BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_data_records_daily_great
    ON public.data_records (is_daily_great)
    WHERE is_daily_great = true;

-- match_type on similarity_flags
ALTER TABLE public.similarity_flags
    ADD COLUMN IF NOT EXISTS match_type TEXT NOT NULL DEFAULT 'USER_HISTORY';

-- Unique constraint on (source, matched, match_type)
ALTER TABLE public.similarity_flags
    DROP CONSTRAINT IF EXISTS similarity_flags_source_record_id_matched_record_id_key;

ALTER TABLE public.similarity_flags
    ADD CONSTRAINT similarity_flags_source_matched_type_key
    UNIQUE (source_record_id, matched_record_id, match_type);

-- Allow standalone similarity jobs (not tied to an ingest job)
ALTER TABLE public.similarity_jobs
    ALTER COLUMN ingest_job_id DROP NOT NULL;
```

### Prisma Model Changes

`packages/database/prisma/schema.prisma`:

```prisma
model DataRecord {
  // ...existing fields...
  isDailyGreat Boolean @default(false) @map("is_daily_great")
}

model SimilarityFlag {
  // ...existing fields...
  matchType String @default("USER_HISTORY") @map("match_type")

  @@unique([sourceRecordId, matchedRecordId, matchType])
}

model SimilarityJob {
  // ingestJobId is now optional
  ingestJobId String? @map("ingest_job_id")
}
```

### API Endpoints

All endpoints require FLEET, MANAGER, or ADMIN role.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/daily-great-tasks?environment=X&page=N&limit=20` | List flagged records (paginated) |
| `PATCH` | `/api/daily-great-tasks/[id]` | Toggle `isDailyGreat`; body: `{ isDailyGreat: boolean }` |
| `GET` | `/api/daily-great-tasks/search?task_key=X` | Search by `metadata->>'task_key'` |
| `POST` | `/api/daily-great-tasks/compare` | On-demand compare; body: `{ environment, threshold? }` |

#### GET `/api/daily-great-tasks` Response

```typescript
{
  records: Array<{
    id: string;
    environment: string;
    taskKey: string | null;       // metadata->>'task_key'
    snippet: string;              // first 200 chars of content
    createdByName: string | null;
    createdByEmail: string | null;
    createdAt: Date;
  }>;
  total: number;                  // total flagged records (for pagination)
}
```

#### GET `/api/daily-great-tasks/search` Response

```typescript
{
  records: Array<{
    id: string;
    environment: string;
    taskKey: string | null;
    snippet: string;
    isDailyGreat: boolean;
    createdByName: string | null;
    createdByEmail: string | null;
    createdAt: Date;
  }>;
}
```

#### POST `/api/daily-great-tasks/compare` Request / Response

```typescript
// Request
{
  environment: string;   // required
  threshold?: number;    // 0–100, default 80
}

// Response
{
  matches: Array<{
    taskId: string;
    taskContent: string;
    greatId: string;
    greatContent: string;
    similarity: number;   // percentage, e.g. 84.2
  }>;
  totalTasks: number;
  totalGreat: number;
}
```

### Similarity Detection Integration

The detection engine is in `packages/core/src/similarity/index.ts`. The DAILY_GREAT pass runs after the USER_HISTORY per-user comparison loop in `runSimilarityDetection()`.

The `match_type` field uses the `MatchType` union type exported from `packages/types/src/common.ts`:

```typescript
export type MatchType = 'USER_HISTORY' | 'DAILY_GREAT';
```

---

## Related Documentation

- [Exemplar Tasks](./EXEMPLAR_TASKS.md) — curated reference library managed independently from data_records
- [Similarity Flags API](./Reference/API_REFERENCE.md)
- [Database Schema](./Reference/DATABASE_SCHEMA.md)
- [Fleet Guide](./UserGuides/FLEET_GUIDE.md)

---

*Last Updated: 2026-03-04*
