import React from 'react';
import { render, screen } from '@testing-library/react';
import { LoginPage } from '../LoginPage';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermission } from '../../../hooks/useStaffAccess';

const mockNavigate = jest.fn();
let mockSearch = '';
let mockState: unknown = null;

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/auth/login', search: mockSearch, hash: '', state: mockState }),
  useSearchParams: () => [new URLSearchParams(mockSearch)],
}), { virtual: true });
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../hooks/useStaffAccess', () => ({
  CONTENT_PERMISSION_NODE: 'knk.admin.content',
  usePermission: jest.fn(),
}));
jest.mock('../../../components/auth/LoginForm', () => ({ LoginForm: () => <form aria-label="login form" /> }));

const mockedUseAuth = useAuth as jest.Mock;
const mockedUsePermission = usePermission as jest.Mock;

const setUp = ({ loggedIn, search = '', state = null, content = 'denied' }: {
  loggedIn: boolean; search?: string; state?: unknown; content?: 'checking' | 'allowed' | 'denied';
}) => {
  mockSearch = search;
  mockState = state;
  mockedUseAuth.mockReturnValue({ isLoggedIn: loggedIn });
  mockedUsePermission.mockReturnValue({
    allowed: content === 'allowed',
    isChecking: content === 'checking',
    status: content,
  });
  render(<LoginPage />);
};

describe('LoginPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the session-expired banner', () => {
    setUp({ loggedIn: false, search: '?returnTo=%2Fforms&reason=expired' });
    expect(screen.getByRole('status')).toHaveTextContent(/your session expired/i);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('goes back to a safe returnTo after login', () => {
    setUp({ loggedIn: true, search: '?returnTo=%2Fforms%2Ftown' });
    expect(mockNavigate).toHaveBeenCalledWith('/forms/town', { replace: true });
  });

  it('goes back to the page ProtectedRoute came from', () => {
    setUp({ loggedIn: true, state: { from: { pathname: '/account/transactions', search: '', hash: '' } } });
    expect(mockNavigate).toHaveBeenCalledWith('/account/transactions', { replace: true });
  });

  it('ignores an off-site returnTo and lands players on their account', () => {
    setUp({ loggedIn: true, search: '?returnTo=%2F%2Fevil.example' });
    expect(mockNavigate).toHaveBeenCalledWith('/account', { replace: true });
  });

  it('lands content staff on the dashboard, once the check is done', () => {
    setUp({ loggedIn: true, content: 'checking' });
    expect(mockNavigate).not.toHaveBeenCalled();

    jest.clearAllMocks();
    setUp({ loggedIn: true, content: 'allowed' });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });
});
