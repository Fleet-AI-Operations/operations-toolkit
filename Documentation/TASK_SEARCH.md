# Task Search

A Core app tool for finding task records by creator name, email, or task ID, with an optional AI-powered authenticity check to detect AI-generated or templated submissions.

## Table of Contents

- [Overview](#overview)
- [Access & Permissions](#access--permissions)
- [Searching for Tasks](#searching-for-tasks)
- [Running an AI Check](#running-an-ai-check)
  - [Verdicts](#verdicts)
  - [Confidence Levels](#confidence-levels)
  - [Interpreting Results](#interpreting-results)
- [Technical Reference](#technical-reference)
  - [API Endpoints](#api-endpoints)
  - [AI Check System Prompt](#ai-check-system-prompt)
- [Related Documentation](#related-documentation)

---

## Overview

Task Search allows authorised users to quickly locate task submissions by searching for the submitter's name, email address, or a specific task ID. Each result can be individually submitted to an LLM for an authenticity assessment that classifies the task as genuinely human-written, AI-generated, or produced from a fill-in-the-blank template.

**Key use cases:**
- Investigate a specific worker's submissions by name or email
- Look up a task by ID for review purposes
- Flag tasks that appear to be AI-generated or templated rather than authentic human work

---

## Access & Permissions

| Role | Access |
|------|--------|
| CORE | ✅ Full access |
| FLEET | ✅ Full access |
| MANAGER | ✅ Full access |
| ADMIN | ✅ Full access |
| QA, USER | ❌ Forbidden |

Navigate to **Core app → Scoring → Task Search** (`/task-search`).

---

## Searching for Tasks

1. Enter a search term in the search bar.
2. Press **Enter** or click **Search**.

The search matches against:
- **Creator name** — partial, case-insensitive (`ILIKE %query%`)
- **Creator email** — partial, case-insensitive (`ILIKE %query%`)
- **Task ID** — exact match

Up to 25 results are returned, ordered by most recently created first.

### Latest Version Only

An amber toggle labelled **Latest version only** appears below the search bar. When enabled (default: **on**), only the highest-versioned task for each unique `task_key` is returned, deduplicating re-submitted prompts.

| Toggle state | Behaviour |
|---|---|
| **On** (default) | One result per `task_key`, keeping the highest version (`task_version` or `version_no`). Tasks without a `task_key` are treated as unique. |
| **Off** | All versions are returned (up to 25 total), ordered by most recently created first. |

If you are investigating whether a worker resubmitted the same prompt across multiple versions, turn this toggle **off** to see every version in the results.

Toggling this control immediately re-runs the search when results are already showing — no need to press Search again.

### Environment Filter

When results span more than one environment, a dropdown appears below the result count letting you narrow results to a single environment. Filtering is applied client-side — no new API call is made. The count updates to show `X of Y results in "environment-name"` while a filter is active. Clearing the dropdown back to **All environments** restores the full result set.

Each result card displays:

| Field | Description |
|-------|-------------|
| Task ID | Monospace badge; exact record identifier |
| Environment | The environment the task belongs to |
| Creator name | Name of the submitting user |
| Creator email | Email of the submitting user |
| Date | Submission date |
| Content | Task text; truncated at 300 characters with a "Show more" toggle |

---

## Running an AI Check

Each result card has an **AI Check** button. Clicking it sends the task content to the configured LLM and returns an authenticity assessment.

> The AI check uses the currently configured AI provider (LM Studio or OpenRouter). If no AI provider is running, the check will fail with an error.

### Verdicts

| Verdict | Meaning | Indicator colour |
|---------|---------|-----------------|
| **Authentic** | Appears genuinely written by a human | 🟢 Green |
| **Templated** | Looks like a fill-in-the-blank template | 🟡 Yellow |
| **AI Generated** | Shows signs of LLM authorship | 🔴 Red |

### Confidence Levels

| Confidence | Meaning |
|------------|---------|
| HIGH | Strong evidence for the verdict |
| MEDIUM | Some indicators present but not conclusive |
| LOW | Weak signal; treat the verdict with caution |

### Interpreting Results

The AI check result panel shows three components:

1. **Verdict + Confidence** — The classification and how certain the model is.
2. **Reasoning** — A 2–3 sentence explanation citing specific evidence from the task text.
3. **Indicators** — Individual phrases or patterns identified as supporting the verdict.

The result panel is collapsible via the chevron button and persists until a new check is run on the same card.

> **Important**: AI authenticity checks are heuristic. A HIGH-confidence AI_GENERATED verdict is strong evidence, but the result should be treated as a signal for further investigation rather than a definitive ruling, especially at LOW or MEDIUM confidence.

---

## Technical Reference

### API Endpoints

#### `GET /api/task-search`

Search task records.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search term (name, email, or exact task ID) |
| `latestOnly` | boolean | When `true`, returns only the highest version per `task_key` (default: `false`) |

**Response:**

```typescript
{
  tasks: Array<{
    id: string;
    content: string;
    environment: string;
    createdByName: string | null;
    createdByEmail: string | null;
    createdAt: string; // ISO date
  }>;
}
```

Returns an empty array if `q` is blank. Maximum 25 results.

**Authorization:** CORE, FLEET, MANAGER, or ADMIN role required.

---

#### `POST /api/task-search/user-similarity`

Find other tasks submitted by the same worker as the selected record, ranked by vector similarity.

**Request body:**

```typescript
{
  recordId: string;    // The task to use as the similarity anchor
  latestOnly?: boolean; // When true, deduplicate comparison pool to highest version per task_key (default: false)
}
```

**Response:**

```typescript
{
  matches: Array<{
    id: string;
    content: string;
    environment: string;
    createdByName: string | null;
    createdByEmail: string | null;
    createdAt: string; // ISO date
    taskKey: string | null;
    taskVersion: string | null;
    similarity: number; // 0–100
  }>;
  versionFiltered: boolean; // true if results were narrowed by version (latestOnly or v1-preference fallback)
}
```

**Authorization:** CORE, FLEET, MANAGER, or ADMIN role required.

**Error codes:**

| Status | Meaning |
|--------|---------|
| 400 | `recordId` missing or request body invalid |
| 401 | Not authenticated |
| 403 | Insufficient role |
| 404 | Source record not found |
| 422 | Source record has no embedding, no environment, or no user identity |
| 500 | Database error |

> **Version fallback (latestOnly=false)**: When `latestOnly` is off, the endpoint checks whether the worker has any version-1 tasks. If so, results are restricted to version 1 only (`versionFiltered: true`). If the worker has no version-1 tasks, all versions are returned (`versionFiltered: false`).

---

#### `POST /api/task-search/ai-check`

Run an LLM authenticity assessment on a task.

**Request body:**

```typescript
{
  content: string; // Task text to analyse
}
```

**Response:**

```typescript
{
  verdict: 'AI_GENERATED' | 'TEMPLATED' | 'AUTHENTIC';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;      // 2–3 sentence explanation
  indicators: string[];   // Specific phrases or patterns
}
```

**Authorization:** CORE, FLEET, MANAGER, or ADMIN role required.

**Error codes:**

| Status | Meaning |
|--------|---------|
| 400 | `content` is missing or blank |
| 401 | Not authenticated |
| 403 | Insufficient role |
| 502 | LLM returned an unexpected response format |
| 500 | AI provider error or other server failure |

### AI Check System Prompt

The AI check uses a structured system prompt that instructs the LLM to output JSON only:

```
{
  "verdict": "AI_GENERATED" | "TEMPLATED" | "AUTHENTIC",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "2–3 sentence explanation citing specific evidence",
  "indicators": ["specific phrase or pattern", "..."]
}
```

**Verdict definitions used in the prompt:**

- **AI_GENERATED**: Overly formal phrasing, unnaturally perfect grammar, generic scenarios, formulaic sentence structures, vocabulary patterns typical of LLMs.
- **TEMPLATED**: Obvious variable substitution, highly repetitive structure, identical phrasing with only specific details swapped.
- **AUTHENTIC**: Natural variation, minor imperfections, specific personal context, conversational tone, idiosyncratic word choices.

---

## Related Documentation

- [Core Guide](./UserGuides/CORE_GUIDE.md)
- [AI Strategy](./Architecture/AI_STRATEGY.md)
- [API Reference](./Reference/API_REFERENCE.md)

---

*Last Updated: 2026-03-05*
