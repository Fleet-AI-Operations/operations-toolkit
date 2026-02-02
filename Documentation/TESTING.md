# Testing Guide

This guide covers how to run and write tests for the Operations Tools with the local Supabase setup.

## 📋 Table of Contents

- [Test Types](#test-types)
- [Quick Start](#quick-start)
- [Test Environment](#test-environment)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [CI/CD](#cicd)
- [Troubleshooting](#troubleshooting)

---

## 🧪 Test Types

### Unit Tests (Vitest)
- **Location**: `src/**/*.test.ts`, `src/**/*.spec.ts`
- **Framework**: Vitest with React Testing Library
- **Purpose**: Test individual functions and components in isolation
- **Speed**: Fast (< 1 second per test)
- **Database**: Mocked with `vi.mock()`

### E2E Tests (Playwright)
- **Location**: `e2e/**/*.spec.ts`
- **Framework**: Playwright
- **Purpose**: Test complete user flows in a real browser
- **Speed**: Slower (5-30 seconds per test)
- **Database**: Real local Supabase database

---

## 🚀 Quick Start

### Prerequisites

1. **Local Supabase running**:
   ```bash
   npm run dev:supabase
   ```

2. **Dependencies installed**:
   ```bash
   npm install
   ```

### Run All Tests

```bash
# Unit tests only
npm test

# E2E tests only
npm run test:e2e

# All tests (unit + E2E)
npm run test:ci
```

---

## ⚙️ Test Environment

### Environment Variables

Tests use `.env.test` which configures:
- Local Supabase connection
- Test database URL
- Mock API keys

**File: `.env.test`**
```bash
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
SUPABASE_SERVICE_ROLE_KEY="sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
```

### Database Setup

Tests use the local Supabase database:

1. **Unit Tests**: Database calls are mocked (don't touch real DB)
2. **E2E Tests**: Use real local database (test data is created/cleaned up)

**Important**: E2E tests will create real data in your local database. Reset with:
```bash
npm run dev:reset
```

---

## 🏃 Running Tests

### Unit Tests

**Run all unit tests:**
```bash
npm test
```

**Watch mode (re-runs on file changes):**
```bash
npm run test:watch
```

**Run specific test file:**
```bash
npm test src/lib/__tests__/ai.test.ts
```

**Run with coverage:**
```bash
npm test -- --coverage
```

### E2E Tests

**Prerequisites**: Ensure Supabase is running
```bash
npm run dev:supabase
```

**Run all E2E tests:**
```bash
npm run test:e2e
```

**Interactive UI mode:**
```bash
npm run test:e2e:ui
```

**Headed mode (see browser):**
```bash
npm run test:e2e:headed
```

**Run specific test:**
```bash
npx playwright test e2e/auth.spec.ts
```

**Debug mode:**
```bash
npx playwright test --debug
```

### Combined Test Suite

**Run everything:**
```bash
npm run test:ci
```

This runs:
1. Unit tests
2. E2E tests

---

## 📝 Writing Tests

### Unit Tests

Unit tests use **Vitest** and mock external dependencies.

**Example: Testing a utility function**

```typescript
// src/lib/__tests__/myUtil.test.ts
import { describe, it, expect } from 'vitest';
import { myFunction } from '../myUtil';

describe('myFunction', () => {
  it('should return expected result', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

**Example: Mocking Prisma**

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock Prisma
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../prisma', () => ({
  prisma: mockPrisma,
}));

describe('User Operations', () => {
  it('should fetch users', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: '1', email: 'test@example.com' }
    ]);

    const users = await getUsers();
    expect(users).toHaveLength(1);
  });
});
```

**Example: Mocking Supabase**

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signIn: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

describe('Auth Operations', () => {
  it('should sign in user', async () => {
    // Test your auth logic
  });
});
```

### E2E Tests

E2E tests use **Playwright** and test real user flows.

**Current E2E Test Coverage:**
- `e2e/auth.spec.ts` - Authentication flow and authorization redirects
- `e2e/smoke.spec.ts` - Basic application health checks
- `e2e/example.spec.ts` - Playwright example tests
- `e2e/bonus-windows.spec.ts` - Time tracking and bonus management features
- `e2e/audit-logs.spec.ts` - Audit logging system (admin features)

**Example: Testing authentication flow**

```typescript
// e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should allow user to login', async ({ page }) => {
    await page.goto('/login');

    // Fill form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');

    // Submit
    await page.click('button[type="submit"]');

    // Verify redirect
    await expect(page).toHaveURL('/dashboard');
  });
});
```

**Example: Testing with database setup**

```typescript
import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';

test.describe('Project Management', () => {
  test.beforeEach(async () => {
    // Create test data
    await prisma.project.create({
      data: { name: 'Test Project' },
    });
  });

  test.afterEach(async () => {
    // Clean up
    await prisma.project.deleteMany({
      where: { name: 'Test Project' },
    });
  });

  test('should display project', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('text=Test Project')).toBeVisible();
  });
});
```

---

## 🔄 Test Workflow

### Development Workflow

1. **Start Supabase**:
   ```bash
   npm run dev:supabase
   ```

2. **Write your feature/fix**

3. **Write unit tests** (if needed)

4. **Run unit tests** in watch mode:
   ```bash
   npm run test:watch
   ```

5. **Write E2E tests** (for user-facing features)

6. **Run E2E tests**:
   ```bash
   npm run test:e2e
   ```

7. **Run all tests** before committing:
   ```bash
   npm run test:ci
   ```

### Pre-Commit Checklist

- [ ] Unit tests pass: `npm test`
- [ ] E2E tests pass: `npm run test:e2e`
- [ ] No TypeScript errors: `npm run build`
- [ ] Linting passes: `npm run lint`

---

## 🤖 CI/CD

### GitHub Actions Setup

Tests run automatically on:
- Pull requests
- Pushes to main branch

**Example workflow** (`.github/workflows/test.yml`):

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Start Supabase
        run: npx supabase start

      - name: Run unit tests
        run: npm test

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

### CI Environment Variables

In CI, tests use:
- Local Supabase (via `supabase start`)
- `.env.test` configuration
- Headless browser mode

---

## 🐛 Troubleshooting

### Unit Tests

**Issue**: Tests fail with "Cannot find module"
```bash
# Solution: Regenerate Prisma Client
npx prisma generate
```

**Issue**: Environment variables not loaded
```bash
# Solution: Ensure .env.test exists and is loaded
cat .env.test
npm test -- --reporter=verbose
```

**Issue**: Mocks not working
```bash
# Solution: Ensure mocks are hoisted
const { mockPrisma } = vi.hoisted(() => ({ ... }));
```

### E2E Tests

**Issue**: Tests timeout
```bash
# Solution: Ensure Supabase is running
npm run dev:supabase
supabase status
```

**Issue**: Database not found
```bash
# Solution: Reset Supabase database
npm run dev:reset
```

**Issue**: Port 3000 already in use
```bash
# Solution: Kill existing process
lsof -ti:3000 | xargs kill -9
```

**Issue**: Auth tests fail
```bash
# Solution: Check Supabase is accessible
curl http://127.0.0.1:54321/health
```

**Issue**: Test data persists between runs
```bash
# Solution: Clean up test data in afterEach hooks
test.afterEach(async () => {
  await prisma.dataRecord.deleteMany();
});
```

### General Issues

**Issue**: Supabase not starting
```bash
# Solution: Check Docker is running
docker ps
docker-compose ps

