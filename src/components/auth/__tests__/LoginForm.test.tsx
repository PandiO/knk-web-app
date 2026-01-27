import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';
import { useAuth } from '../../../hooks/useAuth';

// Mock useAuth hook
jest.mock('../../../hooks/useAuth');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('LoginForm', () => {
  const mockLogin = jest.fn();
  const defaultAuthValue = {
    user: null,
    isLoggedIn: false,
    isLoading: false,
    error: null,
    login: mockLogin,
    register: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue(defaultAuthValue);
  });

  describe('rendering', () => {
    it('should render email and password fields', () => {
      render(<LoginForm />);

      expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    });

    it('should render remember me checkbox', () => {
      render(<LoginForm />);

      const rememberMeCheckbox = screen.getByRole('checkbox', { name: /remember me/i });
      expect(rememberMeCheckbox).toBeInTheDocument();
      expect(rememberMeCheckbox).toBeChecked(); // Default is true
    });

    it('should render submit button', () => {
      render(<LoginForm />);

      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    });

    it('should render password visibility toggle button', () => {
      render(<LoginForm />);

        expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
    });
  });

  describe('form validation', () => {
    it('should show error when email is empty on submit', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const submitButton = screen.getByRole('button', { name: /log in/i });
      await user.click(submitButton);

      // Check both the sr-only announcement and the visible error message
      await waitFor(() => {
        const srOnlyDiv = document.querySelector('.sr-only[role="alert"]');
        expect(srOnlyDiv).toHaveTextContent(/email is required/i);
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should show error when email format is invalid', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText(/^email/i);
      await user.type(emailInput, 'invalid-email');

      const submitButton = screen.getByRole('button', { name: /log in/i });
      await user.click(submitButton);

      await waitFor(() => {
        const srOnlyDiv = document.querySelector('.sr-only[role="alert"]');
        expect(srOnlyDiv).toHaveTextContent(/please enter a valid email address/i);
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should show error when password is empty on submit', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText(/^email/i);
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /log in/i });
      await user.click(submitButton);

      await waitFor(() => {
        const srOnlyDiv = document.querySelector('.sr-only[role="alert"]');
        expect(srOnlyDiv).toHaveTextContent(/password is required/i);
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should clear validation errors when user corrects input', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      // Submit with empty email to trigger error
      const submitButton = screen.getByRole('button', { name: /log in/i });
      await user.click(submitButton);

      await waitFor(() => {
        const srOnlyDiv = document.querySelector('.sr-only[role="alert"]');
        expect(srOnlyDiv).toHaveTextContent(/email is required/i);
      });

      // Type valid email
      const emailInput = screen.getByLabelText(/^email/i);
      await user.type(emailInput, 'test@example.com');

      // Submit again
      await user.click(submitButton);

      // Email error should be gone (only password error remains)
      expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument();
      await waitFor(() => {
        const srOnlyDiv = document.querySelector('.sr-only[role="alert"]');
        expect(srOnlyDiv).toHaveTextContent(/password is required/i);
      });
    });
  });

  describe('password visibility toggle', () => {
    it('should toggle password visibility when clicking eye icon', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

        const passwordInput = screen.getByLabelText(/^password/i) as HTMLInputElement;
      expect(passwordInput.type).toBe('password');

        const toggleButton = screen.getByRole('button', { name: /show password/i });
      await user.click(toggleButton);

      expect(passwordInput.type).toBe('text');
        expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();

      await user.click(toggleButton);
      expect(passwordInput.type).toBe('password');
    });
  });

  describe('remember me checkbox', () => {
    it('should toggle remember me state when clicking checkbox', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const rememberMeCheckbox = screen.getByRole('checkbox', { name: /remember me/i });
      expect(rememberMeCheckbox).toBeChecked();

      await user.click(rememberMeCheckbox);
      expect(rememberMeCheckbox).not.toBeChecked();

      await user.click(rememberMeCheckbox);
      expect(rememberMeCheckbox).toBeChecked();
    });

    it('should pass rememberMe value to login function', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
      } as any);

      render(<LoginForm />);

  const emailInput = screen.getByLabelText(/^email/i);
  const passwordInput = screen.getByLabelText(/^password/i);
      const rememberMeCheckbox = screen.getByRole('checkbox', { name: /remember me/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(rememberMeCheckbox); // Uncheck (default is checked)

      const submitButton = screen.getByRole('button', { name: /log in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
          rememberMe: false,
        });
      });
    });
  });

  describe('form submission', () => {
    it('should successfully submit login with valid credentials and rememberMe=true', async () => {
      const user = userEvent.setup();
      const mockOnSuccess = jest.fn();
      mockLogin.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
      } as any);

      render(<LoginForm onLoginSuccess={mockOnSuccess} />);

  const emailInput = screen.getByLabelText(/^email/i);
  const passwordInput = screen.getByLabelText(/^password/i);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'SecurePass123!');

      const submitButton = screen.getByRole('button', { name: /log in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'SecurePass123!',
          rememberMe: true, // Default
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/login successful/i)).toBeInTheDocument();
      });

      // Success callback should be called after delay
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('should disable submit button while submitting', async () => {
      const user = userEvent.setup();
      let resolveLogin: any;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });
      mockLogin.mockReturnValue(loginPromise);

      render(<LoginForm />);

  const emailInput = screen.getByLabelText(/^email/i);
  const passwordInput = screen.getByLabelText(/^password/i);
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /log in/i });
      await user.click(submitButton);

      // Button should be disabled during submission
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });

      resolveLogin({ id: 1, email: 'test@example.com' });

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('error handling', () => {
    it('should display error message on invalid credentials', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValue({
        code: 'InvalidCredentials',
        response: { code: 'InvalidCredentials', message: 'Invalid email or password' },
      });

      render(<LoginForm />);

  const emailInput = screen.getByLabelText(/^email/i);
  const passwordInput = screen.getByLabelText(/^password/i);
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');

      const submitButton = screen.getByRole('button', { name: /log in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/login failed/i)).toBeInTheDocument();
        expect(screen.getAllByText(/email or password is incorrect/i).length).toBeGreaterThan(0);
      });
    });

    it('should display custom error message from backend', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValue({
        response: { message: 'Account is temporarily locked' },
      });

      render(<LoginForm />);

  const emailInput = screen.getByLabelText(/^email/i);
  const passwordInput = screen.getByLabelText(/^password/i);
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /log in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getAllByText(/account is temporarily locked/i).length).toBeGreaterThan(0);
      });
    });

    it('should announce errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const submitButton = screen.getByRole('button', { name: /log in/i });
      await user.click(submitButton);

      await waitFor(() => {
          const srOnlyDiv = document.querySelector('.sr-only[role="alert"]');
          expect(srOnlyDiv).toHaveTextContent(/login form has errors/i);
      });
    });

    it('should announce backend errors to screen readers', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValue({
        response: { message: 'Invalid credentials' },
      });

      render(<LoginForm />);

      const emailInput = screen.getByLabelText(/^email/i);
      const passwordInput = screen.getByLabelText(/^password/i);
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');

      const submitButton = screen.getByRole('button', { name: /log in/i });
      await user.click(submitButton);

      await waitFor(() => {
        const srOnlyDiv = document.querySelector('.sr-only[role="alert"]');
        expect(srOnlyDiv).toHaveTextContent(/Invalid credentials/i);
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes on inputs', () => {
      render(<LoginForm />);

        const emailInput = screen.getByLabelText(/^email/i);
        const passwordInput = screen.getByLabelText(/^password/i);

      expect(emailInput).toHaveAttribute('aria-invalid', 'false');
      expect(passwordInput).toHaveAttribute('aria-invalid', 'false');
    });

    it('should mark inputs as invalid when errors exist', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const submitButton = screen.getByRole('button', { name: /log in/i });
      await user.click(submitButton);

      await waitFor(() => {
          const emailInput = screen.getByLabelText(/^email/i);
          const passwordInput = screen.getByLabelText(/^password/i);

        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('should associate error messages with inputs via aria-describedby', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const submitButton = screen.getByRole('button', { name: /log in/i });
      await user.click(submitButton);

      await waitFor(() => {
          const emailInput = screen.getByLabelText(/^email/i);
        expect(emailInput).toHaveAttribute('aria-describedby', 'login-email-error');
        
          const passwordInput = screen.getByLabelText(/^password/i);
        expect(passwordInput).toHaveAttribute('aria-describedby', 'login-password-error');
      });
    });
  });
});
