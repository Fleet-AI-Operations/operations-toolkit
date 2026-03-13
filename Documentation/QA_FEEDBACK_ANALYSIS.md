# QA Feedback Analysis

## Overview

The QA Feedback Analysis feature provides comprehensive performance analytics for QA workers based on feedback ratings from an external rating system. It enables Fleet and Admin users to identify quality issues, track worker performance, and provide targeted coaching.

**Access:** FLEET and ADMIN roles only

**Location:** Fleet App → QA Feedback Analysis (`/qa-feedback-analysis`)

---

## Features

### 1. Main Analytics Dashboard

**URL:** `/qa-feedback-analysis`

**Purpose:** Provides an overview of all QA workers with performance metrics.

**Key Metrics:**
- Total ratings per worker
- Negative rating percentage
- Negative-per-feedback ratio (indicates how often rated feedbacks are negative)
- Dispute counts
- Total feedbacks written

**Features:**
- **Date Range Filtering:** Quick selects (7, 30, 90 days, All Time) or custom date range. Defaults to last 7 days on page load.
- **Environment Filtering:** Filter by specific environment (e.g., Production, Staging)
- **Minimum Negative % Filter:** Show only workers above a certain negative threshold
- **Search:** Search by QA name or email
- **Sorting:** Click column headers to sort by any metric
- **Pagination:** 25 workers per page

**UI Elements:**
- Summary statistics cards (Total Workers, Average Negative %, High Risk Count, Total Disputes)
- Searchable and sortable data table
- Expandable rows showing environment breakdown per worker

### 2. Worker Details Page

**URL:** `/qa-feedback-analysis/worker/[email]`

**Purpose:** Detailed performance analysis for a specific QA worker.

**Sections:**

#### Summary Statistics (Horizontal Cards)
- Total Ratings (with progress bar showing positive/negative split)
- Negative Percentage (color-coded: green <15%, orange 15-25%, red >25%)
- Total Feedbacks (with negative-per-feedback ratio)

#### Environment Breakdown
- Performance breakdown by environment
- Shows total ratings, negative %, and counts per environment
- Sorted by total ratings (descending)

#### Timeline
- Monthly trend of negative rating percentage
- Shows rating volume per month
- Helps identify performance trends over time

#### Rated Tasks List
- All tasks where this worker's feedback was rated
- Filter tabs: All, Positive, Negative, Disputed
- Each task card shows:
  - Task content preview
  - Environment
  - Creation date
  - Rating badge (Positive/Negative/Disputed)
  - Rater information
- Click any task to view full task history

### 3. Task History Modal

**Purpose:** Shows complete context for a specific task, including related tasks and all feedbacks.

**Sections:**

#### Task Details
- Full task content (extracted from `metadata.task_prompt` for untruncated content)
- Environment
- Creation date
- Author (worker email/name)

#### Related Tasks from Same Worker
- Other tasks by the same worker within 7 days
- Helps identify patterns in worker behavior
- Shows environment and date for each task

#### All Feedbacks
- Every feedback given for this task (linked via `task_key` in metadata)
- Shows:
  - Full feedback content (from `metadata.feedback_content`)
  - QA worker who gave the feedback
  - Feedback creation date
  - Rating status (Helpful/Not Helpful/Disputed) if rated
  - Rater information

**Interaction:**
- Opens as a centered overlay modal
- Click outside or press X to close
- Nested on top of worker details page (z-index: 2000)

---

## Data Model

### Database Tables

#### `qa_feedback_ratings`
Stores rating data imported from external CSV.

**Key Fields:**
- `rating_id` (unique): External rating identifier
- `feedback_id`: Links to feedback record
- `eval_task_id`: Foreign key to `data_records.id` (nullable until linked)
- `is_helpful`: Boolean (true = positive, false = negative)
- `is_dispute`: Boolean (marks disputed ratings)
- `qa_email` / `qa_name`: QA worker who wrote the feedback
- `rater_email` / `rater_name`: Person who rated the feedback
- `rated_at`: Timestamp of rating

**Indexes:**
- `qa_email` (worker queries)
- `is_helpful` (positive/negative filtering)
- `rated_at DESC` (date range queries)
- `eval_task_id` (task linkage)
- Composite: `(qa_email, rated_at DESC)` (worker timeline queries)

**RLS Policies:**
- SELECT: FLEET and ADMIN
- INSERT/UPDATE: ADMIN only

#### Relationship to `data_records`
- `qa_feedback_ratings.eval_task_id` → `data_records.id` (one-to-many)
- Links ratings to tasks for context and filtering
- Established via admin linking tool or automatic matching by `metadata.rating_id`

---

## CSV Import System

### Import Page

