# API Reference

Complete reference for all REST API endpoints in the Operations Tools.

## Table of Contents

- [Authentication](#authentication)
- [Projects](#projects)
- [Records](#records)
- [Ingestion](#ingestion)
- [Analysis](#analysis)
- [Admin](#admin)
- [AI Services](#ai-services)
- [Status](#status)
- [Error Codes](#error-codes)

---

## Authentication

All API routes (except `/api/status`) require authentication via Supabase session cookies.

### Authentication Flow

```typescript
// Login sets session cookie
POST /api/auth/login

// Session is automatically validated on subsequent requests
// via middleware and createClient() from @/lib/supabase/server
```

### Role-Based Access Control

| Role | Description | Access Level |
|------|-------------|--------------|
| **USER** | Standard user | Read data, generate analyses |
| **MANAGER** | Team manager | USER + Access time tracking & bonus windows |
| **ADMIN** | Administrator | MANAGER + User management, system settings |

---

## Projects

### GET /api/projects

List all projects visible to the authenticated user.

**Authentication**: Required
**Authorization**: All roles

**Request**
```http
GET /api/projects HTTP/1.1
Cookie: sb-auth-token=...
```

**Response** (200 OK)
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Project Name",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "guidelines": "data:application/pdf;base64,..."
    }
  ]
}
```

**Error Responses**
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Database error

---

### POST /api/projects

Create a new project.

**Authentication**: Required
**Authorization**: All roles

**Request**
```http
POST /api/projects HTTP/1.1
Content-Type: application/json
Cookie: sb-auth-token=...

{
  "name": "New Project",
  "guidelines": "data:application/pdf;base64,JVBERi0xLjQ..."
}
```

**Request Body**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Project name (max 255 chars) |
| `guidelines` | string | No | Base64-encoded PDF (data URI format) |

**Response** (201 Created)
```json
{
  "project": {
    "id": "uuid",
    "name": "New Project",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Responses**
- `400 Bad Request` - Missing or invalid fields
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Database or file processing error

---

### DELETE /api/projects/:id

Delete a project and all associated records.

**Authentication**: Required
**Authorization**: ADMIN only

**Request**
```http
DELETE /api/projects/uuid HTTP/1.1
Cookie: sb-auth-token=...
```

**Response** (200 OK)
```json
{
  "message": "Project deleted successfully",
  "deletedRecords": 1234
}
```

**Error Responses**
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Project doesn't exist
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
| `projectId` | string | Required | Filter by project ID |
| `type` | enum | - | Filter by type: `TASK`, `FEEDBACK` |
| `category` | enum | - | Filter by category: `TOP_10`, `BOTTOM_10`, `UNRATED` |
| `search` | string | - | Full-text search in content |
| `hasAlignment` | boolean | - | Filter by alignment analysis status |
| `environment` | string | - | Filter by metadata environment field |
| `limit` | number | 20 | Results per page (max 100) |
| `offset` | number | 0 | Pagination offset |
| `sortBy` | string | `createdAt` | Sort field: `createdAt`, `alignment`, `category`, `environment` |
| `sortOrder` | string | `desc` | Sort direction: `asc`, `desc` |

**Request**
```http
GET /api/records?projectId=uuid&type=TASK&limit=10&offset=0 HTTP/1.1
Cookie: sb-auth-token=...
```

**Response** (200 OK)
```json
{
  "records": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "type": "TASK",
      "category": "TOP_10",
      "content": "The task content...",
      "originalId": "task-123",
      "metadata": {
        "environment_name": "production",
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

Ingest data from CSV upload.

**Authentication**: Required
**Authorization**: All roles

**Request**
```http
POST /api/ingest/csv HTTP/1.1
Content-Type: application/json
Cookie: sb-auth-token=...

{
  "projectId": "uuid",
  "type": "TASK",
  "csvData": "task_id,content,rating\ntask-1,Content here,top 10",
  "filterKeywords": ["production"],
  "generateEmbeddings": true
}
```

**Request Body**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Target project ID |
| `type` | enum | Yes | `TASK` or `FEEDBACK` |
| `csvData` | string | Yes | CSV file content as string |
| `filterKeywords` | string[] | No | Only ingest records containing these keywords |
| `generateEmbeddings` | boolean | No | Generate embeddings immediately (default: true) |

**Response** (200 OK)
```json
{
  "jobId": "uuid",
  "message": "Ingestion started",
  "estimatedRecords": 150
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
- `404 Not Found` - Project not found
- `500 Internal Server Error` - Processing error

---

### GET /api/ingest/status

Get status of an ingestion job.

**Authentication**: Required
**Authorization**: All roles

**Query Parameters**
- `jobId` (required): Ingestion job ID

**Request**
```http
GET /api/ingest/status?jobId=uuid HTTP/1.1
Cookie: sb-auth-token=...
```

**Response** (200 OK)
```json
{
  "id": "uuid",
  "projectId": "uuid",
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

### POST /api/ingest/cancel

Cancel an active or queued ingestion job.

**Authentication**: Required
**Authorization**: All roles

**Request**
```http
POST /api/ingest/cancel HTTP/1.1
Content-Type: application/json
Cookie: sb-auth-token=...

{
  "jobId": "uuid"
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

## Admin

### GET /api/admin/users

List all users (Admin/Manager only).

**Authentication**: Required
**Authorization**: ADMIN, MANAGER

**Response** (200 OK)
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "role": "USER",
      "mustResetPassword": false,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
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

Start bulk alignment analysis for a project.

**Authentication**: Required
**Authorization**: ADMIN only

**Request**
```http
POST /api/admin/bulk-align HTTP/1.1
Content-Type: application/json
Cookie: sb-auth-token=...

{
  "projectId": "uuid"
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
  "projectId": "uuid",
  "action": "clear_analyses"
}
```

**Actions**
- `clear_analyses` - Remove all alignment analyses for a project
- `wipe_all` - **DANGER**: Delete all projects and data

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
const response = await fetch('/api/projects', {
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

### v0.1.0 (Current)
- Initial API release
- All core endpoints operational
- Basic authentication and RBAC

### Future Plans
- GraphQL API
- Batch operations
- Export/Import endpoints
- Webhook support
