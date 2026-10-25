/**
 * RegisterForm: code -> email and password -> done (alpha hardening WP9.4, decision D1).
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from './RegisterForm';
import { authClient } from '../../apiClients/authClient';
import { useAuth } from '../../contexts/AuthContext';
import { ERROR_MESSAGES } from '../../utils/authConstants';
import { normalizeLinkCode, normalizeLinkCodeInput } from '../../utils/linkCode';
import { fetchRegistrationMode, resetRegistrationModeCache } from '../../hooks/useRegistrationMode';

const mockNavigate = jest.fn();

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
  useNavigate: () => mockNavigate,
}), { virtual: true });
jest.mock('../../apiClients/authClient', () => ({
  authClient: { validateLinkCode: jest.fn(), registrationInfo: jest.fn() },
}));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedValidate = authClient.validateLinkCode as jest.Mock;
const mockedInfo = authClient.registrationInfo as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;
const PASSWORD = 'Kn1ghts&Kings!';

/** The mode the form finds cached, so tests that don't await it see no late state update. */
async function withMode(mode: string) {
  resetRegistrationModeCache();
  mockedInfo.mockResolvedValue({ mode });
  await fetchRegistrationMode();
}

async function enterCode(code = 'ABCD1234') {
  await userEvent.type(screen.getByTestId('link-code'), code);
  await userEvent.click(screen.getByRole('button', { name: /check code/i }));
}

async function fillAccount(email = 'steve@example.com') {
  await userEvent.type(await screen.findByLabelText(/email address/i), email);
  await userEvent.type(screen.getByTestId('password'), PASSWORD);
  await userEvent.type(screen.getByTestId('confirm-password'), PASSWORD);
}

