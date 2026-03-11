# API Reference

Complete reference for all REST API endpoints in the Operations Tools.

## Table of Contents

- [Authentication](#authentication)
- [Environments](#environments)
- [Records](#records)
- [Ingestion](#ingestion)
- [Analysis](#analysis)
- [Similarity Flags](#similarity-flags)
- [Prompt Authenticity — Task Creator Deep-Dive](#prompt-authenticity--task-creator-deep-dive)
- [QA Feedback Import](#qa-feedback-import)
- [Admin](#admin)
- [AI Services](#ai-services)
- [Status](#status)
- [Error Codes](#error-codes)

---

## Authentication

API routes support two authentication methods:

### 1. Session Cookies (browser / UI)

```http
POST /api/auth/login
Cookie: sb-auth-token=...
```

Session cookies are set automatically on login and validated on each subsequent request via Supabase SSR.

### 2. API Tokens (programmatic / scripts)

Admin users can create long-lived bearer tokens at **Admin → API Tokens**.

```http
Authorization: Bearer otk_<64 hex chars>
```

- Tokens are prefixed `otk_` and contain 256 bits of randomness
- Only the SHA-256 hash is stored server-side; the plaintext is shown once at creation
- Tokens inherit the permissions of the admin who created them
- Tokens can have an optional expiry date and can be revoked at any time
- The `Authorization: Bearer` header takes precedence over session cookies

**Example:**
```bash
curl -X POST https://your-fleet-app/api/ingest/csv \
  -H "Authorization: Bearer otk_abc123..." \
  -F "file=@data.csv" \
  -F "generateEmbeddings=true"
```

### Role-Based Access Control

Roles are hierarchical — higher roles inherit all permissions of lower roles.

| Role | Description | Access Level |
|------|-------------|--------------|
| **USER** | Standard user | Time tracking, links |
| **QA** | QA analyst | USER + Records management, similarity search |
| **CORE** | Core reviewer | QA + Likert scoring, review decisions |
| **FLEET** | Fleet manager | CORE + Ingestion, analytics, workforce tools, similarity check |
| **MANAGER** | Team manager (legacy) | FLEET + bonus windows, time reporting |
| **ADMIN** | Administrator | All access + user management, system settings |

---

## Environments

Records are organized by a plain `environment` string field (e.g. "production", "staging"). There is no separate Environments table — environments are derived from the distinct values in `data_records.environment`.

### GET /api/environments

List all distinct environment values across all records.

**Authentication**: Required
**Authorization**: All roles

**Request**
```http
GET /api/environments HTTP/1.1
Cookie: sb-auth-token=...
```

**Response** (200 OK)
```json
{
  "environments": ["production", "staging", "dev"]
}
```

**Error Responses**
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Database error

---

## Records

### GET /api/records

Query and filter data records with pagination.

**Authentication**: Required
**Authorization**: All roles

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `environment` | string | - | Filter by environment (e.g. "production") |
| `type` | enum | - | Filter by type: `TASK`, `FEEDBACK` |
| `category` | enum | - | Filter by category: `TOP_10`, `BOTTOM_10`, `STANDARD` |
| `search` | string | - | Full-text search in content |
| `hasAlignment` | boolean | - | Filter by alignment analysis status |
| `limit` | number | 20 | Results per page (max 100) |
| `offset` | number | 0 | Pagination offset |
| `sortBy` | string | `createdAt` | Sort field: `createdAt`, `alignment`, `category`, `environment` |
| `sortOrder` | string | `desc` | Sort direction: `asc`, `desc` |

**Request**
```http
GET /api/records?environment=production&type=TASK&limit=10&offset=0 HTTP/1.1
Cookie: sb-auth-token=...
```

**Response** (200 OK)
```json
{
  "records": [
    {
      "id": "uuid",
      "environment": "production",
      "type": "TASK",
      "category": "TOP_10",
      "content": "The task content...",
      "originalId": "task-123",
      "metadata": {
        "custom_field": "value"
      },
      "embedding": [0.1, 0.2, ...],
      "alignmentAnalysis": "Score: 8/10\n\nStrengths:...",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

**Error Responses**
- `400 Bad Request` - Invalid query parameters
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Database error

---

### POST /api/records

Create or update alignment analysis for a record.

**Authentication**: Required
**Authorization**: All roles

**Request**
```http
POST /api/records HTTP/1.1
Content-Type: application/json
Cookie: sb-auth-token=...

{
  "recordId": "uuid",
  "generateAlignment": true
}
```

**Response** (200 OK)
```json
{
  "analysis": "Score: 8/10\n\nStrengths: Clear objectives...",
  "cost": 0.000150
}
```

**Error Responses**
- `400 Bad Request` - Missing recordId
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Record not found
- `500 Internal Server Error` - AI service or database error

---

## Ingestion

### POST /api/ingest/csv

Ingest data from a CSV file upload. Accepts multipart form data. Supports both session cookies and API token authentication.

**Authentication**: Required (session cookie or `Authorization: Bearer otk_...`)
**Authorization**: FLEET, ADMIN

**Request**
```http
POST /api/ingest/csv HTTP/1.1
Content-Type: multipart/form-data
Authorization: Bearer otk_...

file=<binary CSV data>
generateEmbeddings=true
filterKeywords=keyword1,keyword2
```

```bash
# curl example
curl -X POST https://fleet-app/api/ingest/csv \
  -H "Authorization: Bearer otk_..." \
  -F "file=@/path/to/data.csv" \
  -F "generateEmbeddings=true"
```

**Form Fields**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | CSV file (max 150 MB, must end in `.csv`) |
| `filterKeywords` | string | No | Comma-separated keywords; only matching rows are ingested |
| `generateEmbeddings` | boolean | No | Generate vector embeddings after ingestion (default: false) |

The environment and record type are read from columns in the CSV itself (`env_key`, `type`, etc.).

**Response** (200 OK)
```json
{
  "jobId": "clxyz...",
  "message": "Ingestion started in the background."
}
```

**Job Status Flow**
1. `PENDING` → Job created, waiting to start
2. `PROCESSING` → Loading data into database
3. `QUEUED_FOR_VEC` → Waiting for AI vectorization
4. `VECTORIZING` → Generating embeddings
5. `COMPLETED` → Finished successfully
6. `FAILED` → Error occurred
7. `CANCELLED` → User cancelled

**Error Responses**
- `400 Bad Request` - Invalid CSV format or missing fields
- `401 Unauthorized` - Not authenticated
- `400 Bad Request` - Missing or invalid environment
- `500 Internal Server Error` - Processing error

---

### GET /api/ingest/status

Get status of an ingestion job.

**Authentication**: Required (session cookie or `Authorization: Bearer otk_...`)
**Authorization**: FLEET, MANAGER, ADMIN

**Query Parameters**
- `jobId` (required): Ingestion job ID

**Request**
```http
GET /api/ingest/status?jobId=uuid HTTP/1.1
Authorization: Bearer otk_...
```

**Response** (200 OK)
```json
{
  "id": "uuid",
  "environment": "production",
  "type": "TASK",
  "status": "VECTORIZING",
  "totalRecords": 150,
  "processedCount": 75,
  "savedCount": 140,
  "skippedCount": 10,
  "skippedDetails": {
    "Duplicate ID": 8,
    "Keyword Mismatch": 2
  },
  "error": null,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

---

### GET /api/ingest/jobs

List recent ingestion jobs, optionally filtered by environment.

**Authentication**: Required (session cookie or `Authorization: Bearer otk_...`)
**Authorization**: FLEET, MANAGER, ADMIN

**Query Parameters**
- `environment` (optional): Filter to a specific environment

**Response** (200 OK)
```json
[
  {
    "id": "clxyz...",
    "environment": "production",
    "type": "TASK",
    "status": "COMPLETED",
    "totalRecords": 200,
    "savedCount": 195,
    "skippedCount": 5,
    "createdAt": "2026-03-10T12:00:00Z"
  }
]
```

Returns the 20 most recent jobs ordered by creation date descending.

---

### POST /api/ingest/cancel

Cancel an active or queued ingestion job.

**Authentication**: Required (session cookie or `Authorization: Bearer otk_...`)
**Authorization**: FLEET, MANAGER, ADMIN

**Request**
```http
POST /api/ingest/cancel HTTP/1.1
Content-Type: application/json
Authorization: Bearer otk_...

{
  "jobId": "clxyz..."
}
```

**Response** (200 OK)
```json
{
  "message": "Job cancelled successfully",
  "jobId": "uuid"
}
```

---

## Analysis

### POST /api/analysis/compare

Compare two records for similarity and differences.

**Authentication**: Required
**Authorization**: All roles

**Request**
```http
POST /api/analysis/compare HTTP/1.1
Content-Type: application/json
Cookie: sb-auth-token=...

{
  "recordId1": "uuid",
  "recordId2": "uuid"
}
```

**Response** (200 OK)
```json
{
  "similarity": 0.87,
  "analysis": "Both records discuss similar topics...",
  "differences": ["Record 1 mentions X, Record 2 mentions Y"],
  "cost": 0.000200
}
```

---

### POST /api/analysis/prompt-similarity

Find similar records using vector similarity.

**Authentication**: Required
**Authorization**: All roles

**Request**
```http
POST /api/analysis/prompt-similarity HTTP/1.1
Content-Type: application/json
Cookie: sb-auth-token=...

{
  "recordId": "uuid",
  "limit": 5
}
```

**Response** (200 OK)
```json
{
  "similar": [
    {
      "record": { "id": "uuid", "content": "..." },
      "similarity": 0.92
    }
  ]
}
```

---

## Similarity Flags

Similarity flags are generated automatically during data ingestion. Records from `@fleet.so` email addresses are excluded from detection.

### GET /api/similarity-flags

Fetch paginated similarity flags with optional filters.

**Authentication**: Required
**Authorization**: CORE, FLEET, MANAGER, ADMIN

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 25) |
| `environment` | string | Filter by environment |
| `status` | string | Filter by status: `OPEN` or `CLAIMED` |
| `claimedBy` | string | `me` to show only flags claimed by the authenticated user (requires `status=CLAIMED`) |
| `matchType` | string | Filter by match type: `USER_HISTORY` or `DAILY_GREAT` |

**Request**
```http
GET /api/similarity-flags?status=OPEN&environment=production HTTP/1.1
Cookie: sb-auth-token=...
```

**Response** (200 OK)
```json
{
  "flags": [
    {
      "id": "uuid",
      "similarityJobId": "uuid",
      "sourceRecordId": "uuid",
      "matchedRecordId": "uuid",
      "similarityScore": 0.94,
      "userEmail": "worker@example.com",
      "userName": "Worker Name",
      "environment": "production",
      "status": "OPEN",
      "matchType": "USER_HISTORY",
      "claimedByEmail": null,
      "claimedAt": null,
      "notifiedAt": null,
      "createdAt": "2026-01-15T10:00:00Z",
      "sourceSnippet": "First 200 chars of source prompt...",
      "matchedSnippet": "First 200 chars of matched prompt...",
      "matchedTaskKey": null
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 25
}
```

---

### POST /api/similarity-flags/ai-compare

Use AI to analyse the similarity between two flagged records. Returns a structured comparison covering key similarities, notable differences, duplicate assessment, and an overall verdict.

**Authentication**: Required
**Authorization**: CORE, FLEET, MANAGER, ADMIN

**Request**
```http
POST /api/similarity-flags/ai-compare HTTP/1.1
Content-Type: application/json
Cookie: sb-auth-token=...

{
  "sourceRecordId": "uuid",
  "matchedRecordId": "uuid"
}
```

**Response** (200 OK)
```json
{
  "analysis": "1. Key similarities: ...\n2. Notable differences: ...\n3. Duplicate assessment: ...\n4. Overall verdict: ...",
  "cost": "$0.0012",
  "provider": "openrouter"
}
```

`cost` is `null` for local LM Studio providers (free compute). `provider` identifies which AI backend was used.

**Error Responses**

| Status | Meaning |
|--------|---------|
| 400 | Missing `sourceRecordId` or `matchedRecordId`, or invalid JSON body |
| 404 | Source or matched record not found |
| 502 | AI provider failed to respond or returned empty content |

---

## Prompt Authenticity — Task Creator Deep-Dive

Tools for investigating individual task creators: browsing their submission history, running AI-powered authenticity analysis (AI-generated, templated, non-native, rapid submission), and looking up records by ID or task key.

**Authorization**: All endpoints require minimum **CORE** role. Tasks ingested without a `createdByEmail` value are excluded from all results in this section.

---

### GET /api/prompt-authenticity/user-deep-dive

Fetch the full task history for a specific creator, with per-task authenticity flags and a summary.

**Authorization**: CORE+

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | Yes | Creator email address |
| `environment` | string | No | Filter to a single environment |

**Response** (200 OK)
```json
{
  "user": { "name": "Alice Worker" },
  "tasks": [
    {
      "id": "uuid",
      "content": "Task text...",
      "environment": "prod",
      "createdAt": "2026-01-15T10:30:00Z",
      "gapFromPreviousMin": 12.5,
      "isRapidSubmission": false,
      "analysisStatus": "COMPLETED",
      "isLikelyAIGenerated": false,
      "aiGeneratedConfidence": 10,
      "aiGeneratedIndicators": [],
      "isLikelyTemplated": false,
      "templateConfidence": 5,
      "templateIndicators": [],
      "detectedTemplate": null,
      "isLikelyNonNative": false,
      "nonNativeConfidence": 8,
      "nonNativeIndicators": [],
      "overallAssessment": "Appears authentic."
    }
  ],
  "summary": {
    "total": 42,
    "analyzed": 40,
    "aiGeneratedCount": 3,
    "aiGeneratedPct": 7,
    "templatedCount": 1,
    "templatedPct": 2,
    "nonNativeCount": 0,
    "nonNativePct": 0,
    "rapidSubmissionCount": 4,
    "rapidSubmissionPct": 10
  }
}
```

**Error Responses**
- `400 Bad Request` — `email` is missing
- `401 Unauthorized` — not authenticated
- `403 Forbidden` — insufficient role
- `500 Internal Server Error` — database error

---

### GET /api/prompt-authenticity/user-deep-dive/users

List all distinct task creators, with task counts, for the user selector on the landing page. Returns all matching users — pagination is handled client-side (25 users per page).

**Authorization**: CORE+

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `environment` | string | No | Filter to a single environment |

**Notes**
- Excludes creators whose email ends with `@fleet.so` (case-insensitive)
- Results are sorted alphabetically by name (falls back to email)
- Capped at 10,000 unique emails to prevent OOM on large datasets

**Response** (200 OK)
```json
{
  "users": [
    { "email": "alice@example.com", "name": "Alice Worker", "taskCount": 42 },
    { "email": "bob@example.com", "name": "Bob Smith", "taskCount": 17 }
  ]
}
```

**Error Responses**
- `401 Unauthorized` — not authenticated
- `403 Forbidden` — insufficient role
- `500 Internal Server Error` — database error

---

### POST /api/prompt-authenticity/user-deep-dive/analyze

Run AI authenticity analysis on all unanalyzed (or all) tasks for a given creator. Updates each record's `analysisStatus`, flags, and confidence scores. Returns a summary of results.

**Authorization**: CORE+

**Request Body**
```json
{
  "email": "alice@example.com",
  "environment": "prod"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Creator email address |
| `environment` | string | No | Limit analysis to a single environment |

**Response** (200 OK)
```json
{
  "analyzed": 38,
  "failed": 1,
  "message": "Analyzed 38 tasks (1 failed).",
  "templateAnalysisFailed": false
}
```

`templateAnalysisFailed` is `true` when cross-prompt template detection succeeded per-record but the final template-field DB write failed. Authenticity flags are still populated; only the `detectedTemplate` badge may be incomplete.

**Error Responses**
- `400 Bad Request` — `email` is missing or request body is invalid JSON
- `401 Unauthorized` — not authenticated
- `403 Forbidden` — insufficient role
- `500 Internal Server Error` — unexpected database or AI error

---

### GET /api/prompt-authenticity/user-deep-dive/lookup

Look up the creator(s) of a task by record ID or `metadata.task_key`. Uses a two-phase search — exact match first, then case-insensitive partial match — and returns a `matchType` field so callers can distinguish exact from approximate results.

**Authorization**: CORE+

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Record ID or task key to search for (max 200 characters, whitespace trimmed) |

**Search strategy**

1. **Exact match** — single Prisma `OR` query: `{ id: q }` OR `{ metadata.task_key === q }` (case-sensitive). Returns at most 1 result with `matchType: "exact"`.
2. **Fuzzy fallback** — if exact match finds nothing, runs `metadata->>'task_key' ILIKE '%q%'` (case-insensitive, LIKE wildcards in `q` are escaped). Returns up to 5 results ordered by `createdAt DESC`, with `matchType: "fuzzy"`.

Only tasks with a non-null `createdByEmail` are considered. Tasks ingested without creator attribution are invisible to this endpoint.

**Response** (200 OK)
```json
{
  "results": [
    {
      "recordId": "uuid",
      "email": "alice@example.com",
      "name": "Alice Worker",
      "environment": "prod",
      "taskKey": "task-key-abc"
    }
  ],
  "matchType": "exact"
}
```

`matchType` is `"exact"` when Phase 1 succeeded, `"fuzzy"` when Phase 2 was used. Clients should surface a visible indicator when `matchType` is `"fuzzy"` — fuzzy results are approximate and a single match does not guarantee it is the intended record.

**Error Responses**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "q is required" }` | Query param missing or blank |
| 400 | `{ "error": "q must be 200 characters or fewer" }` | Query exceeds length limit |
| 401 | `{ "error": "Unauthorized" }` | Not authenticated |
| 403 | `{ "error": "Forbidden" }` | Insufficient role |
| 404 | `{ "error": "No task found for the given ID or task key" }` | Both phases returned nothing |
| 500 | `{ "error": "Internal server error" }` | Database error (details are not forwarded to the client) |

---

## QA Feedback Import

### POST /api/qa-feedback-import

Import QA feedback ratings from a CSV file. Upserts by `rating_id` — existing records are updated, new ones are inserted. Optionally creates task records for linked tasks.

**Authentication**: Required (session cookie or `Authorization: Bearer otk_...`)
**Authorization**: ADMIN only

**Request**
```http
POST /api/qa-feedback-import HTTP/1.1
Content-Type: multipart/form-data
Authorization: Bearer otk_...

file=<binary CSV data>
```

```bash
curl -X POST https://fleet-app/api/qa-feedback-import \
  -H "Authorization: Bearer otk_..." \
  -F "file=@ratings.csv"
```

**CSV Required Columns**
| Column | Description |
|--------|-------------|
| `rating_id` | Unique identifier for the rating (used for upsert) |
| `feedback_id` | ID of the feedback being rated |
| `is_helpful` | `true`/`false` or `1`/`0` |
| `rated_at` | ISO 8601 date |
| `rater_email` | Email of the rater |
| `qa_email` | Email of the QA worker |

**CSV Optional Columns**: `feedback_content`, `eval_task_id`, `is_dispute`, `dispute_status`, `dispute_reason`, `rater_name`, `qa_name`, `resolved_at`, `resolved_by_name`, `resolution_reason`, `task_id`, `task_prompt`, `task_creator_name`, `task_creator_email`, `task_created_at`, `env_key`, `scenario_title`

**Response** (200 OK)
```json
{
  "success": true,
  "summary": {
    "imported": 142,
    "updated": 8,
    "skipped": 2,
    "tasksCreated": 15,
    "errors": ["Row 5: Missing required fields: rater_email"]
  }
}
```

**Error Responses**
- `400 Bad Request` - No file provided or CSV parse error
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - ADMIN role required
- `500 Internal Server Error` - Unexpected error

---

## Admin

### GET /api/admin/api-tokens

List API tokens owned by the authenticated admin.

**Authentication**: Required
**Authorization**: ADMIN only

**Response** (200 OK)
```json
[
  {
    "id": "abc123",
    "name": "Ingest Script",
    "tokenPrefix": "deadbeef",
    "lastUsedAt": "2026-03-10T09:00:00Z",
    "expiresAt": null,
    "revokedAt": null,
    "createdAt": "2026-03-01T10:00:00Z"
  }
]
```

The `tokenHash` is never returned. `tokenPrefix` is the first 8 hex chars of the token after `otk_`, for identification.

---

### POST /api/admin/api-tokens

Create a new API token. Returns the plaintext token **once** — it cannot be retrieved again.

**Authentication**: Required
**Authorization**: ADMIN only

**Request**
```http
POST /api/admin/api-tokens HTTP/1.1
Content-Type: application/json
Cookie: sb-auth-token=...

{
  "name": "Ingest Script",
  "expiresAt": "2027-01-01"
}
```

**Request Body**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable label |
| `expiresAt` | string | No | ISO date for expiry (e.g. `"2027-01-01"`). Omit for no expiry. |

**Response** (201 Created)
```json
{
  "id": "abc123",
  "name": "Ingest Script",
  "tokenPrefix": "deadbeef",
  "expiresAt": null,
  "createdAt": "2026-03-10T10:00:00Z",
  "token": "otk_deadbeef..."
}
```

The `token` field is only present in this response. Store it securely.

---

### DELETE /api/admin/api-tokens/:id

Revoke an API token. Soft-deletes by setting `revokedAt`. The token is immediately rejected on subsequent requests.

**Authentication**: Required
**Authorization**: ADMIN only (own tokens only)

**Response** (200 OK)
```json
{ "success": true }
```

**Error Responses**
- `404 Not Found` - Token not found or belongs to another user
- `409 Conflict` - Token already revoked

---

### GET /api/admin/users

List all users (Admin/Manager only).

**Authentication**: Required
**Authorization**: ADMIN, MANAGER

**Response** (200 OK)
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "role": "USER",
    "mustResetPassword": false,
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

---

### POST /api/admin/users

Create a new user (Admin only).

**Authentication**: Required
**Authorization**: ADMIN only

**Request**
```http
POST /api/admin/users HTTP/1.1
Content-Type: application/json
Cookie: sb-auth-token=...

{
  "email": "newuser@example.com",
  "password": "TemporaryPass123!",
  "role": "USER"
}
```

**Response** (201 Created)
```json
{
  "user": {
    "id": "uuid",
    "email": "newuser@example.com",
    "role": "USER",
    "mustResetPassword": true
  }
}
```

---

### POST /api/admin/users/reset-password

Reset a user's password (Admin only).

**Authentication**: Required
**Authorization**: ADMIN only

**Request**
```http
POST /api/admin/users/reset-password HTTP/1.1
Content-Type: application/json
Cookie: sb-auth-token=...

{
  "userId": "uuid",
  "newPassword": "NewTemporaryPass123!"
}
```

**Response** (200 OK)
```json
{
  "message": "Password reset successfully",
  "mustResetPassword": true
}
```

---

### GET /api/admin/settings

Get current system settings.

**Authentication**: Required
**Authorization**: ADMIN only

**Response** (200 OK)
```json
{
  "settings": {
    "ai_provider": "lmstudio",
    "ai_host": "http://localhost:1234/v1",
    "llm_model": "llama-3.1-8b",
    "embedding_model": "nomic-embed-text"
  }
}
```

---

### POST /api/admin/settings

Update system settings.

**Authentication**: Required
**Authorization**: ADMIN only

**Request**
```http
POST /api/admin/settings HTTP/1.1
Content-Type: application/json
Cookie: sb-auth-token=...

{
  "ai_provider": "openrouter",
  "ai_host": "https://openrouter.ai/api/v1",
  "llm_model": "anthropic/claude-3-sonnet"
}
```

---

### POST /api/admin/bulk-align

Start bulk alignment analysis for an environment.

**Authentication**: Required
**Authorization**: ADMIN only

**Request**
```http
POST /api/admin/bulk-align HTTP/1.1
Content-Type: application/json
Cookie: sb-auth-token=...

{
  "environment": "production"
}
```

**Response** (200 OK)
```json
{
  "jobId": "uuid",
  "totalRecords": 1500,
  "message": "Bulk alignment started"
}
```

---

### POST /api/admin/clear

Clear alignment analyses or wipe all data (DANGER).

**Authentication**: Required
**Authorization**: ADMIN only

**Request**
```http
POST /api/admin/clear HTTP/1.1
Content-Type: application/json
Cookie: sb-auth-token=...

{
  "environment": "production",
  "action": "clear_analyses"
}
```

**Actions**
- `clear_analyses` - Remove all alignment analyses for an environment
- `wipe_all` - **DANGER**: Delete all records and data

---

### GET /api/admin/bonus-windows

Get all bonus windows with user breakdown data (Manager/Admin only).

**Authentication**: Required
**Authorization**: ADMIN, MANAGER

**Response** (200 OK)
```json
{
  "bonusWindows": [
    {
      "id": "uuid",
      "name": "Q1 2024 Bonus",
      "startTime": "2024-01-01T00:00:00Z",
      "endTime": "2024-03-31T23:59:59Z",
      "targetTaskCount": 100,
      "targetFeedbackCount": 50,
      "targetTaskCountTier2": 150,
      "targetFeedbackCountTier2": 75,
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-01T10:00:00Z"
    }
  ]
}
```

---

### POST /api/admin/bonus-windows

Create a new bonus window (Manager/Admin only).

**Authentication**: Required
**Authorization**: ADMIN, MANAGER

**Request**
```http
POST /api/admin/bonus-windows HTTP/1.1
Content-Type: application/json
Cookie: sb-auth-token=...

{
  "name": "Q1 2024 Bonus",
  "startTime": "2024-01-01T00:00:00Z",
  "endTime": "2024-03-31T23:59:59Z",
  "targetTaskCount": 100,
  "targetFeedbackCount": 50,
  "targetTaskCountTier2": 150,
  "targetFeedbackCountTier2": 75
}
```

**Request Body**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Bonus window name |
| `startTime` | ISO 8601 | Yes | Window start date/time |
| `endTime` | ISO 8601 | Yes | Window end date/time |
| `targetTaskCount` | number | Yes | Tier 1 task target |
| `targetFeedbackCount` | number | Yes | Tier 1 feedback target |
| `targetTaskCountTier2` | number | No | Tier 2 task target (optional) |
| `targetFeedbackCountTier2` | number | No | Tier 2 feedback target (optional) |

**Response** (201 Created)
```json
{
  "bonusWindow": {
    "id": "uuid",
    "name": "Q1 2024 Bonus",
    "startTime": "2024-01-01T00:00:00Z",
    "endTime": "2024-03-31T23:59:59Z"
  }
}
```

---

### DELETE /api/admin/bonus-windows/:id

Delete a bonus window (Manager/Admin only).

**Authentication**: Required
**Authorization**: ADMIN, MANAGER

**Request**
```http
DELETE /api/admin/bonus-windows/uuid HTTP/1.1
Cookie: sb-auth-token=...
```

**Response** (200 OK)
```json
{
  "message": "Bonus window deleted successfully"
}
```

---

### GET /api/admin/activity-over-time

Get daily activity statistics for tasks and feedback over a configurable date range (Manager/Admin only).

**Authentication**: Required
**Authorization**: ADMIN, MANAGER

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `start` | string (YYYY-MM-DD) | 29 days ago | Start date for the range |
| `end` | string (YYYY-MM-DD) | Today | End date for the range |

**Request**
```http
GET /api/admin/activity-over-time?start=2026-01-01&end=2026-01-31 HTTP/1.1
Cookie: sb-auth-token=...
```

**Response** (200 OK)
```json
{
  "dailyActivity": [
    {
      "date": "2026-01-01",
      "taskCount": 45,
      "feedbackCount": 23,
      "totalCount": 68
    },
    {
      "date": "2026-01-02",
      "taskCount": 52,
      "feedbackCount": 18,
      "totalCount": 70
    }
  ],
  "startDate": "2026-01-01T00:00:00.000Z",
  "endDate": "2026-01-31T23:59:59.999Z"
}
```

**Notes**
- If no date range is provided, defaults to the past 30 days (29 days ago + today)
- Start time is set to 00:00:00.000 of the start date
- End time is set to 23:59:59.999 of the end date
- All dates in the range are returned, even if they have zero counts
- Dates are returned in YYYY-MM-DD format, sorted chronologically

**Error Responses**
- `400 Bad Request` - Invalid date format or start date after end date
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Insufficient permissions (USER role)
- `500 Internal Server Error` - Database error

---

## AI Services

### GET /api/ai/balance

Get OpenRouter account balance (Admin only).

**Authentication**: Required
**Authorization**: ADMIN only

**Response** (200 OK)
```json
{
  "balance": 9.75,
  "currency": "USD"
}
```

*Returns null for LM Studio provider*

---

### GET /api/ai/status

Check AI service health.

**Authentication**: Required
**Authorization**: All roles

**Response** (200 OK)
```json
{
  "provider": "lmstudio",
  "status": "online",
  "models": {
    "llm": "llama-3.1-8b",
    "embedding": "nomic-embed-text"
  }
}
```

---

## Status

### GET /api/status

Public health check endpoint.

**Authentication**: Not required
**Authorization**: Public

**Response** (200 OK)
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Error Codes

### Standard HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| `200` | OK | Successful request |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid input, malformed JSON, missing required fields |
| `401` | Unauthorized | Not authenticated, session expired |
| `403` | Forbidden | Insufficient permissions for this operation |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Duplicate resource, constraint violation |
| `500` | Internal Server Error | Database error, AI service error, unexpected error |

### Error Response Format

All error responses follow this structure:

```json
{
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `AUTH_REQUIRED` | Authentication required | Log in and retry |
| `INSUFFICIENT_PERMISSIONS` | Role lacks required permissions | Contact admin for role upgrade |
| `INVALID_INPUT` | Request validation failed | Check request format and required fields |
| `RESOURCE_NOT_FOUND` | Requested resource doesn't exist | Verify ID is correct |
| `DUPLICATE_ENTRY` | Resource already exists | Use different identifier |
| `AI_SERVICE_ERROR` | AI service unavailable or error | Check AI service status, retry |
| `DATABASE_ERROR` | Database operation failed | Retry or contact admin |
| `JOB_ALREADY_RUNNING` | Background job already active | Wait for current job to complete |

---

## Rate Limiting

Currently, rate limiting is not implemented. Future versions may add:
- Per-user request limits
- AI operation throttling
- Concurrent job limits

---

## Webhooks

Webhooks are not currently supported. Future versions may add:
- Job completion notifications
- Alignment threshold alerts
- System health alerts

---

## SDK & Libraries

Official SDKs are not yet available. Use standard HTTP clients:

```typescript
// Example: Fetch API
const response = await fetch('/api/records?environment=production&type=TASK', {
  method: 'GET',
  credentials: 'include', // Include session cookie
  headers: {
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

---

## Changelog

### v0.2.0 (2026-03-10)
- Added API token authentication (`Authorization: Bearer otk_...`)
- Added `GET/POST /api/admin/api-tokens` and `DELETE /api/admin/api-tokens/:id`
- Added `POST /api/qa-feedback-import` with token support
- Updated `POST /api/ingest/csv` to multipart form upload with token support
- Added auth to `GET /api/ingest/status`, `POST /api/ingest/cancel`, `GET /api/ingest/jobs`

### v0.1.0
- Initial API release
- All core endpoints operational
- Basic authentication and RBAC
