# Quick Test Reference Card

## 🎯 Quick Summary of Changes

### What Changed
- ❌ **Removed**: Dashboard pages from Fleet, Core, QA, and User apps
- 🏠 **Changed**: Landing pages now redirect to primary features
- 🔀 **Moved**: Alignment Scoring from QA app → Core app (CORE+ access only)
- 🔤 **Sorted**: Projects, users, and sidebar items alphabetically
- 🔍 **Added**: User search in Similarity Search
- 🗑️ **Removed**: Quality scores from Records pages

### What Stayed the Same
- ✅ Admin app unchanged (Dashboard still present)
- ✅ All existing features still work
- ✅ Authentication and permissions unchanged
- ✅ Database and API unchanged

---

## 📱 App-by-App Quick Check

### User App (3001)
```
Landing: /time-tracking ← (was /)
Sidebar: Time Tracking, Links
Removed: Dashboard
```

### QA App (3002)
```
Landing: /records ← (was /)
Sidebar: Records, Similarity, Top/Bottom
Removed: Dashboard, Alignment Scoring, Quality scores
Added: User search & sorting in Similarity
```

### Core App (3003)
```
Landing: /likert-scoring ← (was /)
Sidebar: Alignment Scoring*, Candidate Review, Likert, Assignments
Removed: Dashboard
Added: Alignment Scoring page (moved from QA)
*Alphabetically ordered
```

### Fleet App (3004)
```
Landing: /analytics ← (was /)
Sidebar: Analytics, Full Similarity, Ingestion, etc.
Removed: Dashboard
Added: Alphabetical project sorting
```

### Admin App (3005)
```
Landing: / (Dashboard) ← UNCHANGED
Sidebar: Dashboard, Users, Settings, etc.
Status: NO CHANGES
```

---

## ✅ 30-Second Smoke Test

Run this on each app (except Admin):

1. **Login** → Should redirect to feature page (NOT `/`)
2. **Check sidebar** → Dashboard link should NOT exist
3. **Navigate** → All links work correctly

**Core App Extra**:
- Alignment Scoring should be in sidebar
- QA users should NOT see it

**QA App Extra**:
- Records page should NOT have alignment score buttons
- User dropdown should be sorted by last name

---

## 🚦 Pass/Fail Criteria

| App | Landing Page | No Dashboard | Special Check |
|-----|--------------|--------------|---------------|
| User | /time-tracking | ✓ | Links work |
| QA | /records | ✓ | No alignment scoring |
| Core | /likert-scoring | ✓ | HAS alignment scoring |
| Fleet | /analytics | ✓ | Projects sorted A-Z |
| Admin | / (Dashboard) | ✗ (should have) | Unchanged |

---

## 🔍 Visual Inspection Checklist

Open each app and verify within 1 minute:

**Fleet** → Analytics charts visible
**Core** → Likert scoring interface visible, sidebar has 4 items
**QA** → Records list visible, no alignment score buttons
**User** → Time tracking interface visible

---

## 🧪 Role-Based Quick Test

### Test User: QA Role
- ✅ Can access QA app
- ❌ Cannot see Alignment Scoring
- ✅ Lands on /records

### Test User: CORE Role
- ✅ Can access Core app
- ✅ CAN see Alignment Scoring
- ✅ Lands on /likert-scoring

### Test User: FLEET Role
- ✅ Can access Fleet app
- ✅ CAN access Alignment Scoring (in Core)
- ✅ Lands on /analytics

---

## 📞 Quick Debug Commands

```bash
# Check if apps are running
lsof -ti:3001,3002,3003,3004,3005

# Check Supabase status
supabase status

# Restart all apps
pnpm turbo run dev

# Check unit tests
pnpm turbo run test
```

---

## ✨ Expected Results Summary

| Metric | Expected | Actual |
|--------|----------|--------|
| Apps updated | 4 (User, QA, Core, Fleet) | ___ |
| Dashboards removed | 4 | ___ |
| New landing pages | 4 | ___ |
| Alignment Scoring location | Core only | ___ |
| Admin app changed | No | ___ |

---

## 🎯 Priority Test Order

1. **Core App** (most changes) - 5 min
2. **QA App** (alignment removed) - 5 min
3. **Fleet App** (project sorting) - 3 min
4. **User App** (simple redirect) - 2 min
5. **Admin App** (verify unchanged) - 1 min

**Total estimated time**: ~15-20 minutes

---

## ✅ Sign-Off

- [ ] All landing pages correct
- [ ] All Dashboards removed (except Admin)
- [ ] Alignment Scoring only in Core
- [ ] Navigation works smoothly
- [ ] No broken links found

**Ready for deployment**: YES / NO

**Tested by**: _______________
**Date**: _______________
