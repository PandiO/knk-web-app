import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UnlinkedBanner } from '../UnlinkedBanner';
import { useAuth } from '../../contexts/AuthContext';

let mockPath = '/';
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => <a href={to} className={className}>{children}</a>,
  useLocation: () => ({ pathname: mockPath }),
}), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedUseAuth = useAuth as jest.Mock;

describe('UnlinkedBanner (KNG-214)', () => {
  beforeEach(() => {
    mockPath = '/';
  });

  it('points a logged-in player without Minecraft to /account/link', () => {
    mockedUseAuth.mockReturnValue({ isLoggedIn: true, user: { id: 1, minecraftLinked: false } });
    render(<UnlinkedBanner />);

    expect(screen.getByRole('link', { name: /Link your Minecraft account to play/ })).toHaveAttribute('href', '/account/link');
  });

  it.each([
    ['linked', { isLoggedIn: true, user: { id: 1, minecraftLinked: true } }],
    ['an older API without the field', { isLoggedIn: true, user: { id: 1 } }],
    ['logged out', { isLoggedIn: false, user: null }],
  ])('shows nothing when %s', (_, auth) => {
    mockedUseAuth.mockReturnValue(auth);
    const { container } = render(<UnlinkedBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(['/account/link', '/link'])('stays off the linking page %s itself', path => {
    mockPath = path;
    mockedUseAuth.mockReturnValue({ isLoggedIn: true, user: { id: 1, minecraftLinked: false } });
    const { container } = render(<UnlinkedBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
