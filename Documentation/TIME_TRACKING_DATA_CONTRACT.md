# Time Tracking API - Data Contract

**Version**: 1.0.0
**Last Updated**: 2026-02-12
**Status**: Development/MVP (Unauthenticated)

---

## Endpoint

```
POST /api/time-entries/record
```

**Base URLs**:
- Local: `http://localhost:3001`
- Production: `https://your-domain.com` _(when authenticated)_

---

## Request Specification

### Headers

```
Content-Type: application/json
```

### Request Body Schema

```typescript
{
  email: string;          // Required: User's email address
  category: string;       // Required: Activity category (see valid values)
  hours: number;          // Required: Hours spent (0-23)
  minutes: number;        // Required: Minutes spent (0-59)
  count?: number;         // Optional: Task count (integer >= 0)
  notes?: string;         // Optional: Additional notes (max 2000 characters)
  date?: string;          // Optional: Date in YYYY-MM-DD format (defaults to today)
}
```

### Field Requirements

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `email` | string | ✅ Yes | Valid email format (RFC 5322) |
| `category` | string | ✅ Yes | Must be one of valid categories (see below) |
| `hours` | number | ✅ Yes | Integer, 0-23 inclusive |
| `minutes` | number | ✅ Yes | Integer, 0-59 inclusive |
| `count` | number | ❌ No | Integer, >= 0 |
| `notes` | string | ❌ No | Max length: 2000 characters |
| `date` | string | ❌ No | Format: YYYY-MM-DD (ISO 8601 date) |

### Valid Categories

```
"Writing New Tasks"
"Updating Tasks Based on Feedback"
"Time Spent on Instructions or Slack"
"Platform Downtime"
"Time Spent on QA"
```

### Validation Rules

1. **Email**: Must match pattern `^[^\s@]+@[^\s@]+\.[^\s@]+$`
2. **Hours + Minutes**: Cannot both be 0 (minimum 1 minute required)
3. **Category**: Case-sensitive, exact match required
4. **Date**: Must be valid date, format YYYY-MM-DD
5. **All numeric fields**: Must be integers (no decimals)

---

## Response Specification

### Success Response (201 Created)

```typescript
{
  success: boolean;       // Always true for success
  entry: {
    id: string;           // UUID of created entry
    date: string;         // ISO 8601 datetime
    hours: number;        // Hours from request
    minutes: number;      // Minutes from request
    category: string;     // Category from request
    count: number | null; // Count from request or null
    notes: string | null; // Notes from request or null
  }
}
```

**Example**:
```json
{
  "success": true,
  "entry": {
    "id": "clxy123abc456def789",
    "date": "2026-02-12T00:00:00.000Z",
    "hours": 2,
    "minutes": 30,
    "category": "Writing New Tasks",
    "count": 5,
    "notes": "Completed morning batch"
  }
}
```

### Error Response (4xx, 5xx)

```typescript
{
  error: string;  // Human-readable error message
}
```

---

## Error Codes

| Status Code | Error Message | Description |
|-------------|---------------|-------------|
| `400` | `Missing required fields: email, category, hours, minutes` | One or more required fields not provided |
| `400` | `Invalid email format` | Email doesn't match validation pattern |
| `400` | `Hours must be an integer between 0 and 23` | Hours out of range or not an integer |
| `400` | `Minutes must be an integer between 0 and 59` | Minutes out of range or not an integer |
| `400` | `Time cannot be 0h 0m. Please enter at least 1 minute.` | Both hours and minutes are 0 |
| `400` | `Invalid category. Must be one of: ...` | Category not in valid list |
| `400` | `Count must be a positive integer` | Count is negative or not an integer |
| `400` | `Notes must be 2000 characters or less` | Notes exceed maximum length |
| `400` | `Invalid date format. Use YYYY-MM-DD` | Date string cannot be parsed |
| `500` | `Failed to record time entry` | Internal server error |

---

## Request Examples

### Minimal Request (Required Fields Only)

```bash
curl -X POST http://localhost:3001/api/time-entries/record \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "category": "Writing New Tasks",
    "hours": 2,
    "minutes": 30
  }'
```

### Full Request (All Fields)

```bash
curl -X POST http://localhost:3001/api/time-entries/record \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "category": "Writing New Tasks",
    "hours": 2,
    "minutes": 30,
    "count": 5,
    "notes": "Completed 5 task prompts for Project Alpha",
    "date": "2026-02-12"
  }'
```

