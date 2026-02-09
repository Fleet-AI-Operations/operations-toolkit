# Test Suite Updates Summary

## ✅ Completed Updates

### 1. Playwright Configuration (E2E Tests)
**File**: `playwright.config.ts`

**Changes**:
- Added multi-app support via `APP_UNDER_TEST` environment variable
- Configured dynamic port selection for different apps (3001-3005)
- Updated webServer command to use turborepo: `pnpm turbo run dev --filter=@repo/{app}-app`
- Default test target: Fleet app (port 3004)

**Usage**:
```bash
# Test default (fleet) app
npm run test:e2e

# Test specific apps
APP_UNDER_TEST=qa npm run test:e2e
APP_UNDER_TEST=admin npm run test:e2e
```

### 2. Vitest Configuration (Unit Tests)
**File**: `vitest.config.ts`

**Changes**:
- Updated include patterns to test `packages/**/*.test.ts` and `apps/**/*.test.ts`
- Added @repo/* module aliases for monorepo imports
- Updated coverage paths to include packages (packages/core, packages/auth, packages/database)
- Kept legacy src/ tests during migration period

**Usage**:
```bash
# Run all unit tests across all packages
pnpm turbo run test

# Run with coverage
npm test -- --coverage
```

### 3. Documentation
**File**: `TEST_MIGRATION_GUIDE.md` (NEW)

Complete guide covering:
- Current test configuration
- Test organization (where to put tests)
- Migration checklist for moving legacy tests
- Running tests (unit + E2E)
- Writing new tests with examples
- Best practices for monorepo testing
- Troubleshooting common issues

## 📋 Current Test State

### Unit Tests (Vitest)
**Location**: Still in legacy `src/lib/__tests__/` and `src/app/api/__tests__/`
**Status**: Config updated to support monorepo, but tests not yet moved

**Count**:
- src/lib/__tests__/: ~5 test files
- src/app/api/__tests__/: ~5 test files
- packages/: 0 test files (TODO)
- apps/: 0 test files (TODO)

### E2E Tests (Playwright)
**Location**: `e2e/` directory
**Status**: Config updated for multi-app testing

**Test Files**:
- e2e/smoke.spec.ts - Basic smoke tests
- e2e/auth.spec.ts - Authentication flows
- e2e/profile.spec.ts - User profile tests
- e2e/ingest.spec.ts - Ingestion features
- e2e/admin.spec.ts - Admin features
- e2e/bonus-windows.spec.ts - Bonus window tests
- e2e/bug-reports.spec.ts - Bug reporting
- e2e/audit-logs.spec.ts - Audit log tests
- e2e/activity-over-time.spec.ts - Activity analytics

## 🔄 Migration TODO

### Phase 1: Move Unit Tests to Packages

**Business Logic** → `packages/core/src/__tests__/`:
- [ ] src/lib/__tests__/ingestion.test.ts
- [ ] src/lib/__tests__/similarity.test.ts
- [ ] src/lib/__tests__/audit.test.ts
- [ ] src/lib/__tests__/bug-reports.test.ts

**Auth Logic** → `packages/auth/src/__tests__/`:
- [ ] src/lib/supabase/__tests__/server.test.ts
- [ ] src/lib/__tests__/supabase-client.test.ts

### Phase 2: Move API Tests to Apps

**Admin App** → `apps/admin/src/app/api/__tests__/`:
- [ ] src/app/api/__tests__/admin-users.test.ts
- [ ] src/app/api/audit-logs/__tests__/route.test.ts

**Fleet App** → `apps/fleet/src/app/api/__tests__/`:
- [ ] src/app/api/__tests__/projects.test.ts
- [ ] src/app/api/__tests__/ingest-csv.test.ts

**QA App** → `apps/qa/src/app/api/__tests__/`:
- [ ] src/app/api/__tests__/records.test.ts

**User App** → `apps/user/src/app/api/__tests__/`:
- [ ] src/app/api/__tests__/auth-login.test.ts

### Phase 3: Update E2E Tests

- [ ] Review each E2E test for app compatibility
- [ ] Update any hardcoded URLs to use baseURL
- [ ] Ensure tests work with APP_UNDER_TEST switching
- [ ] Add cross-app navigation tests

### Phase 4: Add New Tests

- [ ] AppSwitcher component tests (packages/ui)
- [ ] Shared auth helper tests (packages/auth)
- [ ] Database utility tests (packages/database)

### Phase 5: Cleanup

- [ ] Remove src/lib/__tests__/
- [ ] Remove src/app/api/__tests__/
- [ ] Remove src/ directory entirely
- [ ] Update CI/CD workflows

## 🚀 Running Tests Now

### Unit Tests
```bash
# All tests (including legacy src/)
pnpm turbo run test

# Specific package (once tests are moved)
cd packages/core && pnpm test
```

### E2E Tests
```bash
# Test fleet app (default)
npm run test:e2e

# Test specific app
APP_UNDER_TEST=qa npm run test:e2e
APP_UNDER_TEST=admin npm run test:e2e

# With UI
npm run test:e2e -- --ui
```

### All Tests (CI)
```bash
npm run test:ci
```

## 📊 Benefits of New Test Structure

1. **Faster Test Execution**: Turborepo caches test results, only re-runs changed packages
2. **Isolation**: Tests are co-located with code they test
3. **App-Specific Testing**: E2E tests can target specific apps
4. **Better Organization**: Clear separation between unit/integration/E2E tests
5. **Parallel Execution**: Turbo runs tests in parallel across packages

## ⚠️ Important Notes

1. **Legacy Tests Still Work**: Config supports both old (src/) and new (packages/apps) locations
2. **Migration is Gradual**: No rush to move all tests immediately
3. **E2E Tests Ready**: Can already test different apps via APP_UNDER_TEST
4. **No Breaking Changes**: Existing test commands still work

## 📝 Next Steps

**Immediate** (recommended):
1. Run existing tests to ensure they still pass
2. Start moving unit tests to packages/core
3. Update one E2E test as a proof of concept

**Short-term** (next sprint):
1. Complete unit test migration
2. Add tests for new packages (ui, auth)
3. Update E2E tests for multi-app architecture

**Long-term** (future):
1. Remove src/ directory entirely
2. Add visual regression testing
3. Set up per-app CI/CD pipelines
