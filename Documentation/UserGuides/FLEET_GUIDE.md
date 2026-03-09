# FLEET Role Guide

**Welcome to Operations Tools!** This guide covers all features available to users with the FLEET role.

## 🎯 Your Applications

As a FLEET team member, you have access to **four applications**:

1. **User App** - Basic features
2. **QA App** - Quality assurance tools
3. **Core App** - Scoring and review tools
4. **Fleet App** - Fleet management and operations ⭐

**Searching the sidebar:** Every app has a **Search tools...** input at the top of the sidebar. Type to instantly filter all navigation items across sections. Results show the tool name and its section. Clear the input or collapse the sidebar to return to the normal view.

**Similarity Flags badge:** A warning icon (⚠) with a count appears in the header of every app you visit. It shows the number of open similarity flags across the platform. Click it to navigate directly to the Similarity Flags dashboard in the Core App. The badge is visible on all apps for users with CORE role or higher.

## 📋 Table of Contents

### Inherited Features
1. [User, QA, and Core Features](#inherited-features)

### Fleet App Features (Your Primary Tools)
2. [Data Ingestion](#data-ingestion)
3. [Project Management](#project-management)
4. [Analytics Dashboard](#analytics-dashboard)
5. [Bonus Windows Management](#bonus-windows-management)
6. [Activity Over Time](#activity-over-time)
7. [Time Analytics](#time-analytics)
8. [Bug Reports Management](#bug-reports-management)
9. [Prompt Authenticity Checker](#prompt-authenticity-checker)
10. [Full Similarity Check](#full-similarity-check)

---

## INHERITED FEATURES

As a FLEET manager, you have full access to all lower-tier features:

### User App
✅ Time Tracking - Record your work hours
✅ Links & Resources - Access documentation
✅ Bonus Windows (View) - See performance data
✅ Profile Management - Update account settings

**See**: [USER_GUIDE.md](./USER_GUIDE.md)

### QA App
✅ Records Management - View and analyze records
✅ Similarity Search - Find related content
✅ Top/Bottom 10 Review - Quality analysis
✅ Top Prompts Analysis - Best practice identification
✅ Alignment Comparison - AI-powered guideline checks

**See**: [QA_GUIDE.md](./QA_GUIDE.md)

### Core App
✅ Likert Scoring - Rate records on dimensions
✅ Candidate Review - Evaluate submissions
✅ My Assignments - Manage assigned work
✅ Review Decisions - Make final determinations

**See**: [CORE_GUIDE.md](./CORE_GUIDE.md)

---

## FLEET APP FEATURES

> ⭐ **Your Primary Workspace**: The Fleet App is your main management hub.

## Data Ingestion

Import task and feedback data into the system from CSV files or API endpoints.

### What is Data Ingestion?

Data Ingestion is the process of loading external data (prompts, feedback, evaluations) into the Operations Tools database for analysis and quality assurance.

**Data Sources**:
- **CSV Files** - Bulk upload from spreadsheets
- **API Endpoints** - Automated data sync from external systems
- **Manual Entry** - Single-record creation (for small datasets)

### Accessing Ingestion

1. Navigate to **Fleet App**
2. Click **Ingest** in the sidebar
3. Choose ingestion method: CSV Upload or API Sync

---

### CSV Ingestion

Upload spreadsheet data in bulk.

**Preparing Your CSV**:

Required Columns (at least one):
- `content` or `feedback_content` or `prompt` - The actual text
- `task_id` or `id` - Unique identifier (prevents duplicates)

Optional Columns:
- `category` - TOP_10, BOTTOM_10, or STANDARD
- `type` - TASK or FEEDBACK
- `created_at` - Timestamp
- `created_by_name` - Creator name
- `created_by_email` - Creator email
- `metadata` - JSON string with additional data

**CSV Format Example**:
```csv
task_id,content,category,type,created_at
001,Write a function to validate email addresses,TOP_10,TASK,2026-01-15
002,Fix the bug in user authentication,BOTTOM_10,TASK,2026-01-16
003,Great explanation of the algorithm!,STANDARD,FEEDBACK,2026-01-17
```

**Upload Process**:

1. **Select Project**
   - Choose existing project from dropdown
   - Or create new project first (see Project Management)

2. **Choose File**
   - Click **"Choose File"** or drag-and-drop
   - Select your CSV file
   - File size limit: Usually 10MB

3. **Configure Options**
   - **Auto-detect Type**: Infer TASK vs FEEDBACK from content
   - **Auto-detect Category**: Classify as TOP_10/BOTTOM_10 from keywords
   - **Skip Duplicates**: Ignore records with existing task_id
   - **Vectorize After Upload**: Generate AI embeddings (recommended)

4. **Review Preview**
   - System shows first 10 rows
   - Verify columns mapped correctly
   - Check for format errors

5. **Start Ingestion**
   - Click **"Start Ingestion"**
   - Job begins processing
   - Progress bar shows real-time status

**Monitoring Progress**:

The ingestion job has two phases:

**Phase 1: Data Loading (Fast)**
- Inserts records into database
- Validates data format
- Checks for duplicates
- Status: PROCESSING → QUEUED_FOR_VEC
- Duration: Seconds to minutes

**Phase 2: Vectorization (Slow)**
- Generates AI embeddings for semantic search
- Batches of 25 records
- Requires AI service (LM Studio or OpenRouter)
- Status: VECTORIZING → COMPLETED
- Duration: Minutes to hours (depending on volume)

**Progress Indicators**:
- **Records Processed**: 847 / 1,000
- **Percentage**: 84.7%
- **Estimated Time Remaining**: 8 minutes
- **Current Status**: VECTORIZING
- **Errors**: 3 (view details)

**Handling Errors**:
- Click **"View Errors"** to see skipped records
- Common errors:
  - Duplicate task_id (already exists)
  - Missing required fields (no content)
  - Invalid format (malformed JSON metadata)
  - Keyword mismatch (doesn't match project criteria)

**Post-Ingestion**:
- Records immediately available in QA App
- Vectorization continues in background
- Similarity search works after vectorization completes
- Job status shown in Ingestion History

> **Local development only**: The Ingestion page shows two additional amber buttons when running outside production:
> - **Trigger Pending Ingestion Jobs** — manually kicks off Phase 1 (data loading) for all jobs currently in `PENDING` status. Useful when the DB webhook trigger is not configured locally.
> - **Trigger Queued Vectorization Jobs** — manually kicks off Phase 2 (vectorization) for all jobs in `QUEUED_FOR_VEC` status. Useful when the AI server is running but Phase 2 has not started.
>
> These buttons are hidden in production and are only visible in the development environment.

---

### API Ingestion

Automate data sync from external systems via REST API.

**Use Cases**:
- Real-time data feed from production system
- Scheduled imports from data warehouse
- Integration with third-party tools
- Continuous data collection

**Setup Process**:

1. **Configure API Endpoint**
   - Navigate to Fleet App → Ingest → API
   - Enter source API URL
   - Add authentication (API key, OAuth, etc.)
   - Test connection

2. **Map Fields**
   - System fetches sample data
   - Map API fields to Operations Tools fields:
     - `api.prompt_text` → `content`
     - `api.unique_id` → `task_id`
     - `api.quality_flag` → `category`

3. **Set Schedule**
   - Manual trigger only
   - Hourly sync
   - Daily at specific time
   - Custom cron expression

4. **Enable Sync**
   - Save configuration
   - Enable the sync job
   - Monitor first run for errors

**Monitoring API Sync**:
- View sync history and status
- Check success/failure rates
- Review error logs
- Adjust configuration as needed

---

### Ingestion Best Practices

**Data Quality**:
- ✅ Include unique task_id for deduplication
- ✅ Provide created_at timestamps
- ✅ Use consistent category naming
- ✅ Validate CSV format before upload

**Performance**:
- ✅ Upload during off-hours for large files
- ✅ Split very large files (>100k records)
- ✅ Enable vectorization in separate job if urgent
- ❌ Don't upload while other jobs running

**Error Prevention**:
- ✅ Test with small sample first (100 rows)
- ✅ Review preview before starting job
- ✅ Keep source data as backup
- ❌ Don't modify files during upload

---

## Project Management

Create and manage projects that organize records, guidelines, and team members.

### What are Projects?

Projects are organizational containers for related work:
- Group related tasks/feedback together
- Associate with specific guidelines (PDF)
- Track project-specific metrics
- Manage access and permissions

### Accessing Project Management

1. Navigate to Fleet App → **Projects**
2. See list of all projects
3. Click project name to manage

### Creating a Project

1. Click **"+ New Project"**
2. Fill in project details:
   - **Name**: Clear, descriptive name (e.g., "Q1 2026 Content Review")
   - **Description**: Purpose and scope
   - **Guidelines PDF**: Upload project guidelines document
   - **Status**: ACTIVE, ARCHIVED, or PLANNING
3. Click **"Create Project"**

### Guidelines PDF

**Purpose**: Guidelines are used for alignment analysis (AI comparison).

**Requirements**:
- PDF format only
- Extractable text (not scanned images)
- Clear, structured content
- Under 20 pages recommended

**What to Include**:
- Quality criteria
- Dos and don'ts
- Examples of good/bad work
- Style guide
- Requirements and constraints

**Uploading Guidelines**:
1. Edit project
2. Click **"Upload Guidelines"** or drag-and-drop
3. Wait for upload (file stored as base64)
4. Guidelines immediately available for alignment analysis

### Managing Projects

**Edit Project**:
1. Click project name
2. Click **"Edit"** button
3. Update any field
4. Click **"Save Changes"**

**Archive Project**:
- Change status to ARCHIVED
- Project hidden from active lists
- Data preserved, but no new records accepted
- Can be reactivated later

**Delete Project**:
⚠️ **Warning**: Deletes all associated records permanently!
1. Click **"Delete"** button
2. Confirm by typing project name
3. All records, scores, and analyses deleted
4. Cannot be undone

### Project Statistics

**Dashboard Shows**:
- Total records in project
- Records by type (TASK vs FEEDBACK)
- Records by category (TOP_10, BOTTOM_10, STANDARD)
- Ingestion jobs (active, completed, failed)
- Recent activity
- Average alignment scores (if analyzed)

### Project Team (if applicable)

Some projects may have team assignment features:
- Add/remove team members
- Assign roles (reviewer, scorer, manager)
- Set permissions (view, edit, manage)

---

## Analytics Dashboard

View comprehensive analytics and insights across all projects and data.

### Accessing Analytics

Navigate to Fleet App → **Analytics** (or Dashboard)

### Dashboard Sections

**Overview Panel**:
- Total records across all projects
- Records by type (pie chart)
- Records by category (bar chart)
- Recent ingestion jobs
- System health indicators

**Project Performance**:
- List of all projects
- Records per project
- Completion rates
- Quality scores
- Trend indicators (↑ improving, ↓ declining)

**Quality Metrics**:
- Average alignment scores
- Distribution of scores (histogram)
- Top-performing projects
- Projects needing attention

**Ingestion Activity**:
- Jobs in progress
- Recent completions
- Error rates
- Vectorization backlog

**Time-Based Trends**:
- Records created over time (line chart)
- Busiest days/weeks
- Seasonal patterns
- Growth rate

### Custom Reports

**Creating Reports**:
1. Click **"Custom Report"**
2. Select metrics to include
3. Choose date range
4. Filter by project, type, category
5. Generate report
6. Export to PDF or CSV

**Saved Reports**:
- Save frequently used report configs
- Schedule automatic generation
- Share with stakeholders
- Set up email delivery

### Exporting Data

**Export Options**:
1. **CSV Export**: Raw data for Excel/Sheets
2. **PDF Report**: Formatted report with charts
3. **JSON Export**: Structured data for developers

**What to Export**:
- All records (or filtered subset)
- Scores and ratings
- Alignment analyses
- Project statistics
- User activity logs

---

## Bonus Windows Management

Create and manage time-bounded performance tracking periods for team bonuses.

### What are Bonus Windows?

Bonus Windows are defined time periods where team performance is tracked against specific targets. If targets are met, teams receive bonuses.

**Structure**:
- Start Date & End Date
- Target metrics (quality score, volume, etc.)
- Team/individual tracking
- Optional two-tier targets (good/excellent)

### Accessing Bonus Windows

Navigate to Fleet App → **Bonus Windows**

### Creating a Bonus Window

1. Click **"+ New Bonus Window"**
2. Fill in details:

**Basic Information**:
- **Name**: Descriptive name (e.g., "Q1 2026 Quality Bonus")
- **Description**: What qualifies for bonus
- **Start Date**: When tracking begins
- **End Date**: When tracking ends

**Targets**:
- **Primary Target**: Minimum goal to achieve bonus
- **Stretch Target** (optional): Higher goal for larger bonus
- **Metric**: What's being measured (quality score, volume, etc.)

**Participants**:
- **All Users**: Everyone qualifies
- **Specific Team**: Select team/group
- **Individuals**: Select specific users

3. Click **"Create Window"**

### Managing Bonus Windows

**Edit Window**:
- Update dates (if not started yet)
- Modify targets (carefully - affects fairness)
- Change description
- Add/remove participants

**Close Window**:
1. Window automatically closes at end date
2. Or manually close early: Click **"Close Window"**
3. Final calculations are performed
4. Results are frozen (cannot be changed)

**View Results**:
- See which users/teams met targets
- View individual contributions
- Export results for payroll
- Generate reports for management

### Tracking Progress

**Active Windows Show**:
- Days remaining
- Current performance vs. target
- Progress bar (visual indicator)
- Individual breakdowns (if tracked)

**User View**:
- Users can view their own progress
- See what they need to achieve bonus
- Track daily/weekly improvement
- Understand bonus criteria

### Best Practices

**Setting Targets**:
- Base on historical data
- Make achievable but challenging
- Communicate clearly to team
- Review and adjust quarterly

**Communication**:
- Announce window start/end dates
- Explain bonus criteria clearly
- Provide regular updates on progress
- Celebrate when targets are met

**Fairness**:
- Apply same criteria to all participants
- Don't change targets mid-window
- Handle edge cases consistently
- Document any adjustments and reasons

---

## Activity Over Time

Visualize data creation trends with interactive line charts showing daily activity patterns.

### What is Activity Over Time?

Interactive visualization showing how many tasks and feedback records are created each day, helping identify trends, patterns, and anomalies.

### Accessing Activity Over Time

Navigate to Fleet App → **Activity Over Time**

### Using the Visualization

**Date Range Selection**:
1. Choose date range:
   - Last 7 days
   - Last 30 days
   - Last 90 days
   - Custom range (select start/end dates)
2. Chart updates automatically

**Interactive Chart**:
- **Line Chart**: Shows daily counts over time
- **Two Lines**: Blue for tasks, green for feedback
- **Hover**: Mouse over data points for exact counts
- **Legend**: Click to show/hide lines
- **Zoom**: Drag to zoom into specific period (if supported)

**Data Points Show**:
- Date
- Task count for that day
- Feedback count for that day
- Total (tasks + feedback)

### Interpreting Trends

**Look For**:
- **Spikes**: Unusual high activity (bulk uploads? deadline crunch?)
- **Drops**: Unexpectedly low activity (holidays? system downtime?)
- **Patterns**: Weekly cycles (e.g., more activity Mon-Wed)
- **Growth**: Increasing trend over time
- **Decline**: Decreasing trend (concern?)

**Common Patterns**:
- **Monday spike**: Week kickoff, high activity
- **Friday drop**: End of week, lower activity
- **Month-end surge**: Deadline-driven work
- **Seasonal variation**: Busy/slow periods

### Taking Action

**Based on Trends**:
- Schedule ingestion during low-activity periods
- Plan maintenance during predictable drops
- Allocate resources for anticipated spikes
- Investigate unexplained anomalies

**Reporting**:
- Export chart image for presentations
- Share insights with management
- Track growth metrics over quarters
- Justify resource allocation

---

## Time Analytics

Advanced time tracking analytics for team performance and resource planning (Under Construction).

### What is Time Analytics?

Deep dive into time tracking data with advanced metrics and visualizations.

**Planned Features**:
- Time spent per project
- Utilization rates per team member
- Billable vs. non-billable time
- Efficiency metrics
- Forecasting and capacity planning

### Current Status

⚠️ **Under Construction**: This feature is being developed.

Check back for updates or contact your administrator for timeline.

---

## Bug Reports Management

View, triage, and manage bug reports submitted by users across all applications.

### Accessing Bug Reports

Navigate to Fleet App → **Bug Reports**

### Bug Report Dashboard

**View Modes**:
- **Unassigned**: New reports needing triage
- **Assigned**: Reports with owners
- **In Progress**: Being actively worked
- **Resolved**: Fixed and closed
- **All**: Complete list

**Report Cards Show**:
- Title and description
- Reporter name
- Date submitted
- Priority level (if assigned)
- Status
- Assigned developer (if any)

### Triaging Bug Reports

**Review Process**:
1. Read report carefully
2. Determine severity:
   - **Critical**: System down, data loss, security issue
   - **High**: Major feature broken, many users affected
   - **Medium**: Feature partially broken, workaround exists
   - **Low**: Minor issue, cosmetic, edge case
3. Assign priority
4. Assign to developer or team

**Setting Priority**:
1. Click report
2. Select priority level
3. Add notes explaining priority
4. Save

**Assigning Reports**:
1. Click report
2. Select assignee from dropdown
3. Assignee receives notification
4. Report moves to Assigned queue

### Updating Status

**Status Flow**:
1. **New** → Report just submitted
2. **Triaged** → Reviewed and prioritized
3. **Assigned** → Developer assigned
4. **In Progress** → Being actively fixed
5. **Resolved** → Fix deployed
6. **Closed** → Verified fixed, no further action

**Changing Status**:
1. Open report
2. Select new status
3. Add comment explaining change
4. Reporter is notified

### Communicating with Reporters

**Add Comments**:
1. Open report
2. Scroll to comments section
3. Write comment:
   - Ask clarifying questions
   - Provide updates
   - Explain resolution
   - Thank for reporting
4. Submit comment
5. Reporter receives notification

**Requesting More Information**:
- Ask for screenshots
- Request steps to reproduce
- Clarify expected vs. actual behavior
- Inquire about environment/browser

### Closing Reports

**When to Close**:
- Bug is fixed and deployed
- Issue cannot be reproduced
- Working as intended (not a bug)
- Duplicate of existing report
- Won't fix (explain why)

**Closing Process**:
1. Verify fix is deployed
2. Add final comment explaining resolution
3. Change status to Resolved or Closed
4. Thank reporter for contribution

### Bug Report Metrics

**Track**:
- Total reports submitted
- Open vs. closed reports
- Average time to resolution
- Reports by priority
- Most common issue types
- Top reporters (most helpful users)

**Reporting**:
- Export metrics to CSV
- Create weekly/monthly summaries
- Share with development team
- Identify systemic issues

---

## FLEET Role Workflow

### Daily Routine

**Morning** (1-2 hours):
1. Check Analytics Dashboard for overnight activity
2. Review bug reports - triage new submissions
3. Monitor active ingestion jobs
4. Check bonus window progress
5. Review time analytics (once available)

**Midday** (3-4 hours):
- Start any needed data ingestions
- Manage project updates and guidelines
- Review and respond to bug reports
- Update bonus window progress
- Use QA/Core tools for quality checks
- Handle escalations from team

**Afternoon** (2-3 hours):
- Complete CORE assignments (scoring, reviews)
- Analyze Activity Over Time trends
- Plan future ingestions and projects
- Communicate with stakeholders
- Update team on metrics and progress

**End of Day**:
- Log time in Time Tracking
- Check all jobs completed successfully
- Review tomorrow's priorities
- Send status updates if needed

### Weekly Tasks

- Create new projects as needed
- Upload/update project guidelines
- Run bulk data ingestions
- Generate analytics reports
- Review and close bug reports
- Update bonus window targets
- Conduct team calibration sessions
- Report metrics to management

### Monthly Tasks

- Analyze trends and patterns
- Create/close bonus windows
- Archive completed projects
- Review team performance
- Update guidelines based on learnings
- Plan next month's ingestions
- Conduct retrospectives
- Budget and resource planning

---

## Tips for FLEET Success

### Project Management

1. **Keep guidelines updated** - Review quarterly
2. **Consistent naming** - Use clear project names
3. **Archive old projects** - Keep active list clean
4. **Document decisions** - Note why projects were created/changed

### Data Management

1. **Test ingestions** - Always test with small sample first
2. **Schedule wisely** - Run large jobs during off-hours
3. **Monitor progress** - Check jobs don't stall
4. **Clean data** - Validate before upload

### Team Management

1. **Communicate clearly** - Explain bonus criteria upfront
2. **Set realistic targets** - Base on data, not wishes
3. **Be transparent** - Share metrics regularly
4. **Celebrate wins** - Recognize when targets met

### Analytics

1. **Review daily** - Stay on top of trends
2. **Act on insights** - Don't just observe, improve
3. **Share reports** - Keep stakeholders informed
4. **Track over time** - Compare periods, identify patterns

---

## Troubleshooting

### "Ingestion job stuck at 99%"

**Possible Causes**:
- Vectorization job hit AI rate limit
- AI service disconnected
- Last few records have errors

**Solutions**:
1. Check AI service status (Admin → AI Settings)
2. Review job errors (click "View Errors")
3. Cancel and restart if stuck >1 hour
4. Contact admin if OpenRouter balance depleted

### "Cannot upload guidelines PDF"

**Solutions**:
- Check file is actually PDF format
- Verify file size under 20MB
- Ensure PDF has extractable text (not scanned image)
- Try re-saving PDF from source

### "Bonus window not showing progress"

**Solutions**:
- Verify window start date has passed
- Check participants are correctly assigned
- Ensure metrics are being tracked
- Refresh page or browser cache

### "Activity chart shows no data"

**Solutions**:
- Verify date range includes data
- Check project has records
- Try different time range
- Clear browser cache

---

## Prompt Authenticity Checker

Analyze prompts to detect non-native speaker patterns, AI-generated content, and templated/formulaic writing — on a per-prompt and per-user basis.

**Access**: Fleet App → Prompt Authenticity Checker (FLEET/ADMIN roles only)

---

### Overview

The tool has four tabs:

| Tab | Purpose |
|-----|---------|
| **Import** | Load prompts into the analysis queue |
| **Analyze** | Run AI analysis jobs over queued prompts |
| **Results** | Browse and filter individual prompt analysis results |
| **Patterns** | Per-user aggregated stats and cross-prompt template analysis |

---

### Import Tab

Two modes for adding prompts to the analysis queue:

#### CSV Import
Upload a CSV file with columns: `version_id`, `task_key`, `prompt`, `version_no`, `is_active`, `created_by_name`, `created_by_email`, `created_at`. Duplicate records (matching `version_id`) are automatically skipped.

#### From Database
Pull records directly from the `data_records` table — no CSV needed.

**Filter options**:
- **Environment** — restrict to a specific environment (dropdown auto-populates on page load)
- **Record Type** — Tasks only, Feedback only, or All types
- **Start / End Date** — filter by record creation date
- **Limit** — cap the number of records synced (useful for testing)
- **Filter by User** — restrict to records from a specific user (partial name or email match)

Use **Preview Count** to see how many records match before committing. Click **Sync to Queue** to import them. Already-queued records are automatically skipped.

---

### Analyze Tab

Start a background analysis job that processes queued prompts using AI.

**Configuration**:
- **Date Range** (optional) — restrict which queued prompts get analyzed based on when they were created
- **Record Limit** (optional) — cap how many prompts to process (useful for testing)

Jobs can be paused, resumed, and cancelled. Live progress is displayed (analyzed / total, cost, flagged counts). Job history is shown below the active job panel.

---

### Results Tab

Browse all analyzed prompts with filter and search controls.

**Stat cards** (top of page):
- Total Analyzed
- Non-Native flagged count
- AI-Generated flagged count
- Templated flagged count

**Filters**:
- Search by author name or email
- Filter dropdown: All Results, Completed, Flagged (Any), Non-Native Only, AI-Generated Only, Templated Only

**Table columns**: Author, Email, Prompt (click to expand), Non-Native %, AI Generated %, Templated %, Details

Click **Details** on any row to expand the full analysis: indicators for each detection category, detected template pattern (if any), and the overall assessment.

Use **Export to CSV** to download the current filtered view.

---

### Patterns Tab

Per-user breakdown of analysis results across all their prompts.

**Filters**:
- **Environment** — scope stats to a single environment
- **Min Prompts** — hide users with fewer than N analyzed prompts (default: 2)

Click **Load Users** to populate the table. Columns show each user's total prompts analyzed and the count + percentage flagged for Non-Native, AI-Generated, and Templated patterns.

**Actions per user**:

| Button | What it does |
|--------|-------------|
| **View Prompts** | Opens a modal showing that user's analyzed prompts (latest version per task only), with environment badge, template confidence badge, and detected template pattern. Filter to "Templated Only" to focus review. |
| **Expand** | Shows any previously run cross-prompt AI analysis inline |
| **Cross-Prompt AI** | Sends up to 20 of the user's prompts as a group to the AI for deeper template pattern detection — returns an inferred template, evidence, and confidence score |
| **Deep Dive** | Opens the Task Creator Deep-Dive page (in the Core app) for that user, pre-scoped to the current environment filter. |

---

### Detection Categories

| Category | What it detects |
|----------|----------------|
| **Non-Native** | Grammar patterns, phrasing, word choice suggesting non-native English speaker |
| **AI-Generated** | Structural markers, vocabulary, and style consistent with AI-written text |
| **Templated** | A shared structural skeleton repeated across multiple prompts by the same user in the same environment — detected by comparing all of a user's prompts together, not by inspecting any single prompt in isolation |

Each category produces a **confidence score (0–100%)** and a list of specific indicators.

---

### Tips

- Run **From Database** sync first, then start an **Analyze** job — no CSV export needed.
- Use **Preview Count** before syncing large date ranges to avoid queueing more than needed.
- The **Patterns tab** environment filter loads automatically — no need to visit Import first.
- **Cross-Prompt AI** analysis is on-demand and incurs an AI cost (shown after completion).
- The **View Prompts** modal deduplicates by task — only the most recent version of each prompt is shown.

---

## Full Similarity Check

Detect duplicate and near-duplicate tasks across environments using vector embeddings and cosine similarity.

**Access**: FLEET or ADMIN role required. Navigate to **Fleet App → Full Similarity Check** (`/full-similarity-check`).

### What is the Full Similarity Check?

The Full Similarity Check lets you browse all vectorized tasks in the database, select one or more, and compare them against the rest of the dataset using their AI-generated embeddings. It is designed for auditing prompt quality and flagging submitted work that is suspiciously similar to other tasks.

### Browsing Tasks

The main page displays all tasks that have been vectorized (i.e., have an embedding). Tasks are paginated — 25 per page.

**Filters available**:

| Filter | Description |
|--------|-------------|
| **Environment** | Scope the list to a single environment |
| **User** | Show only tasks submitted by a specific name or email |
| **Latest versions only** | When enabled, shows only the highest-versioned task per unique `task_key`, deduplicating re-submitted versions (off by default) |

Use the **Previous / Next** page controls (or First / Last) to navigate large datasets.

### Comparing Tasks

1. Tick the checkbox on one or more task rows.
2. Click **Compare Selected**.
3. The results panel shows each selected task alongside its most similar matches, sorted by similarity (highest first).

**Comparison options (set before comparing)**:

| Option | Description |
|--------|-------------|
| **Scope** | `Same environment` — only compares within the same environment. `All environments` — compares across the entire dataset. |
| **Latest versions only** | When on, the comparison pool is also deduplicated to the highest version per task key, preventing older versions from inflating match counts. |
| **Threshold** | Minimum cosine similarity percentage to include in results (default 50%). Raise to 70–80% to focus on near-duplicates. |

> **Duplicate detection**: Tasks with identical content are automatically excluded from match results regardless of their ID. This prevents re-ingested records from showing as 100% matches.

### Similarity Score

Scores are expressed as a percentage (0–100%):

| Range | Interpretation |
|-------|---------------|
| 90–100% | Near-identical — almost certainly a duplicate or copy |
| 70–89% | Highly similar — strong candidate for review |
| 50–69% | Moderately similar — worth investigating if many workers hit this range |
| < 50% | Not shown (below default threshold) |

### Viewing a Side-by-Side Comparison

Click **View** on a match row to open the side-by-side panel. This shows:
- Full content of both tasks
- Metadata (environment, created by, date)
- Similarity score
- **AI Analysis** (generated automatically): key similarities, key differences, duplicate assessment, and overall evaluation using the configured AI provider (LM Studio or OpenRouter). OpenRouter costs are shown after the analysis completes.

### Tips

- Enable **Latest versions only** when your dataset contains re-submitted task versions — without it, version 2 and version 3 of the same task may appear as high-similarity matches.
- Use a threshold of **80%+** to find likely copy-paste submissions; drop to **60%** for template detection.
- The comparison pool is capped at 2000 records for performance — use the environment scope when working with large datasets to keep results focused.
- Tasks without embeddings are excluded from both the browse list and the comparison pool. Run vectorization first if records are missing.

---

## Advanced Topics

### Bulk Operations

**Mass Actions**:
- Archive multiple projects at once
- Bulk close bug reports
- Export multiple project reports
- Batch update project settings

### API Access (if available)

Some installations may provide API access for:
- Automated ingestion
- Programmatic project creation
- Metrics extraction
- Integration with other tools

Contact admin for API documentation and keys.

### Custom Integrations

Work with developers to create:
- Automated data pipelines
- Custom analytics dashboards
- Notification integrations (Slack, email)
- Report automation

---

## Need Admin Access?

FLEET is a high-level management role, but ADMIN role provides:
- User management (create/edit/delete users)
- System configuration
- AI settings management
- Audit logs
- Advanced permissions

Contact your administrator or IT if you need admin access.

---

## Support & Resources

**Technical Issues**: Bug reporting (you can also view and manage all bug reports!)
**Questions**: Ask your manager or admin
**Training**: Request FLEET training for new features
**Documentation**: See USER_GUIDE.md, QA_GUIDE.md, and CORE_GUIDE.md for inherited features

---

**Document Version**: 1.1
**Last Updated**: March 2026
**Role**: FLEET
**Access Level**: User App + QA App + Core App + Fleet App (Full Access)