### JavaScript/TypeScript

```typescript
interface TimeEntryRequest {
  email: string;
  category: string;
  hours: number;
  minutes: number;
  count?: number;
  notes?: string;
  date?: string;
}

interface TimeEntryResponse {
  success: boolean;
  entry: {
    id: string;
    date: string;
    hours: number;
    minutes: number;
    category: string;
    count: number | null;
    notes: string | null;
  };
}

interface ErrorResponse {
  error: string;
}

async function recordTime(
  request: TimeEntryRequest
): Promise<TimeEntryResponse> {
  const response = await fetch(
    'http://localhost:3001/api/time-entries/record',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error);
  }

  return await response.json();
}

// Usage
const result = await recordTime({
  email: 'user@example.com',
  category: 'Writing New Tasks',
  hours: 2,
  minutes: 30,
  count: 5,
});

console.log('Entry ID:', result.entry.id);
```

### Python

```python
import requests
from typing import Optional, TypedDict

class TimeEntryRequest(TypedDict, total=False):
    email: str          # Required
    category: str       # Required
    hours: int          # Required
    minutes: int        # Required
    count: Optional[int]
    notes: Optional[str]
    date: Optional[str]

def record_time(data: TimeEntryRequest) -> dict:
    response = requests.post(
        'http://localhost:3001/api/time-entries/record',
        json=data
    )
    response.raise_for_status()
    return response.json()

# Usage
result = record_time({
    'email': 'user@example.com',
    'category': 'Writing New Tasks',
    'hours': 2,
    'minutes': 30,
    'count': 5
})

print(f"Entry ID: {result['entry']['id']}")
```

---

## JSON Schema

### Request Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["email", "category", "hours", "minutes"],
  "properties": {
    "email": {
      "type": "string",
      "format": "email",
      "pattern": "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
    },
    "category": {
      "type": "string",
      "enum": [
        "Writing New Tasks",
        "Updating Tasks Based on Feedback",
        "Time Spent on Instructions or Slack",
        "Platform Downtime",
        "Time Spent on QA"
      ]
    },
    "hours": {
      "type": "integer",
      "minimum": 0,
      "maximum": 23
    },
    "minutes": {
      "type": "integer",
      "minimum": 0,
      "maximum": 59
    },
    "count": {
      "type": "integer",
      "minimum": 0
    },
    "notes": {
      "type": "string",
      "maxLength": 2000
    },
    "date": {
      "type": "string",
      "format": "date",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    }
  },
  "additionalProperties": false
}
```

### Response Schema (Success)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["success", "entry"],
  "properties": {
    "success": {
      "type": "boolean",
      "const": true
    },
    "entry": {
      "type": "object",
      "required": ["id", "date", "hours", "minutes", "category"],
      "properties": {
        "id": {
          "type": "string"
        },
        "date": {
          "type": "string",
          "format": "date-time"
        },
        "hours": {
          "type": "integer",
          "minimum": 0,
          "maximum": 23
        },
        "minutes": {
          "type": "integer",
          "minimum": 0,
          "maximum": 59
        },
        "category": {
          "type": "string"
        },
        "count": {
          "type": ["integer", "null"],
          "minimum": 0
        },
        "notes": {
          "type": ["string", "null"],
          "maxLength": 2000
        }
      }
    }
  }
}
```

### Response Schema (Error)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["error"],
  "properties": {
    "error": {
      "type": "string"
    }
  }
}
```

---

## OpenAPI 3.0 Specification

```yaml
openapi: 3.0.0
info:
  title: Time Tracking API
  version: 1.0.0
  description: Browser extension time tracking endpoint (unauthenticated)

servers:
  - url: http://localhost:3001
    description: Local development
  - url: https://your-domain.com
    description: Production (requires authentication)

