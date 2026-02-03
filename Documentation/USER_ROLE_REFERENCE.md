# User Role Reference Guide

This guide is for users with the **USER** role. It explains all the tools and features available to you in the Operations Tools application.

## Table of Contents

- [Your Role Overview](#your-role-overview)
- [Available Tools](#available-tools)
  - [Dashboard](#dashboard)
  - [Records](#records)
  - [Similarity Search](#similarity-search)
  - [Top/Bottom 10 Review](#topbottom-10-review)
  - [Likert Scoring](#likert-scoring)
  - [Top Prompts](#top-prompts)
  - [Links](#links)
  - [Bug Reporting](#bug-reporting)
- [Common Tasks](#common-tasks)
- [Getting Help](#getting-help)

---

## Your Role Overview

As a **USER**, you have access to all data analysis and review tools. Your role allows you to:

✅ **View and analyze data** across all projects
✅ **Review and score records** using alignment analysis
✅ **Search for similar content** using semantic search
✅ **Report bugs** and track their status
✅ **Access external resources** through the Links page

❌ **Cannot** ingest new data (requires Manager or Admin)
❌ **Cannot** manage projects (requires Manager or Admin)
❌ **Cannot** track time or manage bonus windows (requires Manager or Admin)
❌ **Cannot** access administrative settings (requires Admin)

---

## Available Tools

### Dashboard

**Location:** Main page after login (`/`)

**What it does:**
The Dashboard is your home base. It provides an overview of your current project's data and quick access to key features.

**Features:**
- **Project Selector**: Switch between different projects in the top navigation
- **Quick Stats**: See total records, alignment scores, and data quality at a glance
- **Recent Activity**: View recently analyzed records
- **AI Balance**: (If using OpenRouter) Monitor your AI API credit balance

**How to use it:**
1. Select a project from the dropdown in the top-left
2. Review the statistics and visualizations
3. Click on any record to view details or generate alignment scores

---

### Records

**Location:** Sidebar → Analysis → Records (`/records`)

**What it does:**
Browse, search, and analyze all records in the currently selected project. This is your primary workspace for reviewing data quality.

**Features:**
- **List View**: See all records with their quality ratings and scores
- **Search**: Find specific records by content or metadata
- **Filter**: Filter by quality rating (Top 10, Bottom 10, or All)
- **Alignment Analysis**: Generate AI-powered alignment scores for individual records
- **Expand/Collapse**: Click on records to view full content
- **Batch Operations**: View multiple records at once

**How to use it:**
1. Navigate to Records from the sidebar
2. Use filters to narrow down the data you want to review
3. Click "Generate Alignment Score" on any record to analyze it against project guidelines
4. Click the score badge to view detailed AI feedback
5. Use the search box to find specific content

**Tips:**
- Long content is automatically truncated - click to expand
- Alignment scores are color-coded: Red (poor) → Yellow (fair) → Green (excellent)
- Scores are based on the project's uploaded PDF guidelines

---

### Similarity Search

**Location:** Sidebar → Analysis → Similarity (`/similarity`)

**What it does:**
Find records that are semantically similar to a search query or reference record. This uses AI embeddings to understand meaning, not just keywords.

**Features:**
- **Semantic Search**: Finds content with similar meaning, even if words are different
- **Similarity Scores**: Shows how closely each result matches your query (0-100%)
- **Cross-Project Search**: Search across all available projects
- **Context Preservation**: Results maintain their original context and metadata

**How to use it:**
1. Enter a search query or paste example text
2. Select which project(s) to search
3. Click "Search"
4. Review results ranked by similarity percentage
5. Click on any result to view full details

**Example use cases:**
- "Find all records about customer complaints"
- "Show me content similar to this top-performing example"
- "Locate records discussing [specific topic]"

**Tips:**
- Use natural language queries for best results
- Higher percentages (90%+) indicate very close matches
- Lower percentages (60-80%) may still be relevant but less similar

---

### Top/Bottom 10 Review

**Location:** Sidebar → Analysis → Top/Bottom 10 (`/topbottom10`)

**What it does:**
Focused review interface for records categorized as "Top 10" (high quality) or "Bottom 10" (low quality) during data ingestion.

**Features:**
- **Side-by-Side Comparison**: Review top and bottom performers together
- **Quality Context**: Understand what makes high-quality vs low-quality content
- **Batch Review**: Efficiently review multiple records in one session
- **Alignment Scoring**: Generate scores for any record in the list

**How to use it:**
1. Navigate to Top/Bottom 10 from the sidebar
2. Review the split view showing both quality tiers
3. Click on records to expand and read full content
4. Generate alignment scores to validate categorization
5. Use insights to understand quality patterns

**Tips:**
- This view is ideal for training or calibration sessions
- Compare top and bottom examples to identify quality indicators
- Use alignment scores to verify that ratings match guideline expectations

---

### Likert Scoring

**Location:** Sidebar → Analysis → Likert Scoring (`/likert-scoring`)

**What it does:**
Provides a structured Likert-scale rating interface for evaluating records on multiple dimensions.

**Features:**
- **Multi-Dimensional Rating**: Score records across multiple criteria
- **Standardized Scale**: Uses consistent 1-5 or 1-7 scale
- **Progress Tracking**: See how many records you've reviewed
- **Export Results**: Download your ratings for analysis

**How to use it:**
1. Navigate to Likert Scoring from the sidebar
2. Review the rating criteria for your project
3. Read each record and assign scores based on the criteria
4. Click "Next" to move to the next record
5. Track your progress as you work through the dataset

**Rating Guidelines:**
- 1 = Strongly Disagree / Very Poor
- 2 = Disagree / Poor
- 3 = Neutral / Acceptable
- 4 = Agree / Good
- 5 = Strongly Agree / Excellent

**Tips:**
- Be consistent with your rating criteria
- Take breaks to maintain rating quality
- Review rating guidelines before starting a session

---

### Top Prompts

**Location:** Sidebar → Analysis → Top Prompts (`/top-prompts`)

**What it does:**
Analyzes and displays the highest-performing prompts or content patterns in your dataset.

**Features:**
- **Performance Ranking**: See top-performing content ranked by quality scores
- **Pattern Analysis**: Identify common characteristics of high-quality content
- **Filtering**: Filter by various criteria to find specific patterns
- **Detailed View**: Expand any prompt to see full content and metadata

**How to use it:**
1. Navigate to Top Prompts from the sidebar
2. Review the ranked list of top performers
3. Click on any prompt to view details
4. Look for common patterns or themes
5. Use insights to improve future content

**Tips:**
- Use this to identify "golden examples" for training
- Look for patterns that distinguish top performers
- Compare with Bottom 10 to understand quality differences

---

### Links

**Location:** Sidebar → Overview → Links (`/links`)

**What it does:**
Provides quick access to external resources, documentation, and tools related to your projects.

**Features:**
- **Categorized Links**: Organized by type (General, Project Guidelines, etc.)
- **Quick Access**: Jump to external resources without leaving the app
- **Documentation Hub**: Links to important project documentation
- **Resource Library**: Access training materials and guidelines

**How to use it:**
1. Navigate to Links from the sidebar
2. Browse categories to find relevant resources
3. Click any link to open in a new tab
4. Bookmark frequently used resources

**Common Links:**
- Project guideline documents
- Training materials
- External tools and dashboards
- Team communication channels

---

### Bug Reporting

**Location:** Floating button (bottom-right) + Header icon

**What it does:**
Allows you to report issues you encounter while using the application and track their resolution status.

**Features:**

#### **Submit a Bug Report**
- **Floating Button**: Purple bug icon in bottom-right corner of every page
- **Auto-Capture**: Automatically records the page URL and your browser info
- **Rich Descriptions**: Provide detailed information about the issue
- **Instant Confirmation**: Success message and toast notification

#### **Track Your Reports**
- **Header Icon**: Bug icon in top navigation bar
- **Status Updates**: See current status of all your reports
  - **Pending** (Amber): Waiting for admin review
  - **In Progress** (Blue): Being investigated
  - **Resolved** (Green): Bug has been fixed
- **Badge Counter**: Shows number of your active reports
- **Smart Filtering**: If you have >5 reports, only active ones are shown

**How to submit a bug report:**
1. Click the floating bug button (bottom-right corner)
2. A modal appears showing the current page URL
3. Describe what went wrong in detail
4. Click "Submit Report"
5. You'll see a success message and toast notification

**How to track your reports:**
1. Click the bug icon in the header
2. A dropdown shows all your submitted reports
3. View status, time submitted, and page where bug occurred
4. Click outside to close the dropdown

**Tips for good bug reports:**
- Be specific about what you were doing when the bug occurred
- Include steps to reproduce if possible
- Submit one issue per report
- Check your tracker to see when bugs are resolved

For detailed bug reporting documentation, see [BUG_REPORTS.md](./BUG_REPORTS.md).

---

## Common Tasks

### Reviewing a New Project

1. **Select Project**: Use the project selector in the top navigation
2. **Check Dashboard**: Review overall stats and data quality
3. **Browse Records**: Navigate to Records to see all data
4. **Generate Scores**: Click "Generate Alignment Score" on sample records
5. **Identify Patterns**: Use Top Prompts to find high-quality examples
6. **Search Content**: Use Similarity Search to explore related content

### Analyzing Data Quality

1. **Top/Bottom 10**: Review both quality tiers side-by-side
2. **Alignment Scores**: Generate scores to validate quality ratings
3. **Similarity Search**: Find similar content to high/low performers
4. **Likert Scoring**: Rate records on specific quality dimensions
5. **Compare Patterns**: Identify what makes content high or low quality

### Finding Specific Content

1. **Keyword Search**: Use the search box in Records view
2. **Similarity Search**: Enter a query or example text
3. **Filter by Quality**: Use Top/Bottom 10 to focus on specific tiers
4. **Cross-Project**: Search across multiple projects if needed

### Understanding Alignment Scores

1. **Click "Generate Alignment Score"** on any record
2. **Wait for AI Analysis**: Processing typically takes 5-15 seconds
3. **View Score Badge**: Color indicates quality (red/yellow/green)
4. **Read Detailed Feedback**: Click the badge to see:
   - Strengths: What the content does well
   - Weaknesses: Areas for improvement
   - Suggestions: Specific recommendations
5. **Use Insights**: Apply learnings to understand quality patterns

---

## Getting Help

### If you encounter issues:

1. **Check the User Guide**: [USER_GUIDE.md](./USER_GUIDE.md)
2. **Review Troubleshooting**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
3. **Submit a Bug Report**: Use the floating bug button
4. **Contact Your Admin**: If you need access to additional features

### Understanding Your Permissions

If you try to access a page and see "Access Denied" or get redirected:
- That feature requires Manager or Admin role
- Common restricted features:
  - Data ingestion
  - Project management
  - Time tracking
  - System administration
- Contact your administrator if you need access

### Best Practices

1. **Select Correct Project**: Always verify you have the right project selected
2. **Save Your Work**: Alignment scores are saved automatically
3. **Report Issues Early**: Use bug reporting for any problems you encounter
4. **Stay Consistent**: When doing Likert scoring, maintain consistent rating criteria
5. **Regular Reviews**: Check your bug report tracker for status updates

---

## Feature Comparison by Role

Here's what you can do compared to other roles:

| Feature | USER | MANAGER | ADMIN |
|---------|------|---------|-------|
| **View Dashboard** | ✅ | ✅ | ✅ |
| **View Records** | ✅ | ✅ | ✅ |
| **Generate Alignment Scores** | ✅ | ✅ | ✅ |
| **Similarity Search** | ✅ | ✅ | ✅ |
| **Review Tools** | ✅ | ✅ | ✅ |
| **Submit Bug Reports** | ✅ | ✅ | ✅ |
| **Track Own Bug Reports** | ✅ | ✅ | ✅ |
| **Ingest Data** | ❌ | ✅ | ✅ |
| **Manage Projects** | ❌ | ✅ | ✅ |
| **Time Tracking** | ❌ | ✅ | ✅ |
| **Bonus Windows** | ❌ | ✅ | ✅ |
| **User Management** | ❌ | ❌ | ✅ |
| **System Settings** | ❌ | ❌ | ✅ |
| **View All Bug Reports** | ❌ | ❌ | ✅ |
| **Audit Logs** | ❌ | ❌ | ✅ |

---

## Tips for Success

### Maximize Your Efficiency

1. **Learn Keyboard Shortcuts**: Use Tab, Enter, and arrow keys for navigation
2. **Use Filters**: Narrow down data before reviewing
3. **Batch Similar Tasks**: Review similar records together for consistency
4. **Take Breaks**: Quality of review decreases with fatigue
5. **Track Patterns**: Keep notes on quality indicators you discover

### Quality Review Guidelines

1. **Stay Objective**: Base scores on guidelines, not personal preference
2. **Be Consistent**: Use the same criteria throughout your review session
3. **Document Insights**: Note patterns you discover
4. **Verify Scores**: Use alignment analysis to validate your assessments
5. **Ask Questions**: Report unclear guidelines or confusing data

### Using AI Features Effectively

1. **Trust the Process**: AI analysis takes time - be patient
2. **Verify Results**: AI suggestions should be validated, not blindly followed
3. **Report Errors**: If AI scores seem wrong, report it as a bug
4. **Learn from Feedback**: Read the detailed analysis to understand quality criteria
5. **Compare Scores**: Check multiple records to understand scoring patterns

---

## Quick Reference Card

### Navigation
- **Sidebar**: Main navigation menu (left side)
- **Header**: Project selector and user menu (top)
- **Floating Button**: Bug report submission (bottom-right)

### Color Coding
- **Red/Amber**: Poor quality or pending action
- **Yellow**: Fair quality or in progress
- **Green**: Good quality or completed

### Status Indicators
- **Pending**: Awaiting review or processing
- **In Progress**: Currently being worked on
- **Completed/Resolved**: Finished successfully

### Common Actions
- **Expand Content**: Click on truncated text
- **Generate Score**: Click "Generate Alignment Score" button
- **View Details**: Click on badges or cards
- **Search**: Use search boxes in each tool
- **Filter**: Use dropdown filters to narrow results

---

## Related Documentation

- **[User Guide](./USER_GUIDE.md)** - Complete application usage guide
- **[Bug Reports](./BUG_REPORTS.md)** - Detailed bug reporting documentation
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[User Management](./USER_MANAGEMENT.md)** - Role details and permissions

---

*Last Updated: 2026-02-02*
*For updates to this documentation, contact your administrator.*
