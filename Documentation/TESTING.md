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

## 📚 Related Documentation

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Local Development Guide](../LOCALDEV_QUICKSTART.md)
