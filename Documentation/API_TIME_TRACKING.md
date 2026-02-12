# Time Tracking API - Browser Extension Integration

## ⚠️ CRITICAL SECURITY WARNING ⚠️

**THIS ENDPOINT IS INTENTIONALLY UNAUTHENTICATED AND IS ONLY FOR TEMPORARY USE**

This API endpoint has **NO AUTHENTICATION** and poses significant security risks:

- ❌ Anyone can submit time entries for any email address
- ❌ No rate limiting (vulnerable to spam/abuse)
- ❌ No identity verification
- ❌ Potential for data manipulation and false entries
- ❌ Not suitable for production use in current state

### Required Before Production Deployment:

✅ **MUST IMPLEMENT** before deploying to production:
1. **API Token Authentication** - Generate and validate tokens
2. **Rate Limiting** - Prevent abuse (e.g., 100 requests per hour per token/IP)
3. **Request Validation** - Enhanced validation and abuse detection
4. **Audit Logging** - Log all submissions with IP addresses
5. **CORS Restrictions** - Limit to authorized domains
6. **Email Verification** - Optionally verify email ownership
7. **API Key Rotation** - Implement key expiration and rotation

### Current Status: MVP / Development Only

This implementation is designed for:
- ✅ Local development and testing
- ✅ Internal tools with trusted users
- ✅ MVP / proof-of-concept
- ❌ **NOT for production public use**

---

## Overview

This document describes the public API endpoint for recording time entries from browser extensions or external tools. This endpoint does not require authentication and is designed for easy integration during development.

### How It Works for Non-Existent Users

- **Time entries can be recorded for users who don't exist yet** in the system
- The entry is stored with the user's email address for later linking
- When a user account is eventually created with that email, all their past time entries will be automatically associated with their account
- This allows time tracking to begin before user onboarding is complete

## Endpoint

```
POST /api/time-entries/record
```

**Base URL**:
- Local Development: `http://localhost:3001`
- Production: Your deployed user app URL

## Request Format

### Headers
```
Content-Type: application/json
```

### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | ✅ Yes | User's email address (doesn't need to exist in system yet) |
| `category` | string | ✅ Yes | Activity category (see valid categories below) |
| `hours` | number | ✅ Yes | Hours spent (0-23) |
| `minutes` | number | ✅ Yes | Minutes spent (0-59) |
| `count` | number | ❌ No | Optional task count for tracking productivity |
| `notes` | string | ❌ No | Optional notes (max 2000 characters) |
| `date` | string | ❌ No | Optional date (YYYY-MM-DD format, defaults to today) |

### Valid Categories

- `"Writing New Tasks"`
- `"Updating Tasks Based on Feedback"`
- `"Time Spent on Instructions or Slack"`
- `"Platform Downtime"`
- `"Time Spent on QA"`

## Example Requests

### Minimal Request (Required fields only)

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

### Full Request (All fields)

```bash
curl -X POST http://localhost:3001/api/time-entries/record \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "category": "Writing New Tasks",
    "hours": 2,
    "minutes": 30,
    "count": 5,
    "notes": "Completed 5 new task prompts for Project X",
    "date": "2026-02-12"
  }'
```

### JavaScript/TypeScript Example

```typescript
async function recordTimeEntry(data: {
  email: string;
  category: string;
  hours: number;
  minutes: number;
  count?: number;
  notes?: string;
  date?: string;
}) {
  const response = await fetch('http://localhost:3001/api/time-entries/record', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return await response.json();
}

// Usage
try {
  const result = await recordTimeEntry({
    email: 'user@example.com',
    category: 'Writing New Tasks',
    hours: 1,
    minutes: 30,
    count: 3,
    notes: 'Completed morning session'
  });

  console.log('Time entry recorded:', result.entry);
} catch (error) {
  console.error('Failed to record time:', error.message);
}
```

## Response Format

### Success Response (201 Created)

```json
{
  "success": true,
  "entry": {
    "id": "clxy123abc...",
    "date": "2026-02-12T00:00:00.000Z",
    "hours": 2,
    "minutes": 30,
    "category": "Writing New Tasks",
    "count": 5,
    "notes": "Completed 5 new task prompts"
  }
}
```

### Error Responses

#### 400 Bad Request - Missing Fields
```json
{
  "error": "Missing required fields: email, category, hours, minutes"
}
```

#### 400 Bad Request - Invalid Email
```json
{
  "error": "Invalid email format"
}
```


#### 400 Bad Request - Invalid Hours
```json
{
  "error": "Hours must be an integer between 0 and 23"
}
```

#### 400 Bad Request - Invalid Minutes
```json
{
  "error": "Minutes must be an integer between 0 and 59"
}
```

#### 400 Bad Request - Zero Time
```json
{
  "error": "Time cannot be 0h 0m. Please enter at least 1 minute."
}
```

