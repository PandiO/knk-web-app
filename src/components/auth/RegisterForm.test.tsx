/**
 * RegisterForm Component Tests
 * 
 * Tests cover the component rendering and initial validation:
 * - Component initialization and rendering
 * - Form field visibility and structure
 * - Password visibility toggle
 * - Initial state
 */

import React from 'react';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from './RegisterForm';
import { render, generateTestEmail } from '../../test-utils/test-helpers';
import { mockAuthClient } from '../../test-utils/mockAuthClient';

// Mock the auth client
jest.mock('../../apiClients/authClient', () => ({
  authClient: require('../../test-utils/mockAuthClient').mockAuthClient,
}));

describe('RegisterForm', () => {
  let onRegistrationSuccess: jest.Mock;

  beforeEach(() => {
    onRegistrationSuccess = jest.fn();
    mockAuthClient.reset();
  });

  describe('Initial Rendering', () => {
    it('should render step 1 (Account Info) initially', () => {
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      expect(screen.getAllByText(/account info/i).length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it('should have the correct form structure', () => {
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      expect(screen.getAllByText(/account info/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });
  });

  describe('Field Rendering', () => {
    it('should have all required input fields on step 1', () => {
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const emailInput = screen.getByTestId('email');
      const passwordInput = screen.getByTestId('password');
      const confirmPasswordInput = screen.getByTestId('confirm-password');
      
      expect(emailInput).toBeInTheDocument();
      expect(passwordInput).toBeInTheDocument();
      expect(confirmPasswordInput).toBeInTheDocument();
    });

    it('should have password visibility toggle buttons', () => {
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const toggleButtons = screen.getAllByRole('button', { name: /show password|hide password/i });
      expect(toggleButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility when clicking the eye icon', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const passwordInput = screen.getByTestId('password') as HTMLInputElement;
      const toggleButtons = screen.getAllByRole('button', { name: /show password|hide password/i });
      const passwordToggle = toggleButtons[0]; // First one should be for password field
      
      // Initially password should be hidden
      expect(passwordInput.type).toBe('password');
      
      // Click to show
      await user.click(passwordToggle);
      expect(passwordInput.type).toBe('text');
      
      // Click to hide
      await user.click(passwordToggle);
      expect(passwordInput.type).toBe('password');
    });

    it('should toggle confirm password visibility when clicking the eye icon', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const confirmPasswordInput = screen.getByTestId('confirm-password') as HTMLInputElement;
      const toggleButtons = screen.getAllByRole('button', { name: /show password|hide password/i });
      const confirmToggle = toggleButtons[1]; // Second one should be for confirm field
      
      // Initially password should be hidden
      expect(confirmPasswordInput.type).toBe('password');
      
      // Click to show
      await user.click(confirmToggle);
      expect(confirmPasswordInput.type).toBe('text');
      
      // Click to hide
      await user.click(confirmToggle);
      expect(confirmPasswordInput.type).toBe('password');
    });
  });

  describe('Form Input', () => {
    it('should allow typing in email field', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const emailInput = screen.getByTestId('email') as HTMLInputElement;
      const testEmail = generateTestEmail();
      
      await user.type(emailInput, testEmail);
      expect(emailInput.value).toBe(testEmail);
    });

    it('should allow typing in password field', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const passwordInput = screen.getByTestId('password') as HTMLInputElement;
      const testPassword = 'TestPassword123!';
      
      await user.type(passwordInput, testPassword);
      expect(passwordInput.value).toBe(testPassword);
    });

    it('should allow typing in confirm password field', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const confirmPasswordInput = screen.getByTestId('confirm-password') as HTMLInputElement;
      const testPassword = 'TestPassword123!';
      
      await user.type(confirmPasswordInput, testPassword);
      expect(confirmPasswordInput.value).toBe(testPassword);
    });

    it('should display password requirements', () => {
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      expect(screen.getByText(/password tips/i)).toBeInTheDocument();
      expect(screen.getByText(/mix of uppercase, lowercase, numbers/i)).toBeInTheDocument();
    });
  });

  describe('Validation - Duplicate Email', () => {
    it('should prevent form submission when email is already registered', async () => {
      const user = userEvent.setup();
      mockAuthClient.setRegisterFailure('DuplicateEmail');
      
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      // Fill in the form with duplicate email
      const emailInput = screen.getByTestId('email');
      const passwordInput = screen.getByTestId('password');
      const confirmPasswordInput = screen.getByTestId('confirm-password');
      
      await user.type(emailInput, 'duplicate@example.com');
      await user.type(passwordInput, 'TestPassword');
      await user.type(confirmPasswordInput, 'TestPassword');
      
      // Proceed to step 2
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      // Wait for step 2 to appear - check for username field
      await screen.findByTestId('username');
      
      // Fill in username
      const usernameInput = screen.getByTestId('username');
      await user.type(usernameInput, 'testuser');
      
      // Proceed to step 3
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Submit form on step 3
      const createButton = await screen.findByRole('button', { name: /create account/i });
      await user.click(createButton);
      
      // Should show error in FeedbackModal and not call onRegistrationSuccess
      const modal = await screen.findByRole('dialog');
      expect(within(modal).getByText(/email is already in use/i)).toBeInTheDocument();
      expect(onRegistrationSuccess).not.toHaveBeenCalled();
    });

    it('should check email availability during input', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const emailInput = screen.getByTestId('email');
      
      // Type email that's already taken (based on mock)
      await user.type(emailInput, 'taken@example.com');
      await user.tab(); // Blur the field to trigger validation
      
      // Should show warning about email being taken
      expect(await screen.findByText(/email.*already.*use/i)).toBeInTheDocument();
    });
  });

  describe('Validation - Password Mismatch', () => {
    it('should prevent form submission when passwords do not match', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const emailInput = screen.getByTestId('email');
      const passwordInput = screen.getByTestId('password');
      const confirmPasswordInput = screen.getByTestId('confirm-password');
      
      await user.type(emailInput, generateTestEmail());
      await user.type(passwordInput, 'TestPassword');
      await user.type(confirmPasswordInput, 'DifferentPassword456!');
      
      // Try to submit
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      // Should show error and not proceed
      expect(await screen.findByText(/passwords.*do not match/i)).toBeInTheDocument();
      expect(onRegistrationSuccess).not.toHaveBeenCalled();
    });

    it('should show real-time password mismatch feedback', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const passwordInput = screen.getByTestId('password');
      const confirmPasswordInput = screen.getByTestId('confirm-password');
      
      await user.type(passwordInput, 'TestPassword');
      await user.type(confirmPasswordInput, 'Different');
      
      // Should show mismatch indicator
      expect(await screen.findByText(/passwords.*do not match/i)).toBeInTheDocument();
    });

    it('should clear mismatch error when passwords match', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const passwordInput = screen.getByTestId('password');
      const confirmPasswordInput = screen.getByTestId('confirm-password');
      
      await user.type(passwordInput, 'TestPassword');
      await user.type(confirmPasswordInput, 'Different');
      
      // Should show mismatch
      expect(await screen.findByText(/passwords.*do not match/i)).toBeInTheDocument();
      
      // Clear and type matching password
      await user.clear(confirmPasswordInput);
      await user.type(confirmPasswordInput, 'TestPassword');
      
      // Mismatch error should disappear
      expect(screen.queryByText(/passwords.*do not match/i)).not.toBeInTheDocument();
    });
  });

  describe('Validation - Weak Password', () => {
    it('should prevent form submission with weak password (too short)', async () => {
      const user = userEvent.setup();
      mockAuthClient.setRegisterFailure('InvalidPassword');
      
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const emailInput = screen.getByTestId('email');
      const passwordInput = screen.getByTestId('password');
      const confirmPasswordInput = screen.getByTestId('confirm-password');
      
      await user.type(emailInput, generateTestEmail());
      await user.type(passwordInput, 'Weak1!');
      await user.type(confirmPasswordInput, 'Weak1!');
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      // Should show error about password requirements
      expect(await screen.findByText(/password.*at least 8 characters/i)).toBeInTheDocument();
      expect(onRegistrationSuccess).not.toHaveBeenCalled();
    });

    it('should prevent form submission with common weak password', async () => {
      const user = userEvent.setup();
      
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const emailInput = screen.getByTestId('email');
      const passwordInput = screen.getByTestId('password');
      const confirmPasswordInput = screen.getByTestId('confirm-password');
      
      await user.type(emailInput, generateTestEmail());
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      // Should show error about weak password (client-side validation)
      // The error should contain either "too common" or "too weak" 
      expect(await screen.findByText(/too common|too weak/i)).toBeInTheDocument();
      expect(onRegistrationSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Validation - Form Progression', () => {
    it('should not proceed to step 2 with invalid email format', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const emailInput = screen.getByTestId('email');
      const passwordInput = screen.getByTestId('password');
      const confirmPasswordInput = screen.getByTestId('confirm-password');
      
      await user.type(emailInput, 'invalid-email');
      await user.type(passwordInput, 'TestPassword');
      await user.type(confirmPasswordInput, 'TestPassword');
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      // Should show email validation error
      expect(await screen.findByText(/invalid email|valid email address/i)).toBeInTheDocument();
      // Should still be on step 1
      expect(screen.getAllByText(/account info/i).length).toBeGreaterThan(0);
    });

    it('should not proceed to step 2 with empty required fields', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      // Should show validation errors for empty fields
      const errors = screen.getAllByText(/required/i);
      expect(errors.length).toBeGreaterThanOrEqual(2); // Email and password errors
      // Should still be on step 1
      expect(screen.getAllByText(/account info/i).length).toBeGreaterThan(0);
    });

    it('should proceed to step 2 when all validations pass', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const emailInput = screen.getByTestId('email');
      const passwordInput = screen.getByTestId('password');
      const confirmPasswordInput = screen.getByTestId('confirm-password');
      
      await user.type(emailInput, generateTestEmail());
      await user.type(passwordInput, 'TestPassword');
      await user.type(confirmPasswordInput, 'TestPassword');
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      // Should proceed to step 2 (Minecraft Info) - wait for username field to appear
      await screen.findByTestId('username');
    });
  });

  describe('Error Handling', () => {
    it('should display server error messages', async () => {
      const user = userEvent.setup();
      mockAuthClient.setRegisterFailure('ServerError');
      
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      // Fill step 1
      const emailInput = screen.getByTestId('email');
      const passwordInput = screen.getByTestId('password');
      const confirmPasswordInput = screen.getByTestId('confirm-password');
      
      await user.type(emailInput, generateTestEmail());
      await user.type(passwordInput, 'TestPassword');
      await user.type(confirmPasswordInput, 'TestPassword');
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Wait for step 2 to appear - check for username field
      await screen.findByTestId('username');
      
      // Fill step 2
      const usernameInput = screen.getByTestId('username');
      await user.type(usernameInput, 'testuser');
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Submit on step 3
      const createButton = await screen.findByRole('button', { name: /create account/i });
      await user.click(createButton);
      
      // Should display error message from server in FeedbackModal
      const modal = await screen.findByRole('dialog');
      expect(within(modal).getByText(/something went wrong/i)).toBeInTheDocument();
      expect(onRegistrationSuccess).not.toHaveBeenCalled();
    });

    it('should clear previous errors when retrying', async () => {
      const user = userEvent.setup();
      mockAuthClient.setRegisterFailure('InvalidPassword');
      
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const emailInput = screen.getByTestId('email');
      const passwordInput = screen.getByTestId('password');
      const confirmPasswordInput = screen.getByTestId('confirm-password');
      
      // First attempt with weak password
      await user.type(emailInput, generateTestEmail());
      await user.type(passwordInput, 'Weak1!');
      await user.type(confirmPasswordInput, 'Weak1!');
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      expect(await screen.findByText(/password.*at least 8 characters/i)).toBeInTheDocument();
      
      // Reset mock and retry with valid password
      mockAuthClient.reset();
      await user.clear(passwordInput);
      await user.clear(confirmPasswordInput);
      await user.type(passwordInput, 'TestPassword');
      await user.type(confirmPasswordInput, 'TestPassword');
      
      await user.click(nextButton);
      
      // Error should be cleared and form should proceed
      expect(screen.queryByText(/password.*at least 8 characters/i)).not.toBeInTheDocument();
    });
  });

  describe('Complete Registration Flow', () => {
    it('should successfully complete registration with valid data', async () => {
      const user = userEvent.setup();
      render(<RegisterForm onRegistrationSuccess={onRegistrationSuccess} />);
      
      const testEmail = generateTestEmail();
      
      // Step 1: Account Info
      const emailInput = screen.getByTestId('email');
      const passwordInput = screen.getByTestId('password');
      const confirmPasswordInput = screen.getByTestId('confirm-password');
      
      await user.type(emailInput, testEmail);
      await user.type(passwordInput, 'TestPassword');
      await user.type(confirmPasswordInput, 'TestPassword');
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Wait for step 2 to appear - check for username field
      await screen.findByTestId('username');
      
      // Step 2: Minecraft Info
      const usernameInput = screen.getByTestId('username');
      await user.type(usernameInput, 'testuser123');
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Step 3: Review & Confirm
      const createButton = await screen.findByRole('button', { name: /create account/i });
      await user.click(createButton);
      
      // Should call onRegistrationSuccess with link code after success modal appears
      await waitFor(() => {
        expect(onRegistrationSuccess).toHaveBeenCalled();
      }, { timeout: 3000 });
    });
  });
});
