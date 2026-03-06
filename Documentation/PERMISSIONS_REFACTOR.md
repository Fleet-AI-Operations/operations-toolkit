# Permissions & Navigation Refactor

This document outlines the new user roles, permissions hierarchy, and navigation structure.

## Navigation Structure

### Current → New Mapping

| Current Section | New Section | Subsection | Feature | Notes |
|----------------|-------------|------------|---------|-------|
| **Overview** | ~~Removed~~ | - | - | Section deprecated |
| - | **User Tools** | - | - | **New top-level section** |
| - | User Tools | - | Time Recording | ⭐ New feature to be implemented |
| - | User Tools | - | Links | Moved from Overview |
| **Analysis** | **QA Tools** | - | - | Renamed section |
| Analysis | QA Tools | Dashboard | Dashboard | |
| Analysis | QA Tools | Dashboard | Top/Bottom 10 | |
| Analysis | QA Tools | Dashboard | Top Prompts | |
| - | **Core Tools** | - | - | **New section** |
| - | Core Tools | Scoring | Likert Scoring | |
| - | Core Tools | Review | Top/Bottom 10 (review) | Review addon for QA decisions |
| **Operations Tools** | **Fleet Tools** | - | - | Renamed section |
| Operations Tools | Fleet Tools | Data | Ingest | |
| Operations Tools | Fleet Tools | Performance | Bonus Windows | |
| Operations Tools | Fleet Tools | Performance | Activity Over Time | |
| Operations Tools | Fleet Tools | Performance | Time Analytics | |
| Operations Tools | Fleet Tools | Management | Project Management | |
| Operations Tools | Fleet Tools | Management | Candidate Review | |
| Operations Tools | Fleet Tools | Management | Rater Management | |
| - | **Admin Tools** | - | - | Elevated section |
| - | Admin Tools | System | Bug Reports | |
| - | Admin Tools | System | Admin | |
| - | Admin Tools | System | LLM Models | |
| - | Admin Tools | System | Status | |

---

## New Navigation Hierarchy

```
📁 User Tools
   └─ Time Recording ⭐ [NEW]
   └─ Links

📁 QA Tools
   ├─ Dashboard
   │  ├─ Dashboard
   │  ├─ Top/Bottom 10
   │  └─ Top Prompts

📁 Core Tools
   ├─ Scoring
   │  └─ Likert Scoring
   └─ Review
      └─ Top/Bottom 10 (review)

📁 Fleet Tools
   ├─ Data
   │  └─ Ingest
   ├─ Performance
   │  ├─ Bonus Windows
   │  ├─ Activity Over Time
   │  └─ Time Analytics
   └─ Management
      ├─ Project Management
      ├─ Candidate Review
      └─ Rater Management

📁 Admin Tools
   └─ System
      ├─ Bug Reports
      ├─ Admin
      ├─ LLM Models
      └─ Status
```

---

## User Roles & Permissions

### Role Definitions

| Role | Access Level | Description |
|------|--------------|-------------|
| **USER** | Basic | Standard user access - time tracking and links |
| **QA** | Quality Assurance | User tools + QA dashboard and analysis |
| **Core** | Core Operations | User + QA + Core scoring and review tools |
| **Fleet** | Fleet Management | User + QA + Core + Fleet operations |
| **Admin** | Full Access | Complete system access including admin tools |

### Permission Matrix

| Section | USER | QA | Core | Fleet | Admin |
|---------|:----:|:--:|:----:|:-----:|:-----:|
| **User Tools** | ✅ | ✅ | ✅ | ✅ | ✅ |
| - Time Recording | ✅ | ✅ | ✅ | ✅ | ✅ |
| - Links | ✅ | ✅ | ✅ | ✅ | ✅ |
| **QA Tools** | ❌ | ✅ | ✅ | ✅ | ✅ |
| - Dashboard | ❌ | ✅ | ✅ | ✅ | ✅ |
| - Top/Bottom 10 | ❌ | ✅ | ✅ | ✅ | ✅ |
| - Top Prompts | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Core Tools** | ❌ | ❌ | ✅ | ✅ | ✅ |
| - Likert Scoring | ❌ | ❌ | ✅ | ✅ | ✅ |
| - Top/Bottom 10 (review) | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Fleet Tools** | ❌ | ❌ | ❌ | ✅ | ✅ |
| - Ingest | ❌ | ❌ | ❌ | ✅ | ✅ |
| - Bonus Windows | ❌ | ❌ | ❌ | ✅ | ✅ |
| - Activity Over Time | ❌ | ❌ | ❌ | ✅ | ✅ |
| - Time Analytics | ❌ | ❌ | ❌ | ✅ | ✅ |
| - Project Management | ❌ | ❌ | ❌ | ✅ | ✅ |
| - Candidate Review | ❌ | ❌ | ❌ | ✅ | ✅ |
| - Rater Management | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Admin Tools** | ❌ | ❌ | ❌ | ❌ | ✅ |
| - Bug Reports | ❌ | ❌ | ❌ | ❌ | ✅ |
| - Admin | ❌ | ❌ | ❌ | ❌ | ✅ |
| - LLM Models | ❌ | ❌ | ❌ | ❌ | ✅ |
| - Status | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Role Hierarchy Visualization

