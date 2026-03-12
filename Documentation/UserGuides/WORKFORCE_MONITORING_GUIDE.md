# Workforce Monitoring Guide

Comprehensive reference for the Workforce Monitoring system — a suite of tools for tracking worker activity, flagging concerns, and running AI-driven prompt analysis.

**Access**: FLEET, MANAGER, and ADMIN roles only.
**Location**: Fleet App → Workforce Monitoring (`/workforce-monitoring`)

---

## Table of Contents

1. [Overview](#overview)
2. [Worker List](#worker-list)
3. [Review Requested Badge](#review-requested-badge)
4. [Worker Detail Page](#worker-detail-page)
   - [Tasks Tab](#tasks-tab)
   - [Feedback Tab](#feedback-tab)
   - [Flags Tab](#flags-tab)
   - [Lookup Tab](#lookup-tab)
   - [Similarity Tab](#similarity-tab)
   - [Deep Dive Tab](#deep-dive-tab)
5. [Worker Flags](#worker-flags)
   - [Flag Types](#flag-types)
   - [Severity Levels](#severity-levels)
   - [Flag Status Workflow](#flag-status-workflow)
   - [Creating Flags](#creating-flags)
   - [Resolving Flags](#resolving-flags)
6. [Review Requested Flags](#review-requested-flags)
7. [API Reference](#api-reference)

---

## Overview

The Workforce Monitoring system gives FLEET managers a single place to observe, review, and act on worker performance signals:

| What you can do | Where |
|---|---|
| See all workers with task/feedback counts and active flags | Worker List |
| Filter to only flagged or unflagged workers | Worker List filter toggle |
| View a worker's full submission history | Worker Detail → Tasks / Feedback |
| Create, track, and resolve flags | Worker Detail → Flags tab |
| Find who submitted a specific task by ID or key | Worker Detail → Lookup tab |
| Run cosine-similarity checks on a single task | Worker Detail → Similarity tab |
| View AI-powered prompt analysis results | Worker Detail → Deep Dive tab |
| Flag a worker for ops review from the Core app | Core App → Task Creator Deep-Dive |
| See pending review requests from any app header | Review Requested badge (top-right header) |

---

## Worker List

**URL**: `/workforce-monitoring`

The list shows every worker (anyone who has submitted at least one task or feedback record), with these columns:

| Column | Description |
|---|---|
| **Name** | Display name (from most-recent record) |
| **Email** | Worker email address |
| **Tasks** | Total task records |
| **Feedback** | Total feedback records |
| **Active Flags** | Count of OPEN or UNDER_REVIEW flags |
| **Last Activity** | Date of most recent submission |

### Default Sort

By default the list is sorted:

1. Workers with active flags **first** (flagged-first ordering)
2. Then alphabetically by **last name** (A→Z)
3. Then by **email** (A→Z) for ties

This ensures flagged workers are always visible at the top without any manual filtering.

### Column Sorting

Click any column header to sort by that column. Click again to reverse direction. Switching away from a custom sort resets to the default flagged-first ordering.

### Filters

| Filter | Behaviour |
|---|---|
| **Search** | Case-insensitive partial match on name or email (300ms debounce) |
| **Environment** | Restricts counts and last-activity to a single environment |
| **All / Flagged / Unflagged** | Segmented toggle — "Flagged" shows only workers with at least one OPEN or UNDER_REVIEW flag; "Unflagged" shows workers with no active flags |

> Switching the flag toggle back to "All" automatically resets any custom column sort back to the default flagged-first order.

### Pagination

50 workers per page. Use the **Previous / Next** (and **First / Last**) buttons to navigate. The current page and total count are shown below the table.

### Opening a Worker Profile

Click any row to navigate to that worker's detail page at `/workforce-monitoring/worker/<encoded-email>`.

---

## Review Requested Badge

A flag icon with a count badge appears in the **top-right header** of every app for users with FLEET role or higher.

- The badge shows the number of **OPEN or UNDER_REVIEW** `REVIEW_REQUESTED` flags across all workers.
- Clicking the badge navigates directly to the Workforce Monitoring list **pre-filtered to flagged workers**.
- The badge is dimmed (no count shown) when there are no pending reviews.
- The count caps at **99+** for display purposes.
- The badge is visible in all five apps (User, QA, Core, Fleet, Admin) so you never miss a review request regardless of which app you're working in.

---

## Worker Detail Page

**URL**: `/workforce-monitoring/worker/<email>`

Six tabs give a complete view of one worker. The page header shows the worker's name and email, plus a summary stat row.

---

### Tasks Tab

Paginated list of the worker's TASK records (50 per page), newest first.

**Filters**:
- **Environment** dropdown — scope to one environment
- **Latest versions only** toggle — when on, deduplicates by `task_key` and shows only the highest-versioned submission per unique key

Each row shows the task content (truncated), environment badge, creation date, and metadata. Click a row to expand the full content.

> **Note**: Task pagination is stable across pages — tasks are ordered by creation date (newest first), with record ID as a tiebreaker to ensure consistent results when multiple tasks share the same timestamp.

---

### Feedback Tab

Same layout as Tasks, but shows FEEDBACK records. Environment filter applies here too.

---

### Flags Tab

Shows all flags ever created for this worker (all statuses). Active flags (OPEN / UNDER_REVIEW) appear first.

**Creating a flag from this tab**:

1. Click **+ Add Flag**.
2. Fill in:
   - **Flag Type** — one of the types listed in [Flag Types](#flag-types)
   - **Severity** — LOW / MEDIUM / HIGH / CRITICAL (default: MEDIUM)
   - **Reason** — short description shown in the flag card
   - **Notes** *(optional)* — longer internal notes
3. Click **Submit**.

**Flag cards show**: type badge (colour-coded), severity badge, status badge, reason, creator, creation date, and any notes. Expand a flag to see resolution details and update the status.

---

### Lookup Tab

Find the creator of a task when you only have a task ID or task key (e.g. from a spreadsheet or support ticket).

1. Paste or type a **record ID** or **task key** into the search field.
2. Click **Look Up**.
3. The result shows the creator email, name, environment, and task key.

**Match modes**:
- **Exact** — direct ID match or exact `metadata.task_key` match
- **Fuzzy** — partial case-insensitive `task_key` match (up to 5 results)

The Lookup tab is scoped to the currently-displayed worker but will show the result for whoever actually submitted the task — useful for verifying that a task attributed to this worker really belongs to them.

---

### Similarity Tab

Run a cosine-similarity comparison on a single task belonging to this worker.

1. Select a task from the dropdown (shows task key or truncated content).
2. Configure options:
   - **Scope**: `Same environment` or `All environments`
   - **Latest versions only**: deduplicate the comparison pool
   - **Threshold**: minimum similarity percentage (default 50%)
3. Click **Compare**.
4. Results are sorted by similarity (highest first). Each match shows the similarity score, creator, environment, and a "Same worker" label if the match was also submitted by this worker.

The comparison pool is capped at 2 000 records for performance. Use environment scope when working with large datasets.

**Similarity score guide**:

| Range | Interpretation |
|---|---|
| 90–100% | Near-identical — almost certainly a duplicate or copy |
| 70–89% | Highly similar — strong candidate for review |
| 50–69% | Moderately similar — worth investigating |

---

### Deep Dive Tab

AI-powered prompt-authenticity analysis for this worker's tasks. Requires that analysis has been run via the **Prompt Authenticity Checker** in Fleet App first.

**Summary cards** at the top show percentages for:
- AI-Generated tasks
- Templated tasks
- Non-Native language indicators
- Rapid submissions (tasks submitted within 5 minutes of the previous task)

**Per-task rows** show confidence badges for each detection category. Click a row to expand the full analysis: indicators, detected template pattern, and overall assessment.

**Running or refreshing analysis**: Click **Run Analysis** (or **Refresh Analysis** if results already exist). This calls the deep-dive analyze endpoint which syncs the worker's tasks into the analysis queue and processes any pending or stuck records. The button is disabled while analysis is in progress.

**Flag for Ops Review**: At the top of the Deep Dive tab, if you decide the worker needs ops attention, click **Flag for Ops Review**. An optional message field lets you add context. Submitting creates a `REVIEW_REQUESTED` flag visible to all FLEET+ users via the header badge and the Flags tab.

---

## Worker Flags

### Flag Types

| Type | Badge colour | Description |
|---|---|---|
| `QUALITY_CONCERN` | default | Submission quality below expectations |
| `POLICY_VIOLATION` | default | Breach of platform or project policy |
| `COMMUNICATION_ISSUE` | default | Communication or responsiveness problem |
| `ATTENDANCE` | default | Attendance or availability concern |
| `OTHER` | default | Miscellaneous concern |
| `REVIEW_REQUESTED` | purple | Ops review requested (from Core app or Deep Dive) |

### Severity Levels

| Severity | Colour | When to use |
|---|---|---|
| LOW | green | Minor concern, monitor only |
| MEDIUM | amber | Noticeable issue, warrants follow-up |
| HIGH | orange | Significant problem requiring prompt action |
| CRITICAL | red | Urgent — immediate intervention needed |

### Flag Status Workflow

```
OPEN  →  UNDER_REVIEW  →  RESOLVED
  └──────────────────────→  DISMISSED
```

| Status | Meaning |
|---|---|
| **OPEN** | Flag created, not yet actioned |
| **UNDER_REVIEW** | Someone is actively investigating |
| **RESOLVED** | Issue addressed and closed |
| **DISMISSED** | Flag deemed not actionable |

Only FLEET, MANAGER, and ADMIN users can create or update flags. When a flag is resolved or dismissed, the resolver's ID and timestamp are recorded.

### Creating Flags

**From the worker's Flags tab** (FLEET+ role):
- Fill in the form above the flag list and click **Submit**.

**From the Core App — Task Creator Deep-Dive** (CORE+ role):
- Open the deep dive for a worker and click **Flag for Ops Review** in the header area.
- Optionally add a message.
- This creates a `REVIEW_REQUESTED` flag with `MEDIUM` severity.

### Resolving Flags

1. Open the worker's Flags tab.
2. Expand the flag you want to resolve.
3. Select **Resolved** or **Dismissed** from the status dropdown.
4. Add resolution notes explaining what action was taken.
5. Save.

The flag is removed from the active-flag count and will no longer be included in the Review Requested badge total.

---

## Review Requested Flags

`REVIEW_REQUESTED` is a special flag type created by CORE-role users (or by FLEET users from the Deep Dive tab) to signal that a worker needs review by the operations team.

**How they flow**:

1. A CORE reviewer notices a concern in the Task Creator Deep-Dive and clicks **Flag for Ops Review**.
2. A `REVIEW_REQUESTED` flag is created with `OPEN` status.
3. The **Review Requested badge** in the header increments immediately for all FLEET+ users across all apps.
4. A FLEET manager clicks the badge, lands on the Workforce Monitoring list filtered to flagged workers.
5. The manager opens the worker, reviews the Deep Dive and flags, changes the flag status to `UNDER_REVIEW` while investigating, then `RESOLVED` or `Dismissed` once complete.
6. The badge count decrements once the flag leaves OPEN/UNDER_REVIEW.

---

## API Reference

All endpoints require FLEET, MANAGER, or ADMIN role unless noted.

### Worker List

```
GET /api/workforce-monitoring
```

Query params:

| Param | Type | Default | Description |
|---|---|---|---|
| `environment` | string | — | Filter to one environment |
| `search` | string | — | Partial name or email match |
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Results per page (max 200) |
| `sortBy` | string | — | `lastActivity` \| `taskCount` \| `feedbackCount` \| `activeFlags` |
| `sortDir` | string | `desc` | `asc` \| `desc` |
| `flagged` | string | `all` | `all` \| `flagged` \| `unflagged` |

Response: `{ workers, total, page, limit }`

When `sortBy` is omitted the server applies the default compound sort: active flags descending, then last name ascending, then email ascending.

---

### Worker Detail

```
GET /api/workforce-monitoring/worker?email=<email>
```

Query params: `email` (required), `environment`, `page`, `limit` (max 100), `type` (`TASK`|`FEEDBACK`), `latestOnly` (`true`).

Response: `{ worker, tasks, feedback, flags, totalTasks, totalFeedback, environments }`

---

### Flags

```
GET  /api/workforce-monitoring/flags?email=<email>
POST /api/workforce-monitoring/flags
```

**POST body**: `{ workerEmail, workerName?, flagType, severity?, reason, notes? }`

Valid `flagType` values: `QUALITY_CONCERN`, `POLICY_VIOLATION`, `COMMUNICATION_ISSUE`, `ATTENDANCE`, `OTHER`, `REVIEW_REQUESTED`

Valid `severity` values: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` (default `MEDIUM`)

---

### Flag Update

```
PATCH /api/workforce-monitoring/flags/<id>
```

Body: `{ status?, resolutionNotes?, notes? }`

Valid `status` values: `OPEN`, `UNDER_REVIEW`, `RESOLVED`, `DISMISSED`

Setting status to `RESOLVED` or `DISMISSED` records the resolver's user ID and a timestamp.

---

### Lookup

```
GET /api/workforce-monitoring/lookup?q=<id_or_task_key>
```

Response: `{ results: [{ recordId, email, name, environment, taskKey }], matchType: 'exact'|'fuzzy' }`

---

### Similarity Compare

```
POST /api/workforce-monitoring/similarity/compare
```

Body:

```json
{
  "taskId": "string",
  "scope": "environment | all",
  "threshold": 50,
  "latestOnly": false,
  "workerEmail": "string"
}
```

Response: `{ source, matches, total }`

Each match includes `taskId`, `content`, `environment`, `taskKey`, `createdBy`, `createdByEmail`, `isSameWorker`, `similarity`, `createdAt`.

---

### Deep Dive Data

```
GET /api/workforce-monitoring/deep-dive?email=<email>&environment=<env>
```

Response: `{ user, tasks, summary }` — includes rapid-submission flags and all prompt-authenticity analysis fields.

---

### Deep Dive Analyze (run/refresh)

```
POST /api/workforce-monitoring/deep-dive/analyze
```

Body: `{ email, environment? }` — syncs tasks to the analysis queue and processes pending/stuck records.

Response: `{ synced, analyzed, failed, total, templateAnalysisFailed, message }`

---

### Ops Flag (Core App)

```
POST /api/prompt-authenticity/user-deep-dive/ops-flag
```

**Requires CORE or higher role** (available in the Core App).

Body: `{ workerEmail, workerName?, reason? }`

Creates a `REVIEW_REQUESTED` flag with `MEDIUM` severity. Response: `{ flag }` (201).

---

## Related Documentation

- [FLEET Guide](./FLEET_GUIDE.md) — Full Fleet App user guide
- [Prompt Authenticity section in FLEET_GUIDE.md](./FLEET_GUIDE.md#prompt-authenticity-checker) — Running AI analysis jobs
- [API Reference](../Reference/API_REFERENCE.md) — Full API documentation
- [Database Schema](../Reference/DATABASE_SCHEMA.md) — WorkerFlag and related models

---

**Document Version**: 1.0
**Last Updated**: 2026-03-12
**Role**: FLEET / MANAGER / ADMIN
