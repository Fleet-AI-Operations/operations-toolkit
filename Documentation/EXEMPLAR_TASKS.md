# Exemplar Tasks

A fleet management tool for maintaining a library of "golden standard" reference tasks per environment, and scanning real task submissions for suspicious similarity against them.

## Table of Contents

- [Overview](#overview)
- [Access & Permissions](#access--permissions)
- [Using the Manage Tab](#using-the-manage-tab)
  - [Adding an Exemplar](#adding-an-exemplar)
  - [Importing from CSV](#importing-from-csv)
  - [Editing an Exemplar](#editing-an-exemplar)
  - [Deleting an Exemplar](#deleting-an-exemplar)
  - [Generating Missing Embeddings](#generating-missing-embeddings)
- [Using the Compare Tab](#using-the-compare-tab)
- [Using the Daily Great Tasks Tab](#using-the-daily-great-tasks-tab)
- [Technical Reference](#technical-reference)
  - [Database Schema](#database-schema)
  - [API Endpoints](#api-endpoints)
  - [Embedding Generation](#embedding-generation)
  - [Similarity Calculation](#similarity-calculation)
- [Related Documentation](#related-documentation)

---

## Overview

Exemplar Tasks provides a curated reference library of high-quality task prompts, organised by environment. Once exemplars are in place, the Compare tab scans up to 2,000 real task records in the same environment and computes cosine similarity between each task and every exemplar, surfacing submissions that look like near-copies of a known reference.

**Key use cases:**
- Detect workers copying or paraphrasing known exemplar/training prompts
- Validate task quality by comparing against a gold-standard library
- Identify templated or suspiciously similar submissions at scale

---

## Access & Permissions

| Role | Access |
|------|--------|
| FLEET | ✅ Full access |
| MANAGER | ✅ Full access |
| ADMIN | ✅ Full access |
| CORE, QA, USER | ❌ Forbidden |

Navigate to **Fleet app → Tasks & Feedback Tools → Exemplar Tasks** (`/exemplar-tasks`).

---

## Using the Manage Tab

### Selecting an Environment

Use the environment selector at the top of the page to filter exemplars. Select **All Environments** to view the entire library across all environments, or choose a specific environment to work within it.

> **Note**: Add, Import, and Compare actions require a specific environment to be selected. They are disabled in "All Environments" mode.

### Adding an Exemplar

1. Select an environment from the dropdown.
2. Click **Add Exemplar**.
3. Enter the task content in the textarea (required).
4. Click **Save**.

An embedding is generated automatically in the background. The embedding status indicator on the card will turn green once complete:
- 🟢 Green dot — embedding present, ready for comparison
- ⚪ Grey dot — embedding pending

### Adding a New Environment

To use an environment that does not yet have any exemplars:

1. Open the environment selector.
2. Select **+ Add Environment…**
3. Type the new environment name in the text box that appears.
4. Click **Save** — or add your first exemplar, which will create the environment entry.

### Importing from CSV

CSV import is the fastest way to bulk-load exemplars. The expected format is:

| Column | Description |
|--------|-------------|
| `ENV` | Environment name |
| `Prompt` | Task content |
| `Date Published` | Publication date (informational only) |
| `Changes` | If this value contains the word `deleted`, the row is skipped |

**Steps:**

1. Select the target environment (or use any environment — you can choose during import).
2. Click **Import CSV** and select your file.
3. A preview panel appears showing the row breakdown by environment as coloured chips.
4. Choose:
   - **Import [environment] only** — imports only rows matching the currently selected environment
   - **Import all environments** — imports every non-deleted row in the file
5. A spinner shows while embeddings are being generated. Wait for completion before navigating away.

> **Important**: Rows where the `Changes` column contains "deleted" are automatically skipped during both the preview and import steps.

### Editing an Exemplar

1. Click **Edit** on any exemplar card.
2. Modify the content in the textarea.
3. Click **Save**.

If the content has changed, a new embedding is generated automatically.

### Deleting an Exemplar

1. Click **Delete** on any exemplar card.
2. Confirm with **Yes** when prompted.

Deletion is immediate and cannot be undone.

### Generating Missing Embeddings

If exemplars were imported and their embeddings failed to generate (shown as grey dots), a yellow **Generate N Missing Embeddings** button appears at the top of the Manage tab.

Click it to trigger embedding generation for all exemplars that currently have no embedding. The button disappears once all embeddings are present.

> Embeddings are generated one at a time to avoid AI server overload. Large imports may take a minute or two.

---

## Using the Compare Tab

The Compare tab scans up to 2,000 real task records in the selected environment and finds the best-matching exemplar for each task.

### Running a Comparison

1. Select a specific environment.
2. Adjust the **Similarity threshold** (default: 70%) — only matches at or above this score are returned.
3. Click **Run Comparison**.

The button is disabled if:
- No specific environment is selected
- No exemplars with embeddings exist in the selected environment

### Reading the Results

| Element | Description |
|---------|-------------|
| Score badge | Similarity percentage; colour-coded: green ≥ 80%, yellow 60–79%, red < 60% |
| Task content | The real task submission; click to expand |
| → Exemplar | The exemplar it most closely matched and its content snippet |

A summary line shows how many tasks were scanned, how many exemplars were used, and whether any exemplar embeddings were missing.

**Empty state**: "No tasks matched above X% threshold" means no real tasks exceeded the threshold — either similarity is genuinely low or the threshold is set too high.

---

## Using the Daily Great Tasks Tab

The **Daily Great Tasks** tab is the third tab on the Exemplar Tasks page. It provides tools to flag existing `data_records` as high-quality reference tasks and compare incoming submissions against them.

### Searching and Flagging by Task Key

1. Enter a `task_key` in the **Search by task key** input (e.g. `T-1234`).
2. Click **Search**.
3. The most recent submission per worker for that task key is returned.
4. Click **Flag** or **Unflag** on any row to mark the record as a daily great task.

Flagged records are automatically included in the similarity detection pipeline: every ingest job compares new tasks against them and creates `DAILY_GREAT` similarity flags visible in the Core app.

### Managing the Flagged List

The **Currently Flagged** section shows all currently flagged records, paginated at 20 per page. Click **Unflag** on any row to remove it from the daily great set.

### Running an On-Demand Comparison

1. Select a specific environment (required).
2. Set the similarity threshold (default: 80%).
3. Click **Run Comparison**.

Results are shown inline — tasks above the threshold are listed alongside the matching daily great record and similarity score. This comparison is not persisted; it is for exploratory review only.

> For full documentation including automatic ingestion integration and the Core app flags view, see [Daily Great Tasks](./DAILY_GREAT_TASKS.md).

---

## Technical Reference

### Database Schema

```sql
CREATE TABLE exemplar_tasks (
  id          TEXT PRIMARY KEY,
  environment TEXT NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(1536),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exemplar_tasks_environment ON exemplar_tasks(environment);
```

### Prisma Model

```prisma
model ExemplarTask {
  id          String                 @id
  environment String
  content     String                 @db.Text
  embedding   Unsupported("vector")?
  createdById String?                @map("created_by_id") @db.Uuid
  createdAt   DateTime               @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime               @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@index([environment])
  @@map("exemplar_tasks")
  @@schema("public")
}
```

### API Endpoints

All endpoints require FLEET, MANAGER, or ADMIN role.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/exemplar-tasks?environment=X` | List exemplars for an environment (omit param for all) |
| `POST` | `/api/exemplar-tasks` | Create an exemplar; generates embedding automatically |
| `PATCH` | `/api/exemplar-tasks/[id]` | Update content; regenerates embedding if content changed |
| `DELETE` | `/api/exemplar-tasks/[id]` | Delete an exemplar |

**Audit logging**: `POST`, `PATCH`, and `DELETE` produce audit log entries (`EXEMPLAR_TASK_CREATED`, `EXEMPLAR_TASK_UPDATED`, `EXEMPLAR_TASK_DELETED`) visible in Admin → Audit Logs. Calls are fire-and-forget and do not affect the API response on failure.
| `POST` | `/api/exemplar-tasks/compare` | Run cosine similarity scan |
| `POST` | `/api/exemplar-tasks/import` | Bulk CSV import with embedding generation |
| `POST` | `/api/exemplar-tasks/embed-pending` | Regenerate embeddings for rows missing them (body: `{ environment? }`) |
| `GET` | `/api/exemplar-tasks/environments` | List distinct environments from exemplar_tasks only |

#### Compare Request Body

```typescript
{
  environment: string;   // required
  threshold?: number;    // 0–100, default 70
}
```

#### Compare Response

```typescript
{
  matches: Array<{
    taskId: string;
    taskContent: string;
    exemplarId: string;
    exemplarContent: string;
    similarity: number;       // percentage, e.g. 84.2
  }>;
  totalTasks: number;         // Tasks with embeddings scanned (capped at 2,000; excludes tasks without embeddings)
  totalExemplars: number;
  missingEmbeddings: number;  // Exemplars whose vectors could not be parsed
  tasksSkippedNoParse: number; // Tasks skipped due to unparseable embedding vectors
}
```

#### Import Request

Multipart form data:

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | CSV file |
| `filterEnvironment` | string (optional) | Import only rows matching this environment |

#### Import Response

```typescript
{
  imported: number;
  skipped: number;
  embeddingErrors: number;
  embeddingWarning?: string; // Present when embeddingErrors > 0
}
```

#### Embed-Pending Response

```typescript
{
  processed: number;  // Total rows attempted
  succeeded: number;  // Embeddings successfully written
  failed: number;     // Rows where embedding generation failed
}
```

### Embedding Generation

Embeddings use `getEmbedding(content)` from `@repo/core/ai` (singular, not batch). The batch variant `getEmbeddings()` silently returns empty arrays on failure and must not be used here.

Vector writes use raw SQL to bypass Prisma's lack of native `vector` type support:

```typescript
await prisma.$executeRaw`
  UPDATE exemplar_tasks
  SET embedding = ${vectorStr}::vector
  WHERE id = ${id}
`;
```

### Similarity Calculation

Cosine similarity is computed in Node.js using `cosineSimilarity(vecA, vecB)` from `@repo/core/ai`. PostgreSQL vector operators are not used for the comparison scan — both exemplar and task embeddings are fetched and parsed in memory.

The comparison is O(tasks × exemplars) and is capped at 2,000 tasks per run. For each task the best-matching exemplar is retained.

---

## Related Documentation

- [Daily Great Tasks](./DAILY_GREAT_TASKS.md) — flagging existing data_records as reference tasks with automatic ingestion detection
- [Fleet Guide](./UserGuides/FLEET_GUIDE.md)
- Full Similarity Check (`/full-similarity-check`) — a complementary tool for per-task similarity scanning across all records, without a curated exemplar library
- [Database Schema](./Reference/DATABASE_SCHEMA.md)
- [API Reference](./Reference/API_REFERENCE.md)

---

*Last Updated: 2026-03-04*
