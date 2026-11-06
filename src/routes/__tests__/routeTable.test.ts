import {
  ADMIN_GROUPS, ADMIN_NODES, adminGroupHref, isWithin, lineageOf, matchRoute, nodeOf, REDIRECTS, ROUTE_LIST, ROUTES,
  SIDEBAR_ROUTES, TOP_NAV_NODES, TOP_NAV_ROUTES, trailFor,
} from '../routeTable';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same functions.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });

const at = (pathname: string) => matchRoute(pathname)?.route.id;

// PandiO/knk-workspace#30: one table for the nav, the gates, the titles and the breadcrumbs.
describe('route-meta table', () => {
  it('has one entry per path, and every parent is a route without parameters', () => {
    const paths = ROUTE_LIST.map(route => route.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const route of ROUTE_LIST) {
      if (!route.parent) continue;
      const parent = ROUTES[route.parent as keyof typeof ROUTES];
      expect(parent).toBeDefined();
      expect(parent.path).not.toMatch(/[:*]/);
    }
    // No old URL is both a route and a redirect.
    expect(REDIRECTS.filter(redirect => paths.includes(redirect.from))).toEqual([]);
  });

  it('gives every admin page a group and a title, and every sidebar page a node', () => {
    for (const route of ROUTE_LIST.filter(r => r.layout === 'admin' && r.id !== 'adminHome')) {
      expect([route.id, route.group]).toEqual([route.id, expect.any(String)]);
      expect(route.title).toBeTruthy();
    }
    for (const route of SIDEBAR_ROUTES) {
      expect(route.layout).toBe('admin');
      expect(nodeOf(route.access)).toBeTruthy();
      expect(route.sidebar?.description).toBeTruthy();
    }
    // Every group has at least one page; the order is the issue's.
    expect(ADMIN_GROUPS.map(group => group.label)).toEqual(['Content', 'World', 'Players & support', 'Economy', 'Settings', 'Owner']);
    for (const group of ADMIN_GROUPS) {
      expect(SIDEBAR_ROUTES.some(route => route.group === group.id)).toBe(true);
    }
  });

  it('keeps every gate App.tsx had before #30', () => {
    const gates = Object.fromEntries(ROUTE_LIST.map(route => [route.path, route.access.kind === 'staff' || route.access.kind === 'owner'
      ? `${route.access.kind}:${route.access.node}` : route.access.kind]));
    expect(gates).toEqual({
      '/': 'public', '/auth/register': 'public', '/auth/login': 'public', '/auth/forgot-password': 'public',
      '/auth/reset-password': 'public', '/invite/:token': 'public', '/invite': 'public', '/join': 'public', '/link': 'public',
      '/account/delete-data/confirm': 'public', '/leaderboards': 'public', '/players/:username': 'public',
      '/siege/matches/:id': 'public', '/guides': 'public', '/guides/enchantments': 'public', '*': 'public',
      '/account': 'login', '/account/link': 'login', '/account/transactions': 'login',
      '/admin': 'login',
      '/dashboard': 'staff:knk.admin.content', '/dashboard/:entityName': 'staff:knk.admin.content',
      '/forms': 'staff:knk.admin.content', '/forms/:entityName': 'staff:knk.admin.content',
      '/forms/:entityName/edit/:entityId': 'staff:knk.admin.content',
      '/admin/form-configurations/new': 'staff:knk.admin.content', '/admin/form-configurations/edit/:id': 'staff:knk.admin.content',
      '/admin/display-configurations/new': 'staff:knk.admin.content', '/admin/display-configurations/edit/:id': 'staff:knk.admin.content',
      '/display/:entityName/:id': 'staff:knk.admin.content', '/admin/minecraft-catalog': 'staff:knk.admin.content',
      '/admin/lootboxes': 'staff:knk.admin.lootbox.manage', '/admin/discovery': 'staff:knk.admin.discovery',
      '/admin/roads': 'staff:knk.admin.road', '/admin/locations/orphans': 'staff:knk.admin.location.orphans',
      '/admin/users': 'staff:knk.admin.user.manage', '/admin/users/:id': 'staff:knk.admin.user.manage',
      '/admin/invitations': 'staff:knk.admin.invites',
      '/admin/users/balance-log': 'staff:knk.admin.currency.history', '/admin/economy/transactions/:publicId': 'staff:knk.admin.currency.history',
      '/admin/economy/policy': 'staff:knk.admin.currency.policy', '/admin/economy/alerts': 'staff:knk.admin.currency.alerts',
      '/admin/game-settings': 'staff:knk.admin.config', '/admin/siege-configuration': 'staff:knk.siege.admin.manage',
      '/admin/email': 'staff:knk.admin.config',
      '/owner/telemetry': 'owner:knk.owner.telemetry.view', '/owner/privacy': 'owner:knk.owner.privacy.manage',
      '/owner/analytics': 'owner:knk.owner.analytics.view',
    });
  });

  it('matches like the router: static segments before parameters, then the catch-all', () => {
    expect(at('/admin/users/balance-log')).toBe('balanceLog');
    expect(at('/admin/users/12')).toBe('playerProfile');
    expect(at('/admin/users')).toBe('moderation');
    expect(at('/forms/Town/edit/4')).toBe('entityEdit');
    expect(at('/dashboard/Town')).toBe('dashboardType');
    expect(at('/players/Steve')).toBe('publicPlayer');
    expect(at('/nowhere')).toBe('notFound');
    expect(matchRoute('/admin/economy/transactions/abc')?.params).toEqual({ publicId: 'abc' });
  });

  // #197's DASHBOARD_ACTIVE_ALSO (LW1-1) is now the breadcrumb parents.
  it.each([
    '/dashboard/Town', '/forms', '/forms/Town', '/forms/Town/edit/4', '/admin/form-configurations/new',
    '/admin/display-configurations/edit/3', '/display/Town/4',
  ])('puts %s under the Dashboard', (path) => {
    expect(isWithin(matchRoute(path)!.route, 'dashboard')).toBe(true);
  });

  it('keeps the economy pages out of Moderation, although their URL is under /admin/users', () => {
    expect(isWithin(ROUTES.balanceLog, 'moderation')).toBe(false);
    expect(isWithin(ROUTES.playerProfile, 'moderation')).toBe(true);
    expect(lineageOf(ROUTES.formBuilderEdit).map(route => route.id)).toEqual(['formBuilderEdit', 'entitySetup', 'dashboard']);
  });

  it('builds the trail: group, parents, page', () => {
    expect(trailFor(ROUTES.transaction)).toEqual([
      { label: 'Economy', to: '/admin#admin-group-economy' },
      { label: 'Balance event log', to: '/admin/users/balance-log' },
      { label: 'Transaction' },
    ]);
    expect(trailFor(ROUTES.gameSettings)).toEqual([{ label: 'Settings', to: adminGroupHref('settings') }, { label: 'Game settings' }]);
    expect(trailFor(ROUTES.formBuilderNew).map(crumb => crumb.label)).toEqual(['Content', 'Dashboard', 'Entity setup', 'Form builder']);
    // The typed dashboard URL is the dashboard itself: no second "Dashboard".
    expect(trailFor(ROUTES.dashboardType).map(crumb => crumb.label)).toEqual(['Content', 'Dashboard']);
    // Not in the admin console: no trail.
    expect(trailFor(ROUTES.leaderboards)).toEqual([]);
    expect(trailFor(ROUTES.adminHome)).toEqual([]);
  });

  it('checks every node a sidebar page needs, the invitations node included (#262)', () => {
    expect(ADMIN_NODES).toEqual(expect.arrayContaining([
      'knk.admin.content', 'knk.admin.invites', 'knk.admin.user.manage', 'knk.admin.currency.history',
      'knk.admin.currency.policy', 'knk.admin.currency.alerts', 'knk.admin.location.orphans',
      'knk.admin.config', 'knk.siege.admin.manage', 'knk.owner.telemetry.view',
    ]));
    expect(new Set(ADMIN_NODES).size).toBe(ADMIN_NODES.length);
  });

  it('lists the bar links: Home, Leaderboards, Guides, Dashboard, Admin last (LW4-1)', () => {
    expect(TOP_NAV_ROUTES.map(route => route.id)).toEqual(['home', 'leaderboards', 'guides', 'dashboard', 'adminHome']);
    // The Dashboard link has the dashboard route's gate.
    expect(ROUTES.dashboard.access).toEqual({ kind: 'staff', node: 'knk.admin.content' });
    expect(TOP_NAV_NODES).toEqual(['knk.admin.content']);
  });
});