describe('RegisterForm', () => {
  const register = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    await withMode('LinkCode');
    mockedUseAuth.mockReturnValue({ register });
  });

  it('starts with the link code and the server address, without a username field', () => {
    render(<RegisterForm />);

    expect(screen.getByTestId('link-code')).toBeInTheDocument();
    expect(screen.getByText('play.knightsandkings.net')).toBeInTheDocument();
    expect(screen.getByText('/account link')).toBeInTheDocument();
    expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument();
  });

  it('registers with the code, logs the player in and shows the done step (happy path)', async () => {
    const onRegistering = jest.fn();
    const onRegistrationSuccess = jest.fn();
    mockedValidate.mockResolvedValue({ isValid: true, username: 'Steve' });
    register.mockResolvedValue({ id: 5, username: 'Steve' });
    render(<RegisterForm onRegistering={onRegistering} onRegistrationSuccess={onRegistrationSuccess} />);

    await enterCode('abcd1234');
    expect(mockedValidate).toHaveBeenCalledWith('ABCD1234');
    expect(await screen.findByTestId('link-code-owner')).toHaveTextContent('This code belongs to Steve.');

    await fillAccount();
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(register).toHaveBeenCalledWith({
      linkCode: 'ABCD1234',
      email: 'steve@example.com',
      password: PASSWORD,
      passwordConfirmation: PASSWORD,
    }));
    expect(await screen.findByText(/your web account is ready/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to your account/i })).toHaveAttribute('href', '/account');
    expect(onRegistering).toHaveBeenCalledWith(true);
    expect(onRegistrationSuccess).toHaveBeenCalled();
  });

  it('stays on the code step for an invalid code', async () => {
    mockedValidate.mockResolvedValue({ isValid: false, error: 'Invalid or expired link code' });
    render(<RegisterForm />);

    await enterCode();

    expect(await screen.findByText(ERROR_MESSAGES.InvalidLinkCode)).toBeInTheDocument();
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
  });

  it('sends a claim code typed as XXXX-XXXX to /link instead of checking it as a link code (2026-10-25)', async () => {
    render(<RegisterForm />);

    await userEvent.type(screen.getByTestId('link-code'), 'k7qh-m2xa');

    expect(screen.getByTestId('link-code')).toHaveValue('K7QH-M2XA');
    expect(screen.getByTestId('claim-code-detected')).toHaveTextContent(/disconnect screen/);
    await userEvent.click(screen.getByRole('button', { name: /continue with this code/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/link?code=K7QH-M2XA');
    expect(mockedValidate).not.toHaveBeenCalled();
  });

  it('hints at the claim flow when a refused link code could be a claim code without its dash', async () => {
    mockedValidate.mockResolvedValue({ isValid: false });
    render(<RegisterForm />);

    await enterCode('k7qhm2xa');

    expect(await screen.findByText(ERROR_MESSAGES.InvalidLinkCode)).toBeInTheDocument();
    const hint = screen.getByTestId('claim-code-hint');
    expect(hint).toHaveTextContent(/15 minutes/);
    expect(hint.querySelector('a')).toHaveAttribute('href', '/link?code=K7QH-M2XA');
  });

  it('gives no claim hint for a refused code with a letter a claim code never has', async () => {
    mockedValidate.mockResolvedValue({ isValid: false });
    render(<RegisterForm />);

    await enterCode('ABCDOLIL');

    expect(await screen.findByText(ERROR_MESSAGES.InvalidLinkCode)).toBeInTheDocument();
    expect(screen.queryByTestId('claim-code-hint')).not.toBeInTheDocument();
  });

  it('asks for all 8 characters before calling the API', async () => {
    render(<RegisterForm />);

    await enterCode('ABC');

    expect(await screen.findByText(/8-character code/i, { selector: '#link-code-error' })).toBeInTheDocument();
    expect(mockedValidate).not.toHaveBeenCalled();
  });

  it('shows DuplicateEmail on the email field', async () => {
    mockedValidate.mockResolvedValue({ isValid: true, username: 'Steve' });
    register.mockRejectedValue({ status: 409, code: 'DuplicateEmail', response: { error: 'DuplicateEmail' } });
    const onRegistering = jest.fn();
    render(<RegisterForm onRegistering={onRegistering} />);

    await enterCode();
    await fillAccount();
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(ERROR_MESSAGES.DuplicateEmail)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('aria-invalid', 'true');
    expect(onRegistering).toHaveBeenLastCalledWith(false);
  });

  it('shows AlreadyRegistered on the Minecraft account, with login and reset links', async () => {
    mockedValidate.mockResolvedValue({ isValid: true, username: 'Steve' });
    register.mockRejectedValue({ status: 409, code: 'AlreadyRegistered' });
    render(<RegisterForm />);

    await enterCode();
    await fillAccount();
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(ERROR_MESSAGES.AlreadyRegistered)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/auth/login');
    expect(screen.getByRole('link', { name: /reset your password/i })).toHaveAttribute('href', '/auth/forgot-password');
  });

  it('says an invitation is needed when the server is invite-only (KNG-212)', async () => {
    mockedValidate.mockResolvedValue({ isValid: true, username: 'Steve' });
    register.mockRejectedValue({ status: 403, response: { error: 'InviteRequired', message: 'You need an invitation to create an account.' } });
    render(<RegisterForm />);
    await enterCode();
    await fillAccount();

    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    const notice = await screen.findByTestId('invite-required');
    expect(notice).toHaveTextContent('You need an invitation to create an account');
    expect(notice.querySelector('a[href="/join"]')).not.toBeNull();
  });

  it('goes back to the code step when the code expired meanwhile', async () => {
    mockedValidate.mockResolvedValue({ isValid: true, username: 'Steve' });
    register.mockRejectedValue({ status: 400, code: 'InvalidLinkCode' });
    render(<RegisterForm />);

    await enterCode();
    await fillAccount();
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(ERROR_MESSAGES.InvalidLinkCode)).toBeInTheDocument();
    expect(screen.getByTestId('link-code')).toBeInTheDocument();
  });

  it('checks the password before calling the API', async () => {
    mockedValidate.mockResolvedValue({ isValid: true, username: 'Steve' });
    render(<RegisterForm />);

    await enterCode();
    await userEvent.type(await screen.findByLabelText(/email address/i), 'steve@example.com');
    await userEvent.type(screen.getByTestId('password'), PASSWORD);
    await userEvent.type(screen.getByTestId('confirm-password'), 'different');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect((await screen.findAllByText(/passwords do not match/i)).length).toBeGreaterThan(0);
    expect(register).not.toHaveBeenCalled();
  });
});

