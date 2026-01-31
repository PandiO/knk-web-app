/**
 * RegisterForm Component Tests
 * 
 * Tests cover the complete registration flow:
 * - Multi-step form navigation
 * - Field validation (email, password, username)
 * - Successful registration with link code generation
 * - Error handling (duplicate email/username, weak password)
 * - Link code integration
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from './RegisterForm';
import { render, generateTestEmail, generateTestUsername } from '../../test-utils/test-helpers';
import { mockAuthClient } from '../../test-utils/mockAuthClient';

// Mock the auth client
jest.mock('../../apiClients/authClient', () => ({
  authClient: mockAuthClient,
}));

describe('RegisterForm', () => {
  let onRegistrationSuccess: jest.Mock;

  beforeEach(() => {
    onRegistrationSuccess = jest.fn();
    mockAuthClient.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Step Navigation', () => {
    it('should render step 1 (Account Info) initially', () => {
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      expect(screen.getByText('Account Info')).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it('should navigate to step 2 when step 1 is valid', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);

      // Fill step 1
      await user.type(screen.getByLabelText(/email/i), generateTestEmail());
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');

      // Click next
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Should be on step 2
      await waitFor(() => {
        expect(screen.getByText('Minecraft Info')).toBeInTheDocument();
      });
      expect(screen.getByLabelText(/minecraft username/i)).toBeInTheDocument();
    });

    it('should navigate to step 3 (Review) when all steps are valid', async () => {
      const user = userEvent.setup();
      const testEmail = generateTestEmail();
      const testUsername = generateTestUsername();

      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);

      // Complete step 1
      await user.type(screen.getByLabelText(/email/i), testEmail);
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Complete step 2
      await waitFor(() => {
        expect(screen.getByLabelText(/minecraft username/i)).toBeInTheDocument();
      });
      await user.type(screen.getByLabelText(/minecraft username/i), testUsername);
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Should be on step 3
      await waitFor(() => {
        expect(screen.getByText('Review & Confirm')).toBeInTheDocument();
      });
      expect(screen.getByText(testEmail)).toBeInTheDocument();
      expect(screen.getByText(testUsername)).toBeInTheDocument();
    });

    it('should navigate back to previous steps', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);

      // Go to step 2
      await user.type(screen.getByLabelText(/email/i), generateTestEmail());
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Minecraft Info')).toBeInTheDocument();
      });

      // Click back
      await user.click(screen.getByRole('button', { name: /back/i }));

      // Should be back on step 1
      await waitFor(() => {
        expect(screen.getByText('Account Info')).toBeInTheDocument();
      });
    });
  });

  describe('Validation', () => {
    it('should show error for invalid email format', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);

      await user.type(screen.getByLabelText(/email/i), 'invalid-email');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeInTheDocument();
      });
    });

    it('should show error for weak password', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);

      await user.type(screen.getByLabelText(/email/i), generateTestEmail());
      await user.type(screen.getByLabelText(/^password$/i), '123');
      await user.type(screen.getByLabelText(/confirm password/i), '123');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
      });
    });

    it('should show error when passwords do not match', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);

      await user.type(screen.getByLabelText(/email/i), generateTestEmail());
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'DifferentPass456!');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('should show error for empty username', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);

      // Complete step 1
      await user.type(screen.getByLabelText(/email/i), generateTestEmail());
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Try to proceed without username
      await waitFor(() => {
        expect(screen.getByLabelText(/minecraft username/i)).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/username is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Successful Registration', () => {
    it('should complete registration and generate link code', async () => {
      const user = userEvent.setup();
      const testEmail = generateTestEmail();
      const testUsername = generateTestUsername();

      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);

      // Complete step 1
      await user.type(screen.getByLabelText(/email/i), testEmail);
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Complete step 2
      await waitFor(() => {
        expect(screen.getByLabelText(/minecraft username/i)).toBeInTheDocument();
      });
      await user.type(screen.getByLabelText(/minecraft username/i), testUsername);
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Review and submit
      await waitFor(() => {
        expect(screen.getByText('Review & Confirm')).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Should call success callback with link code
      await waitFor(() => {
        expect(onRegistrationSuccess).toHaveBeenCalledWith(
          expect.objectContaining({
            code: expect.any(String),
            expiresAt: expect.any(String),
          })
        );
      }, { timeout: 3000 });
    });

    it('should display success message after registration', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);

      // Complete all steps
      await user.type(screen.getByLabelText(/email/i), generateTestEmail());
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/minecraft username/i)).toBeInTheDocument();
      });
      await user.type(screen.getByLabelText(/minecraft username/i), generateTestUsername());
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Check for success feedback
      await waitFor(() => {
        expect(screen.getByText(/account created/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error for duplicate email', async () => {
      mockAuthClient.setRegisterFailure('DuplicateEmail');
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);

      // Complete registration with duplicate email
      await user.type(screen.getByLabelText(/email/i), 'duplicate@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/minecraft username/i)).toBeInTheDocument();
      });
      await user.type(screen.getByLabelText(/minecraft username/i), generateTestUsername());
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Should show duplicate email error
      await waitFor(() => {
        expect(screen.getByText(/email is already in use/i)).toBeInTheDocument();
      });
    });

    it('should display error for duplicate username', async () => {
      mockAuthClient.setRegisterFailure('DuplicateUsername');
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);

      // Complete registration with duplicate username
      await user.type(screen.getByLabelText(/email/i), generateTestEmail());
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/minecraft username/i)).toBeInTheDocument();
      });
      await user.type(screen.getByLabelText(/minecraft username/i), 'duplicateuser');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Should show duplicate username error
      await waitFor(() => {
        expect(screen.getByText(/username is already taken/i)).toBeInTheDocument();
      });
    });

    it('should not fail registration if link code generation fails', async () => {
      mockAuthClient.setLinkCodeFailure();
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);

      // Complete registration
      await user.type(screen.getByLabelText(/email/i), generateTestEmail());
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/minecraft username/i)).toBeInTheDocument();
      });
      await user.type(screen.getByLabelText(/minecraft username/i), generateTestUsername());
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Should still show success (link code failure is non-fatal)
      await waitFor(() => {
        expect(screen.getByText(/account created/i)).toBeInTheDocument();
      });
      
      // Callback should be called with undefined link code
      await waitFor(() => {
        expect(onRegistrationSuccess).toHaveBeenCalledWith(undefined);
      }, { timeout: 3000 });
    });
  });

  describe('Link Code Integration', () => {
    it('should accept optional link code in step 2', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);

      // Complete step 1
      await user.type(screen.getByLabelText(/email/i), generateTestEmail());
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Enter link code in step 2
      await waitFor(() => {
        expect(screen.getByLabelText(/minecraft username/i)).toBeInTheDocument();
      });
      await user.type(screen.getByLabelText(/minecraft username/i), generateTestUsername());
      
      const linkCodeInput = screen.queryByLabelText(/link code/i);
      if (linkCodeInput) {
        await user.type(linkCodeInput, 'ABC12XYZ');
      }

      await user.click(screen.getByRole('button', { name: /next/i }));

      // Should proceed to step 3
      await waitFor(() => {
        expect(screen.getByText('Review & Confirm')).toBeInTheDocument();
      });
    });

    it('should display link code in review step if provided', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);

      // Complete with link code
      await user.type(screen.getByLabelText(/email/i), generateTestEmail());
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/minecraft username/i)).toBeInTheDocument();
      });
      await user.type(screen.getByLabelText(/minecraft username/i), generateTestUsername());
      
      const linkCodeInput = screen.queryByLabelText(/link code/i);
      if (linkCodeInput) {
        await user.type(linkCodeInput, 'ABC12XYZ');
        await user.click(screen.getByRole('button', { name: /next/i }));

        // Check review step shows link code
        await waitFor(() => {
          expect(screen.getByText(/ABC12XYZ/i)).toBeInTheDocument();
        });
      }
    });
  });
});