# Restart Supabase
npm run dev:stop
npm run dev:supabase
```

**Issue**: Tests pass locally but fail in CI
- Ensure CI has Supabase installed
- Check CI environment variables
- Verify Docker is available in CI
- Add `npx supabase start` to CI workflow

---

## 📊 Test Coverage

### View Coverage Report

```bash
npm test -- --coverage
```

This generates:
- Terminal summary
- HTML report in `coverage/` directory

### Coverage Thresholds

**Recommended minimums**:
- Statements: 70%
- Branches: 60%
- Functions: 70%
- Lines: 70%

**Configure in `vitest.config.ts`**:
```typescript
test: {
  coverage: {
    statements: 70,
    branches: 60,
    functions: 70,
    lines: 70,
  },
}
```

---

## 🔗 Best Practices

### Unit Tests

✅ **Do:**
- Mock external dependencies (Prisma, Supabase, APIs)
- Test one thing per test
- Use descriptive test names
- Keep tests fast (< 100ms each)
- Test edge cases and error conditions

❌ **Don't:**
- Make real API calls
- Touch the real database
- Test implementation details
- Write flaky tests

### E2E Tests

✅ **Do:**
- Test critical user flows
- Clean up test data after each test
- Use data-testid for reliable selectors
- Test responsive behavior
- Verify accessibility

❌ **Don't:**
- Test every single interaction
- Rely on timing (use waitFor)
- Leave test data in database
- Test styling details

---

## 🔐 Testing Audit Logs

The audit log system tracks administrative actions across the application. Testing ensures audit trails are accurate and secure.

### Unit Tests

**File**: `src/lib/__tests__/audit.test.ts`

Tests the core audit logging functions:
- `logAudit()` - Creating audit log entries
- `getCurrentUserForAudit()` - Extracting user info from Supabase session
- Error handling (graceful degradation)
- CUID generation for log IDs

**Example**:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { logAudit } from '../audit';

describe('logAudit', () => {
  it('should create audit log with all fields', async () => {
    await logAudit({
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: 'test-user-id',
      userId: 'admin-id',
      userEmail: 'admin@example.com',
      metadata: { role: 'USER' }
    });

    // Verify Prisma was called with correct data
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('should not throw on failure', async () => {
    mockPrisma.auditLog.create.mockRejectedValue(new Error('DB error'));

    // Should not throw - graceful degradation
    await expect(logAudit({...})).resolves.not.toThrow();
  });
});
```

### E2E Tests

**File**: `e2e/audit-logs.spec.ts`

