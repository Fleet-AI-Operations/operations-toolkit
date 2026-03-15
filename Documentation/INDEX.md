# Documentation Index

Complete guide to the Operations Tools documentation.

## 🚀 Getting Started

New to the project? Start here:

1. **[README](../README.md)** - Project overview and turborepo architecture
2. **[App Navigation Guide](../APP_NAVIGATION_GUIDE.md)** - Feature mapping across 5 apps
3. **[Role-Specific User Guides](./UserGuides/INDEX.md)** - Comprehensive guides by role ⭐
   - [USER Guide](./UserGuides/USER_GUIDE.md) - Basic features ([PDF](./UserGuides/PDFs/USER_GUIDE.pdf))
   - [QA Guide](./UserGuides/QA_GUIDE.md) - Quality assurance tools ([PDF](./UserGuides/PDFs/QA_GUIDE.pdf))
   - [CORE Guide](./UserGuides/CORE_GUIDE.md) - Scoring and review ([PDF](./UserGuides/PDFs/CORE_GUIDE.pdf))
   - [FLEET Guide](./UserGuides/FLEET_GUIDE.md) - Fleet management ([PDF](./UserGuides/PDFs/FLEET_GUIDE.pdf))
   - [📄 All guides available as PDFs](./UserGuides/PDFs/) for offline access and distribution
4. **[Local Development Guide](./LOCAL_DEVELOPMENT.md)** - Turborepo development workflow

## 📚 Documentation Structure

```
Documentation/
├── INDEX.md (this file)           # Documentation map
│
├── Getting Started/
│   ├── Quick Start                → ../LOCALDEV_QUICKSTART.md
│   ├── User Guide                 → ./USER_GUIDE.md
│   ├── User Role Reference        → ./USER_ROLE_REFERENCE.md
│   ├── User Management            → ./USER_MANAGEMENT.md
│   └── Bug Reports                → ./BUG_REPORTS.md
│
├── Feature Guides/
│   ├── Exemplar Tasks             → ./EXEMPLAR_TASKS.md
│   ├── Great Example Tasks        → ./GREAT_EXAMPLE_TASKS.md
│   ├── Weekly Task Metrics        → ./WEEKLY_TASK_METRICS.md
│   ├── Task Search                → ./TASK_SEARCH.md
│   ├── Task Creator Deep-Dive     → see API Reference § Prompt Authenticity
│   ├── Mentorship Program         → ./MENTORSHIP.md
│   ├── Task Disputes              → ./TASK_DISPUTES.md
│   └── Workforce Monitoring       → ./UserGuides/WORKFORCE_MONITORING_GUIDE.md
│
├── Development/
│   ├── Local Development          → ./LOCAL_DEVELOPMENT.md
│   ├── Testing Guide              → ./TESTING.md
│   ├── Testing Coverage           → ../TESTING_COVERAGE.md
│   └── Schema Management          → ../SCHEMA_MANAGEMENT_GUIDE.md
│
├── Deployment/
│   ├── Deployment Options         → ../DEPLOYMENT_OPTIONS.md
│   ├── Production Setup           → ./SETUP.md
│   ├── Vercel Deployment          → ./VERCEL.md
│   └── Production vs Local        → ../PRODUCTION_VS_LOCAL.md
│
├── Reference/
│   ├── API Reference              → ./Reference/API_REFERENCE.md
│   ├── Database Schema            → ./Reference/DATABASE_SCHEMA.md
│   └── Security & Best Practices  → ./SECURITY.md
│
├── Architecture/
│   ├── System Overview            → ./Architecture/OVERVIEW.md
│   ├── Ingestion Flow             → ./Architecture/INGESTION_FLOW.md
│   └── AI Strategy                → ./Architecture/AI_STRATEGY.md
│
└── Support/
    └── Troubleshooting            → ./TROUBLESHOOTING.md
```

---

## By Task

### I want to...

