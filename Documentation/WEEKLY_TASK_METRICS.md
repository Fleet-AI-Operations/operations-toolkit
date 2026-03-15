# Weekly Task Metrics

Fleet management tools for reviewing weekly task and feedback volume and spotlighting high-quality TOP_10 submissions.

## Table of Contents

- [Overview](#overview)
- [Access & Permissions](#access--permissions)
- [Weekly Task Metrics Page](#weekly-task-metrics-page)
  - [Date Range Controls](#date-range-controls)
  - [Summary Statistics](#summary-statistics)
  - [Environment Breakdowns](#environment-breakdowns)
- [Top 10 Spotlight](#top-10-spotlight)
  - [How Records Are Selected](#how-records-are-selected)
  - [Flagging Great Example Tasks](#flagging-great-example-tasks)
- [Technical Reference](#technical-reference)
  - [API Endpoints](#api-endpoints)
- [Related Documentation](#related-documentation)

---

## Overview

The Weekly Task Metrics suite provides two linked pages in the Fleet app:

1. **Weekly Task Metrics** (`/weekly-task-metrics`) — summary counts and environment breakdowns for tasks created, tasks approved, and task revisions over a configurable date range.
2. **Top 10 Spotlight** (`/weekly-task-metrics/spotlight`) — a randomly selected set of 5 TOP_10 tasks and 5 TOP_10 feedback records from the previous 7 days, with one-click flagging as [Great Example Tasks](./GREAT_EXAMPLE_TASKS.md).

---

## Access & Permissions

| Role | Access |
|------|--------|
| FLEET | ✅ Full access |
| MANAGER | ✅ Full access |
| ADMIN | ✅ Full access |
| CORE, QA, USER | ❌ Forbidden |

Navigate to **Fleet app → Weekly Task Metrics** (`/weekly-task-metrics`).

---

## Weekly Task Metrics Page

### Date Range Controls

The filter bar at the top of the page lets you define the reporting window:

| Control | Description |
|---------|-------------|
| **Start Date / End Date** | Custom date range inputs |
| **Environments** | Multi-select dropdown; leave empty for all environments |
| **Apply** | Fetch data for the selected range and environments |
| **Last 7d / 14d / 30d** | Quick-select buttons; sets the range to N days ending yesterday |

The default range on load is the 7 days ending yesterday.

### Summary Statistics

Three stat cards display totals for the selected period:

| Stat | Definition |
|------|------------|
| **Unique Tasks Created** | Count of `type = 'TASK'` records created in the range |
| **Tasks Approved** | Count of `type = 'FEEDBACK'` records where `metadata->>'feedback_outcome' = 'approved'` |
| **Task Revisions Made** | Count of TASK records where `metadata->>'task_version' > 1` |

All counts exclude records created by `@fleet.so` email addresses.

### Environment Breakdowns

Two tables beneath the stat cards break down Tasks Created and Tasks Approved by environment, showing count and percentage share. Click **Copy Summary** in the header to copy a formatted plain-text summary to the clipboard.

### Top 10 Spotlight Button

A **Top 10 Spotlight** button in the header row navigates to `/weekly-task-metrics/spotlight`.

---

## Top 10 Spotlight

Navigate to the Spotlight page from the **Top 10 Spotlight** button on the Weekly Task Metrics page, or directly at `/weekly-task-metrics/spotlight`.

### How Records Are Selected

The page fetches from `GET /api/admin/weekly-task-metrics/spotlight` on load and on every **Re-roll** click.

Selection logic for each list:

1. Pool: all `data_records` with `category = 'TOP_10'` and the appropriate `type`, created in the previous 7 days (ending yesterday), excluding `@fleet.so` addresses.
2. For feedback, records with content exactly equal to `"Task approved by QA reviewer"` are also excluded.
3. Within this pool, at most **1 record per user** (`createdByEmail`) is eligible — a random record is chosen for each user with multiple qualifying records.
4. **5 records** are randomly drawn from the de-duplicated pool.

The two lists (tasks and feedback) are selected independently, so a user could theoretically appear in both.

Each card displays:
- Rank badge (#1–#5)
- Environment pill
- Full record content
- Author name or email

### Flagging Great Example Tasks

Task cards show a **Mark as Great Example** button (sparkle icon). Clicking it:

1. Calls `PATCH /api/daily-great-tasks/[id]` with `{ isDailyGreat: true }`.
2. The button immediately turns amber and shows **Great Example** to confirm.
3. Clicking again removes the flag (`{ isDailyGreat: false }`).

Feedback cards do not have a flag button — only TASK records can be flagged as great examples.

Flagged records automatically participate in the similarity detection pipeline on subsequent ingest jobs. See [Great Example Tasks](./GREAT_EXAMPLE_TASKS.md) for full details.

---

## Technical Reference

### API Endpoints

All endpoints require FLEET, MANAGER, or ADMIN role.

#### GET `/api/admin/weekly-task-metrics`

Returns summary metrics for the selected date range and environments.

**Query parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | `YYYY-MM-DD` | Start date (default: 7 days ago) |
| `end` | `YYYY-MM-DD` | End date (default: yesterday) |
| `environments` | string | Comma-separated environment names (default: all) |

**Response**:

```typescript
{
  uniqueTasksCreated: number;
  uniqueTasksCreatedByEnvironment: Array<{ environment: string; count: number }>;
  totalTasksApproved: number;
  totalTasksApprovedByEnvironment: Array<{ environment: string; count: number }>;
  totalRevisions: number;
  dateRange: { start: string; end: string };
}
```

#### GET `/api/admin/weekly-task-metrics/spotlight`

Returns 5 random TOP_10 tasks and 5 random TOP_10 feedback records from the previous 7 days. At most 1 record per user per list. Re-randomises on every request.

**Response**:

```typescript
{
  tasks: Array<{
    id: string;
    environment: string;
    content: string;
    createdByName: string | null;
    createdByEmail: string | null;
    isDailyGreat: boolean;   // whether this record is currently flagged as a great example
  }>;
  feedback: Array<{
    id: string;
    environment: string;
    content: string;
    createdByName: string | null;
    createdByEmail: string | null;
  }>;
  dateRange: { start: string; end: string };
}
```

---

## Related Documentation

- [Great Example Tasks](./GREAT_EXAMPLE_TASKS.md) — full documentation for the flagging system and similarity detection pipeline
- [Exemplar Tasks](./EXEMPLAR_TASKS.md) — curated reference library
- [Fleet Guide](./UserGuides/FLEET_GUIDE.md)

---

*Last Updated: 2026-03-14*
