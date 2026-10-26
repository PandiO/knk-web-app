import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AccountLinkPage } from '../AccountLinkPage';
import { authClient } from '../../../apiClients/authClient';
import { useAuth } from '../../../contexts/AuthContext';
import { tokenService } from '../../../utils/tokenService';
import { loadPendingClaim, savePendingClaim } from '../../../utils/claimCode';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => <a href={to} className={className}>{children}</a>,
  useNavigate: () => mockNavigate,
}), { virtual: true });
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
// The real authService runs, so the token switch after a fold (case B) is what is under test.
jest.mock('../../../apiClients/authClient', () => ({ authClient: { linkMinecraftAccount: jest.fn() } }));

const linkCall = authClient.linkMinecraftAccount as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;

describe('AccountLinkPage (/account/link)', () => {
  const refresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockedUseAuth.mockReturnValue({ user: { id: 5, username: 'web-1', minecraftLinked: false }, refresh });
  });

  it('shows the onboarding steps and fills in a kept claim code', () => {
    savePendingClaim({ code: 'K7QHM2XA', minecraftName: 'Steve', expiresAt: new Date(Date.now() + 60_000).toISOString() });
    render(<AccountLinkPage />);

    expect(screen.getByText(/Java Edition 26.3/)).toBeInTheDocument();
    expect(screen.getByText(/stopped with a code/)).toBeInTheDocument();
    expect(screen.getByTestId('claim-code-lifetime')).toHaveTextContent(/same.*code.*new one/);
    // Shown in two groups like the disconnect screen (#192).
    expect(screen.getByLabelText('Code from the server')).toHaveValue('K7QH-M2XA');
  });

  it('links with the code, stores the new session after a fold, and goes to the account page', async () => {
    const setToken = jest.spyOn(tokenService, 'setAccessToken').mockImplementation(() => undefined);
    linkCall.mockResolvedValue({ user: { id: 2 }, merged: true, accessToken: 'token-for-the-minecraft-account', expiresIn: 900 });
    savePendingClaim({ code: 'K7QHM2XA', minecraftName: 'Steve', expiresAt: new Date(Date.now() + 60_000).toISOString() });
    render(<AccountLinkPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Link account' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/account', { replace: true }));
    expect(linkCall).toHaveBeenCalledWith({ linkCode: 'K7QHM2XA' });
    expect(setToken).toHaveBeenCalledWith('token-for-the-minecraft-account', expect.any(Boolean));
    expect(refresh).toHaveBeenCalled();
    expect(loadPendingClaim()).toBeNull();
    setToken.mockRestore();
  });

  it('accepts an /account link code too, unchanged (its alphabet has O, I and L)', async () => {
    linkCall.mockResolvedValue({ user: { id: 5 } });
    render(<AccountLinkPage />);

    await userEvent.type(screen.getByLabelText('Code from the server'), 'abc-dolil');
    expect(screen.getByLabelText('Code from the server')).toHaveValue('ABCD-OLIL');
    await userEvent.click(screen.getByRole('button', { name: 'Link account' }));

    await waitFor(() => expect(linkCall).toHaveBeenCalledWith({ linkCode: 'ABCDOLIL' }));
  });

  // #192: the field shows the separator itself, with or without one typed; the API folds look-alikes.
  it.each(['k7qhm2xo', 'k7qh-m2xo', 'K7QH m2xo'])('shows %s as XXXX-XXXX and sends its 8 characters', async typed => {
    linkCall.mockResolvedValue({ user: { id: 5 } });
    render(<AccountLinkPage />);

    await userEvent.type(screen.getByLabelText('Code from the server'), typed);

    expect(screen.getByLabelText('Code from the server')).toHaveValue('K7QH-M2XO');
    await userEvent.click(screen.getByRole('button', { name: 'Link account' }));
    await waitFor(() => expect(linkCall).toHaveBeenCalledWith({ linkCode: 'K7QHM2XO' }));
  });

  it('says a refused claim code stays valid for 15 minutes', async () => {
    linkCall.mockRejectedValue({ status: 400, response: { error: 'InvalidClaimCode', message: 'This code is invalid or has expired.' } });
    render(<AccountLinkPage />);

    await userEvent.type(screen.getByLabelText('Code from the server'), 'K7QH-M2XA');
    await userEvent.click(screen.getByRole('button', { name: 'Link account' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This code is invalid or has expired.');
    expect(alert).toHaveTextContent(/stays valid for 15 minutes/);
  });

  it('says so for the kept code from /link too', async () => {
    linkCall.mockRejectedValue({ status: 400, response: { error: 'InvalidClaimCode', message: 'This code is invalid or has expired.' } });
    savePendingClaim({ code: 'K7QHM2XA', minecraftName: 'Steve', expiresAt: new Date(Date.now() + 60_000).toISOString() });
    render(<AccountLinkPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Link account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/15 minutes/);
  });

  it('shows the API refusal', async () => {
    linkCall.mockRejectedValue({ status: 400, response: { error: 'OperationFailed', message: 'Invalid or expired link code' } });
    render(<AccountLinkPage />);

    // O, L and I: a link code, never a claim code, so no "stays valid for 15 minutes".
    await userEvent.type(screen.getByLabelText('Code from the server'), 'ZZZZOLIZ');
    await userEvent.click(screen.getByRole('button', { name: 'Link account' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid or expired link code');
    expect(alert).not.toHaveTextContent(/15 minutes/);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('says so when the account is already linked', () => {
    mockedUseAuth.mockReturnValue({ user: { id: 5, username: 'Steve', uuid: 'u', minecraftLinked: true }, refresh });
    render(<AccountLinkPage />);

    expect(screen.getByRole('heading', { name: /is linked/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Code from the server')).not.toBeInTheDocument();
  });
});
