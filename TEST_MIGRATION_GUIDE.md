# Test Suite Migration Guide

## Current State (Post-Turborepo Migration)

The test suite has been updated to support the turborepo monorepo architecture.

### Test Configuration Updates

#### ✅ Playwright Config (E2E Tests)
- **File**: `playwright.config.ts`
- **Changes**:
  - Now supports testing different apps via `APP_UNDER_TEST` env var
  - Default: Fleet app (port 3004)
  - Dynamically starts the correct app for testing

**Usage**:
```bash
# Test fleet app (default)
npm run test:e2e

# Test specific app
APP_UNDER_TEST=qa npm run test:e2e
APP_UNDER_TEST=admin npm run test:e2e
```

#### ✅ Vitest Config (Unit Tests)
- **File**: `vitest.config.ts`
- **Changes**:
  - Looks for tests in `packages/**/*.test.ts` and `apps/**/*.test.ts`
  - Legacy tests in `src/` still supported during migration
  - Added @repo/* aliases for monorepo imports

**Usage**:
```bash
# Run all unit tests (all packages + apps)
pnpm turbo run test

# Run tests with coverage
npm test -- --coverage
```

## Test Organization

### Unit Tests Location

**Recommended Structure**:
```
packages/core/src/
├── ai/
│   ├── index.ts
│   └── __tests__/
│       └── ai.test.ts
├── ingestion/
│   ├── index.ts
│   └── __tests__/
│       └── ingestion.test.ts
└── utils/
    ├── index.ts
    └── __tests__/
        └── utils.test.ts
```

**Legacy Location** (still works but deprecated):
```
src/lib/__tests__/
├── ingestion.test.ts
├── similarity.test.ts
└── audit.test.ts
```

### E2E Tests Location

**Current**:
```
e2e/
├── smoke.spec.ts          # Basic smoke tests
├── auth.spec.ts           # Authentication flows
├── ingest.spec.ts         # Ingestion features
└── admin.spec.ts          # Admin features
```

**Notes**:
- E2E tests use relative URLs (e.g., `/ingest`, `/admin`)
- The `APP_UNDER_TEST` env var determines which app is tested
- Tests should be written app-agnostically where possible

## Migration Checklist

### Phase 1: Configuration ✅ COMPLETE
- [x] Update `playwright.config.ts` for multi-app support
- [x] Update `vitest.config.ts` for monorepo structure
- [x] Add @repo/* aliases to vitest config

### Phase 2: Move Unit Tests (TODO)
Current legacy tests that should be migrated:

**Business Logic Tests** → `packages/core/src/__tests__/`:
- [ ] `src/lib/__tests__/ingestion.test.ts` → `packages/core/src/ingestion/__tests__/`
- [ ] `src/lib/__tests__/similarity.test.ts` → `packages/core/src/similarity/__tests__/`
- [ ] `src/lib/__tests__/audit.test.ts` → `packages/core/src/audit/__tests__/`
- [ ] `src/lib/__tests__/bug-reports.test.ts` → `packages/core/src/utils/__tests__/`

**Auth Tests** → `packages/auth/src/__tests__/`:
- [ ] `src/lib/supabase/__tests__/server.test.ts` → `packages/auth/src/__tests__/`
- [ ] `src/lib/__tests__/supabase-client.test.ts` → `packages/auth/src/__tests__/`

**API Route Tests** → `apps/*/src/app/api/__tests__/`:
- [ ] `src/app/api/__tests__/admin-users.test.ts` → `apps/admin/src/app/api/__tests__/`
- [ ] `src/app/api/__tests__/auth-login.test.ts` → `apps/user/src/app/api/__tests__/`
- [ ] `src/app/api/__tests__/projects.test.ts` → `apps/fleet/src/app/api/__tests__/`
- [ ] `src/app/api/__tests__/ingest-csv.test.ts` → `apps/fleet/src/app/api/__tests__/`
- [ ] `src/app/api/__tests__/records.test.ts` → `apps/qa/src/app/api/__tests__/`

### Phase 3: Update E2E Tests (TODO)
- [ ] Review `e2e/smoke.spec.ts` - ensure works with fleet app
- [ ] Review `e2e/auth.spec.ts` - ensure works across apps
- [ ] Review `e2e/ingest.spec.ts` - specific to fleet app
- [ ] Review `e2e/admin.spec.ts` - specific to admin app
- [ ] Create app-specific E2E test files if needed

### Phase 4: Add New Tests (TODO)
- [ ] Add tests for AppSwitcher component (`packages/ui/src/components/__tests__/`)
- [ ] Add integration tests for cross-app navigation
- [ ] Add tests for shared packages (auth, database helpers)

### Phase 5: Cleanup (TODO)
- [ ] Remove legacy tests from `src/lib/__tests__/`
- [ ] Remove `src/app/api/__tests__/`
- [ ] Update CI/CD to run tests per app

## Running Tests

### Unit Tests

```bash
# All unit tests (parallel across all packages)
pnpm turbo run test