**URL:** `/qa-feedback-import` (ADMIN only recommended, though currently FLEET can access)

**Process:**
1. Select CSV file with feedback ratings data
2. Upload and validate
3. System performs upsert (creates new or updates existing by `rating_id`)
4. Shows progress and summary report

**Expected CSV Format:**

Required columns:
- `rating_id` - Unique rating identifier
- `feedback_id` - Feedback identifier
- `is_helpful` - Boolean or 0/1 (positive/negative)
- `rated_at` - Timestamp (ISO 8601 or parseable format)
- `rater_email` - Email of person who rated
- `qa_email` - Email of QA worker who wrote feedback

Optional columns:
- `eval_task_id` - Task ID (if known)
- `is_dispute`, `dispute_status`, `dispute_reason` - Dispute tracking
- `qa_name`, `rater_name` - Names for display
- `resolved_by_name`, `resolved_at`, `resolution_reason` - Dispute resolution

**Validation:**
- Checks for required fields
- Validates date formats
- Validates boolean values
- Skips duplicate `rating_id` (or updates if already exists)

**Import Limits:**
- Batch size: 500 records per transaction
- Sequential processing (not optimized for very large files)

---

## API Endpoints

### Main Analytics
**GET** `/api/qa-feedback-analysis`

**Query Parameters:**
- `startDate` (YYYY-MM-DD): Start of date range
- `endDate` (YYYY-MM-DD): End of date range
- `environment` (string): Filter by environment name
- `minNegativePercent` (number): Minimum negative % threshold

**Response:**
```json
{
  "workers": [
    {
      "qaEmail": "qa@example.com",
      "qaName": "QA Worker",
      "totalRatings": 100,
      "positiveRatings": 75,
      "negativeRatings": 25,
      "negativePercent": 25.0,
      "disputes": 3,
      "totalFeedbacks": 120,
      "negativePerFeedbackRatio": 0.208
    }
  ],
  "dateRange": { "start": "2026-01-01", "end": "2026-12-31" },
  "filters": { "environment": "Production", "minNegativePercent": 20 }
}
```

**Authorization:** FLEET or ADMIN

**Performance Optimizations:**
- Batched feedback count query (groupBy to avoid N+1)
- Environment filtering at database level
- Indexed queries on qa_email, is_helpful, rated_at

---

### Worker Details
**GET** `/api/qa-feedback-analysis/worker-details`

**Query Parameters:**
- `qaEmail` (required): QA worker email
- `startDate`, `endDate`, `environment`: Same as main endpoint

**Response:**
```json
{
  "worker": { /* WorkerSummary */ },
  "ratingsByEnvironment": [
    {
      "environment": "Production",
      "totalRatings": 50,
      "positiveRatings": 35,
      "negativeRatings": 15,
      "negativePercent": 30.0
    }
  ],
  "ratingsByMonth": [
    {
      "month": "2026-01",
      "totalRatings": 25,
      "positiveRatings": 18,
      "negativeRatings": 7,
      "negativePercent": 28.0
    }
  ],
  "tasks": [
    {
      "taskId": "task-123",
      "taskContent": "Task content preview...",
      "taskEnvironment": "Production",
      "taskCreatedAt": "2026-01-15T10:30:00Z",
      "ratingId": "rating-456",
      "isHelpful": false,
      "isDispute": false,
      "ratedAt": "2026-01-16T14:20:00Z",
      "raterEmail": "rater@example.com"
    }
  ]
}
```

**Authorization:** FLEET or ADMIN

---

### Task History
**GET** `/api/qa-feedback-analysis/task-history`

**Query Parameters:**
- `taskId` (required): Task ID to fetch history for

**Response:**
```json
{
  "task": {
    "id": "task-123",
    "content": "Full task prompt from metadata.task_prompt",
    "environment": "Production",
    "createdAt": "2026-01-15T10:30:00Z",
    "createdByEmail": "worker@example.com",
    "createdByName": "Worker Name",
    "metadata": { /* full metadata object */ }
  },
  "relatedTasks": [
    {
      "id": "task-124",
      "content": "Another task preview...",
      "environment": "Production",
      "createdAt": "2026-01-14T09:15:00Z"
    }
  ],
  "allFeedbacks": [
    {
      "feedbackId": "fb-789",
      "feedbackContent": "Full feedback from metadata.feedback_content",
      "feedbackCreatedAt": "2026-01-16T11:00:00Z",
      "qaEmail": "qa@example.com",
      "qaName": "QA Worker",
      "ratingId": "rating-456",
      "isHelpful": false,
      "isDispute": false,
      "ratedAt": "2026-01-17T08:30:00Z",
      "raterEmail": "rater@example.com"
    }
  ]
}
```