Tests the complete audit logging workflow:
- API endpoint authorization (admin-only)
- Audit log creation on user actions
- Filter functionality (by action, entity, date)
- Pagination
- Metadata display

**Test Scenarios**:

1. **Authorization**: Non-admin users cannot access audit logs
2. **Log Creation**: Actions generate corresponding audit logs
3. **Filtering**: Can filter by action type, entity, and date range
4. **Pagination**: Navigate through multiple pages of logs
5. **Metadata**: Metadata displays correctly when expanded

**Example**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Audit Logs', () => {
  test('should create audit log when user is created', async ({ page }) => {
    // Login as admin
    await loginAsAdmin(page);

    // Create a new user
    await page.goto('/admin/users');
    await page.click('button:has-text("Create User")');
    await page.fill('input[name="email"]', 'newuser@example.com');
    await page.click('button:has-text("Create")');

    // Check audit log was created
    await page.goto('/admin/audit-logs');
    await expect(page.locator('text=User Created')).toBeVisible();
    await expect(page.locator('text=newuser@example.com')).toBeVisible();
  });

  test('should filter audit logs by action', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/audit-logs');

    // Open filters
    await page.click('button:has-text("Filters")');

    // Select action filter
    await page.selectOption('select[name="action"]', 'USER_CREATED');

    // Verify filtered results
    const logs = page.locator('[data-testid="audit-log-entry"]');
    await expect(logs.first()).toContainText('User Created');
  });
});
```

### Testing Best Practices

**For Audit Log Tests:**

✅ **Do:**
- Test that critical actions generate audit logs
- Verify admin-only access control
- Test graceful degradation (audit failures don't break operations)
- Clean up test audit logs in afterEach hooks
- Test metadata is properly recorded

❌ **Don't:**
- Test every single audit action (focus on critical ones)
- Depend on specific log IDs (they're auto-generated)
- Test exact timestamp values (use date ranges)
- Leave test audit logs in the database

### Manual Testing Checklist

When testing audit logs manually:

- [ ] Create a new user (should log USER_CREATED)
- [ ] Change user role (should log USER_ROLE_CHANGED)
- [ ] Reset password (should log USER_PASSWORD_RESET)
- [ ] Create/update/delete project (should log PROJECT_*)
- [ ] Clear data (should log DATA_CLEARED)
- [ ] Update AI settings (should log SYSTEM_SETTINGS_UPDATED)
- [ ] Create/update/delete bonus window (should log BONUS_WINDOW_*)
- [ ] Verify non-admin cannot access `/admin/audit-logs`
- [ ] Test all filters work correctly
- [ ] Test pagination with 50+ logs
- [ ] Verify metadata expands correctly

---

## 📋 Quick Reference

### Common Commands

```bash
# Start Supabase (required for E2E tests)
npm run dev:supabase

# Run unit tests
npm test

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e

# E2E interactive UI
npm run test:e2e:ui

# All tests
npm run test:ci

# Coverage
npm test -- --coverage

# Coverage with UI
npm run test:coverage:ui
```

### Test File Locations

```
src/
  lib/
    __tests__/
      helpers.ts              # Unit test helpers
      ai.test.ts              # AI service tests
      ingestion.test.ts       # Ingestion pipeline tests
      similarity.test.ts      # Similarity search tests
      supabase/
        __tests__/
          server.test.ts      # Supabase server client tests
  app/
    api/
      __tests__/
        auth-login.test.ts    # Auth login API tests (templates)
        admin-users.test.ts   # Admin users API tests (templates)
        ingest-csv.test.ts    # CSV ingestion API tests (templates)
        records.test.ts       # Records API tests (templates)
        projects.test.ts      # Projects API tests (templates)
        README.md             # Integration test guide

e2e/
  helpers.ts                  # E2E test helpers
  auth.spec.ts                # Authentication E2E tests
  smoke.spec.ts               # Smoke tests
  bonus-windows.spec.ts       # Bonus windows E2E tests
```

### Configuration Files

```
.env.test                     # Test environment variables
vitest.config.ts              # Vitest configuration
vitest.setup.ts               # Vitest setup file
playwright.config.ts          # Playwright configuration
```

### Test Coverage

**Current Status:**
- ✅ Unit tests: `ai.test.ts`, `ingestion.test.ts`, `similarity.test.ts`
- ✅ Supabase: `server.test.ts`
- 🚧 API integration tests: Templates created, need implementation
- ✅ E2E tests: Auth, smoke, bonus windows

**Coverage Configuration:**
```typescript
// vitest.config.ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov'],
  lines: 80,
  functions: 80,
  branches: 75,
  statements: 80,
}
```

**View Coverage:**
- Terminal: `npm test -- --coverage`
- HTML Report: `open coverage/index.html`
- Interactive UI: `npm run test:coverage:ui`

---

## 📚 Related Documentation

- [Testing Coverage Guide](../TESTING_COVERAGE.md) - Detailed coverage setup and goals
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Local Development Guide](../LOCALDEV_QUICKSTART.md)
