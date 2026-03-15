# Task Disputes

Feature guide for the Task Disputes dashboard and CSV import tools.

## Table of Contents

- [Overview](#overview)
- [Access](#access)
- [Task Disputes Dashboard (Fleet)](#task-disputes-dashboard-fleet)
  - [Stat Cards](#stat-cards)
  - [Filters](#filters)
  - [Disputes Table](#disputes-table)
  - [Expanded Row Detail](#expanded-row-detail)
- [Task Disputes Import (Admin)](#task-disputes-import-admin)
  - [CSV Format](#csv-format)
  - [Matching Logic](#matching-logic)
  - [Import Summary](#import-summary)
- [Database](#database)
- [API Reference](#api-reference)
- [Related Documentation](#related-documentation)

---

## Overview

Task Disputes tracks feedback disputes imported from the external platform's `feedback_disputes_report.csv` export. Each dispute is matched against the local `data_records` table via `task_key` so you can cross-reference dispute outcomes with the ingested task data.

---

## Access

| Tool | URL | Required Role |
|------|-----|---------------|
| Task Disputes dashboard | `/task-disputes` (Fleet app) | FLEET or above |
| Task Disputes Import | `/admin/task-disputes-import` (Admin app) | ADMIN only |

---

## Task Disputes Dashboard (Fleet)

Navigate to **Task Disputes** in the Fleet app sidebar under "Tasks & Feedback Tools".

### Stat Cards

The top of the page shows clickable stat cards for each dispute status:

- **Approved** — disputes the platform accepted
- **Rejected** — disputes the platform denied
- **Pending** — disputes awaiting resolution
- **Discarded** — disputes abandoned
- **Matched X%** — percentage of disputes linked to a local `data_record`

Click any status card to filter the table to that status. Click again to clear.

### Filters

| Filter | Type | Description |
|--------|------|-------------|
| Person | Text (debounced) | Case-insensitive substring search across disputer name/email, QA reviewer name/email, and resolver name |
| Task Key | Text (debounced) | Filter by task key (substring, case-insensitive) |
| Environment | Dropdown | Filter by `env_key` |
| Status | Dropdown | Filter by dispute status |
| Modality | Dropdown | `computer_use` or `tool_use` |
| Match | Dropdown | Show only matched or unmatched disputes |

Text inputs are debounced (300ms) to avoid excessive API calls while typing. A red **Clear** button appears when any filter is active.

### Disputes Table

The table shows 25 disputes per page, ordered by source creation date (newest first). Columns:

| Column | Description |
|--------|-------------|
| ID | External dispute ID (`#1001`) |
| Status | Colour-coded status badge |
| Disputer | Name and email of the person who filed the dispute |
| Environment | `env_key` and `env_data_key` |
| Task Key | Truncated task key (full value on hover) |
| Modality | `computer use` or `tool use` |
| Match | Green checkmark if linked to a local data record |
| Date | Source creation date + expand/collapse chevron |

Click any row to expand it.

### Expanded Row Detail

Expanded rows show two panels:

**Dispute Details**
- Reason, Resolution, Report text, and Original Feedback — each in its own card
- Report text and Original Feedback cards are truncated to 4 lines by default; click **Show more / Show less** to expand or collapse
- Original Feedback card includes a **Positive / Negative** badge when `original_feedback_positive` is set
- QA Reviewer chip: shown when the dispute has a QA reviewer (name · email)
- Metadata chips: Team, Category, Helpful (Yes/No, colour-coded), Resolved by + date

**Linked Record**
- If matched: Record ID, Environment, Creator name, and a **View worker profile** link to the Workforce Monitoring page
- If unmatched: "No matching record found" with the `task_key` for debugging

---

## Task Disputes Import (Admin)

Navigate to **Task Disputes Import** in the Admin app sidebar, or go directly to `/admin/task-disputes-import`.

### CSV Format

Upload the `feedback_disputes_report.csv` export from the external platform. The file must have these columns (order does not matter):

```
id, created_at, updated_at, feedback_id, eval_task_id, dispute_status,
dispute_reason, resolution_reason, resolved_at, report_text, is_helpful,
disputer_user_id, disputer_name, disputer_email,
qa_reviewer_user_id, qa_reviewer_name, qa_reviewer_email,
original_feedback_positive, original_feedback_content,
resolver_user_id, resolver_name, team_id, team_name, task_key,
task_lifecycle_status, env_key, env_data_key, task_modality,
dispute_data, leased_by, lease_expires_at
```

**Constraints:**
- Maximum file size: **50 MB**
- `id` must be a valid integer
- `feedback_id` must be a valid integer
- `task_key` must not be empty
- `created_at` and `updated_at` must be valid ISO dates

### Matching Logic

The import links each dispute to a `data_record` by matching the CSV's `task_key` column against `data_records.metadata->>'task_key'` (a JSON field). This is a pre-fetched batch lookup — no per-row queries.

> **Note:** The CSV's `eval_task_id` field is an external UUID from the source platform and is **not** used for matching. The local `data_records.id` uses a different ID scheme (CUID).

Disputes whose `task_key` has no match in `data_records` are still imported — they simply have no linked record. This happens when the corresponding task was never ingested into the system.

### Import Summary

After import, the page shows:

| Field | Description |
|-------|-------------|
| New rows imported | Disputes that did not previously exist |
| Existing rows updated | Disputes updated by matching `id` |
| Rows skipped | Rows with validation errors |
| Matched to data_records | New rows that resolved a `task_key` match |

Re-importing the same CSV is safe — rows are upserted by `externalId`. The **Matched** count only reflects newly created rows (not updates) to avoid double-counting.

---

## Database

**Table:** `public.task_disputes`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Internal primary key |
| `external_id` | `integer UNIQUE` | Source platform dispute ID |
| `eval_task_id` | `text` | Foreign key → `data_records.id` (nullable) |
| `task_key` | `text` | Source task key (used for matching) |
| `dispute_status` | `text` | `pending \| approved \| rejected \| discarded` |
| `disputer_name` | `text` | Name of the person who filed the dispute |
| `disputer_email` | `text` | Email of the person who filed the dispute |
| `qa_reviewer_user_id` | `text` | External user ID of the QA reviewer (nullable) |
| `qa_reviewer_name` | `text` | Name of the QA reviewer (nullable) |
| `qa_reviewer_email` | `text` | Email of the QA reviewer (nullable) |
| `original_feedback_positive` | `boolean` | Whether the original feedback was positive (nullable) |
| `original_feedback_content` | `text` | Full text of the original feedback being disputed (nullable) |
| `env_key` | `text` | Environment identifier |
| `task_modality` | `text` | `computer_use \| tool_use` |
| `dispute_data` | `jsonb` | Structured dispute metadata (category, etc.) |
| `imported_at` | `timestamptz` | When the row was first imported |
| `updated_at` | `timestamptz` | Auto-updated on every change (via trigger) |

Indexes: `dispute_status`, `disputer_email`, `env_key`, `task_key`, `eval_task_id`, `created_at_source DESC`.

---

## API Reference

### `GET /api/task-disputes` (Fleet app)

Returns paginated disputes and summary stats.

**Auth:** FLEET role or above

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Page size (default: 50, max: 200) |
| `status` | string | Filter by `dispute_status` |
| `env` | string | Filter by `env_key` |
| `search` | string | Case-insensitive substring search across disputer name/email, QA reviewer name/email, and resolver name |
| `modality` | string | Filter by `task_modality` |
| `matched` | `true \| false` | Filter by whether `eval_task_id` is set |
| `taskKey` | string | Substring filter on `task_key` (case-insensitive) |

**Response:**
```json
{
  "disputes": [...],
  "total": 338,
  "page": 1,
  "limit": 25,
  "stats": {
    "byStatus": { "pending": 10, "approved": 200, ... },
    "byEnv": [{ "env": "fos-accounting", "count": 150 }, ...],
    "byModality": { "computer_use": 300, "tool_use": 38 },
    "totalMatched": 201,
    "totalUnmatched": 137
  }
}
```

---

### `POST /api/task-disputes/import` (Admin app)

Imports a disputes CSV via multipart form upload.

**Auth:** ADMIN role only

**Request:** `multipart/form-data` with a `file` field containing the CSV.

**Response:**
```json
{
  "success": true,
  "summary": {
    "imported": 200,
    "updated": 138,
    "skipped": 0,
    "matched": 195,
    "errors": []
  }
}
```

---

## Related Documentation

- [Workforce Monitoring Guide](./UserGuides/WORKFORCE_MONITORING_GUIDE.md) — linked from dispute expanded rows
- [Database Schema](./Reference/DATABASE_SCHEMA.md)
- [API Reference](./Reference/API_REFERENCE.md)

---

*Last Updated: 2026-03-15*