paths:
  /api/time-entries/record:
    post:
      summary: Record a time entry
      description: Create a new time entry for the specified user email
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - email
                - category
                - hours
                - minutes
              properties:
                email:
                  type: string
                  format: email
                  example: user@example.com
                category:
                  type: string
                  enum:
                    - Writing New Tasks
                    - Updating Tasks Based on Feedback
                    - Time Spent on Instructions or Slack
                    - Platform Downtime
                    - Time Spent on QA
                  example: Writing New Tasks
                hours:
                  type: integer
                  minimum: 0
                  maximum: 23
                  example: 2
                minutes:
                  type: integer
                  minimum: 0
                  maximum: 59
                  example: 30
                count:
                  type: integer
                  minimum: 0
                  example: 5
                notes:
                  type: string
                  maxLength: 2000
                  example: Completed morning batch
                date:
                  type: string
                  format: date
                  example: "2026-02-12"
      responses:
        '201':
          description: Time entry created successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  entry:
                    type: object
                    properties:
                      id:
                        type: string
                        example: clxy123abc456def789
                      date:
                        type: string
                        format: date-time
                      hours:
                        type: integer
                      minutes:
                        type: integer
                      category:
                        type: string
                      count:
                        type: integer
                        nullable: true
                      notes:
                        type: string
                        nullable: true
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                    example: Invalid email format
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                    example: Failed to record time entry
```

---

## Rate Limiting (Future)

⚠️ **Current Status**: No rate limiting implemented

**Planned** (when authentication is added):
- **Limit**: 100 requests per hour per user
- **Headers**:
  - `X-RateLimit-Limit: 100`
  - `X-RateLimit-Remaining: 95`
  - `X-RateLimit-Reset: 1707753600`
- **Status Code**: `429 Too Many Requests`
- **Response**: `{ "error": "Rate limit exceeded. Retry after 3600 seconds." }`
- **Header**: `Retry-After: 3600`

---

## Authentication (Future)

⚠️ **Current Status**: No authentication required (temporary)

**Planned** (before production):
```
Authorization: Bearer <api-token>
```

Example:
```bash
curl -X POST http://localhost:3001/api/time-entries/record \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tk_abc123xyz456..." \
  -d '{ ... }'
```

When authentication is implemented:
- `email` field will be removed from request (derived from token)
- `401 Unauthorized` returned for missing/invalid token

---

## Testing

### Valid Test Cases

```javascript
// Minimal valid request
{ email: "test@example.com", category: "Writing New Tasks", hours: 1, minutes: 0 }

// Full valid request
{ email: "test@example.com", category: "Writing New Tasks", hours: 2, minutes: 30, count: 5, notes: "Test", date: "2026-02-12" }

// Edge case: Maximum hours
{ email: "test@example.com", category: "Writing New Tasks", hours: 23, minutes: 59 }

// Edge case: Minimum time
{ email: "test@example.com", category: "Writing New Tasks", hours: 0, minutes: 1 }
```

### Invalid Test Cases

```javascript
// Missing required field
{ email: "test@example.com", category: "Writing New Tasks", hours: 1 } // ❌ Missing minutes

// Invalid email
{ email: "not-an-email", category: "Writing New Tasks", hours: 1, minutes: 0 } // ❌

// Hours out of range
{ email: "test@example.com", category: "Writing New Tasks", hours: 24, minutes: 0 } // ❌

// Minutes out of range
{ email: "test@example.com", category: "Writing New Tasks", hours: 1, minutes: 60 } // ❌

// Zero time
{ email: "test@example.com", category: "Writing New Tasks", hours: 0, minutes: 0 } // ❌

// Invalid category
{ email: "test@example.com", category: "Invalid", hours: 1, minutes: 0 } // ❌

// Negative count
{ email: "test@example.com", category: "Writing New Tasks", hours: 1, minutes: 0, count: -1 } // ❌

// Notes too long
{ email: "test@example.com", category: "Writing New Tasks", hours: 1, minutes: 0, notes: "x".repeat(2001) } // ❌
```

---

## Changelog

### Version 1.0.0 (2026-02-12)
- Initial data contract
- Unauthenticated endpoint
- Support for non-existent users (email-based)

### Future Versions
- v2.0.0: Add authentication (breaking change - removes email from request)
- v2.1.0: Add rate limiting
- v3.0.0: Add batch endpoint

---

## Support

For questions or issues with this API contract:
- See full documentation: [API_TIME_TRACKING.md](API_TIME_TRACKING.md)
- See security requirements: [TIME_TRACKING_SECURITY_ROADMAP.md](TIME_TRACKING_SECURITY_ROADMAP.md)
- Contact: Your system administrator

---

**Contract Version**: 1.0.0
**Status**: ⚠️ Development Only - Authentication Required for Production