#### **Install and Run Locally**
→ [Local Development Quick Start](../LOCALDEV_QUICKSTART.md)
→ [Local Development Guide](./LOCAL_DEVELOPMENT.md)

#### **Deploy to Production**
→ [Deployment Options](../DEPLOYMENT_OPTIONS.md)
→ [Production Setup Guide](./SETUP.md)
→ [Vercel Deployment](./VERCEL.md)

#### **Use the Application**
→ [User Guide](./USER_GUIDE.md)
→ [User Role Reference](./USER_ROLE_REFERENCE.md) (for USER role)
→ [User Management](./USER_MANAGEMENT.md)
→ [Bug Reports](./BUG_REPORTS.md)
→ [Exemplar Tasks](./EXEMPLAR_TASKS.md) (Fleet)
→ [Great Example Tasks](./GREAT_EXAMPLE_TASKS.md) (Fleet)
→ [Weekly Task Metrics & Spotlight](./WEEKLY_TASK_METRICS.md) (Fleet)
→ [Task Search](./TASK_SEARCH.md) (Core)
→ [Task Creator Deep-Dive](./Reference/API_REFERENCE.md#prompt-authenticity--task-creator-deep-dive) (Core)
→ [Workforce Monitoring Guide](./UserGuides/WORKFORCE_MONITORING_GUIDE.md) (Fleet)
→ [Mentorship Program](./MENTORSHIP.md) (Fleet)
→ [Task Disputes](./TASK_DISPUTES.md) (Fleet/Admin)

#### **Develop Features**
→ [Local Development](./LOCAL_DEVELOPMENT.md)
→ [API Reference](./Reference/API_REFERENCE.md)
→ [Database Schema](./Reference/DATABASE_SCHEMA.md)
→ [Testing Guide](./TESTING.md)

#### **Understand the Architecture**
→ [System Overview](./Architecture/OVERVIEW.md)
→ [Ingestion Flow](./Architecture/INGESTION_FLOW.md)
→ [AI Strategy](./Architecture/AI_STRATEGY.md)

#### **Fix Problems**
→ [Troubleshooting Guide](./TROUBLESHOOTING.md)

#### **Secure the Application**
→ [Security & Best Practices](./SECURITY.md)

#### **Test the Application**
→ [Testing Guide](./TESTING.md)
→ [Testing Coverage](../TESTING_COVERAGE.md)

---

## By Role

### Developers

**Essential Reading**:
1. [Local Development Quick Start](../LOCALDEV_QUICKSTART.md)
2. [API Reference](./Reference/API_REFERENCE.md)
3. [Database Schema](./Reference/DATABASE_SCHEMA.md)
4. [Testing Guide](./TESTING.md)
5. [Security Best Practices](./SECURITY.md)

**Reference**:
- [System Architecture](./Architecture/OVERVIEW.md)
- [Ingestion Flow](./Architecture/INGESTION_FLOW.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

### DevOps / SRE

**Essential Reading**:
1. [Deployment Options](../DEPLOYMENT_OPTIONS.md)
2. [Production Setup](./SETUP.md)
3. [Production vs Local](../PRODUCTION_VS_LOCAL.md)
4. [Security Guide](./SECURITY.md)

**Reference**:
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Database Schema](./Reference/DATABASE_SCHEMA.md)

### End Users

**Essential Reading**:
1. [User Guide](./USER_GUIDE.md)
2. [User Role Reference](./USER_ROLE_REFERENCE.md) - Quick reference for USER role
3. [User Management](./USER_MANAGEMENT.md)
4. [Bug Reports](./BUG_REPORTS.md)

**Reference**:
- [Troubleshooting](./TROUBLESHOOTING.md) (Common Issues section)

### QA / Testers

**Essential Reading**:
1. [Testing Guide](./TESTING.md)
2. [User Guide](./USER_GUIDE.md)
3. [Troubleshooting](./TROUBLESHOOTING.md)

**Reference**:
- [API Reference](./Reference/API_REFERENCE.md)

---

## Documentation Standards

### File Organization

- **Root level** (`/`): Quick starts and high-level guides
- **Documentation/** (`/Documentation`): Comprehensive guides
- **Documentation/Reference/** (`/Documentation/Reference`): Technical reference material
- **Documentation/Architecture/** (`/Documentation/Architecture`): System design docs

### Naming Conventions

- Use `UPPERCASE.md` for root-level docs
- Use `TitleCase.md` for guide names
- Use `SHOUTING_CASE.md` for important files (README, CLAUDE)

### Document Structure

All guides should include:
1. **Title** - Clear, descriptive
2. **Table of Contents** - For docs > 100 lines
3. **Overview** - What this doc covers
4. **Main Content** - Organized with headers
5. **Related Links** - Links to related docs
6. **Last Updated** - Date of last significant update

---

## Contributing to Documentation

### Adding New Documentation

1. **Determine location**:
   - Getting started guide → Root or `Documentation/`
   - Technical reference → `Documentation/Reference/`
   - Architecture doc → `Documentation/Architecture/`

2. **Follow template**:
   ```markdown
   # Document Title

   Brief description of what this document covers.

   ## Table of Contents
   - [Section 1](#section-1)
   - [Section 2](#section-2)

   ## Section 1
   Content...

   ## Related Documentation
   - [Link to related doc](./path/to/doc.md)
   ```

3. **Update INDEX.md** (this file)

4. **Cross-reference**:
   - Add links from related docs
   - Update main README if applicable

### Updating Existing Documentation

1. **Make changes**
2. **Update "Last Updated" date**
3. **Check cross-references** still valid
4. **Test code examples** still work

### Documentation Review Checklist

- [ ] Clear and concise writing
- [ ] Code examples tested and working
- [ ] Links to related docs included
- [ ] Screenshots current (if applicable)
- [ ] No broken links
- [ ] Consistent formatting
- [ ] Table of contents updated
- [ ] INDEX.md updated

---

## Quick Reference

### Key URLs

- **Local App**: http://localhost:3000
- **Local Supabase Studio**: http://localhost:54323
- **Supabase Mailpit**: http://localhost:54324
- **Public Status**: http://localhost:3000/status
- **API Base**: http://localhost:3000/api

### Key Commands

```bash
# Development
npm install                  # Install dependencies
npm run dev:supabase        # Start local Supabase
npm run dev                 # Start dev server

# Testing
npm test                    # Run unit tests
npm run test:coverage       # Run with coverage
npm run test:e2e           # Run E2E tests

# Database
npm run dev:studio          # Open Supabase Studio
npm run dev:reset          # Reset database

# Production
npm run build              # Build for production
npm start                  # Start production server
```

### Key Files

```
.env.local                 # Local environment config
prisma/schema.prisma       # Database schema
supabase/config.toml       # Supabase configuration
CLAUDE.md                  # AI assistant instructions
package.json               # Dependencies and scripts
```

---

## Documentation Maintenance

### Quarterly Review

Every 3 months, review and update:
- [ ] All code examples still work
- [ ] Screenshots are current
- [ ] Dependencies versions up to date
- [ ] Links not broken
- [ ] New features documented
- [ ] Deprecated features removed

### After Major Updates

When making significant changes:
- [ ] Update affected documentation
- [ ] Update version numbers
- [ ] Update changelog
- [ ] Notify team of doc changes

---

## Need Help?

Can't find what you're looking for?

1. **Search**: Use GitHub search or grep through docs
   ```bash
   grep -r "search term" Documentation/
   ```

2. **Check Troubleshooting**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

3. **Ask for Help**:
   - Check GitHub Issues
   - Create new issue with `documentation` label

4. **Improve Docs**:
   - Found an error? Submit a PR
   - Missing information? Open an issue
   - Unclear explanation? Suggest improvements

---

*Last Updated: 2026-03-14* — Added Weekly Task Metrics doc; renamed Daily Great Tasks → Great Example Tasks
