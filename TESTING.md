# Testing Documentation

## Overview
This document describes the automated testing setup for the Knights & Kings web application registration flow.

## Test Structure

### Unit/Component Tests (Jest + React Testing Library)
Located in: `src/components/auth/RegisterForm.test.tsx`

**Coverage:**
- Multi-step form navigation
- Field validation (email, password, username)
- Successful registration flow
- Error handling (duplicate email/username, weak passwords)
- Link code integration

**Running tests:**
```bash
npm test                    # Run all tests in watch mode
npm test -- --coverage      # Run with coverage report
npm test -- --watchAll=false # Run once without watch mode
```

### E2E Tests (Cypress)
Located in: `cypress/e2e/registration.cy.ts`

**Coverage:**
- Complete user journey from registration to login
- Form validation across all steps
- Success page verification with link code display
- Duplicate detection (email and username)
- Link code copying functionality
- Post-registration login verification

**Running tests:**
```bash
npm run cypress:open        # Open Cypress UI for interactive testing
npm run cypress:run         # Run headless E2E tests in CI
npm run cypress:run:chrome  # Run in Chrome headless
npm run cypress:run:firefox # Run in Firefox headless
```

## Test Data Strategy

### Avoiding Test Pollution
All tests use timestamped test data to prevent conflicts:

```typescript
// Component tests
const testEmail = generateTestEmail();        // test+1234567890@example.com
const testUsername = generateTestUsername();  // testuser_1234567890

// E2E tests
const timestamp = Date.now();
const email = `test+${timestamp}@example.com`;
const username = `testuser_${timestamp}`;
```

### Test Users
E2E tests create real database entries with the pattern:
- Email: `test+{timestamp}@example.com`
- Username: `testuser_{timestamp}`
- Password: `SecureTestPass123!`

**Database Cleanup:**
Consider implementing a scheduled job to remove test users:
```sql
DELETE FROM Users 
WHERE Email LIKE 'test+%@example.com' 
  AND CreatedAt < DATE_SUB(NOW(), INTERVAL 7 DAY);
```

## Test Utilities

### Mock AuthClient
`src/test-utils/mockAuthClient.ts`

Provides controlled responses for testing:
```typescript
mockAuthClient.setRegisterFailure('DuplicateEmail');  // Simulate duplicate email
mockAuthClient.setLinkCodeFailure();                   // Simulate link code error
mockAuthClient.reset();                                 // Reset to success state
```

### Test Helpers
`src/test-utils/test-helpers.tsx`

Helper functions for rendering with providers:
```typescript
import { render, generateTestEmail } from '../../test-utils/test-helpers';

render(<RegisterForm />);  // Auto-wrapped with AuthProvider and Router
```

## Continuous Integration

### GitHub Actions (Recommended)
```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test -- --watchAll=false --coverage
      - run: npm run cypress:run

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Coverage Goals

### Current Coverage
Run `npm test -- --coverage` to see detailed coverage report.

### Target Coverage
- Statements: 80%+
- Branches: 75%+
- Functions: 80%+
- Lines: 80%+

### Critical Paths (100% coverage required)
- Password validation logic
- Email validation
- Registration submission flow
- Link code generation/handling

## Debugging Tests

### Component Tests
```bash
# Run specific test file
npm test RegisterForm.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="validation"

# Debug with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

### E2E Tests
```bash
# Open Cypress UI for step-by-step debugging
npm run cypress:open

# Run with video recording
npm run cypress:run -- --record

# Run specific test file
npm run cypress:run -- --spec "cypress/e2e/registration.cy.ts"
```

## Best Practices

### 1. Test Independence
- Each test should be fully independent
- Use beforeEach/afterEach for cleanup
- Never rely on test execution order

### 2. Descriptive Test Names
```typescript
// ✅ Good
it('should display error when passwords do not match', ...)

// ❌ Bad
it('password test', ...)
```

### 3. Wait for Async Operations
```typescript
// Component tests
await waitFor(() => {
  expect(screen.getByText(/success/i)).toBeInTheDocument();
});

// E2E tests
cy.contains(/success/i, { timeout: 10000 }).should('be.visible');
```

### 4. Test Real User Behavior
- Use accessible queries (getByRole, getByLabelText)
- Avoid testing implementation details
- Focus on user-visible outcomes

## Troubleshooting

### Common Issues

**Tests timing out:**
- Increase timeout in waitFor: `{ timeout: 5000 }`
- Check for unmocked API calls
- Verify test data doesn't conflict

**Cypress can't find elements:**
- Add data-testid attributes for reliable selection
- Use cy.debug() to inspect DOM state
- Check for timing issues with cy.wait()

**Mock not working:**
- Verify jest.mock() is called before imports
- Check mock implementation matches actual API
- Reset mocks between tests

## Future Enhancements

### Planned Additions
- [ ] Visual regression testing (Percy/Chromatic)
- [ ] Performance testing (Lighthouse CI)
- [ ] Accessibility testing (axe-core)
- [ ] API contract testing (Pact)
- [ ] Load testing for registration endpoint

### Test Expansion
- [ ] Password reset flow
- [ ] Email verification flow
- [ ] Link code expiration handling
- [ ] Minecraft-first registration flow
- [ ] Account linking flow

## Resources

- [React Testing Library Docs](https://testing-library.com/react)
- [Cypress Best Practices](https://docs.cypress.io/guides/references/best-practices)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Playground](https://testing-playground.com/) - Find optimal queries
