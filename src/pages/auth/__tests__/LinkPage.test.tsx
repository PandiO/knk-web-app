import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { LinkPage } from '../LinkPage';
import { admissionClient } from '../../../apiClients/admissionClient';
import { authService } from '../../../services/authService';
import { useAuth } from '../../../contexts/AuthContext';
import { loadPendingClaim, savePendingClaim } from '../../../utils/claimCode';

const mockNavigate = jest.fn();
let mockSearch = '';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => <a href={to} className={className}>{children}</a>,
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(mockSearch)],
}), { virtual: true });
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../hooks/useOnboardingInfo', () => ({
  useOnboardingInfo: () => ({ info: null, loading: false, mode: 'Invite', inviteSignup: true, accessGate: true }),
}));
jest.mock('../../../apiClients/admissionClient', () => ({ admissionClient: { checkClaim: jest.fn() } }));
jest.mock('../../../services/authService', () => ({ authService: { linkMinecraftAccount: jest.fn() } }));

const checkClaim = admissionClient.checkClaim as jest.Mock;
const link = authService.linkMinecraftAccount as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;
const inAMinute = () => new Date(Date.now() + 60_000).toISOString();

describe('LinkPage (/link)', () => {
  const refresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockSearch = '';
    window.history.replaceState(null, '', '/link');
    mockedUseAuth.mockReturnValue({ isLoggedIn: false, user: null, refresh });
  });

  it('says when a code is invalid, that it stays valid 15 minutes, and keeps nothing', async () => {
    checkClaim.mockResolvedValue({ valid: false });
    render(<LinkPage />);

    await userEvent.type(screen.getByLabelText('Code from the server'), 'zzzzzzzz');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/invalid or has expired/i);
    expect(alert).toHaveTextContent(/stays valid for 15 minutes/);
    expect(checkClaim).toHaveBeenCalledWith('ZZZZZZZZ');
    expect(loadPendingClaim()).toBeNull();
  });

  // 2026-10-25: the register page sends a claim code typed into its link-code field here.
  it('checks a code from the URL at once and drops it from the address bar', async () => {
    mockSearch = '?code=K7QH-M2XA';
    window.history.replaceState(null, '', '/link?code=K7QH-M2XA');
    const expiresAt = inAMinute();
    checkClaim.mockResolvedValue({ valid: true, minecraftName: 'Steve', expiresAt });
    render(<LinkPage />);

    expect(await screen.findByText(/Verified: Minecraft account/)).toHaveTextContent('Steve');
    expect(checkClaim).toHaveBeenCalledTimes(1);
    expect(checkClaim).toHaveBeenCalledWith('K7QHM2XA');
    expect(window.location.search).toBe('');
    expect(loadPendingClaim()).toEqual({ code: 'K7QHM2XA', minecraftName: 'Steve', expiresAt });
  });

  it('leaves a refused URL code in the field to correct', async () => {
    mockSearch = '?code=K7QH-M2XZ';
    checkClaim.mockResolvedValue({ valid: false });
    render(<LinkPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/15 minutes/);
    expect(screen.getByLabelText('Code from the server')).toHaveValue('K7QH-M2XZ');
  });

  it('logged out: verifies the code, keeps it, and offers log in or an invitation', async () => {
    const expiresAt = inAMinute();
    checkClaim.mockResolvedValue({ valid: true, minecraftName: 'Steve', expiresAt });
    render(<LinkPage />);

    // Typed loosely: lower case, the look-alike O, formatted as XXXX-XXXX while typing.
    const input = screen.getByLabelText('Code from the server');
    await userEvent.type(input, 'k7qhm2xo');
    expect(input).toHaveValue('K7QH-M2X0');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText(/Verified: Minecraft account/)).toHaveTextContent('Steve');
    expect(checkClaim).toHaveBeenCalledWith('K7QHM2X0');
    expect(loadPendingClaim()).toEqual({ code: 'K7QHM2X0', minecraftName: 'Steve', expiresAt });
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/auth/login?returnTo=/link');
    expect(screen.getByText(/invite-only/i)).toBeInTheDocument();
    // The order of what comes next, with the Cloudflare step since the gate is on (2026-10-25).
    const journey = screen.getByTestId('link-journey');
    expect(journey).toHaveTextContent(/1\..*sign-up.*Steve/);
    expect(journey).toHaveTextContent(/2\..*Cloudflare.*6-digit code/);
    expect(journey).toHaveTextContent(/3\..*Join the server again/);

    await userEvent.type(screen.getByLabelText('Invitation code'), 'knk-aaaaa-bbbbb');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(mockNavigate).toHaveBeenCalledWith('/join?code=KNK-AAAAA-BBBBB');
    expect(link).not.toHaveBeenCalled();
  });

  it('picks up a kept code without asking again', () => {
    savePendingClaim({ code: 'K7QHM2XA', minecraftName: 'Alex', expiresAt: inAMinute() });
    render(<LinkPage />);

    expect(screen.getByText(/Verified: Minecraft account/)).toHaveTextContent('Alex');
    expect(checkClaim).not.toHaveBeenCalled();
  });

  it('forgets an expired kept code', () => {
    savePendingClaim({ code: 'K7QHM2XA', minecraftName: 'Alex', expiresAt: new Date(Date.now() - 1000).toISOString() });
    render(<LinkPage />);

    expect(screen.getByLabelText('Code from the server')).toBeInTheDocument();
    expect(loadPendingClaim()).toBeNull();
  });

  it('logged in without Minecraft: links straight away and clears the kept code', async () => {
    mockedUseAuth.mockReturnValue({ isLoggedIn: true, user: { id: 5, username: 'web-1', minecraftLinked: false }, refresh });
    savePendingClaim({ code: 'K7QHM2XA', minecraftName: 'Steve', expiresAt: inAMinute() });
    link.mockResolvedValue({ user: { id: 5 } });
    render(<LinkPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Link Steve to my account' }));

    expect(await screen.findByText(/is linked to your account/)).toBeInTheDocument();
    expect(link).toHaveBeenCalledWith({ linkCode: 'K7QHM2XA' });
    expect(refresh).toHaveBeenCalled();
    expect(loadPendingClaim()).toBeNull();
  });

  it('logged in: shows the API refusal and keeps the code', async () => {
    mockedUseAuth.mockReturnValue({ isLoggedIn: true, user: { id: 5, username: 'web-1', minecraftLinked: false }, refresh });
    savePendingClaim({ code: 'K7QHM2XA', minecraftName: 'Steve', expiresAt: inAMinute() });
    link.mockRejectedValue({ status: 403, response: { error: 'InviteRequired', message: 'You need an invitation before you can link a Minecraft account.' } });
    render(<LinkPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Link Steve to my account' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('You need an invitation'));
    expect(loadPendingClaim()).not.toBeNull();
  });

  it('logged in and already linked: no link button', () => {
    mockedUseAuth.mockReturnValue({ isLoggedIn: true, user: { id: 5, username: 'Steve', uuid: 'u', minecraftLinked: true }, refresh });
    savePendingClaim({ code: 'K7QHM2XA', minecraftName: 'Alex', expiresAt: inAMinute() });
    render(<LinkPage />);

    expect(screen.queryByRole('button', { name: /Link Alex/ })).not.toBeInTheDocument();
    expect(screen.getByText(/already linked/i)).toBeInTheDocument();
  });
});
