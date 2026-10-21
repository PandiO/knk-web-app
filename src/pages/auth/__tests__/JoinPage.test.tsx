import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { JoinPage } from '../JoinPage';
import { invitationClient } from '../../../apiClients/invitationClient';
import { useAuth } from '../../../contexts/AuthContext';

const PASSWORD = 'Kn1ghts&Kings!';
const mockNavigate = jest.fn();
let mockSearch = '';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams(mockSearch)],
}), { virtual: true });
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../apiClients/invitationClient', () => ({ invitationClient: { check: jest.fn() } }));

const check = invitationClient.check as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;

describe('JoinPage', () => {
  const register = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch = '';
    mockedUseAuth.mockReturnValue({ isLoggedIn: false, isLoading: false, register });
  });

  it('checks the code from the link and signs up with a typed email', async () => {
    mockSearch = '?code=KNK-7QH4M-2XA9P';
    check.mockResolvedValue({ valid: true, kind: 'Shared', expiresAt: '2026-10-28T12:00:00Z' });
    register.mockResolvedValue({ id: 9 });
    render(<JoinPage />);

    const email = await screen.findByLabelText('Email');
    expect(check).toHaveBeenCalledWith({ code: 'KNK-7QH4M-2XA9P' });
    expect(email).not.toHaveAttribute('readonly');
    await userEvent.type(email, 'player@example.com');
    await userEvent.type(screen.getByLabelText('Password'), PASSWORD);
    await userEvent.type(screen.getByLabelText('Confirm password'), PASSWORD);
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/account/link', { replace: true }));
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ inviteCode: 'KNK-7QH4M-2XA9P', email: 'player@example.com' }));
    expect(register.mock.calls[0][0].inviteToken).toBeUndefined();
  });

  it('lets the player type a code, and says when it is invalid', async () => {
    check.mockResolvedValue({ valid: false, error: 'InvalidInvite' });
    render(<JoinPage />);

    await userEvent.type(screen.getByLabelText('Invitation code'), 'knk-aaaaa-bbbbb');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByTestId('invalid-invite')).toBeInTheDocument();
    expect(check).toHaveBeenCalledWith({ code: 'KNK-AAAAA-BBBBB' });
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('shows a duplicate email on the email field', async () => {
    mockSearch = '?code=KNK-7QH4M-2XA9P';
    check.mockResolvedValue({ valid: true, kind: 'Shared' });
    register.mockRejectedValue({ status: 409, response: { error: 'DuplicateEmail' } });
    render(<JoinPage />);

    await userEvent.type(await screen.findByLabelText('Email'), 'steve@example.com');
    await userEvent.type(screen.getByLabelText('Password'), PASSWORD);
    await userEvent.type(screen.getByLabelText('Confirm password'), PASSWORD);
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/already used by another account/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
