# QA Role Guide

**Welcome to Operations Tools!** This guide covers all features available to users with the QA role.

## 🎯 Your Applications

As a QA team member, you have access to **two applications**:

1. **User App** - Basic features shared with all users
2. **QA App** - Quality assurance and analysis tools ⭐

## 📋 Table of Contents

### User App Features (Inherited)
1. [Time Tracking](#time-tracking)
2. [Links & Resources](#links--resources)
3. [Profile Management](#profile-management)

### QA App Features (Your Primary Tools)
5. [Records Management](#records-management)
6. [Similarity Search](#similarity-search)
7. [Top/Bottom 10 Review](#topbottom-10-review)
8. [Top Prompts Analysis](#top-prompts-analysis)
9. [Alignment Comparison](#alignment-comparison)

---

## USER APP FEATURES

> 💡 **Tip**: You inherit all USER role features. These are available in the User App.

### Time Tracking

Record your work hours for accurate tracking and reporting.

**Quick Actions**:
- Navigate to User App → **Time Tracking**
- Click **"+ New Entry"** to record time
- View your time history and export to CSV

**Fields**:
- Date, Hours, Project, Description

For detailed instructions, see the [USER_GUIDE.md](./USER_GUIDE.md#time-tracking).

### Links & Resources

Access external documentation and tools.

- Navigate to User App → **Links**
- Browse categorized resources
- Click links to open in new tabs

### Profile Management

Manage your account settings.

- Click profile icon → **Profile**
- Change password
- Update preferences
- Logout securely

---

## QA APP FEATURES

> ⭐ **Your Primary Workspace**: The QA App contains your main quality assurance tools.

## Records Management

View, search, and analyze task and feedback records across all projects.

### Accessing Records

1. Navigate to **QA App**
2. Click **Records** in the sidebar
3. You'll see the Records Management dashboard

### Understanding Records

**Record Types**:
- **TASK** - Prompts or instructions submitted to AI
- **FEEDBACK** - Responses or feedback on AI outputs

**Record Categories**:
- **TOP_10** - High-quality examples
- **BOTTOM_10** - Low-quality examples requiring review
- **STANDARD** - Regular records

**Record Metadata**:
- Created date and time
- Creator information
- Project association
- Quality ratings (if scored)
- Alignment analysis (if generated)

### Browsing Records

**Default View**:
- Most recent records displayed first
- Pagination for large datasets
- Quick filters at the top

**Filter Options**:
1. **By Project**: Select specific project from dropdown
2. **By Type**: TASK or FEEDBACK
3. **By Category**: TOP_10, BOTTOM_10, STANDARD, or ALL
4. **By Date Range**: Custom start/end dates

**Applying Filters**:
1. Select your filter criteria
2. Click **"Apply Filters"**
3. Results update automatically
4. Clear filters with **"Reset"** button

### Searching Records

**Text Search**:
1. Use the search box at the top
2. Enter keywords from record content
3. Press Enter or click **"Search"**
4. Results show matching records with highlights

**Search Tips**:
- Use quotes for exact phrases: `"error handling"`
- Multiple words search for all terms
- Search is case-insensitive
- Searches content, not metadata

### Viewing Record Details

1. Click any record in the list
2. **Detail Panel** opens showing:
   - Full content text
   - Metadata (creator, date, project)
   - Quality scores (if available)
   - Alignment analysis (if generated)
   - Similar records (if vectorized)

### Sorting Records

Click column headers to sort:
- **Date**: Newest/oldest first
- **Type**: TASK → FEEDBACK alphabetically
- **Category**: Grouped by category
- **Project**: Alphabetically by project name

### Exporting Records

1. Apply filters to select records you want
2. Click **"Export to CSV"**
3. Choose fields to include:
   - Content
   - Metadata
   - Scores
   - Analysis
4. File downloads automatically

**Export Uses**:
- External analysis in Excel/Google Sheets
- Reporting to management
- Backup of critical records
- Sharing with stakeholders

### Pagination

**Navigation**:
- **Previous** / **Next** buttons
- Page number display: "Page 3 of 47"
- Jump to specific page (if available)
- Records per page: Usually 50

**Performance Tip**: Use filters to reduce dataset size for faster loading.

---

## Similarity Search

Find records similar to a given text using AI-powered semantic search.

### What is Similarity Search?

Similarity search uses AI embeddings to find records with similar **meaning**, not just matching keywords. For example, searching "handle errors gracefully" will find records about error handling, exception management, and fault tolerance - even if they don't use those exact words.

### Using Similarity Search

1. Navigate to QA App → **Similarity Search**
2. Enter your search query in the text box:
   - Can be a full prompt
   - Can be a short phrase
   - Can be keywords
3. Select **Project** (optional - leave blank to search all projects)
4. Set **Number of Results** (default: 20)
5. Click **"Search"**

### Understanding Results

**Result Display**:
- Records ranked by similarity score (0.0 to 1.0)
- **Higher score** = More similar
- Similarity score shown as percentage (e.g., "87% similar")

**Result Card Shows**:
- Record content (truncated)
- Similarity score with visual indicator
- Record type and category
- Project name
- Created date

**Interpreting Scores**:
- **90-100%**: Extremely similar, near-duplicates
- **75-89%**: Highly similar, same concept
- **60-74%**: Moderately similar, related topics
- **Below 60%**: Somewhat similar, weak connection

### Use Cases

**Find Duplicates**:
- Search for existing record content
- High similarity scores (>90%) indicate duplicates
- Helps prevent redundant entries

**Discover Patterns**:
- Search for a concept
- Find all records discussing similar ideas
- Identify common themes across projects

**Quality Control**:
- Search for problematic patterns
- Find all records with similar issues
- Bulk review related records

**Research**:
- Explore how specific topics are handled
- Compare approaches across projects
- Learn from high-quality examples

### Advanced Tips

**Query Crafting**:
- ✅ Use natural language: "How do I handle authentication?"
- ✅ Be specific: "React component state management"
- ❌ Don't use single words: "auth" (too vague)
- ❌ Don't use boolean operators: "AND", "OR" (not supported)

**Filtering Results**:
- Search within specific project for focused results
- Increase result count to cast wider net
- Lower result count for high-precision matches

**Performance**:
- Similarity search requires vectorized records
- Only records with embeddings are searchable
- New records need vectorization (happens automatically)

---

## Top/Bottom 10 Review

Review and analyze the highest and lowest quality records for quality assurance.

### What are Top/Bottom 10?

Projects often identify their best (TOP_10) and worst (BOTTOM_10) examples:
- **TOP_10**: Exemplary records to learn from and replicate
- **BOTTOM_10**: Problematic records requiring review and improvement

### Accessing Top/Bottom 10

1. Navigate to QA App → **Top/Bottom 10**
2. Select **Project** from dropdown
3. Choose **Type**: TASK or FEEDBACK
4. View categorized records

### Reviewing Top 10 Records

**Purpose**: Understand what makes records high-quality.

**Review Process**:
1. Read each TOP_10 record carefully
2. Identify quality indicators:
   - Clear, specific content
   - Proper structure
   - Appropriate detail level
   - Follows guidelines
3. Take notes on patterns
4. Use as templates for future work

**Analysis Questions**:
- What makes this example excellent?
- What patterns appear across all TOP_10 records?
- How can we replicate this quality?
- What guidelines are being followed?

### Reviewing Bottom 10 Records

**Purpose**: Identify and understand quality issues.

**Review Process**:
1. Read each BOTTOM_10 record
2. Identify quality issues:
   - Unclear or vague content
   - Missing information
   - Incorrect structure
   - Guideline violations
3. Document patterns
4. Recommend improvements

**Analysis Questions**:
- What specific issues exist?
- Are problems consistent across records?
- What guidelines were violated?
- How can these be improved?
- What training is needed?

### Taking Action

**Document Findings**:
- Create summary reports
- List common issues
- Identify training needs
- Recommend guideline updates

**Provide Feedback**:
- Share insights with your team
- Create training materials
- Update project guidelines
- Mentor team members

**Escalate Concerns**:
- Report systemic issues to management
- Request guideline clarification
- Suggest process improvements

### Comparative Analysis

**Side-by-Side Review**:
1. Open a TOP_10 and BOTTOM_10 record
2. Compare structure and content
3. Identify specific differences
4. Document "do's and don'ts"

**Pattern Recognition**:
- Look for recurring quality indicators
- Identify common mistakes
- Create checklists for creators
- Build quality criteria

---

## Top Prompts Analysis

Analyze the most frequently used or highest-scoring prompts to identify trends and best practices.

### What is Top Prompts?

Top Prompts shows you the most important or successful prompts in a project, ranked by:
- Usage frequency
- Quality scores
- Performance metrics
- Community ratings

### Accessing Top Prompts

1. Navigate to QA App → **Top Prompts**
2. Select **Project**
3. Choose ranking criteria:
   - Most Used
   - Highest Rated
   - Best Performing
4. Set number of results (default: 50)

### Understanding the Dashboard

**Ranking Display**:
- Prompts listed in order (1, 2, 3...)
- Rank badge shows position
- Metric value displayed (usage count, score, etc.)

**Prompt Cards Show**:
- Prompt content (preview)
- Ranking metric (why it's "top")
- Usage statistics
- Quality indicators
- Project association
- Created date

**Metrics Explained**:
- **Usage Count**: How many times the prompt was used
- **Quality Score**: Average rating or score
- **Success Rate**: Percentage of successful outcomes
- **Trend**: Increasing/decreasing popularity

### Analysis Views

**Overview Tab**:
- High-level summary
- Top 10 quick view
- Key metrics and trends
- Notable patterns

**Detailed Tab**:
- Full list of top prompts
- Expandable detail panels
- Metadata and statistics
- Related prompts

**Trends Tab** (if available):
- Changes over time
- Emerging patterns
- Declining prompts
- Seasonal variations

### Use Cases

**Identify Best Practices**:
- Study top-performing prompts
- Extract success patterns
- Create prompt templates
- Train team on effective techniques

**Quality Improvement**:
- Compare successful vs. unsuccessful prompts
- Identify what works
- Eliminate ineffective patterns
- Standardize high-quality approaches

**Training Material**:
- Use top prompts as examples
- Create "hall of fame" showcase
- Build prompt libraries
- Onboard new team members

**Trend Monitoring**:
- Track changes in prompt usage
- Identify emerging needs
- Spot declining effectiveness
- Adapt to project evolution

### Taking Action

**Document Patterns**:
- Extract common elements from top prompts
- Create prompt guidelines
- Build reusable templates
- Share with team

**Improve Quality**:
- Apply top prompt patterns to new work
- Retire ineffective approaches
- Update team training
- Refine project guidelines

**Report Insights**:
- Create summary reports for management
- Share trends with stakeholders
- Recommend process changes
- Celebrate successes

---

## Alignment Comparison

Evaluate how well records align with project guidelines using AI-powered analysis.

### What is Alignment Comparison?

Alignment Comparison uses AI to evaluate records against project-specific guidelines (uploaded as PDF). The AI acts as a "Quality Assurance Analyst" and provides:
- Alignment score (0-100)
- Detailed analysis
- Specific guideline violations
- Suggested improvements

### Prerequisites

**Required**:
- Project must have guidelines PDF uploaded (Fleet managers do this)
- Record must be ingested into the system
- AI service must be configured (LM Studio or OpenRouter)

**Not Required**:
- Record does not need quality scores
- Record does not need to be vectorized

### Running Alignment Analysis

1. Navigate to QA App → **Records**
2. Find the record to analyze
3. Click the record to open details
4. Click **"Generate Alignment Score"** button
5. Wait for AI analysis (10-30 seconds)
6. View results in the detail panel

**Alternative Path**:
1. Go to QA App → **Compare**
2. Enter Record ID
3. Click **"Analyze"**

### Understanding Results

**Alignment Score (0-100)**:
- **90-100**: Excellent alignment, follows all guidelines
- **75-89**: Good alignment, minor issues
- **60-74**: Acceptable alignment, some violations
- **40-59**: Poor alignment, significant issues
- **Below 40**: Very poor alignment, major violations

**Score Badge Colors**:
- 🟢 Green (90+): Excellent
- 🔵 Blue (75-89): Good
- 🟡 Yellow (60-74): Acceptable
- 🟠 Orange (40-59): Poor
- 🔴 Red (<40): Critical

**Analysis Sections**:

1. **Guideline Alignment Score**
   - Numeric score with explanation
   - Overall assessment

2. **Detailed Analysis**
   - Which guidelines were followed ✅
   - Which guidelines were missed ❌
   - Specific examples from the record
   - Context and reasoning

3. **Suggested Improvements**
   - Specific changes to make
   - Guideline references
   - Priority recommendations
   - Expected impact

### Using Analysis Results

**Quality Assurance**:
- Review low-scoring records
- Identify systematic issues
- Prioritize improvements
- Track quality over time

**Training**:
- Use analysis as teaching tool
- Show specific violations
- Demonstrate improvements
- Create before/after examples

**Guideline Refinement**:
- Identify frequently violated guidelines
- Find unclear or outdated rules
- Recommend guideline updates
- Improve guideline clarity

**Reporting**:
- Export analysis for reports
- Track alignment trends
- Show improvement over time
- Justify resource allocation

### Regenerating Analysis

If guidelines change or you want a fresh evaluation:

1. Open the record with existing analysis
2. Click **"Regenerate"** or similar button
3. Confirm regeneration
4. New analysis replaces the old one

⚠️ **Note**: Regeneration overwrites previous analysis - no undo.

### Cost Considerations

**OpenRouter (Cloud AI)**:
- Each analysis costs tokens (typically $0.01-0.05)
- Cost displayed after analysis completes
- Balance shown in dashboard header
- Large records cost more to analyze

**LM Studio (Local AI)**:
- Free (uses local compute)
- No cost limits
- Slower than cloud AI
- Privacy-first (data stays local)

### Best Practices

**When to Analyze**:
- ✅ New records before approval
- ✅ Records flagged for quality issues
- ✅ Sample records for trend analysis
- ❌ Don't analyze every record (expensive/slow)

**Interpreting Scores**:
- Don't rely solely on numeric score
- Read the detailed analysis
- Look for specific guideline violations
- Consider context and nuance

**Taking Action**:
- Use insights to improve current records
- Train team on common violations
- Update guidelines if needed
- Track improvement over time

---

## QA Workflow Best Practices

### Daily Routine

**Morning**:
1. Check new records in Records Management
2. Review any flagged BOTTOM_10 records
3. Run similarity searches for duplicates
4. Note trends or patterns

**Afternoon**:
1. Deep dive into problematic areas
2. Run alignment analysis on sample records
3. Document findings
4. Create improvement recommendations

**End of Day**:
1. Log your QA time in Time Tracking
2. Update QA reports or dashboards
3. Share key findings with team
4. Plan tomorrow's focus areas

### Weekly Tasks

- Review Top Prompts trends
- Analyze top/bottom 10 for all active projects
- Create summary report for management
- Update team on quality trends
- Recommend guideline improvements

### Quality Metrics to Track

**Record Quality**:
- Average alignment scores per project
- Percentage of records in each score range
- Trend over time (improving/declining)

**Violation Patterns**:
- Most common guideline violations
- Projects with most issues
- Types of records with quality problems

**Review Coverage**:
- Number of records reviewed
- Projects covered
- Time spent on QA activities

---

## Tips for QA Success

### Efficiency

1. **Use filters aggressively** - Don't review everything, focus on priorities
2. **Batch similar records** - Review related records together for pattern recognition
3. **Create templates** - Document common findings for faster reporting
4. **Keyboard shortcuts** - Learn shortcuts for faster navigation (if available)

### Thoroughness

1. **Read full content** - Don't just skim, understand completely
2. **Check context** - Consider project goals and guidelines
3. **Document specifics** - Note exact issues, not just "bad quality"
4. **Verify patterns** - Confirm findings across multiple examples

### Communication

1. **Be specific** - "Violates guideline 3.2: Missing error handling"
2. **Provide examples** - Show both good and bad examples
3. **Suggest solutions** - Don't just point out problems
4. **Track progress** - Follow up on recommendations

### Continuous Improvement

1. **Learn from top prompts** - Study what works
2. **Document patterns** - Build institutional knowledge
3. **Share insights** - Don't hoard knowledge
4. **Seek feedback** - Ask if your QA approach is effective

---

## Troubleshooting Common Issues

### "Cannot generate alignment score"

**Possible Causes**:
- Project has no guidelines PDF uploaded
- AI service is not configured
- OpenRouter balance is zero
- LM Studio is not running

**Solutions**:
1. Check project has guidelines (contact Fleet manager)
2. Verify AI service in Admin → AI Settings
3. Check OpenRouter balance in header
4. Ensure LM Studio is running (if local AI)

### "Similarity search returns no results"

**Possible Causes**:
- Records not vectorized yet
- Search query too specific
- Project has no records
- Vectorization job still running

**Solutions**:
1. Check ingestion job status
2. Wait for vectorization to complete
3. Broaden your search query
4. Try searching different project

### "Top/Bottom 10 is empty"

**Possible Causes**:
- Project has no categorized records
- Records not marked as TOP_10 or BOTTOM_10
- Wrong project selected

**Solutions**:
1. Verify project has data
2. Check Records page for category counts
3. Contact data source about categorization
4. Try different project

---

## Need More Access?

As a QA team member, you may eventually need additional tools:

**CORE Tools** - For Likert scoring and review decisions, request CORE role
**FLEET Tools** - For project management and data ingestion, request FLEET role

Contact your manager to discuss role upgrades.

---

## Support & Resources

**Technical Issues**: Report bugs via bug reporting feature
**Questions**: Ask your QA lead or manager
**Documentation**: See [USER_GUIDE.md](./USER_GUIDE.md) for basic features
**Training**: Request QA training from your manager

---

**Document Version**: 1.0
**Last Updated**: February 2026
**Role**: QA
**Access Level**: User App + QA App
