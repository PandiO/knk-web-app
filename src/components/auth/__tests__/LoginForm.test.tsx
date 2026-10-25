import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm, describeLoginError } from '../LoginForm';
import { useAuth } from '../../../contexts/AuthContext';
import { ERROR_MESSAGES } from '../../../utils/authConstants';
import { authClient } from '../../../apiClients/authClient';
import { fetchOnboardingInfo, resetOnboardingInfoCache } from '../../../hooks/useOnboardingInfo';
import { savePendingClaim } from '../../../utils/claimCode';
import { savePendingInvite } from '../../../utils/pendingInvite';
import { CloudflareSessionError } from '../../../services/cloudflareAccess';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../../contexts/AuthContext');
jest.mock('../../../apiClients/authClient', () => ({ authClient: { onboardingInfo: jest.fn() } }));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedInfo = authClient.onboardingInfo as jest.Mock;

/** The mode the form finds cached, so tests that don't await it see no late state update. */
async function withMode(mode: string, accessGate = false) {
  resetOnboardingInfoCache();
  mockedInfo.mockResolvedValue({ registrationMode: mode, accessGate });
  await fetchOnboardingInfo();
}

describe('LoginForm', () => {
  const mockLogin = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    sessionStorage.clear();
    await withMode('LinkCode');
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
      expect(screen.queryByTestId('invite-only-note')).not.toBeInTheDocument();
    });
  });

  // 2026-10-25: a new tester followed "Create an account" into the link-code form, which can't succeed in Invite mode.
  describe('"Create an account" with invitations on', () => {
    it('points to /join and says the alpha is invite-only', async () => {
      await withMode('Invite');
      render(<LoginForm />);

      expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/join');
      expect(screen.getByTestId('invite-only-note')).toHaveTextContent(/invite-only/);
    });

    it('learns the mode after the first render too', async () => {
      resetOnboardingInfoCache();
      mockedInfo.mockResolvedValue({ registrationMode: 'Invite' });
      render(<LoginForm />);

      expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/auth/register');
      await waitFor(() => expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/join'));
    });

    it('returns to a kept personal invitation (the player clicked Log in on the invite page)', async () => {
      await withMode('Invite');
      savePendingInvite({ token: 'tok', email: 'tester@example.com', expiresAt: new Date(Date.now() + 60_000).toISOString() });
      render(<LoginForm />);

      expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/invite');
    });

    it('continues a verified claim code on /link', async () => {
      await withMode('Open');
      savePendingClaim({ code: 'K7QHM2XA', minecraftName: 'Steve', expiresAt: new Date(Date.now() + 60_000).toISOString() });
      render(<LoginForm />);

      expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/link');
    });

    it('with the Cloudflare gate on, says the first visit on a device goes through Cloudflare first', async () => {
      await withMode('Invite', true);
      render(<LoginForm />);

      expect(screen.getByTestId('access-gate-note')).toHaveTextContent(/Cloudflare asks for your email/);
    });

    it('shows the Cloudflare wording, not "Network error", when the Access session is missing', async () => {
      mockLogin.mockRejectedValue(new CloudflareSessionError(new TypeError('Failed to fetch')));
      render(<LoginForm />);

      await userEvent.type(screen.getByLabelText(/email or minecraft name/i), 'Steve');
      await userEvent.type(screen.getByLabelText(/^password/i), 'hunter22');
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      expect(await screen.findByTestId('login-error')).toHaveTextContent(/Cloudflare sign-in has expired or isn't active/);
    });

    it('keeps the register page when the mode cannot be fetched', async () => {
      resetOnboardingInfoCache();
      mockedInfo.mockReset().mockRejectedValue(new TypeError('Failed to fetch'));
      render(<LoginForm />);

      await waitFor(() => expect(mockedInfo).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockedInfo.mock.results[0].value).rejects.toBeInstanceOf(TypeError));
      expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/auth/register');
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
    expect(describeLoginError(new CloudflareSessionError())).toMatch(/Cloudflare sign-in/);
    expect(describeLoginError({ status: 500 })).toBe(ERROR_MESSAGES.ServerError);
  });
});