**Performance Optimizations:**
- Prisma JSON filtering for feedback lookups (avoids full table scan)
- Batched rating queries (findMany with IN clause)
- Efficient related task query (7-day window, limited to 10)

**Authorization:** FLEET or ADMIN

---

### CSV Import
**POST** `/api/qa-feedback-import`

**Request Body:** FormData with CSV file

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalRows": 1500,
    "imported": 1450,
    "updated": 30,
    "skipped": 20,
    "errors": ["Row 15: Invalid date format", ...]
  }
}
```

**Authorization:** ADMIN only (recommended)

**Process:**
1. Parse CSV rows
2. Validate required fields
3. Check if task exists (by task_id in metadata)
4. Upsert rating record (by rating_id)
5. Return summary with counts and error details

---

## Admin Tools

### Link Ratings to Tasks
**URL:** `/qa-feedback-analysis/link-tasks` (ADMIN only)

**Purpose:** Links existing ratings to tasks by matching `rating.ratingId` to `task.metadata.rating_id`.

**Use Case:** When ratings are imported before tasks, or when `eval_task_id` is null.

**Process:**
1. Fetches all ratings with `eval_task_id = null`
2. Builds lookup map of tasks by `metadata.rating_id`
3. Updates ratings with matching task IDs
4. Shows progress and summary

**Performance:** Optimized to fetch all tasks once, then use in-memory lookup (O(n) instead of O(n²)).

**Button Location:** Link Tasks page (accessible via sidebar or direct URL)

---

## Common Use Cases

### 1. Identify High-Risk QA Workers
**Goal:** Find QA workers with excessive negative feedback.

**Steps:**
1. Go to QA Feedback Analysis
2. Set "Min Negative %" filter to 25%
3. Review workers in the table
4. Click "View Details" for workers of concern
5. Review environment breakdown and timeline to identify patterns

### 2. Investigate a Specific Worker's Performance
**Goal:** Understand why a worker is receiving negative ratings.

**Steps:**
1. Go to QA Feedback Analysis
2. Search for worker by name or email
3. Click "View Details"
4. Review:
   - Environment breakdown (is it specific to one environment?)
   - Timeline (is it a recent trend or ongoing?)
   - Rated tasks (click tasks to see full context)
5. Open task history modal to see:
   - Full task content
   - All feedbacks given for that task
   - Related tasks from the same worker

### 3. Analyze Feedback Quality for a Task
**Goal:** Understand all QA feedback for a specific task.

**Steps:**
1. Go to worker details page
2. Find the task in the Rated Tasks list
3. Click the task card to open Task History modal
4. Review:
   - Full task content
   - All feedbacks written for this task
   - Rating status for each feedback

### 4. Track Performance Trends Over Time
**Goal:** See if a worker's performance is improving or declining.

**Steps:**
1. Go to worker details page
2. Review the Timeline section
3. Look for trends in monthly negative %
4. Compare with Environment Breakdown to see if issues are environment-specific

---

## Troubleshooting

### No Data Showing

**Possible Causes:**
1. No ratings imported yet → Import CSV via the Admin app at `/admin/qa-feedback-import`
2. Ratings not linked to tasks → Use Link Tasks tool at `/qa-feedback-analysis/link-tasks`
3. Date range filter too narrow → Try "All Time" filter
4. Environment filter excluding all data → Clear filters

### Truncated Task Content

**Issue:** Task content ends mid-sentence (e.g., "...wishli")

**Cause:** Source CSV has truncated `task_prompt` at 500 characters.

**Solution:** Re-export CSV from source system with full content in `task_prompt` column, then re-import tasks.

### Environment Shows "N/A"

**Cause:** Task metadata doesn't have `scenario_title`, `env_key`, or `environment_name`.

**Solution:** Check source data and ensure environment is included in one of those fields.

### Feedbacks Not Appearing in Task History

**Cause:** Feedbacks not linked to task via `task_key` in metadata.

**Solution:** Ensure feedbacks and tasks have matching `task_key` in their metadata JSON.

---

## Performance Considerations

### Optimizations Implemented
- **Indexed database queries:** All filters use indexed columns
- **Batched queries:** Feedback counts, rating lookups use single batch queries
- **JSON filtering:** Prisma JSON path filtering pushes metadata queries to database
- **Pagination:** Large result sets paginated (25 per page)
- **Lookup maps:** In-memory maps for linking operations (O(n) instead of O(n²))

### Expected Performance
- Dashboard load: <2 seconds for 200 workers
- Worker details: <1 second
- Task history: <1 second
- Link ratings tool: ~1-2 minutes for 1000 ratings (one-time operation)

### Scaling Recommendations
- For >1000 workers: Add server-side pagination to main endpoint
- For >10,000 ratings per worker: Add pagination to task list in worker details
- For >100,000 total ratings: Consider archiving old ratings or separate analytics database

---

## Testing

### Unit Tests
**Location:** `apps/fleet/src/app/api/qa-feedback-analysis/__tests__/`

**Coverage:**
- Authorization checks (401/403)
- Query parameter validation
- Worker stats calculation
- Date range filtering
- Negative percentage math
- Sorting logic

**Run Tests:**
```bash
pnpm turbo run test --filter=@repo/fleet-app
```

### E2E Tests
**Location:** `e2e/qa-feedback-analysis.spec.ts`

**Coverage:**
- Dashboard loads for FLEET/ADMIN
- Forbidden for USER role
- Date range filtering
- Worker search
- Navigation to worker details
- Task history modal interaction
- CSV import page access

**Run Tests:**
```bash
npm run test:e2e
```

---

## Future Enhancements

**Not Currently Implemented:**
- Email notifications for high negative rates
- Trend forecasting and alerts
- Worker comparison views
- Export to CSV functionality
- Admin notes on worker profiles
- Dispute resolution workflow integration
- MANAGER role access (currently excluded)
- Real-time updates (currently requires page refresh)

---

## Technical Notes

### Content Extraction Hierarchy
1. **Task Content:** `metadata.task_prompt` → `content` (fallback)
2. **Feedback Content:** `metadata.feedback_content` → `content` (fallback)
3. **Environment:** `metadata.scenario_title` → `metadata.env_key` → `metadata.environment_name` → null

### Related Tasks Logic
- Searches for tasks by same worker (`createdByEmail`)
- Within ±7 days of original task
- Excludes the current task
- Sorted by creation date (descending)
- Limited to 10 results

### Feedback Linking Logic
- Feedbacks linked to tasks via `metadata.task_key`
- Ratings linked to feedbacks via `feedback_id` or `metadata.feedback_key`
- Ratings linked to tasks via `eval_task_id` (foreign key)

---

## Security

### Authorization
- All endpoints require authentication (Supabase Auth)
- Role-based access: FLEET and ADMIN only
- Diagnostics endpoint also requires FLEET/ADMIN

### Data Privacy
- PII (emails) logged only in error scenarios
- No sensitive data exposed in error messages (uses ERROR_IDs)
- RLS policies restrict data access at database level

### Input Validation
- Date formats validated
- Required parameters checked
- SQL injection prevented via Prisma (parameterized queries)
- CSV file type validated

---

## Migration and Deployment

### Database Migration
**File:** `supabase/migrations/20260224000000_create_qa_feedback_ratings.sql`

**Includes:**
- Table creation
- Indexes
- RLS policies
- Foreign key constraint to data_records

**Apply Migration:**
```bash
npm run dev:reset
```

### Prisma Schema Updates
**File:** `packages/database/prisma/schema.prisma`

**Changes:**
- Added `QAFeedbackRating` model
- Added relation to `DataRecord`

**Regenerate Client:**
```bash
npm run postinstall
```

### Deployment Checklist
1. ✅ Run database migration
2. ✅ Regenerate Prisma client
3. ✅ Import initial CSV data
4. ✅ Run link ratings tool (if needed)
5. ✅ Verify RLS policies
6. ✅ Test with FLEET and ADMIN users
7. ✅ Run E2E tests

---

## Support and Maintenance

### Logs and Monitoring
- Server-side errors logged with `ERROR_IDS` constants
- Import process logs progress to console
- Link ratings tool shows real-time progress

### Common Maintenance Tasks
- **Import new ratings:** Use CSV import page monthly/weekly
- **Link new ratings:** Run link tool after importing if needed
- **Archive old data:** No automatic archival (manual SQL if needed)

### Error IDs
- `AUTH_UNAUTHORIZED` (401)
- `AUTH_FORBIDDEN` (403)
- `INVALID_INPUT` (400)
- `INVALID_DATE_FORMAT` (400)
- `DB_QUERY_FAILED` (500)
- `SYSTEM_ERROR` (500)

---

## Changelog

**v1.0.0 (2026-02-23)**
- Initial release
- Main analytics dashboard
- Worker details with environment/timeline breakdowns
- Task history modal
- CSV import system
- Link ratings admin tool
- API endpoints with performance optimizations
- E2E and unit tests
- Documentation

**v1.1.0 (2026-03-13)** — FLEOTK-38
- Default date range changed from 30 days to 7 days
- Removed Import CSV button and modal from main dashboard (import is handled via the Admin app)
- Improved filter button visibility: active quick-range button uses accent colour, inactive buttons have higher-contrast border/background, Clear Filters uses red tinting consistent with other pages
