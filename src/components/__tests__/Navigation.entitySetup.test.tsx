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
// #30: the content tools are in the admin sidebar; the bar has one Admin link, current on all of them.
describe('Navigation without the Entity setup link (#197, #30)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHeldNodes(mocks, ['knk.admin.content']);
  });

  it('has no Entity setup or Dashboard link for content staff, but an Admin link', () => {
    const { container } = renderNavAt('/');

    expect(screen.queryByRole('menuitem', { name: /entity setup/i })).not.toBeInTheDocument();
    expect(container.querySelector('a[href^="/forms"]')).toBeNull();
    expect(container.querySelector('a[href="/dashboard"]')).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  it.each([
    '/forms',
    '/forms/Town',
    '/forms/Town/edit/4',
    '/admin/form-configurations/new',
    '/admin/display-configurations/edit/3',
    '/display/Town/4',
    '/dashboard/Town',
  ])('marks Admin as the current page on %s', (path) => {
    renderNavAt(path);

    expect(screen.getByRole('menuitem', { name: 'Admin' })).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark Admin on other pages', () => {
    renderNavAt('/leaderboards');

    expect(screen.getByRole('menuitem', { name: 'Admin' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('menuitem', { name: 'Leaderboards' })).toHaveAttribute('aria-current', 'page');
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
