# API Integration Tests

This directory contains integration test templates for API routes.

## Running Tests

```bash
# Run all API tests
npm test src/app/api/__tests__

# Run specific test file
npm test src/app/api/__tests__/auth-login.test.ts

# Run with watch mode
npm run test:watch src/app/api/__tests__
```

## Test Structure

Each test file follows this structure:

1. **Setup/Teardown**: Create and clean up test data
2. **Happy Path Tests**: Test successful operations
3. **Validation Tests**: Test input validation and error handling
4. **Security Tests**: Test authentication, authorization, and input sanitization
5. **Edge Cases**: Test boundary conditions and unusual inputs
6. **Performance Tests**: Test with large datasets (where applicable)

## Implementing Tests

These files are **templates** with TODO markers. To implement:

1. Fill in the `beforeEach` and `afterEach` setup/teardown logic
2. Replace `// TODO:` comments with actual test implementation
3. Use appropriate HTTP client (fetch, supertest, or custom test helper)
4. Ensure tests are isolated and can run in any order
5. Mock external dependencies (email services, AI APIs, etc.)

## Test Data Helpers

Consider creating shared test helpers:

```typescript
// helpers/test-data.ts
export async function createTestUser(email: string, role: Role) {
  // Implementation
}

export async function createTestProject(name: string, userId: string) {
  // Implementation
}

export async function authenticateAsUser(userId: string) {
  // Implementation
}
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data in `afterEach`
3. **Descriptive Names**: Test names should clearly describe what they test
4. **Arrange-Act-Assert**: Follow AAA pattern
5. **Fast Tests**: Mock slow operations (AI calls, large file operations)
6. **Realistic Data**: Use realistic test data that matches production patterns

## Coverage Goals

Aim for:
- **90%+ code coverage** for critical routes (auth, user management)
- **80%+ code coverage** for business logic routes (ingestion, records)
- **100% of security-critical paths** tested

## Security Testing

All API routes should test:
- Authentication requirements
- Authorization (role-based access)
- Input validation
- SQL injection prevention
- XSS prevention
- CSRF protection (if applicable)
- Rate limiting (if implemented)

## Next Steps

1. Implement the TODO items in each test file
2. Add integration test helpers in a shared `helpers/` directory
3. Configure test database or use transactions for isolation
4. Add CI/CD pipeline to run tests automatically
5. Set up coverage reporting to track progress
