import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Navigation } from '../Navigation';
import { usePermission, usePermissions, useStaffAccess } from '../../hooks/useStaffAccess';
import { mockHeldNodes } from '../../test-utils/permissions';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same components.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: jest.fn(), isLoading: false, user: { id: 7, username: 'Mod' } }),
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
function renderNav(...nodes: string[]) {
  mockHeldNodes(mocks, nodes);
  const result = render(
    <MemoryRouter initialEntries={['/']}>
      <Navigation objectTypes={[]} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  return result;
}

const barLinks = () => screen.getAllByRole('menuitem').map(item => item.textContent);

// #30: the bar keeps the public links and one Admin link; the admin pages (with #185's gates, the node
// each page's API checks) are in the admin sidebar, see layouts/__tests__/AdminLayout.test.tsx.
describe('Navigation bar links (#30, #185)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows players Home, Leaderboards and Guides only', () => {
    renderNav();
    expect(barLinks()).toEqual(['Home', 'Leaderboards', 'Guides']);
  });

  it.each([
    'knk.admin.user.manage',
    'knk.admin.config',
    'knk.siege.admin.manage',
    'knk.admin.invites',
    'knk.admin.currency.history',
    'knk.admin.location.orphans',
  ])('adds Admin for a holder of %s alone', (node) => {
    renderNav(node);
    expect(barLinks()).toEqual(['Home', 'Leaderboards', 'Guides', 'Admin']);
  });

  it('has no admin page links in the bar any more', () => {
    const { container } = renderNav('knk.admin.user.manage', 'knk.admin.config', 'knk.siege.admin.manage');
    for (const href of ['/admin/game-settings', '/admin/siege-configuration', '/admin/users', '/admin/invitations']) {
      expect(container.querySelectorAll(`a[href="${href}"]`)).toHaveLength(0);
    }
  });

  it('asks for every node an admin page needs, the invitations node included (#262)', () => {
    renderNav();
    const asked = mocks.usePermissions.mock.calls.flatMap(([nodes]) => nodes);
    expect(asked).toEqual(expect.arrayContaining(['knk.admin.config', 'knk.siege.admin.manage', 'knk.admin.invites']));
  });
});
