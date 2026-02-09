# User Guides Index

Role-specific user guides for Operations Tools. Each guide covers all features available to that role.

## 📚 Available Guides

### 🔰 [USER Role Guide](./USER_GUIDE.md)
**For**: All users with USER role
**Access**: User App only

**Features Covered**:
- ⏱️ Time Tracking - Record work hours
- 🔗 Links & Resources - Access documentation
- 👤 Profile Management - Account settings
- 🐛 Bug Reporting - Report issues

**Audience**: General users, team members, contributors

---

### 📊 [QA Role Guide](./QA_GUIDE.md)
**For**: Quality assurance team members
**Access**: User App + QA App (ports 3001-3002)

**Includes USER features plus**:
- 📋 Records Management - View and analyze records
- 🔍 Similarity Search - Find related content
- 📈 Top/Bottom 10 Review - Quality analysis
- 🏆 Top Prompts Analysis - Best practice identification
- ✅ Alignment Comparison - AI guideline evaluation

**Audience**: QA analysts, quality reviewers, content evaluators

---

### ⭐ [CORE Role Guide](./CORE_GUIDE.md)
**For**: Core team members with scoring/review responsibilities
**Access**: User App + QA App + Core App (ports 3001-3003)

**Includes USER + QA features plus**:
- 📊 Likert Scoring - Rate records on dimensions
- 👥 Candidate Review - Evaluate submissions
- 📝 My Assignments - Manage work queue
- ✅ Review Decisions - Make final determinations

**Audience**: Scorers, reviewers, evaluators, decision-makers

---

### 🚀 [FLEET Role Guide](./FLEET_GUIDE.md)
**For**: Fleet managers and project leads
**Access**: User App + QA App + Core App + Fleet App (ports 3001-3004)

**Includes USER + QA + CORE features plus**:
- 📥 Data Ingestion - Import CSV/API data
- 📁 Project Management - Create and manage projects
- 📊 Analytics Dashboard - Comprehensive insights
- 💰 Bonus Windows Management - Create and track bonuses
- 📈 Activity Over Time - Trend visualization
- 🐛 Bug Reports Management - Triage and manage reports

**Audience**: Project managers, team leads, fleet managers, operations managers

---

## 🎯 How to Use These Guides

### Finding Your Guide

1. **Check your role**: Click profile icon → see your role
2. **Select your guide**: Click the guide matching your role above
3. **Read relevant sections**: Each guide is comprehensive but organized by feature

### Guide Structure

All guides follow a consistent structure:

1. **Overview** - Role description and app access
2. **Inherited Features** - Features from lower roles (if applicable)
3. **Primary Features** - Features specific to your role
4. **Workflows** - Daily, weekly, monthly routines
5. **Tips & Best Practices** - Success strategies
6. **Troubleshooting** - Common issues and solutions
7. **Support** - Where to get help

### Hierarchical Access

Roles are hierarchical - higher roles inherit all lower role features:

```
PENDING → USER → QA → CORE → FLEET → ADMIN

USER      = User App only
QA        = USER + QA App
CORE      = USER + QA + Core App
FLEET     = USER + QA + CORE + Fleet App
ADMIN     = All apps including Admin App
```

**Example**: If you're CORE role, you should read:
1. USER_GUIDE.md (brief overview)
2. QA_GUIDE.md (brief overview)
3. CORE_GUIDE.md (thorough read)

### Quick Reference

**Need to know how to**:
- Record time? → All guides, User App section
- Review records? → QA Guide or higher
- Score candidates? → CORE Guide or higher
- Upload data? → FLEET Guide only
- Manage users? → ADMIN Guide (not included here)

---

## 🆘 Getting Help

### In-Guide Help

Each guide includes:
- Step-by-step instructions with screenshots (where applicable)
- Best practices and tips
- Troubleshooting sections
- FAQs specific to that role

### Additional Resources

**General Documentation**:
- [Complete Documentation Index](../INDEX.md) - All documentation
- [API Reference](../Reference/API_REFERENCE.md) - Technical specs
- [Database Schema](../Reference/DATABASE_SCHEMA.md) - Data structure

**Architecture Docs**:
- [System Overview](../Architecture/OVERVIEW.md) - Tech stack
- [App Navigation Guide](../../APP_NAVIGATION_GUIDE.md) - Feature locations

**Setup & Operations**:
- [Local Development](../LOCAL_DEVELOPMENT.md) - Dev setup
- [Production Setup](../SETUP.md) - Deployment
- [Testing Guide](../TESTING.md) - Running tests

### Support Channels

**For technical issues**:
- Use the bug reporting feature (available in all apps)
- Provide detailed steps to reproduce
- Include screenshots if possible

**For role/permission questions**:
- Contact your manager
- Reference your user guide
- Request role change if needed

**For feature requests**:
- Discuss with manager first
- Submit via bug report (mark as "Feature Request")
- Provide business justification

---

## 📝 Guide Maintenance

### Document Versions

All guides are version-controlled:
- **Version 1.0** (Feb 2026) - Initial release for turborepo architecture
- Updated as features change
- Check "Last Updated" at bottom of each guide

### Reporting Issues

Found an error in a guide?
1. Note the guide name and section
2. Report via bug reporting feature
3. Mark as "Documentation Issue"
4. We'll update the guide

### Suggesting Improvements

Have ideas for improving guides?
- Additional examples needed?
- Confusing sections?
- Missing features?

Submit feedback via bug reporting or contact your manager.

---

## 🎓 Training Resources

### Onboarding

**New USER**:
1. Read USER_GUIDE.md thoroughly
2. Complete onboarding checklist (if provided)
3. Record test time entry
4. Explore Links page

**New QA**:
1. Review USER_GUIDE.md (overview)
2. Read QA_GUIDE.md thoroughly
3. Complete QA training with team lead
4. Shadow experienced QA analyst
5. Review sample records

**New CORE**:
1. Review USER + QA guides (overview)
2. Read CORE_GUIDE.md thoroughly
3. Participate in calibration session
4. Score training dataset
5. Get feedback on initial scores

**New FLEET**:
1. Review USER + QA + CORE guides (overview)
2. Read FLEET_GUIDE.md thoroughly
3. Shadow experienced fleet manager
4. Practice with test project
5. Review all dashboards and reports

### Continuous Learning

- Attend role-specific training sessions
- Participate in calibration workshops
- Share learnings with team
- Stay updated on new features
- Read updated guide sections

---

## 🔄 Role Upgrades

### Requesting Role Change

If your responsibilities expand:

1. **Discuss with manager**
   - Explain why you need higher role
   - Provide business justification
   - Request formal role change

2. **Manager evaluates**
   - Reviews your performance
   - Confirms need for access
   - Approves or denies request

3. **Admin updates role**
   - Role changed in system
   - You receive notification
   - New features immediately available

4. **Complete training**
   - Read new role's user guide
   - Attend role-specific training
   - Shadow experienced team member

### Role Downgrade

If you no longer need higher access:
- Contact your manager
- Explain change in responsibilities
- Admin adjusts your role
- You lose access to higher-tier apps

---

## 📊 Guide Statistics

**Total Guides**: 4 (USER, QA, CORE, FLEET)
**Total Pages**: ~60+ pages across all guides
**Last Updated**: February 2026
**Format**: Markdown

**Coverage**:
- ✅ All USER features documented
- ✅ All QA features documented
- ✅ All CORE features documented
- ✅ All FLEET features documented
- ⏳ ADMIN guide (future)

---

**Need help? Start with your role's guide, then contact your manager if you have questions!**