# Specific package
cd packages/core && pnpm test

# With coverage
pnpm turbo run test -- --coverage

# Watch mode
cd packages/core && pnpm test:watch
```

### E2E Tests

```bash
# Test fleet app (default)
npm run test:e2e

# Test specific app
APP_UNDER_TEST=qa npm run test:e2e
APP_UNDER_TEST=admin npm run test:e2e
APP_UNDER_TEST=user npm run test:e2e

# Interactive mode
APP_UNDER_TEST=fleet npm run test:e2e -- --ui

# Headed mode (see browser)
npm run test:e2e -- --headed
```

### All Tests (CI)

```bash
# Run unit + E2E tests
npm run test:ci
```

## Writing New Tests

### Unit Tests in Packages

**Example**: Testing a utility in `@repo/core`

```typescript
// packages/core/src/utils/__tests__/helpers.test.ts
import { describe, it, expect } from 'vitest';
import { myHelper } from '../helpers';

describe('myHelper', () => {
    it('should do something', () => {
        expect(myHelper('input')).toBe('expected');
    });
});
```

### API Route Tests in Apps

**Example**: Testing an API route in the Fleet app

```typescript
// apps/fleet/src/app/api/projects/__tests__/route.test.ts
import { describe, it, expect, vi } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

vi.mock('@repo/database', () => ({
    prisma: {
        project: {
            findMany: vi.fn().mockResolvedValue([])
        }
    }
}));

describe('GET /api/projects', () => {
    it('returns projects', async () => {
        const req = new NextRequest('http://localhost:3004/api/projects');
        const res = await GET(req);
        expect(res.status).toBe(200);
    });
});
```

### E2E Tests

**Example**: Testing fleet app ingestion

```typescript
// e2e/ingest.spec.ts
import { test, expect } from '@playwright/test';

// This test runs against APP_UNDER_TEST (default: fleet)
test('can upload CSV file', async ({ page }) => {
    await page.goto('/ingest');

    // Upload file
    await page.setInputFiles('input[type="file"]', 'test-data.csv');
    await page.click('button:has-text("Upload")');

    // Check success
    await expect(page.locator('.success-message')).toBeVisible();
});
```

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Use beforeEach/afterEach for setup/teardown
- Mock external dependencies

### 2. Monorepo-Aware Imports
- Use `@repo/*` imports in tests
- Avoid relative imports across package boundaries
- Example: `import { prisma } from '@repo/database'`

### 3. Test Coverage
- Aim for 80%+ coverage on shared packages
- Focus on critical business logic in `@repo/core`
- API routes should have basic happy path + error tests

### 4. E2E Test Strategy
- Keep E2E tests app-specific where possible
- Use env var to switch between apps: `APP_UNDER_TEST=qa`
- Test cross-app navigation separately

## Troubleshooting

### Issue: "Cannot find module '@repo/database'"
**Solution**: Check vitest.config.ts has proper aliases defined

### Issue: E2E tests fail to start app
**Solution**: Ensure Supabase is running: `npm run dev:supabase`

### Issue: Tests timeout
**Solution**: Increase timeout in playwright.config.ts (currently 120s)

### Issue: Module resolution errors
**Solution**: Run `pnpm install` and `pnpm turbo run build` to ensure packages are built

## Future Improvements

- [ ] Add Jest integration for better React component testing
- [ ] Set up per-app test:e2e commands in turbo.json
- [ ] Create shared test utilities package (@repo/test-utils)
- [ ] Add visual regression testing with Playwright screenshots
- [ ] Set up parallel E2E test execution for different apps