#### 400 Bad Request - Invalid Category
```json
{
  "error": "Invalid category. Must be one of: Writing New Tasks, Updating Tasks Based on Feedback, Time Spent on Instructions or Slack, Platform Downtime, Time Spent on QA"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Failed to record time entry"
}
```

## Validation Rules

1. **Email**: Must be valid email format (user doesn't need to exist in system yet)
2. **Category**: Must be one of the valid categories listed above
3. **Hours**: Integer between 0-23
4. **Minutes**: Integer between 0-59
5. **Time**: Cannot be 0h 0m (must be at least 1 minute)
6. **Count**: If provided, must be a positive integer (≥ 0)
7. **Notes**: If provided, must be ≤ 2000 characters
8. **Date**: If provided, must be in YYYY-MM-DD format (defaults to today)

## Browser Extension Implementation Tips

### 1. Store User Email

Store the user's email in extension storage for easy access:

```javascript
// Store email (one-time setup)
chrome.storage.sync.set({ userEmail: 'user@example.com' });

// Retrieve email when recording time
chrome.storage.sync.get(['userEmail'], (result) => {
  const email = result.userEmail;
  // Use email in API request
});
```

### 2. Handle Errors Gracefully

```javascript
try {
  const response = await fetch(API_URL, { /* ... */ });
  const data = await response.json();

  if (response.ok) {
    // Success - show confirmation
    showNotification('Time recorded successfully!');
  } else {
    // Error - show error message
    showNotification(`Error: ${data.error}`, 'error');
  }
} catch (error) {
  showNotification('Network error: Could not connect to server', 'error');
}
```

### 3. Category Selection

Provide a dropdown or button group for category selection:

```javascript
const categories = [
  'Writing New Tasks',
  'Updating Tasks Based on Feedback',
  'Time Spent on Instructions or Slack',
  'Platform Downtime',
  'Time Spent on QA'
];
```

### 4. Time Input Validation

Validate time input before sending:

```javascript
function validateTimeEntry(hours, minutes) {
  if (hours < 0 || hours > 23) {
    throw new Error('Hours must be between 0 and 23');
  }
  if (minutes < 0 || minutes > 59) {
    throw new Error('Minutes must be between 0 and 59');
  }
  if (hours === 0 && minutes === 0) {
    throw new Error('Time must be at least 1 minute');
  }
}
```

## Rate Limiting

Currently, there is no rate limiting on this endpoint. However, please be respectful:
- Do not spam the endpoint with excessive requests
- Batch multiple time entries if possible
- Implement reasonable delays between requests

## Future Enhancements - Authentication Implementation

### Planned Authentication Architecture

**Phase 1: API Token Authentication (Required for Production)**

1. **Token Generation Endpoint**
   ```
   POST /api/auth/tokens/generate
   Authorization: Bearer <user-jwt>

   Response:
   {
     "token": "tk_abc123...",
     "expiresAt": "2026-03-12T00:00:00Z"
   }
   ```

2. **Token Usage**
   ```
   POST /api/time-entries/record
   Authorization: Bearer tk_abc123...

   {
     "category": "Writing New Tasks",
     "hours": 2,
     "minutes": 30
   }
   ```
   - Email will be derived from token (no need to send in request)
   - Token validates user identity
   - Each token is specific to one user

3. **Token Storage**
   ```sql
   CREATE TABLE api_tokens (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id),
     token_hash TEXT NOT NULL,  -- Hashed for security
     name TEXT,  -- User-friendly name (e.g., "Chrome Extension")
     expires_at TIMESTAMPTZ,
     last_used_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

**Phase 2: Rate Limiting**
- Implement rate limiting middleware (e.g., 100 requests per hour per token)
- Use Redis or in-memory cache for tracking
- Return `429 Too Many Requests` when limit exceeded

**Phase 3: Additional Security**
- CORS restrictions to authorized domains
- IP address logging for audit trail
- Token rotation/expiration
- Suspicious activity detection

### Example Future Request (With Authentication)

```javascript
// User generates token in settings
const token = 'tk_abc123...';

// Browser extension stores token
chrome.storage.sync.set({ apiToken: token });

// Use token in requests
fetch('http://localhost:3001/api/time-entries/record', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,  // ← Authentication!
  },
  body: JSON.stringify({
    // email NOT needed - derived from token
    category: 'Writing New Tasks',
    hours: 2,
    minutes: 30
  })
});
```

### Migration Path

When authentication is implemented:

1. **Create token management UI** in user settings
2. **Add token validation middleware** to /record endpoint
3. **Deprecation period**: Support both authenticated and unauthenticated for 30 days
4. **Remove unauthenticated access** completely
5. **Update browser extension** to use tokens

### Other Planned Features

- ✅ Batch creation of multiple time entries
- ✅ Real-time validation of user permissions
- ✅ Webhook notifications for time entry creation
- ✅ Enhanced analytics and reporting

## Support

For questions or issues with the API, please contact your system administrator or file an issue in the project repository.
