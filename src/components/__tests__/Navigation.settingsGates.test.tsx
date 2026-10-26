import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Navigation } from '../Navigation';
import { usePermission, useStaffAccess } from '../../hooks/useStaffAccess';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same components.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: jest.fn(), isLoading: false, user: { id: 7, username: 'Mod' } }),
}));
jest.mock('../../hooks/useStaffAccess', () => ({
  ...jest.requireActual('../../hooks/useStaffAccess'),
  usePermission: jest.fn(),
  useStaffAccess: jest.fn(),
}));

const mockedPermission = usePermission as jest.Mock;
const mockedStaff = useStaffAccess as jest.Mock;

/** The logged-in user holds exactly these nodes (no wildcards in this test). */
function holds(...nodes: string[]) {
  mockedPermission.mockImplementation((node: string) => ({
    allowed: nodes.includes(node), isChecking: false, status: nodes.includes(node) ? 'allowed' : 'denied', retry: jest.fn(),
  }));
  const isStaff = nodes.includes('knk.admin.user.manage');
  mockedStaff.mockReturnValue({ isStaff, isChecking: false, status: isStaff ? 'allowed' : 'denied' });
}

function linksTo(container: HTMLElement, href: string) {
  return container.querySelectorAll(`a[href="${href}"]`).length;
}

/** jsdom measures every width as 0, so the links live in the menu button's panel: open it. */
function renderNav() {
  const result = render(
    <MemoryRouter initialEntries={['/']}>
      <Navigation objectTypes={[]} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  return result;
}

// #185: the settings pages need the node their API checks, not the moderator node.
describe('Navigation settings links (#185)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('hides Game Settings and Siege Settings from a moderator without their nodes', () => {
    holds('knk.admin.user.manage');
    const { container } = renderNav();

    expect(linksTo(container, '/admin/game-settings')).toBe(0);
    expect(linksTo(container, '/admin/siege-configuration')).toBe(0);
    // The moderator node still opens Moderation.
    expect(linksTo(container, '/admin/users')).toBeGreaterThan(0);
  });

  it('shows Game Settings for knk.admin.config without the moderator node', () => {
    holds('knk.admin.config');
    const { container } = renderNav();

    expect(linksTo(container, '/admin/game-settings')).toBeGreaterThan(0);
    expect(linksTo(container, '/admin/siege-configuration')).toBe(0);
    expect(linksTo(container, '/admin/users')).toBe(0);
  });

  it('shows Siege Settings for knk.siege.admin.manage', () => {
    holds('knk.siege.admin.manage');
    const { container } = renderNav();

    expect(linksTo(container, '/admin/siege-configuration')).toBeGreaterThan(0);
    expect(linksTo(container, '/admin/game-settings')).toBe(0);
  });

  it('asks for the nodes the API checks', () => {
    holds();
    renderNav();

    const asked = mockedPermission.mock.calls.map(([node]) => node);
    expect(asked).toEqual(expect.arrayContaining(['knk.admin.config', 'knk.siege.admin.manage']));
  });
});
