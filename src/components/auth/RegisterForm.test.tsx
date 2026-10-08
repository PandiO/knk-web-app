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
import { normalizeLinkCode } from '../../utils/linkCode';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../apiClients/authClient', () => ({
  authClient: { validateLinkCode: jest.fn() },
}));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedValidate = authClient.validateLinkCode as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;
const PASSWORD = 'Kn1ghts&Kings!';

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

  beforeEach(() => {
    jest.clearAllMocks();
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

    await enterCode('abcd-1234');
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

describe('normalizeLinkCode', () => {
  it('uppercases, drops separators and caps the length', () => {
    expect(normalizeLinkCode('ab-cd 12_34xyz')).toBe('ABCD1234');
  });
});
