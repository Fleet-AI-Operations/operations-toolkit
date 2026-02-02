# Test Coverage Guide

## Running Tests with Coverage

```bash
# Run unit tests with coverage report
npm run test:coverage

# Run tests with coverage in UI mode (interactive)
npm run test:coverage:ui

# Run tests in watch mode (no coverage)
npm run test:watch

# Run E2E tests
npm run test:e2e

# Run all tests (unit + E2E)
npm run test:ci
```

## Coverage Reports

Coverage reports are generated in multiple formats:

- **Terminal**: Displayed in console after test run
- **HTML**: `coverage/index.html` - Open in browser for detailed report
- **JSON**: `coverage/coverage-final.json` - Machine-readable format
- **LCOV**: `coverage/lcov.info` - For CI/CD integrations

## Current Test Status

### Unit Tests (Implemented)

| File | Tests | Status | Coverage |
|------|-------|--------|----------|
| `src/lib/ai.ts` | 8 tests | ✅ Passing | High |
| `src/lib/ingestion.ts` | 3 tests | ✅ Passing | Medium |
| `src/lib/similarity.ts` | 10 tests | ✅ Passing | **New** |
| `src/lib/supabase/client.ts` | 6 tests | ✅ Passing | High |
| `src/lib/supabase/server.ts` | 22 tests | ⚠️ 4 env issues | **New** |

**Total Unit Tests**: 49 tests

### Integration Tests (Templates)

Created comprehensive test templates for top 5 critical API routes:

1. **`src/app/api/__tests__/auth-login.test.ts`** (12 test cases)
   - Authentication validation
   - Security (SQL injection, XSS)
   - Edge cases

2. **`src/app/api/__tests__/admin-users.test.ts`** (16 test cases)
   - User creation and management
   - Role-based access control
   - Password reset functionality

3. **`src/app/api/__tests__/ingest-csv.test.ts`** (21 test cases)
   - CSV parsing and validation
   - Duplicate detection
   - Job management

4. **`src/app/api/__tests__/records.test.ts`** (31 test cases)
   - Complex filtering and sorting
   - Pagination
   - Performance with large datasets

5. **`src/app/api/__tests__/projects.test.ts`** (29 test cases)
   - CRUD operations
   - Cascading deletes
   - File upload validation

**Total Integration Test Templates**: 109 test cases (TODO markers for implementation)

### E2E Tests

| Test Suite | Status | Coverage |
|------------|--------|----------|
| `e2e/auth.spec.ts` | ✅ Passing | Auth flows, role redirects |
| `e2e/bonus-windows.spec.ts` | ✅ Passing | Manager/Admin access |
| `e2e/profile.spec.ts` | ✅ Passing | User profile operations |
| `e2e/smoke.spec.ts` | ✅ Passing | Basic smoke tests |

## Coverage Configuration

Located in `vitest.config.ts`:

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov'],

  // Files to include in coverage
  include: [
    'src/lib/**/*.ts',
    'src/app/api/**/*.ts',
  ],

  // Files to exclude
  exclude: [
    'node_modules/',
    'src/lib/__tests__/',
    'src/app/api/__tests__/',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/*.config.ts',
    'e2e/',
    'dist/',
    '.next/',
    'coverage/',
  ],

  // Coverage thresholds
  lines: 80,
  functions: 80,
  branches: 75,
  statements: 80,
}
```

## Next Steps for Full Coverage

### Phase 1: Complete Unit Tests ✅
- [x] `src/lib/similarity.ts` - 10 tests added
- [x] `src/lib/supabase/server.ts` - 22 tests added

### Phase 2: Implement Integration Tests (High Priority)
- [ ] `src/app/api/__tests__/auth-login.test.ts` - Replace TODOs with implementation
- [ ] `src/app/api/__tests__/admin-users.test.ts` - Implement user management tests
- [ ] `src/app/api/__tests__/ingest-csv.test.ts` - Implement ingestion tests
- [ ] `src/app/api/__tests__/records.test.ts` - Implement record query tests
- [ ] `src/app/api/__tests__/projects.test.ts` - Implement project CRUD tests

### Phase 3: Expand Coverage (Medium Priority)
- [ ] Add tests for remaining API routes (24 routes)
- [ ] Add tests for complex components
- [ ] Add tests for middleware and utilities

### Phase 4: Optimize & Maintain
- [ ] Set up CI/CD coverage reporting
- [ ] Add coverage badges to README
- [ ] Enforce coverage thresholds in CI
- [ ] Regular coverage audits

## Implementation Guide for Integration Tests

Each test template follows this pattern:

```typescript
describe('API Route', () => {
    beforeEach(async () => {
        // TODO: Set up test data
        // TODO: Authenticate test user
    });

    afterEach(async () => {
        // TODO: Clean up test data
    });

    it('should handle successful operation', async () => {
        // TODO: Make API request
        // TODO: Verify response status
        // TODO: Verify data correctness
    });

    it('should validate input', async () => {
        // TODO: Send invalid data
        // TODO: Verify error response
    });

    it('should enforce authentication', async () => {
        // TODO: Send request without auth
        // TODO: Verify 401 status
    });
});
```

### Test Helpers Needed

Create these helpers in `src/app/api/__tests__/helpers/`:

1. **`auth-helpers.ts`**
   ```typescript
   export async function authenticateAsUser(role: Role): Promise<Session>
   export async function createTestUser(email: string, role: Role): Promise<User>
   ```

2. **`data-helpers.ts`**
   ```typescript
   export async function createTestProject(name: string): Promise<Project>
   export async function createTestRecords(projectId: string, count: number): Promise<DataRecord[]>
   ```

3. **`request-helpers.ts`**
   ```typescript
   export async function makeAuthenticatedRequest(path: string, options: RequestInit, session: Session): Promise<Response>
   ```

## Coverage Best Practices

1. **Test Isolation**: Each test should be independent
2. **Setup/Teardown**: Always clean up test data
3. **Descriptive Names**: Test names should explain what they test
4. **Arrange-Act-Assert**: Follow AAA pattern
5. **Mock External Deps**: Mock AI calls, email services, etc.
6. **Fast Tests**: Keep unit tests < 100ms each
7. **Realistic Data**: Use production-like test data

## Troubleshooting

### Tests Failing with Environment Variable Issues

If tests fail due to environment variable conflicts (like the server.ts tests):
- The `.env.test` file provides default values
- Tests attempting to unset env vars may not work as expected
- Solution: Use test-specific env var prefixes or mock the functions directly

### Coverage Not Updating

```bash
# Clear coverage cache
rm -rf coverage/

# Re-run with fresh coverage
npm run test:coverage
```

### Tests Timing Out

```bash
# Increase timeout in vitest.config.ts
test: {
  testTimeout: 30000, // 30 seconds
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Docs](https://playwright.dev/)
- [Coverage Best Practices](https://testing-library.com/docs/guide-which-query/)
