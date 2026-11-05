import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes, RouteElements } from '../../routes/AppRoutes';
import { ROUTE_LIST } from '../../routes/routeTable';
import { Breadcrumbs } from '../../components/Breadcrumbs';
import { AdminHomePage } from '../../pages/admin/AdminHomePage';
import { usePermission, usePermissions, useStaffAccess } from '../../hooks/useStaffAccess';
import { mockHeldNodes } from '../../test-utils/permissions';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same components.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isLoggedIn: true, isLoading: false, refresh: jest.fn(), logout: jest.fn(), user: { id: 7, username: 'Staff' } }),
}));
jest.mock('../../components/UnlinkedBanner', () => ({ UnlinkedBanner: () => null }));
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

// Every page is a stub naming its route; the Entity setup stub draws its own trail like FormWizardPage.
const elements = Object.fromEntries(ROUTE_LIST.map(route => [route.id, <p key={route.id}>page:{route.id}</p>])) as RouteElements;
elements.entitySetupType = <Breadcrumbs trail={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Entity setup' }]} />;
elements.adminHome = <AdminHomePage />;

function renderAt(path: string, ...nodes: string[]) {
  mockHeldNodes(mocks, nodes);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes elements={elements} />
    </MemoryRouter>,
  );
}

/** The sidebar (the first "Admin" navigation; the phone menu's panel is only there while open). */
const sidebar = () => screen.getAllByRole('navigation', { name: 'Admin' })[0];
const groupsIn = (nav: HTMLElement) => within(nav).getAllByRole('group').map(group => ({
  group: within(group).getByRole('heading').textContent,
  pages: within(group).getAllByRole('link').map(link => link.textContent),
}));
const trail = () => within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getAllByRole('listitem').map(item => item.textContent);

// PandiO/knk-workspace#30: layout routes, the grouped admin sidebar, breadcrumbs and titles from the table.
describe('admin layout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists only the pages the nodes allow, by group', () => {
    renderAt('/admin/game-settings', 'knk.admin.content', 'knk.admin.config', 'knk.admin.invites');

    expect(groupsIn(sidebar())).toEqual([
      { group: 'Content', pages: ['Dashboard', 'Minecraft catalogue'] },
      { group: 'Players & support', pages: ['Invitations'] },
      { group: 'Settings', pages: ['Game settings', 'Mail log'] },
    ]);
    expect(screen.getByText('page:gameSettings')).toBeInTheDocument();
  });

  // #262: Invitations used to be missing for everyone; #30 comment: these pages were Moderation buttons only.
  it('lists the economy and retention pages by their own node, without the moderator node', () => {
    renderAt('/admin/users/balance-log', 'knk.admin.currency.history', 'knk.admin.location.orphans');

    expect(groupsIn(sidebar())).toEqual([
      { group: 'World', pages: ['Orphaned Locations'] },
      { group: 'Economy', pages: ['Balance event log'] },
    ]);
    expect(screen.getByText('page:balanceLog')).toBeInTheDocument();
    expect(within(sidebar()).getByRole('link', { name: 'Balance event log' })).toHaveAttribute('aria-current', 'page');
  });

  // #185: the settings pages need the node their API checks, not the moderator node.
  it('hides the settings pages from a moderator without their nodes', () => {
    renderAt('/admin/users', 'knk.admin.user.manage');

    expect(groupsIn(sidebar())).toEqual([{ group: 'Players & support', pages: ['Player moderation'] }]);
  });

  it('keeps the parent page current and draws the trail on a page below it', () => {
    renderAt('/admin/users/12', 'knk.admin.user.manage');

    expect(within(sidebar()).getByRole('link', { name: 'Player moderation' })).toHaveAttribute('aria-current', 'page');
    expect(trail()).toEqual(['Players & support', 'Player moderation', 'Player profile']);
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByRole('link', { name: 'Players & support' })).toHaveAttribute('href', '/admin#admin-group-players');
    expect(within(breadcrumb).getByRole('link', { name: 'Player moderation' })).toHaveAttribute('href', '/admin/users');
    expect(document.title).toBe('Player profile · Knights & Kings');
  });

  // LW1-1 (Dashboard current on the content tools) and LW1-2 (the setup lists' trail starts with the group).
  it('lets a page draw its own trail, with the group in front, and keeps Dashboard current', () => {
    renderAt('/forms/Town', 'knk.admin.content');

    expect(screen.getAllByRole('navigation', { name: 'Breadcrumb' })).toHaveLength(1);
    expect(trail()).toEqual(['Content', 'Dashboard', 'Entity setup']);
    expect(within(sidebar()).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(document.title).toBe('Entity setup · Knights & Kings');
  });

  it('gates each page on its node: "Staff only" without it', () => {
    renderAt('/admin/game-settings', 'knk.admin.content');

    expect(screen.getByRole('heading', { name: 'Staff only' })).toBeInTheDocument();
    expect(screen.getByText('knk.admin.config')).toBeInTheDocument();
    expect(screen.queryByText('page:gameSettings')).not.toBeInTheDocument();
  });

  it('keeps the old builder list URLs working (redirect to Entity setup)', () => {
    renderAt('/admin/form-configurations', 'knk.admin.content');

    expect(screen.getByText('page:entitySetup')).toBeInTheDocument();
  });

  it('opens the sidebar list from the "Admin pages" button below xl', () => {
    renderAt('/admin/roads', 'knk.admin.road');

    expect(document.title).toBe('Road network · Knights & Kings');
    const button = screen.getByRole('button', { name: 'Admin pages' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById('admin-menu-panel')!;
    expect(groupsIn(panel)).toEqual([{ group: 'World', pages: ['Road network'] }]);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.getElementById('admin-menu-panel')).toBeNull();
    expect(button).toHaveFocus();
  });
});

describe('admin overview (/admin)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the allowed pages by group with what they are for', () => {
    renderAt('/admin', 'knk.admin.currency.policy', 'knk.owner.analytics.view');

    const economy = screen.getByRole('region', { name: 'Economy' });
    expect(within(economy).getByRole('link', { name: /Currency policy/ })).toHaveAttribute('href', '/admin/economy/policy');
    expect(screen.getByRole('region', { name: 'Owner' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Content' })).not.toBeInTheDocument();
    expect(document.title).toBe('Admin · Knights & Kings');
  });

  it('says so when no admin page is allowed', () => {
    renderAt('/admin');

    expect(screen.getByRole('heading', { name: 'No admin pages' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Admin' })).not.toBeInTheDocument();
  });
});

describe('public and player layouts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('have no sidebar or trail, and take the title from the table', () => {
    renderAt('/leaderboards', 'knk.admin.content');
    expect(screen.getByText('page:leaderboards')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Admin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
    expect(document.title).toBe('Leaderboards · Knights & Kings');
  });

  it('open a login page behind the login', () => {
    renderAt('/account/transactions');
    expect(screen.getByText('page:accountTransactions')).toBeInTheDocument();
    expect(document.title).toBe('Transactions · Knights & Kings');
  });

  it('show the 404 page for an unknown URL', () => {
    renderAt('/nowhere');
    expect(screen.getByText('page:notFound')).toBeInTheDocument();
    expect(document.title).toBe('Page not found · Knights & Kings');
  });
});
