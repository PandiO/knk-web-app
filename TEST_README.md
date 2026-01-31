# Running Tests for Registration Flow

## Quick Start

### Component Tests (Jest + React Testing Library)
```bash
# Run tests in watch mode (recommended for development)
npm test

# Run all tests once with coverage
npm run test:coverage

# Run tests for CI (no watch, exit after completion)
npm run test:ci
```

### E2E Tests (Cypress)

**Prerequisites:** Make sure the dev server is running first!
```bash
# Terminal 1: Start dev server
npm start

# Terminal 2: Run Cypress tests
npm run cypress:open      # Interactive UI mode
npm run cypress:run       # Headless mode
npm run test:e2e          # Same as cypress:run
```

### Run All Tests
```bash
# Component + E2E tests
npm run test:all
```

## Test Files

- **Component Tests:** `src/components/auth/RegisterForm.test.tsx`
- **E2E Tests:** `cypress/e2e/registration.cy.ts`
- **Test Utilities:** `src/test-utils/`
  - `mockAuthClient.ts` - Mock API client for component tests
  - `test-helpers.tsx` - Rendering helpers with providers

## What's Being Tested

### Registration Flow Coverage
✅ Multi-step form navigation (3 steps)
✅ Email validation (format, required)
✅ Password validation (strength, policy, matching)
✅ Username validation (required, uniqueness)
✅ Link code generation after registration
✅ Duplicate email/username error handling
✅ Success page with link code display
✅ Login with newly created account

### Test Data
All tests use timestamped data to avoid conflicts:
- Email: `test+{timestamp}@example.com`
- Username: `testuser_{timestamp}`
- Password: `SecureTestPass123!`

## Troubleshooting

### Component Tests Failing
1. Check that all dependencies are installed: `npm install`
2. Verify setupTests.ts is properly configured
3. Clear Jest cache: `npm test -- --clearCache`

### Cypress Tests Failing
1. **Dev server not running:** Start it with `npm start`
2. **Wrong port:** Check cypress.config.ts baseUrl matches your dev server
3. **Duplicate data errors:** Tests use timestamps but may fail if run too quickly
4. **Timeouts:** Increase timeout in test or check API response times

### Database Cleanup
E2E tests create real users. Cleanup test data with:
```sql
DELETE FROM Users 
WHERE Email LIKE 'test+%@example.com' 
  AND CreatedAt < DATE_SUB(NOW(), INTERVAL 7 DAY);
```

## CI/CD Integration

Add to your CI pipeline:
```yaml
- name: Run Tests
  run: |
    npm ci
    npm run test:ci
    npm start &
    npm run cypress:run
```

## Further Documentation

See [TESTING.md](./TESTING.md) for comprehensive documentation including:
- Test architecture and patterns
- Coverage goals and metrics
- Debugging strategies
- Best practices
- Future enhancements
