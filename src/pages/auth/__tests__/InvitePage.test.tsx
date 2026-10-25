import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { InvitePage } from '../InvitePage';
import { invitationClient } from '../../../apiClients/invitationClient';
import { useAuth } from '../../../contexts/AuthContext';
import { loadPendingInvite, savePendingInvite } from '../../../utils/pendingInvite';
import { fullPageLoad } from '../../../utils/navigation';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456';
const PASSWORD = 'Kn1ghts&Kings!';
const mockNavigate = jest.fn();
let mockToken: string | undefined = TOKEN;
let mockAccessGate = false;

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
  useParams: () => ({ token: mockToken }),
}), { virtual: true });
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../apiClients/invitationClient', () => ({ invitationClient: { check: jest.fn() } }));
jest.mock('../../../hooks/useOnboardingInfo', () => ({
  useOnboardingInfo: () => ({ info: null, loading: false, mode: 'Invite', inviteSignup: true, accessGate: mockAccessGate }),
}));
jest.mock('../../../utils/navigation', () => ({ fullPageLoad: jest.fn(), reloadPage: jest.fn() }));

const check = invitationClient.check as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;

describe('InvitePage', () => {
  const register = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockAccessGate = false;
    mockToken = TOKEN;
    window.history.replaceState(null, '', `/invite/${TOKEN}`);
    mockedUseAuth.mockReturnValue({ isLoggedIn: false, isLoading: false, register });
  });

  it('removes the token from the address bar and shows the invited address locked', async () => {
    check.mockResolvedValue({ valid: true, kind: 'Personal', email: 'tester@example.com', expiresAt: '2026-10-28T12:00:00Z' });

    render(<InvitePage />);

    const email = await screen.findByLabelText('Email');
    expect(window.location.pathname).toBe('/invite');
    expect(window.location.href).not.toContain(TOKEN);
    expect(check).toHaveBeenCalledWith({ token: TOKEN });
    expect(email).toHaveValue('tester@example.com');
    expect(email).toHaveAttribute('readonly');
    expect(screen.getByRole('heading', { name: /closed alpha/i })).toBeInTheDocument();
    expect(document.head.querySelector('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  });

  it('signs up with the token and goes on to linking', async () => {
    check.mockResolvedValue({ valid: true, kind: 'Personal', email: 'tester@example.com', expiresAt: '2026-10-28T12:00:00Z' });
    register.mockResolvedValue({ id: 9, username: 'web-abc' });
    render(<InvitePage />);

    await userEvent.type(await screen.findByLabelText('Password'), PASSWORD);
    await userEvent.type(screen.getByLabelText('Confirm password'), PASSWORD);
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/account/link', { replace: true }));
    expect(register).toHaveBeenCalledWith(expect.objectContaining({
      inviteToken: TOKEN, email: 'tester@example.com', password: PASSWORD, passwordConfirmation: PASSWORD,
    }));
    expect(loadPendingInvite()).toBeNull();
  });

  // 2026-10-25: a tester clicked "Log in" here, then "Create an account", and lost the invitation.
  it('keeps the invitation for the tab and sends "Log in" back here', async () => {
    check.mockResolvedValue({ valid: true, kind: 'Personal', email: 'tester@example.com', expiresAt: '2026-10-28T12:00:00Z' });
    render(<InvitePage />);

    await screen.findByLabelText('Email');

    expect(loadPendingInvite()).toEqual({ token: TOKEN, email: 'tester@example.com', expiresAt: '2026-10-28T12:00:00Z' });
    expect(screen.getByText(/New here\? Sign up with this invitation/)).toBeInTheDocument();
    const note = screen.getByTestId('signup-login-note');
    expect(note).toHaveTextContent(/Already have an account\?/);
    expect(note.querySelector('a')).toHaveAttribute('href', '/auth/login?returnTo=%2Finvite');
  });

  it('resumes the kept invitation when opened without a token (back from the login page)', async () => {
    savePendingInvite({ token: TOKEN, email: 'tester@example.com', expiresAt: new Date(Date.now() + 60_000).toISOString() });
    mockToken = undefined;
    window.history.replaceState(null, '', '/invite');
    check.mockResolvedValue({ valid: true, kind: 'Personal', email: 'tester@example.com', expiresAt: '2026-10-28T12:00:00Z' });
    render(<InvitePage />);

    expect(await screen.findByLabelText('Email')).toHaveValue('tester@example.com');
    expect(check).toHaveBeenCalledWith({ token: TOKEN });
  });

  it('forgets a kept invitation that turns out invalid', async () => {
    check.mockResolvedValue({ valid: false, error: 'InvalidInvite' });
    render(<InvitePage />);

    await screen.findByTestId('invalid-invite');
    expect(loadPendingInvite()).toBeNull();
  });

  it('with the Cloudflare Access sync on, explains the Cloudflare step and continues as a full page load (KNG-216, 2026-10-25)', async () => {
    mockAccessGate = true;
    check.mockResolvedValue({ valid: true, kind: 'Personal', email: 'tester@example.com', expiresAt: '2026-10-28T12:00:00Z' });
    register.mockImplementation(async () => {
      // The register call logs the player in; the page must not bounce them to /account.
      mockedUseAuth.mockReturnValue({ isLoggedIn: true, isLoading: false, register });
      return { user: { id: 9, email: 'tester@example.com' }, accessGate: true };
    });
    render(<InvitePage />);

    // The journey above the form already names the Cloudflare step.
    const journey = await screen.findByTestId('onboarding-journey');
    expect(journey).toHaveTextContent(/Cloudflare/);

    await userEvent.type(screen.getByLabelText('Password'), PASSWORD);
    await userEvent.type(screen.getByLabelText('Confirm password'), PASSWORD);
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    const step = await screen.findByTestId('access-pin-step');
    expect(step).toHaveTextContent('Cloudflare asks for your email');
    expect(step).toHaveTextContent('tester@example.com');
    expect(step).toHaveTextContent('6-digit code');
    expect(step).toHaveTextContent('noreply@notify.cloudflare.com');
    expect(step).not.toHaveTextContent(/emails you a one-time PIN/);
    expect(mockNavigate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Continue to Cloudflare sign-in' }));
    // A document request, never an in-app navigation: Cloudflare must see it.
    expect(fullPageLoad).toHaveBeenCalledWith('/account/link');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('without the gate, the journey has no Cloudflare step', async () => {
    check.mockResolvedValue({ valid: true, kind: 'Personal', email: 'tester@example.com', expiresAt: '2026-10-28T12:00:00Z' });
    render(<InvitePage />);

    const journey = await screen.findByTestId('onboarding-journey');
    expect(journey).not.toHaveTextContent(/Cloudflare/);
    expect(journey).toHaveTextContent(/play\.knightsandkings\.net/);
  });

  it('needs the alpha rules accepted', async () => {
    check.mockResolvedValue({ valid: true, kind: 'Personal', email: 'tester@example.com' });
    render(<InvitePage />);

    await userEvent.type(await screen.findByLabelText('Password'), PASSWORD);
    await userEvent.type(screen.getByLabelText('Confirm password'), PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/accept the alpha rules/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('shows one message for an invalid, used, expired or revoked invite', async () => {
    check.mockResolvedValue({ valid: false, error: 'InvalidInvite' });
    render(<InvitePage />);

    expect(await screen.findByTestId('invalid-invite')).toHaveTextContent('invalid or has expired');
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('shows the invalid state when the invite is used up while the form was open', async () => {
    check.mockResolvedValue({ valid: true, kind: 'Personal', email: 'tester@example.com' });
    register.mockRejectedValue({ status: 400, response: { error: 'InvalidInvite', message: 'This invitation is invalid or has expired.' } });
    render(<InvitePage />);

    await userEvent.type(await screen.findByLabelText('Password'), PASSWORD);
    await userEvent.type(screen.getByLabelText('Confirm password'), PASSWORD);
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByTestId('invalid-invite')).toBeInTheDocument();
  });

  it('without a token in the URL says the link is invalid', async () => {
    mockToken = undefined;
    window.history.replaceState(null, '', '/invite');
    render(<InvitePage />);

    expect(screen.getByTestId('invalid-invite')).toBeInTheDocument();
    expect(check).not.toHaveBeenCalled();
  });
});