```
                    ┌─────────────┐
                    │    ADMIN    │
                    │  (All Tools)│
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    Fleet    │
                    │ Fleet Tools │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    Core     │
                    │ Core Tools  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │     QA      │
                    │  QA Tools   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    USER     │
                    │ User Tools  │
                    └─────────────┘
```

**Inheritance Pattern:** Each role inherits permissions from roles below it.
- USER → Base access
- QA → USER + QA Tools
- Core → QA + Core Tools
- Fleet → Core + Fleet Tools
- Admin → Fleet + Admin Tools

---

## Implementation Checklist

### Phase 1: Database Schema
- [ ] Add new role types to `Role` enum in Prisma schema
  - [ ] Add `QA` role
  - [ ] Add `CORE` role
  - [ ] Add `FLEET` role
  - [ ] Rename `MANAGER` to `FLEET` (migration)
- [ ] Create migration for role changes
- [ ] Update existing users to new role structure

### Phase 2: Backend Changes
- [ ] Update `checkUserRole()` helper to support new roles
- [x] Create role hierarchy utility — `hasMinRole(userRole, minRole)` in `packages/auth/src/app-access.ts`, exported from `@repo/auth`. Uses `ROLE_WEIGHTS` for hierarchical comparison.
- [ ] Update all API route role checks:
  - [ ] User Tools endpoints (accessible to all authenticated users)
  - [ ] QA Tools endpoints (QA, Core, Fleet, Admin)
  - [ ] Core Tools endpoints (Core, Fleet, Admin)
  - [ ] Fleet Tools endpoints (Fleet, Admin)
  - [ ] Admin Tools endpoints (Admin only)

### Phase 3: Frontend Navigation
- [ ] Create new navigation structure component
- [ ] Implement role-based navigation filtering
- [ ] Update sidebar/header navigation
- [ ] Add visual indicators for user's current role
- [ ] Test navigation visibility for each role

### Phase 4: New Features
- [ ] Implement Time Recording feature (User Tools)
- [ ] Implement Likert Scoring feature (Core Tools)
- [ ] Implement Top/Bottom 10 Review addon (Core Tools)
- [ ] Implement Bug Reports feature (Admin Tools)
- [ ] Implement Project Management feature (Fleet Tools)
- [ ] Implement Candidate Review feature (Fleet Tools)
- [ ] Implement Rater Management feature (Fleet Tools)

### Phase 5: Migration & Testing
- [ ] Write migration scripts for existing data
- [ ] Test each role's access patterns
- [ ] Update documentation (USER_MANAGEMENT.md)
- [ ] Create role assignment UI in Admin console
- [ ] Test role transitions and permission inheritance

---

## Breaking Changes

### Deprecated
- **Overview section** - Removed entirely
- **MANAGER role** - Renamed to FLEET

### Route Changes
| Old Route | New Route | Role Required |
|-----------|-----------|---------------|
| `/` (Overview) | `/dashboard` (QA Tools) or `/time-recording` (User Tools) | QA or USER |
| `/analysis/*` | `/qa-tools/*` | QA |
| `/admin/configuration` | `/fleet-tools/management/*` | Fleet |
| `/ingest` | `/fleet-tools/data/ingest` | Fleet |
| `/bonus-windows` | `/fleet-tools/performance/bonus-windows` | Fleet |
| `/activity-over-time` | `/fleet-tools/performance/activity-over-time` | Fleet |

---

## Security Considerations

1. **Role Verification:** All API routes must verify role permissions server-side
2. **Navigation Hiding:** Frontend navigation should hide inaccessible routes
3. **Direct URL Access:** All routes must block unauthorized direct URL access
4. **Role Inheritance:** Higher roles inherit lower role permissions
5. **Admin Separation:** Admin tools completely separated from operational tools

---

## Notes

- **Status Page:** Currently public (no auth) - consider moving to Admin Tools
- **Links Page:** Simple resource list - appropriate for all users
- **Top/Bottom 10:** Will have two modes:
  - QA Mode: Review and make decisions
  - Core Mode: Review QA decisions and approve/modify
- **Time Recording:** New feature for user time tracking (to be designed)
- **Project Management:** Centralized project CRUD (currently scattered)

---

## Database Schema Changes

### Before
```prisma
enum Role {
  USER
  MANAGER
  ADMIN
}
```

### After
```prisma
enum Role {
  USER      // Basic access
  QA        // Quality assurance
  CORE      // Core operations
  FLEET     // Fleet management
  ADMIN     // Full admin
}
```

### Migration Strategy
```sql
-- Update existing MANAGER users to FLEET
UPDATE profiles SET role = 'FLEET' WHERE role = 'MANAGER';

-- Add new role types
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'QA';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CORE';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FLEET';
```
