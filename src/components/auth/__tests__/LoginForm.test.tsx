import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm, describeLoginError } from '../LoginForm';
import { useAuth } from '../../../contexts/AuthContext';
import { ERROR_MESSAGES } from '../../../utils/authConstants';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../../contexts/AuthContext');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('LoginForm', () => {
  const mockLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoggedIn: false,
      isLoading: false,
      error: null,
      login: mockLogin,
      register: jest.fn(),
      logout: jest.fn(),
      logoutAll: jest.fn(),
      refresh: jest.fn(),
    });
  });

  describe('rendering', () => {
    it('asks for an email or Minecraft name as a plain username field', () => {
      render(<LoginForm />);

      const login = screen.getByLabelText(/email or minecraft name/i);
      expect(login).toHaveAttribute('type', 'text');
      expect(login).toHaveAttribute('autocomplete', 'username');
      expect(screen.getByLabelText(/^password/i)).toHaveAttribute('autocomplete', 'current-password');
    });

    it('leaves remember me unchecked by default', () => {
      render(<LoginForm />);

      expect(screen.getByRole('checkbox', { name: /remember me/i })).not.toBeChecked();
    });

    it('links to registration and password reset', () => {
      render(<LoginForm />);

      expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/auth/register');
      expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute('href', '/auth/forgot-password');
    });
  });

  describe('validation', () => {
    it('requires both fields', async () => {
      render(<LoginForm />);

      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      expect(await screen.findByText('Enter your email or Minecraft name', { selector: '#login-identifier-error' })).toBeInTheDocument();
      expect(screen.getByText('Password is required', { selector: '#login-password-error' })).toBeInTheDocument();
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('submitting', () => {
    it('sends the identifier as `login`, trimmed, with remember-me off', async () => {
      const onLoginSuccess = jest.fn();
      mockLogin.mockResolvedValue({ id: 1 });
      render(<LoginForm onLoginSuccess={onLoginSuccess} />);

      await userEvent.type(screen.getByLabelText(/email or minecraft name/i), '  Steve ');
      await userEvent.type(screen.getByLabelText(/^password/i), 'hunter22');
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => expect(mockLogin).toHaveBeenCalledWith({ login: 'Steve', password: 'hunter22', rememberMe: false }));
      expect(onLoginSuccess).toHaveBeenCalled();
    });

    it('passes remember-me when checked', async () => {
      mockLogin.mockResolvedValue({ id: 1 });
      render(<LoginForm />);

      await userEvent.type(screen.getByLabelText(/email or minecraft name/i), 'steve@example.com');
      await userEvent.type(screen.getByLabelText(/^password/i), 'hunter22');
      await userEvent.click(screen.getByRole('checkbox', { name: /remember me/i }));
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => expect(mockLogin).toHaveBeenCalledWith({ login: 'steve@example.com', password: 'hunter22', rememberMe: true }));
    });

    it('shows a generic message on bad credentials and clears the password', async () => {
      mockLogin.mockRejectedValue({ status: 401, code: 'InvalidCredentials' });
      render(<LoginForm />);

      await userEvent.type(screen.getByLabelText(/email or minecraft name/i), 'Steve');
      await userEvent.type(screen.getByLabelText(/^password/i), 'wrong');
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      expect(await screen.findByTestId('login-error')).toHaveTextContent(ERROR_MESSAGES.InvalidCredentials);
      expect(screen.getByLabelText(/email or minecraft name/i)).toHaveValue('Steve');
      expect(screen.getByLabelText(/^password/i)).toHaveValue('');
    });

    it('shows the lockout message', async () => {
      mockLogin.mockRejectedValue({
        status: 429,
        code: 'TooManyAttempts',
        response: { error: 'TooManyAttempts', message: 'Too many attempts. Try again in 15 minutes.' },
      });
      render(<LoginForm />);

      await userEvent.type(screen.getByLabelText(/email or minecraft name/i), 'Steve');
      await userEvent.type(screen.getByLabelText(/^password/i), 'wrong');
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      expect(await screen.findByTestId('login-error')).toHaveTextContent('Too many attempts. Try again in 15 minutes.');
    });
  });
});

describe('describeLoginError', () => {
  it('maps API errors to messages', () => {
    expect(describeLoginError({ status: 401 })).toBe(ERROR_MESSAGES.InvalidCredentials);
    expect(describeLoginError({ status: 429, retryAfter: '120' })).toBe('Too many attempts. Try again in 2 minutes.');
    expect(describeLoginError(new TypeError('Failed to fetch'))).toBe(ERROR_MESSAGES.NetworkError);
    expect(describeLoginError({ status: 500 })).toBe(ERROR_MESSAGES.ServerError);
  });
});
