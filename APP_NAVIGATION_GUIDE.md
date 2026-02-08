# Multi-App Navigation Guide

## Quick Reference: Which App For Which Feature?

### 🏠 User App (Port 3001)
**For**: All users, time tracking
- Dashboard
- Links page
- Time Tracking
- Bonus Windows (view only)

### 📊 QA App (Port 3002)
**For**: QA role and above
- **Analysis Tools** ⭐
  - Records Management
  - Similarity Search
  - Top/Bottom 10 Review
  - Top Prompts Analysis
  - Comparison Tools

### ⭐ Core App (Port 3003)
**For**: CORE role and above
- **Scoring & Review** ⭐
  - Likert Scoring
  - Candidate Review
  - My Assignments

### 🚀 Fleet App (Port 3004)
**For**: FLEET role and above
- **Fleet Management** ⭐
  - Data Ingestion
  - Project Management
  - Analytics Dashboard
- **Operations**
  - Bonus Windows (manage)
  - Activity Over Time
  - Time Analytics
  - Waiting Approval Queue
  - Bug Reports

### 🔧 Admin App (Port 3005)
**For**: ADMIN role only
- User Management
- **Rater Management** ⭐
  - Rater Groups
  - Assignments Distribution
- Audit Logs
- AI/LLM Settings
- System Configuration

## Common 404 Issues

### "Analysis pages showing 404"
**Solution**: Go to **QA App** (port 3002)
- `/records` → http://localhost:3002/records
- `/similarity` → http://localhost:3002/similarity
- `/topbottom10` → http://localhost:3002/topbottom10

### "Rater Management showing 404"
**Solution**: Go to **Admin App** (port 3005)
- `/admin/rater-groups` → http://localhost:3005/admin/rater-groups
- `/admin/assignments` → http://localhost:3005/admin/assignments

### "Likert Scoring showing 404"
**Solution**: Go to **Core App** (port 3003)
- `/likert-scoring` → http://localhost:3003/likert-scoring

## Development Ports

When running `pnpm turbo run dev`, all apps start simultaneously:

| App   | Port | URL |
|-------|------|-----|
| User  | 3001 | http://localhost:3001 |
| QA    | 3002 | http://localhost:3002 |
| Core  | 3003 | http://localhost:3003 |
| Fleet | 3004 | http://localhost:3004 |
| Admin | 3005 | http://localhost:3005 |

## Next Steps

### Option 1: Cross-App Navigation (Recommended)
Update each app's Sidebar to link to other apps for features they don't have:

```tsx
// In Fleet Sidebar:
{ label: 'Analysis Tools', href: 'http://localhost:3002', icon: BarChart, external: true }

// In all Sidebars:
{ label: 'Admin', href: 'http://localhost:3005/admin', icon: ShieldCheck, external: true }
```

### Option 2: Duplicate Routes
Copy missing routes to apps that need them (creates redundancy but simpler navigation)

### Option 3: Remove Invalid Links
Clean up each app's Sidebar to only show routes that exist in that specific app (best long-term solution)

## Fixing Sidebars

Each app needs its Sidebar updated to only show relevant links. I can help update the Sidebars systematically - just let me know which approach you prefer!
