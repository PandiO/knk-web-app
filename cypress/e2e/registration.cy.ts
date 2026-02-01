/**
 * E2E Test: User Registration Flow
 * 
 * This test covers the complete web-first registration journey:
 * 1. Navigate to registration page
 * 2. Fill out multi-step form with validation
 * 3. Submit registration
 * 4. Verify success message and link code display
 * 5. Verify user can log in with new credentials
 * 
 * Test data is timestamped to avoid duplicates across test runs.
 */

describe('User Registration Flow', () => {
  const timestamp = Date.now();
  const testUser = {
    email: `test+${timestamp}@example.com`,
    password: 'SecureTestPass123!',
    username: `testuser_${timestamp}`,
  };

  beforeEach(() => {
    // Visit registration page
    cy.visit('/register');
  });

  describe('Multi-step Form Navigation', () => {
    it('should display step 1 (Account Info) initially', () => {
      cy.contains('Account Info').should('be.visible');
      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').first().should('be.visible');
    });

    it('should navigate between steps', () => {
      // Fill step 1
      cy.get('input[type="email"]').type(testUser.email);
      cy.get('input[type="password"]').first().type(testUser.password);
      cy.get('input[type="password"]').last().type(testUser.password);
      
      // Go to step 2
      cy.contains('button', 'Next').click();
      cy.contains('Minecraft Info').should('be.visible');

      // Go back to step 1
      cy.contains('button', 'Back').click();
      cy.contains('Account Info').should('be.visible');
      
      // Verify form retained values
      cy.get('input[type="email"]').should('have.value', testUser.email);
    });
  });

  describe('Form Validation', () => {
    it('should prevent proceeding with invalid email', () => {
      cy.get('input[type="email"]').type('invalid-email');
      cy.get('input[type="password"]').first().type(testUser.password);
      cy.get('input[type="password"]').last().type(testUser.password);
      cy.contains('button', 'Next').click();

      // Should show error and stay on step 1
      cy.contains(/valid email/i).should('be.visible');
      cy.contains('Account Info').should('be.visible');
    });

    it('should prevent proceeding with weak password', () => {
      cy.get('input[type="email"]').type(testUser.email);
      cy.get('input[type="password"]').first().type('123');
      cy.get('input[type="password"]').last().type('123');
      cy.contains('button', 'Next').click();

      // Should show error
      cy.contains(/at least 8 characters/i).should('be.visible');
    });

    it('should prevent proceeding with mismatched passwords', () => {
      cy.get('input[type="email"]').type(testUser.email);
      cy.get('input[type="password"]').first().type(testUser.password);
      cy.get('input[type="password"]').last().type('DifferentPassword123!');
      cy.contains('button', 'Next').click();

      // Should show error
      cy.contains(/passwords do not match/i).should('be.visible');
    });

    it('should prevent proceeding without username', () => {
      // Complete step 1
      cy.get('input[type="email"]').type(testUser.email);
      cy.get('input[type="password"]').first().type(testUser.password);
      cy.get('input[type="password"]').last().type(testUser.password);
      cy.contains('button', 'Next').click();

      // Try to proceed from step 2 without username
      cy.contains('Minecraft Info').should('be.visible');
      cy.contains('button', 'Next').click();

      // Should show error
      cy.contains(/username is required/i).should('be.visible');
    });
  });

  describe('Successful Registration', () => {
    it('should complete registration and display link code', () => {
      // Step 1: Account Info
      cy.get('input[type="email"]').type(testUser.email);
      cy.get('input[type="password"]').first().type(testUser.password);
      cy.get('input[type="password"]').last().type(testUser.password);
      cy.contains('button', 'Next').click();

      // Step 2: Minecraft Info
      cy.contains('Minecraft Info').should('be.visible');
      cy.get('input[placeholder*="username" i], input[name="username"]').type(testUser.username);
      cy.contains('button', 'Next').click();

      // Step 3: Review & Confirm
      cy.contains('Review & Confirm').should('be.visible');
      cy.contains(testUser.email).should('be.visible');
      cy.contains(testUser.username).should('be.visible');
      
      // Submit
      cy.contains('button', /create account/i).click();

      // Verify success
      cy.contains(/account created/i, { timeout: 10000 }).should('be.visible');
      
      // Verify link code is displayed on success page
      cy.url({ timeout: 10000 }).should('include', '/register/success');
      cy.contains(/link code/i).should('be.visible');
      
      // Verify link code format (8 alphanumeric characters)
      cy.get('[data-testid="link-code"], code').should(($code) => {
        const code = $code.text().trim();
        expect(code).to.match(/^[A-Z0-9]{8}$/);
      });
    });

    it('should allow copying link code to clipboard', () => {
      // Complete registration
      cy.get('input[type="email"]').type(testUser.email + '.copy');
      cy.get('input[type="password"]').first().type(testUser.password);
      cy.get('input[type="password"]').last().type(testUser.password);
      cy.contains('button', 'Next').click();
      
      cy.contains('Minecraft Info').should('be.visible');
      cy.get('input[placeholder*="username" i], input[name="username"]').type(testUser.username + '_copy');
      cy.contains('button', 'Next').click();
      
      cy.contains('Review & Confirm').should('be.visible');
      cy.contains('button', /create account/i).click();

      // Wait for success page
      cy.url({ timeout: 10000 }).should('include', '/register/success');

      // Click copy button
      cy.contains('button', /copy/i).click();
      
      // Verify copied message or button state change
      cy.contains(/copied/i).should('be.visible');
    });
  });

  describe('Login After Registration', () => {
    it('should allow newly registered user to log in', () => {
      const uniqueEmail = `test+${Date.now()}@example.com`;
      const uniqueUsername = `testuser_${Date.now()}`;

      // Complete registration
      cy.get('input[type="email"]').type(uniqueEmail);
      cy.get('input[type="password"]').first().type(testUser.password);
      cy.get('input[type="password"]').last().type(testUser.password);
      cy.contains('button', 'Next').click();
      
      cy.contains('Minecraft Info').should('be.visible');
      cy.get('input[placeholder*="username" i], input[name="username"]').type(uniqueUsername);
      cy.contains('button', 'Next').click();
      
      cy.contains('Review & Confirm').should('be.visible');
      cy.contains('button', /create account/i).click();

      // Wait for success
      cy.contains(/account created/i, { timeout: 10000 }).should('be.visible');

      // Navigate to login page
      cy.visit('/login');

      // Attempt login with new credentials
      cy.get('input[type="email"]').type(uniqueEmail);
      cy.get('input[type="password"]').type(testUser.password);
      cy.contains('button', /log in|sign in/i).click();

      // Verify successful login (redirect to dashboard or show user info)
      cy.url({ timeout: 10000 }).should('not.include', '/login');
      cy.contains(uniqueUsername, { timeout: 5000 }).should('be.visible');
    });
  });

  describe('Error Handling', () => {
    it('should handle duplicate email error', () => {
      // First registration
      const duplicateEmail = `duplicate+${Date.now()}@example.com`;
      
      cy.get('input[type="email"]').type(duplicateEmail);
      cy.get('input[type="password"]').first().type(testUser.password);
      cy.get('input[type="password"]').last().type(testUser.password);
      cy.contains('button', 'Next').click();
      
      cy.contains('Minecraft Info').should('be.visible');
      cy.get('input[placeholder*="username" i], input[name="username"]').type(`user1_${Date.now()}`);
      cy.contains('button', 'Next').click();
      
      cy.contains('Review & Confirm').should('be.visible');
      cy.contains('button', /create account/i).click();

      // Wait for success
      cy.contains(/account created/i, { timeout: 10000 }).should('be.visible');

      // Try to register again with same email
      cy.visit('/register');
      
      cy.get('input[type="email"]').type(duplicateEmail);
      cy.get('input[type="password"]').first().type(testUser.password);
      cy.get('input[type="password"]').last().type(testUser.password);
      cy.contains('button', 'Next').click();
      
      cy.contains('Minecraft Info').should('be.visible');
      cy.get('input[placeholder*="username" i], input[name="username"]').type(`user2_${Date.now()}`);
      cy.contains('button', 'Next').click();
      
      cy.contains('Review & Confirm').should('be.visible');
      cy.contains('button', /create account/i).click();

      // Should show duplicate email error
      cy.contains(/email is already in use/i, { timeout: 10000 }).should('be.visible');
    });

    it('should handle duplicate username error', () => {
      const duplicateUsername = `dupuser_${Date.now()}`;
      
      // First registration
      cy.get('input[type="email"]').type(`user1+${Date.now()}@example.com`);
      cy.get('input[type="password"]').first().type(testUser.password);
      cy.get('input[type="password"]').last().type(testUser.password);
      cy.contains('button', 'Next').click();
      
      cy.contains('Minecraft Info').should('be.visible');
      cy.get('input[placeholder*="username" i], input[name="username"]').type(duplicateUsername);
      cy.contains('button', 'Next').click();
      
      cy.contains('Review & Confirm').should('be.visible');
      cy.contains('button', /create account/i).click();

      // Wait for success
      cy.contains(/account created/i, { timeout: 10000 }).should('be.visible');

      // Try to register with same username
      cy.visit('/register');
      
      cy.get('input[type="email"]').type(`user2+${Date.now()}@example.com`);
      cy.get('input[type="password"]').first().type(testUser.password);
      cy.get('input[type="password"]').last().type(testUser.password);
      cy.contains('button', 'Next').click();
      
      cy.contains('Minecraft Info').should('be.visible');
      cy.get('input[placeholder*="username" i], input[name="username"]').type(duplicateUsername);
      cy.contains('button', 'Next').click();
      
      cy.contains('Review & Confirm').should('be.visible');
      cy.contains('button', /create account/i).click();

      // Should show duplicate username error
      cy.contains(/username is already taken/i, { timeout: 10000 }).should('be.visible');
    });
  });

  describe('Link Code Integration', () => {
    it('should accept optional link code during registration', () => {
      cy.get('input[type="email"]').type(`linkcode+${Date.now()}@example.com`);
      cy.get('input[type="password"]').first().type(testUser.password);
      cy.get('input[type="password"]').last().type(testUser.password);
      cy.contains('button', 'Next').click();

      // Enter link code in step 2 if field exists
      cy.contains('Minecraft Info').should('be.visible');
      cy.get('input[placeholder*="username" i], input[name="username"]').type(`linkuser_${Date.now()}`);
      
      cy.get('body').then(($body) => {
        if ($body.find('input[name="linkCode"], input[placeholder*="link code" i]').length > 0) {
          cy.get('input[name="linkCode"], input[placeholder*="link code" i]').type('ABC12XYZ');
        }
      });

      cy.contains('button', 'Next').click();

      // Should proceed to review
      cy.contains('Review & Confirm').should('be.visible');
    });
  });
});
