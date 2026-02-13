# Testing Guide for UI/UX Changes

This guide covers testing the recent UI/UX improvements made to the Operations Toolkit apps.

## Changes Made

### Fleet App
- ✅ Removed Dashboard page
- ✅ Landing page now redirects to Analytics (`/analytics`)
- ✅ Removed Dashboard from sidebar
- ✅ Projects are alphabetically sorted in Project Management

### Core App
- ✅ Removed Dashboard page
- ✅ Landing page now redirects to Likert Scoring (`/likert-scoring`)
- ✅ Removed Dashboard from sidebar
- ✅ Added Alignment Scoring feature (moved from QA app)
- ✅ Sidebar items alphabetically ordered

### QA App
- ✅ Removed Dashboard page
- ✅ Landing page now redirects to Records (`/records`)
- ✅ Removed Dashboard from sidebar
- ✅ Removed Alignment Scoring (moved to Core app)
- ✅ Removed Quality scores from Records page
- ✅ Removed Compare page from sidebar (requires record ID)

### User App
- ✅ Removed Dashboard page
- ✅ Landing page now redirects to Time Tracking (`/time-tracking`)
- ✅ Removed Dashboard from sidebar

### Shared Changes
- ✅ User sorting by last name in Similarity Search
- ✅ User search functionality in Similarity Search

## Running Tests

### Unit Tests

Run all unit tests across packages:
```bash
pnpm turbo run test
```

### E2E Tests

E2E tests run against specific apps using the `APP_UNDER_TEST` environment variable.

**Test each app individually:**

```bash
# Fleet App (default)
APP_UNDER_TEST=fleet npm run test:e2e

# Core App
APP_UNDER_TEST=core npm run test:e2e

# QA App
APP_UNDER_TEST=qa npm run test:e2e

# User App
APP_UNDER_TEST=user npm run test:e2e

# Admin App (unchanged, still has Dashboard)
APP_UNDER_TEST=admin npm run test:e2e
```

**Run specific test files:**

```bash
# Navigation tests for Fleet app
APP_UNDER_TEST=fleet npx playwright test app-navigation.spec.ts

# Fleet Management tests
APP_UNDER_TEST=fleet npx playwright test fleet-management.spec.ts

# Full Similarity Check tests
APP_UNDER_TEST=fleet npx playwright test full-similarity-check.spec.ts
```

**Interactive mode:**

```bash
APP_UNDER_TEST=core npx playwright test --ui
```

### Prerequisites

Before running E2E tests, ensure:
1. Supabase is running: `npm run dev:supabase`
2. Database is seeded with test data if needed

## Test Coverage

### New Test File: `app-navigation.spec.ts`

Tests the UI/UX changes across all apps:

- **Landing Page Redirects**: Verifies each app redirects home (`/`) to the correct feature page
- **Dashboard Removal**: Confirms Dashboard links are not present in sidebars
- **Alignment Scoring Access**: Tests that only Core, Fleet, and Admin roles can access alignment scoring
- **Sidebar Navigation**: Verifies navigation items are present and functional

### Existing Test Files

- `auth.spec.ts` - Authentication flow (unchanged)
- `fleet-management.spec.ts` - Fleet management features
- `full-similarity-check.spec.ts` - Similarity checking functionality
- `bonus-windows.spec.ts` - Bonus window management
- `activity-over-time.spec.ts` - Activity analytics
- `audit-logs.spec.ts` - Audit log viewing
- `bug-reports.spec.ts` - Bug reporting system

## Manual Testing Checklist

If you prefer manual testing:

### Fleet App (`http://localhost:3004`)
- [ ] Login redirects to `/analytics`
- [ ] No Dashboard link in sidebar
- [ ] Analytics page loads correctly
- [ ] Project Management shows projects alphabetically

### Core App (`http://localhost:3003`)
- [ ] Login redirects to `/likert-scoring`
- [ ] No Dashboard link in sidebar
- [ ] Alignment Scoring link visible in sidebar
- [ ] Sidebar items in alphabetical order:
  - Alignment Scoring
  - Candidate Review
  - Likert Scoring
  - My Assignments
- [ ] Can access `/alignment-scoring` page
- [ ] Can generate alignment scores for records

### QA App (`http://localhost:3002`)
- [ ] Login redirects to `/records`
- [ ] No Dashboard link in sidebar
- [ ] No Alignment Scoring in sidebar
- [ ] No Compare link in sidebar
- [ ] Records page doesn't show alignment score generation
- [ ] Records page doesn't show Quality scores

### User App (`http://localhost:3001`)
- [ ] Login redirects to `/time-tracking`
- [ ] No Dashboard link in sidebar
- [ ] Time Tracking page loads correctly
- [ ] Links page accessible

### Admin App (`http://localhost:3005`)
- [ ] Dashboard still present (unchanged)
- [ ] All admin features accessible

## Troubleshooting

### Tests fail with "timeout waiting for page"
- Ensure the app server is running on the correct port
- Check Supabase is running: `npm run dev:supabase`
- Increase timeout in `playwright.config.ts` if needed

### Tests fail with "user not found" or auth errors
- Check test database is seeded properly
- Verify `.env.test` has correct Supabase credentials
- Run `npm run dev:reset` to reset test database

### Tests fail on alignment scoring access
- Verify the Core app has alignment scoring routes
- Check API endpoints exist at `/api/analysis/*`
- Confirm role-based permissions are working

## CI/CD Integration

To run tests in CI:

```bash
# Run all tests (unit + E2E)
npm run test:ci

# Run tests for specific app in CI
CI=1 APP_UNDER_TEST=fleet npm run test:e2e
```

## Next Steps

After confirming tests pass:
1. Review test coverage report
2. Add additional tests for edge cases if needed
3. Update CI/CD pipeline to run app-specific tests
4. Document any manual QA procedures for production deployment
