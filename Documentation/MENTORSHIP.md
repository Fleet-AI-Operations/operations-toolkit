# Mentorship Program

Developer and administrator guide for the Mentorship Program feature in the Fleet app.

## Table of Contents
- [Overview](#overview)
- [Data Model](#data-model)
- [Pages](#pages)
- [API Reference](#api-reference)
- [Database Migrations](#database-migrations)
- [Key Design Decisions](#key-design-decisions)
- [Related Documentation](#related-documentation)

---

## Overview

The Mentorship Program allows FLEET managers to organise QA workers into **pods** — each pod has one CORE or FLEET leader and multiple QA members. The dashboard tracks each member's **positive feedback rate** over a rolling 7-day window using data from `QAFeedbackRating`.

**Access**: FLEET, MANAGER, or ADMIN role required.

---

## Data Model

### `mentorship_pods`

| Column           | Type        | Notes                                   |
|------------------|-------------|------------------------------------------|
| `id`             | `text`      | CUID primary key (`gen_random_uuid()`)  |
| `name`           | `text`      | Pod display name                        |
| `core_leader_id` | `uuid`      | FK → `public.profiles.id` (RESTRICT)   |
| `created_at`     | `timestamptz` |                                        |
| `updated_at`     | `timestamptz` |                                        |

### `mentorship_pod_members`

| Column      | Type        | Notes                                          |
|-------------|-------------|------------------------------------------------|
| `id`        | `text`      | CUID primary key                               |
| `pod_id`    | `text`      | FK → `mentorship_pods.id` (CASCADE DELETE)    |
| `qa_email`  | `text`      | Email of the QA worker (not a profiles FK)    |
| `qa_name`   | `text?`     | Display name, nullable                         |
| `joined_at` | `timestamptz` |                                              |

**Unique constraint**: `(pod_id, qa_email)` — a QA worker can only be in a pod once.

> **Important**: QA workers are ingested via CSV and have no platform accounts. Pod membership is stored by `qa_email` directly (not a `user_id` FK), matching how `QAFeedbackRating` identifies workers.

---

## Pages

### Mentorship Dashboard (`/mentorship-dashboard`)

Displays all pods with:
- Core leader name and email
- Each QA member's positive feedback rate for the past 7 days
- Pod-level aggregate positive rate
- Summary stats: total pods, total members, pods with activity

### Pod Configuration (`/mentorship-config`)

CRUD interface for managing pods:
- **Create pod**: Name + CORE/FLEET leader selection
- **Edit pod**: Rename or change leader
- **Delete pod**: Cascades to all members
- **Add members**: Multi-select from QA workers with feedback records; searchable by name or email
- **Remove members**: Remove individual members from a pod

---

## API Reference

All endpoints require FLEET, MANAGER, or ADMIN role. Returns 401 if unauthenticated, 403 if role is insufficient.

### `GET /api/mentorship/pods`

Returns all pods with their core leader and members.

**Response**:
```json
{
  "pods": [
    {
      "id": "pod-1",
      "name": "Pod Alpha",
      "coreLeader": { "id": "...", "email": "...", "firstName": "...", "lastName": "..." },
      "members": [{ "id": "...", "qaEmail": "...", "qaName": "...", "joinedAt": "..." }]
    }
  ]
}
```

### `POST /api/mentorship/pods`

Creates a new pod.

**Body**: `{ "name": "Pod Alpha", "coreLeaderId": "<profile-uuid>" }`

**Response**: `201 { "pod": { ... } }`

**Errors**:
- `400` — name or coreLeaderId missing
- `404` — coreLeaderId does not match a profile

### `PATCH /api/mentorship/pods/[id]`

Updates a pod's name and/or core leader.

**Body**: `{ "name"?: "New Name", "coreLeaderId"?: "<uuid>" }`

**Errors**:
- `404` — pod not found
- `404` — new coreLeaderId not found

### `DELETE /api/mentorship/pods/[id]`

Deletes a pod. Member rows are cascade-deleted by the database.

**Response**: `{ "success": true }`

### `POST /api/mentorship/pods/[id]/members`

Adds QA members to a pod. Duplicate emails (same pod) are silently skipped.

**Body**:
```json
{
  "members": [
    { "qaEmail": "qa@example.com", "qaName": "QA Worker" }
  ]
}
```

**Response**: `201 { "added": <actual_inserted_count> }`

**Notes**:
- `qaEmail` is required and must be a non-empty string
- Emails are normalised to lowercase before storage
- `qaName` is optional; stored as `null` if omitted

### `DELETE /api/mentorship/pods/[id]/members/[memberId]`

Removes a member by their `MentorshipPodMember` row ID (not email). The route verifies that the membership belongs to the specified pod to prevent cross-pod deletion.

**Response**: `{ "success": true }`

### `GET /api/mentorship/dashboard`

Returns pods with per-member and per-pod positive feedback rates over the past 7 days.

**Response**:
```json
{
  "pods": [
    {
      "id": "pod-1",
      "name": "Pod Alpha",
      "coreLeader": { ... },
      "members": [
        {
          "id": "...",
          "email": "qa@example.com",
          "name": "QA Worker",
          "totalRatings": 10,
          "positiveRatings": 8,
          "positiveFeedbackRate": 80
        }
      ],
      "podPositiveRate": 80
    }
  ],
  "windowDays": 7,
  "asOf": "2026-03-10T12:00:00.000Z"
}
```

**Notes**:
- `positiveFeedbackRate` and `podPositiveRate` are `null` when there are no ratings in the window
- Rates are rounded percentages (0–100)
- The 7-day window is `RATING_WINDOW_DAYS` in the route (configurable at the top of the file)

### `GET /api/mentorship/users`

Returns users for picker components in the config UI.

**Query params**:

| Param | Values | Purpose |
|-------|--------|---------|
| `source` | `feedback_records` | Returns distinct QA worker emails from `data_records WHERE type='FEEDBACK'` |
| `minRole` | role name (default: `QA`) | Minimum role for profile-based query |
| `maxRole` | role name (default: `ADMIN`) | Maximum role for profile-based query |

**`source=feedback_records` response** (for QA member picker):
```json
{ "users": [{ "email": "qa@example.com", "name": "QA Worker" }] }
```

**Default role-based response** (for leader picker, e.g. `minRole=CORE&maxRole=FLEET`):
```json
{ "users": [{ "id": "...", "email": "...", "firstName": "...", "lastName": "...", "role": "CORE" }] }
```

---

## Audit Logging

All mutating pod operations produce audit log entries (visible in Admin → Audit Logs). Audit calls are fire-and-forget — a failure does not block the API response.

| Action | Triggered by | Entity type | Key metadata |
|--------|-------------|-------------|--------------|
| `POD_CREATED` | `POST /api/mentorship/pods` | `MENTORSHIP_POD` | `name`, `coreLeaderId` |
| `POD_UPDATED` | `PATCH /api/mentorship/pods/[id]` | `MENTORSHIP_POD` | changed fields only |
| `POD_DELETED` | `DELETE /api/mentorship/pods/[id]` | `MENTORSHIP_POD` | `name` |
| `POD_MEMBERS_ADDED` | `POST /api/mentorship/pods/[id]/members` | `MENTORSHIP_POD` | `added` count, `emails` array |
| `POD_MEMBER_REMOVED` | `DELETE /api/mentorship/pods/[id]/members/[memberId]` | `MENTORSHIP_POD` | `memberId`, `qaEmail` |

---

## Database Migrations

| File | Purpose |
|------|---------|
| `supabase/migrations/20260310100000_mentorship_pods.sql` | Creates `mentorship_pods` and `mentorship_pod_members` tables |
| `supabase/migrations/20260310110000_mentorship_pods_email_members.sql` | Drops `user_id` FK column, adds `qa_email TEXT` and `qa_name TEXT` |
| `supabase/migrations/20260311000000_enable_rls_on_unprotected_tables.sql` | Enables RLS on `mentorship_pods` and `mentorship_pod_members` (and `_duplicates_to_delete`, `worker_flags`) |

Apply locally:
```bash
npm run dev:reset   # Resets DB and re-runs all migrations
npm run postinstall # Regenerates Prisma Client
```

---

## Key Design Decisions

### QA workers are identified by email, not user ID

QA workers are ingested from CSV files and have no platform accounts (no rows in `public.profiles`). Pod membership uses `qa_email TEXT` directly, mirroring how `QAFeedbackRating` identifies workers. This means:
- No FK constraint from `mentorship_pod_members` to `profiles`
- The `source=feedback_records` endpoint queries `data_records` directly to build the member picker
- Emails are normalised to lowercase on write to avoid case-sensitivity mismatches

### Pod leaders must have CORE or FLEET role

The leader picker queries `profiles` with `minRole=CORE&maxRole=FLEET` using numeric role weights. Leaders must have a platform account.

### Bulk member insertion with `skipDuplicates`

`createMany` with `skipDuplicates: true` is used to handle re-adding members gracefully. The `added` response field reflects `result.count` (actual inserts), not the size of the input array.

---

## Related Documentation

- [Fleet Guide](./UserGuides/FLEET_GUIDE.md)
- [QA Feedback Analysis](./QA_FEEDBACK_ANALYSIS.md)
- [Database Schema](./Reference/DATABASE_SCHEMA.md)
- [Testing Guide](./TESTING.md)

---

*Last Updated: 2026-03-11*
