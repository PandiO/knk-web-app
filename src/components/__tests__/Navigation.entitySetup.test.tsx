import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Navigation } from '../Navigation';
import { usePermission, usePermissions, useStaffAccess } from '../../hooks/useStaffAccess';
import { mockHeldNodes } from '../../test-utils/permissions';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same components.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: jest.fn(), isLoading: false, user: { id: 7, username: 'Builder' } }),
}));
jest.mock('../../hooks/useStaffAccess', () => ({
  ...jest.requireActual('../../hooks/useStaffAccess'),
  usePermission: jest.fn(),
  usePermissions: jest.fn(),
  useStaffAccess: jest.fn(),
}));

const mocks = {
  usePermission: usePermission as jest.Mock,
  usePermissions: usePermissions as jest.Mock,
  useStaffAccess: useStaffAccess as jest.Mock,
};

/** jsdom measures every width as 0, so the links live in the menu button's panel: open it. */
function renderNavAt(path: string) {
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <Navigation objectTypes={[]} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  return result;
}

// PandiO/knk-workspace#197: Entity setup is opened from the dashboard's ⚙ (and by URL), not the nav.
// #30: the admin pages are in the admin sidebar; the bar has an Admin link. LW4-1 (developer's decision
// 2026-11-06): Dashboard stays in the bar for holders of its node, current on the dashboard, Entity setup,
// the builders and the detail pages; Admin is current on the other admin pages.
describe('Navigation: Dashboard and Admin in the bar, no Entity setup link (#197, #30, LW4-1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHeldNodes(mocks, ['knk.admin.content']);
  });

  it('has Dashboard and Admin but no Entity setup link for content staff', () => {
    const { container } = renderNavAt('/');

    expect(screen.queryByRole('menuitem', { name: /entity setup/i })).not.toBeInTheDocument();
    expect(container.querySelector('a[href^="/forms"]')).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('menuitem', { name: 'Admin' })).toHaveAttribute('href', '/admin');
    expect(screen.getAllByRole('menuitem').map(item => item.textContent))
      .toEqual(['Home', 'Leaderboards', 'Guides', 'Dashboard', 'Admin']);
  });

  it.each([
    '/dashboard',
    '/dashboard/Town',
    '/forms',
    '/forms/Town',
    '/forms/Town/edit/4',
    '/admin/form-configurations/new',
    '/admin/form-configurations/edit/2',
    '/admin/display-configurations/new',
    '/admin/display-configurations/edit/3',
    '/display/Town/4',
  ])('marks Dashboard (not Admin) as the current page on %s', (path) => {
    renderNavAt(path);

    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('menuitem', { name: 'Admin' })).not.toHaveAttribute('aria-current');
  });

  it.each([
    '/admin',
    '/admin/minecraft-catalog',
    '/admin/users',
    '/admin/game-settings',
    '/owner/telemetry',
  ])('marks Admin (not Dashboard) as the current page on %s', (path) => {
    renderNavAt(path);

    expect(screen.getByRole('menuitem', { name: 'Admin' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('does not mark Dashboard or Admin on other pages', () => {
    renderNavAt('/leaderboards');

    expect(screen.getByRole('menuitem', { name: 'Admin' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('menuitem', { name: 'Leaderboards' })).toHaveAttribute('aria-current', 'page');
  });

  it('without the content node: no Dashboard link, Admin current on a dashboard URL ("Staff only" inside the layout)', () => {
    mockHeldNodes(mocks, ['knk.admin.user.manage']);
    const { container } = renderNavAt('/dashboard/Town');

    expect(screen.queryByRole('menuitem', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/dashboard"]')).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Admin' })).toHaveAttribute('aria-current', 'page');
  });

  it('marks Leaderboards on a public player profile and Guides on a guide (breadcrumb parents)', () => {
    const { unmount } = renderNavAt('/players/Steve');
    expect(screen.getByRole('menuitem', { name: 'Leaderboards' })).toHaveAttribute('aria-current', 'page');
    unmount();
    renderNavAt('/guides/enchantments');
    expect(screen.getByRole('menuitem', { name: 'Guides' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('menuitem', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });
});
