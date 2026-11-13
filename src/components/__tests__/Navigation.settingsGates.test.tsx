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

// #30: the bar keeps the public links, Dashboard (LW4-1; any area node since #280) and one Admin link; the other
// admin pages (with #185's gates, the node each page's API checks) are in the admin sidebar, see
// layouts/__tests__/AdminLayout.test.tsx.
describe('Navigation bar links (#30, #185)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows players Home, Leaderboards and Guides only', () => {
    renderNav();
    expect(barLinks()).toEqual(['Home', 'Leaderboards', 'Guides']);
  });

  it.each([
    'knk.admin.config',
    'knk.admin.invites',
    'knk.admin.currency.history',
    'knk.admin.location.orphans',
  ])('adds Admin for a holder of %s alone', (node) => {
    renderNav(node);
    expect(barLinks()).toEqual(['Home', 'Leaderboards', 'Guides', 'Admin']);
  });

  it.each([
    'knk.admin.content',
    // #280 decision 8: any area node opens the dashboard.
    'knk.admin.world',
    'knk.admin.user.manage',
    'knk.siege.admin.manage',
    'knk.kit.manage',
  ])('adds Dashboard and Admin for a holder of the area node %s (LW4-1, #280)', (node) => {
    renderNav(node);
    expect(barLinks()).toEqual(['Home', 'Leaderboards', 'Guides', 'Dashboard', 'Admin']);
  });

  it('asks for the Dashboard link\'s node, the dashboard route\'s gate', () => {
    renderNav();
    const asked = mocks.usePermissions.mock.calls.flatMap(([nodes]) => nodes);
    expect(asked).toContain('knk.admin.content');
  });

  it('has no other admin page links in the bar', () => {
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