describe('RegisterForm with invitations on (Mode=Invite, 2026-10-25)', () => {
  const register = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    await withMode('Invite');
    mockedUseAuth.mockReturnValue({ register });
  });

  async function openInviteStep() {
    render(<RegisterForm />);
    return screen.findByTestId('invite-mode');
  }

  it('opens on the invitation step and folds the link-code form away', async () => {
    const step = await openInviteStep();

    expect(step).toHaveTextContent(/invite-only/i);
    expect(screen.getByRole('heading', { name: /sign up with your invitation/i })).toBeInTheDocument();
    expect(screen.queryByTestId('link-code')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /check code/i })).not.toBeInTheDocument();
    expect(mockedValidate).not.toHaveBeenCalled();
  });

  it('sends an invitation code to /join', async () => {
    await openInviteStep();

    await userEvent.type(screen.getByTestId('invite-entry'), 'knk-7qh4m-2xa9p');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/join?code=KNK-7QH4M-2XA9P');
  });

  it('sends the code from the disconnect screen to /link', async () => {
    await openInviteStep();

    await userEvent.type(screen.getByTestId('invite-entry'), 'k7qh-m2xa{enter}');

    expect(mockNavigate).toHaveBeenCalledWith('/link?code=K7QH-M2XA');
  });

  it('opens the link-code form, filled in, for 8 plain characters', async () => {
    await openInviteStep();

    await userEvent.type(screen.getByTestId('invite-entry'), 'abcd1234');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('link-code')).toHaveValue('ABCD1234');
    expect(screen.getByTestId('grandfathered-note')).toBeInTheDocument();
  });

  it('asks for a code before continuing', async () => {
    await openInviteStep();

    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/KNK-XXXXX-XXXXX/);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('keeps the link-code path for players from before the invitations, behind a question', async () => {
    mockedValidate.mockResolvedValue({ isValid: true, username: 'Steve' });
    await openInviteStep();

    await userEvent.click(screen.getByRole('button', { name: /already playing and got a code from \/account link/i }));

    expect(screen.getByRole('heading', { name: /enter your link code/i })).toBeInTheDocument();
    expect(screen.queryByTestId('invite-mode')).not.toBeInTheDocument();
    await enterCode('ABCD1234');
    expect(await screen.findByTestId('link-code-owner')).toHaveTextContent('Steve');

    // And back.
    await userEvent.click(screen.getByRole('button', { name: /use a different code/i }));
    await userEvent.click(screen.getByRole('button', { name: /sign up with your invitation instead/i }));
    expect(screen.getByTestId('invite-mode')).toBeInTheDocument();
  });

  it('behaves as before while the mode is unknown (the API could not be asked)', async () => {
    resetRegistrationModeCache();
    mockedInfo.mockReset().mockRejectedValue(new TypeError('Failed to fetch'));
    render(<RegisterForm />);

    expect(screen.getByTestId('link-code')).toBeInTheDocument();
    await waitFor(() => expect(mockedInfo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockedInfo.mock.results[0].value).rejects.toBeInstanceOf(TypeError));
    expect(screen.queryByTestId('invite-mode')).not.toBeInTheDocument();
  });
});

describe('normalizeLinkCode', () => {
  it('uppercases, drops separators and caps the length', () => {
    expect(normalizeLinkCode('ab-cd 12_34xyz')).toBe('ABCD1234');
  });

  it('keeps one dash while typing, so a claim code stays recognisable', () => {
    expect(normalizeLinkCodeInput('k7qh-m2xa')).toBe('K7QH-M2XA');
    expect(normalizeLinkCodeInput('k7qh–m2xa')).toBe('K7QH-M2XA');
    expect(normalizeLinkCodeInput('ab-cd-12 34xyz')).toBe('AB-CD1234');
    expect(normalizeLinkCodeInput('abcd1234xyz')).toBe('ABCD1234');
    expect(normalizeLinkCodeInput('k7qh-m2xa99')).toBe('K7QH-M2XA');
    expect(normalizeLinkCode(normalizeLinkCodeInput('abcd1234xyz'))).toBe('ABCD1234');
  });
});
