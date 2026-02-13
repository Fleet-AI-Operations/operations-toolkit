# PR Title
```
feat: Streamline app navigation and reorganize features across apps
```

# Description

Streamlines navigation by removing Dashboard pages and implementing feature-specific landing pages across all apps. Also reorganizes alignment scoring to Core app and adds UX improvements.

## Key Changes

### All Apps (except Admin)
- ❌ Removed Dashboard pages and sidebar links
- 🏠 Landing pages now redirect to primary features

### Fleet App
- Lands on Analytics
- Projects sorted alphabetically

### Core App
- Lands on Likert Scoring
- ✨ Added Alignment Scoring (moved from QA)
- Sidebar items alphabetically ordered

### QA App
- Lands on Records
- Removed Alignment Scoring (moved to Core)
- Removed Quality scores
- User sorting & search in Similarity Search

### User App
- Lands on Time Tracking
- Simplified sidebar

## Breaking Changes

⚠️ **Alignment Scoring Access**: Now requires CORE+ role (was in QA app). QA users no longer have access.

## Testing

✅ Unit tests: All passing (35/35)
📋 Manual testing guides: `MANUAL_TESTING_CHECKLIST.md`, `QUICK_TEST_REFERENCE.md`

## Deployment

Safe to deploy ✅ - All apps should be deployed simultaneously.

## Files Changed

**Fleet**: page.tsx, Sidebar.tsx, Management.tsx
**Core**: page.tsx, Sidebar.tsx, AlignmentScoring.tsx, alignment-scoring/*, api/records/*, api/analysis/*
**QA**: page.tsx, Sidebar.tsx, ListView.tsx, compare/page.tsx, api/analysis/prompts/route.ts, similarity-content.tsx
**User**: page.tsx, Sidebar.tsx
**Tests**: app-navigation.spec.ts, helpers.ts

## Quick Verification

After deploying, verify:
1. Fleet → lands on `/analytics`
2. Core → lands on `/likert-scoring`, has Alignment Scoring
3. QA → lands on `/records`, NO Alignment Scoring
4. User → lands on `/time-tracking`
5. Admin → unchanged (Dashboard still present)
