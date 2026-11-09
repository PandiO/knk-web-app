import { matchRoutes } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Activity, BookOpen, Boxes, Coins, Compass, Gift, Home, LayoutGrid, Mail, MapPinOff, Map as MapIcon, Route as RouteIcon,
  Settings, ShieldAlert, ShieldOff, SlidersHorizontal, Swords, Table2, Ticket, Trophy, Users,
} from 'lucide-react';
import {
  CONTENT_PERMISSION_NODE, SERVER_CONFIG_PERMISSION_NODE, SIEGE_ADMIN_PERMISSION_NODE, STAFF_PERMISSION_NODE,
} from '../hooks/useStaffAccess';
import { LOOTBOX_ADMIN_NODE } from '../types/dtos/lootbox/LootboxDtos';
import { DISCOVERY_ADMIN_NODE } from '../types/dtos/discovery/DiscoveryDtos';
import { ROAD_ADMIN_NODE } from '../types/dtos/road/RoadDtos';
import { EMAIL_ADMIN_NODE } from '../types/dtos/email/EmailOutboxDtos';
import { INVITATION_NODES } from '../types/dtos/invitations/InvitationDtos';
import { CURRENCY_NODES } from '../types/dtos/currency/CurrencyDtos';
import { LOCATION_RETENTION_NODES } from '../types/dtos/locationRetention/LocationRetentionDtos';
import { OWNER_ANALYTICS_VIEW_NODE } from '../types/dtos/analytics/WorldAnalyticsDtos';
import { OWNER_PRIVACY_MANAGE_NODE, OWNER_TELEMETRY_VIEW_NODE } from '../types/dtos/telemetry/TelemetryDtos';
import type { Breadcrumb } from '../utils/breadcrumbs';

/**
 * The route-meta table (PandiO/knk-workspace#30): one entry per route of the app. It decides
 *
 * - the **layout** a route renders in (`public`, `player`, `admin`; src/layouts/),
 * - who may open it (**access**: everyone, logged in, a staff node, an owner node; src/routes/RouteGate.tsx),
 * - the **page title** (`document.title`; a page may refine it with usePageTitle, e.g. the entity's name),
 * - where it sits in the **navigation**: `topNav` (the bar) and, for admin pages, `group` + `sidebar`
 *   (the grouped admin sidebar and the /admin overview, each item shown only with its node),
 * - its **breadcrumb parent** (`parent`), which also lights up the parent's nav and sidebar link (it replaces
 *   #197's DASHBOARD_ACTIVE_ALSO list).
 *
 * URLs are unchanged; App.tsx maps each id to its page (src/routes/AppRoutes.tsx).
 */

export type LayoutKind = 'public' | 'player' | 'admin';

/** `staff` is StaffRoute (the node, "Staff only" without it); `owner` is OwnerRoute (exact grants, D24). */
export type RouteAccess =
  | { kind: 'public' }
  | { kind: 'login' }
  | { kind: 'staff'; node: string }
  | { kind: 'owner'; node: string };

export const ADMIN_GROUPS = [
  { id: 'content', label: 'Content' },
  { id: 'world', label: 'World' },
  { id: 'players', label: 'Players & support' },
  { id: 'economy', label: 'Economy' },
  { id: 'settings', label: 'Settings' },
  { id: 'owner', label: 'Owner' },
] as const;

export type AdminGroupId = typeof ADMIN_GROUPS[number]['id'];

type RouteDef = {
  path: string;
  layout: LayoutKind;
  access: RouteAccess;
  /** The page title (and the sidebar/breadcrumb label). None: just the site name (the landing page). */
  title?: string;
  /** Admin pages: the sidebar group. Pages without `sidebar` are in the group only for their breadcrumb. */
  group?: AdminGroupId;
  /** Listed in the admin sidebar and on the /admin overview (in table order). */
  sidebar?: { icon: LucideIcon; description: string };
  /** A link in the top bar (in table order, the Admin overview last); with a node only for its holders. */
  topNav?: { icon: LucideIcon; label?: string };
  /** The breadcrumb parent: an id of this table (a route without parameters). Lights up its links too. */
  parent?: string;
  /** `page`: the page draws its own trail (open form, detail page; built from `returnTo`). Default `layout`. */
  breadcrumbs?: 'layout' | 'page';
};

export type RouteMeta = RouteDef & { id: string };

function defineRoutes<K extends string>(defs: Record<K, RouteDef>): Record<K, RouteMeta> {
  return Object.fromEntries(
    (Object.entries(defs) as [K, RouteDef][]).map(([id, def]) => [id, { ...def, id }]),
  ) as unknown as Record<K, RouteMeta>;
}

const PUBLIC: RouteAccess = { kind: 'public' };
const LOGIN: RouteAccess = { kind: 'login' };
const staff = (node: string): RouteAccess => ({ kind: 'staff', node });
const owner = (node: string): RouteAccess => ({ kind: 'owner', node });

export const ROUTES = defineRoutes({
  // --- Public site (signed out there is no bar, LANDING_PAGE_NAVIGATION_ARCHITECTURE) ---
  home: { path: '/', layout: 'public', access: PUBLIC, topNav: { icon: Home, label: 'Home' } },
  register: { path: '/auth/register', layout: 'public', access: PUBLIC, title: 'Create account' },
  login: { path: '/auth/login', layout: 'public', access: PUBLIC, title: 'Log in' },
  forgotPassword: { path: '/auth/forgot-password', layout: 'public', access: PUBLIC, title: 'Forgot password' },
  resetPassword: { path: '/auth/reset-password', layout: 'public', access: PUBLIC, title: 'Reset password' },
  // Invitation sign-up (KNG-212): the personal link drops its token from the URL on load.
  inviteToken: { path: '/invite/:token', layout: 'public', access: PUBLIC, title: 'Accept your invitation' },
  invite: { path: '/invite', layout: 'public', access: PUBLIC, title: 'Accept your invitation' },
  join: { path: '/join', layout: 'public', access: PUBLIC, title: 'Join the closed alpha' },
  // The claim code from the server's disconnect screen, before or without login (KNG-214).
  link: { path: '/link', layout: 'public', access: PUBLIC, title: 'Link your Minecraft account' },
  // Emailed GDPR deletion confirmation link; no sign-in needed (KNG-34).
  confirmDataDeletion: { path: '/account/delete-data/confirm', layout: 'public', access: PUBLIC, title: 'Delete your data' },
  // Player statistics (KNG-34): signed out they show only the always-public fields and boards.
  leaderboards: { path: '/leaderboards', layout: 'public', access: PUBLIC, title: 'Leaderboards', topNav: { icon: Trophy } },
  publicPlayer: { path: '/players/:username', layout: 'public', access: PUBLIC, title: 'Player', parent: 'leaderboards' },
  // Alpha run 1 (#174): a finished siege match; linked from the in-game result and /siege history.
  siegeMatch: { path: '/siege/matches/:id', layout: 'public', access: PUBLIC, title: 'Siege match' },
  // Guides (#221): player guides, the custom enchantment info page first.
  guides: { path: '/guides', layout: 'public', access: PUBLIC, title: 'Guides', topNav: { icon: BookOpen } },
  enchantmentGuide: { path: '/guides/enchantments', layout: 'public', access: PUBLIC, title: 'Custom enchantments', parent: 'guides' },

  // --- Player area (logged in) ---
  account: { path: '/account', layout: 'player', access: LOGIN, title: 'Account' },
  // The Minecraft linking step after an invite sign-up (KNG-214).
  accountLink: { path: '/account/link', layout: 'player', access: LOGIN, title: 'Link your Minecraft account', parent: 'account' },
  accountTransactions: { path: '/account/transactions', layout: 'player', access: LOGIN, title: 'Transactions', parent: 'account' },

  // --- Admin console: grouped sidebar + breadcrumbs. Every node is the one the page's API checks. ---
  adminHome: { path: '/admin', layout: 'admin', access: LOGIN, title: 'Admin', topNav: { icon: LayoutGrid } },

  // Content (alpha hardening WP9.1: knk.admin.content, which the API enforces on the writes too).
  // LW4-1 (developer's decision 2026-11-06): also in the bar, for holders of its node; current on its children.
  dashboard: {
    path: '/dashboard', layout: 'admin', access: staff(CONTENT_PERMISSION_NODE), title: 'Dashboard', group: 'content',
    sidebar: { icon: Table2, description: 'Browse, create and edit the world and content entities.' },
    topNav: { icon: Table2 },
  },
  // #177 link 1 (#58): the selected type in the URL; bare /dashboard reopens the last one.
  dashboardType: { path: '/dashboard/:entityName', layout: 'admin', access: staff(CONTENT_PERMISSION_NODE), title: 'Dashboard', group: 'content', parent: 'dashboard' },
  // Entity setup (#177 decision 4; no link since #197: the dashboard's ⚙ per type). The page draws the trail.
  entitySetup: { path: '/forms', layout: 'admin', access: staff(CONTENT_PERMISSION_NODE), title: 'Entity setup', group: 'content', parent: 'dashboard', breadcrumbs: 'page' },
  entitySetupType: { path: '/forms/:entityName', layout: 'admin', access: staff(CONTENT_PERMISSION_NODE), title: 'Entity setup', group: 'content', parent: 'dashboard', breadcrumbs: 'page' },
  entityEdit: { path: '/forms/:entityName/edit/:entityId', layout: 'admin', access: staff(CONTENT_PERMISSION_NODE), title: 'Entity setup', group: 'content', parent: 'dashboard', breadcrumbs: 'page' },
  formBuilderNew: { path: '/admin/form-configurations/new', layout: 'admin', access: staff(CONTENT_PERMISSION_NODE), title: 'Form builder', group: 'content', parent: 'entitySetup' },
  formBuilderEdit: { path: '/admin/form-configurations/edit/:id', layout: 'admin', access: staff(CONTENT_PERMISSION_NODE), title: 'Form builder', group: 'content', parent: 'entitySetup' },
  displayBuilderNew: { path: '/admin/display-configurations/new', layout: 'admin', access: staff(CONTENT_PERMISSION_NODE), title: 'Display builder', group: 'content', parent: 'entitySetup' },
  displayBuilderEdit: { path: '/admin/display-configurations/edit/:id', layout: 'admin', access: staff(CONTENT_PERMISSION_NODE), title: 'Display builder', group: 'content', parent: 'entitySetup' },
  // The detail page (#81) draws "Dashboard › Town › Cinix" from returnTo and sets the entity's name as title.
  entityDetail: { path: '/display/:entityName/:id', layout: 'admin', access: staff(CONTENT_PERMISSION_NODE), title: 'Details', group: 'content', parent: 'dashboard', breadcrumbs: 'page' },
  // KNG-200 phase 3: server scans, the audit, merges and icon overrides (knk.admin.content).
  minecraftCatalog: {
    path: '/admin/minecraft-catalog', layout: 'admin', access: staff(CONTENT_PERMISSION_NODE), title: 'Minecraft catalogue', group: 'content',
    sidebar: { icon: Boxes, description: 'Materials and enchantments from the server scans, merges and icons.' },
  },

  // World
  lootboxes: {
    path: '/admin/lootboxes', layout: 'admin', access: staff(LOOTBOX_ADMIN_NODE), title: 'Lootboxes', group: 'world',
    sidebar: { icon: Gift, description: 'Lootbox types, loot tables, spawn areas and the drop log.' },
  },
  discovery: {
    path: '/admin/discovery', layout: 'admin', access: staff(DISCOVERY_ADMIN_NODE), title: 'Domain discovery', group: 'world',
    sidebar: { icon: Compass, description: 'Rewards for finding domains, and who found what.' },
  },
  roads: {
    path: '/admin/roads', layout: 'admin', access: staff(ROAD_ADMIN_NODE), title: 'Road network', group: 'world',
    sidebar: { icon: RouteIcon, description: 'Road profiles, tiles and the edge table.' },
  },
  // KNG-80: orphaned Locations found by the weekly retention check (was reachable only through Moderation).
  orphanedLocations: {
    path: '/admin/locations/orphans', layout: 'admin', access: staff(LOCATION_RETENTION_NODES.view), title: 'Orphaned Locations', group: 'world',
    sidebar: { icon: MapPinOff, description: 'Locations nothing points at any more, to review by hand.' },
  },

  // Players & support (Moderation: knk.admin.user.manage, StaffRoute's default node).
  moderation: {
    path: '/admin/users', layout: 'admin', access: staff(STAFF_PERMISSION_NODE), title: 'Player moderation', group: 'players',
    sidebar: { icon: Users, description: 'Every player, groups, premium tiers and title demotions.' },
  },
  playerProfile: { path: '/admin/users/:id', layout: 'admin', access: staff(STAFF_PERMISSION_NODE), title: 'Player profile', group: 'players', parent: 'moderation' },
  // KNG-212 (knk.admin.invites). Its nav link never showed (#262): the node was missing from the nav's map.
  invitations: {
    path: '/admin/invitations', layout: 'admin', access: staff(INVITATION_NODES.manage), title: 'Invitations', group: 'players',
    sidebar: { icon: Ticket, description: 'Personal invites and shared codes for the closed alpha.' },
  },

  // Economy (currency ledger phases 4 and 5; each page its own knk.admin.currency.* node, was reachable only
  // through Moderation).
  balanceLog: {
    path: '/admin/users/balance-log', layout: 'admin', access: staff(CURRENCY_NODES.history), title: 'Balance event log', group: 'economy',
    sidebar: { icon: Coins, description: 'Every balance change, with reversals.' },
  },
  transaction: { path: '/admin/economy/transactions/:publicId', layout: 'admin', access: staff(CURRENCY_NODES.history), title: 'Transaction', group: 'economy', parent: 'balanceLog' },
  currencyPolicy: {
    path: '/admin/economy/policy', layout: 'admin', access: staff(CURRENCY_NODES.policy), title: 'Currency policy', group: 'economy',
    sidebar: { icon: SlidersHorizontal, description: 'Limits and rules for the currencies.' },
  },
  currencyAlerts: {
    path: '/admin/economy/alerts', layout: 'admin', access: staff(CURRENCY_NODES.alerts), title: 'Currency alerts', group: 'economy',
    sidebar: { icon: ShieldAlert, description: 'Anomalies found by the currency monitor, and reconciliation.' },
  },

  // Settings (#185: the node each page's API checks).
  gameSettings: {
    path: '/admin/game-settings', layout: 'admin', access: staff(SERVER_CONFIG_PERMISSION_NODE), title: 'Game settings', group: 'settings',
    sidebar: { icon: Settings, description: 'Join and leave messages, MOTD, spawns, hubs and worlds.' },
  },
  siegeSettings: {
    path: '/admin/siege-configuration', layout: 'admin', access: staff(SIEGE_ADMIN_PERMISSION_NODE), title: 'Siege settings', group: 'settings',
    sidebar: { icon: Swords, description: 'Global siege tunables.' },
  },
  // KNG-206: the outbox, a test mail and Retry (knk.admin.config).
  mailLog: {
    path: '/admin/email', layout: 'admin', access: staff(EMAIL_ADMIN_NODE), title: 'Mail log', group: 'settings',
    sidebar: { icon: Mail, description: 'Sent and failed mails, a test mail and Retry.' },
  },

  // Owner (KNG-34 links 6 and 7: exact grants for diagnostics and data deletion, D24).
  diagnostics: {
    path: '/owner/telemetry', layout: 'admin', access: owner(OWNER_TELEMETRY_VIEW_NODE), title: 'Diagnostics', group: 'owner',
    sidebar: { icon: Activity, description: 'Health, errors and timings of the API.' },
  },
  dataDeletion: {
    path: '/owner/privacy', layout: 'admin', access: owner(OWNER_PRIVACY_MANAGE_NODE), title: 'Data deletion requests', group: 'owner',
    sidebar: { icon: ShieldOff, description: 'GDPR deletion requests and erasures.' },
  },
  worldAnalytics: {
    path: '/owner/analytics', layout: 'admin', access: owner(OWNER_ANALYTICS_VIEW_NODE), title: 'World analytics', group: 'owner',
    sidebar: { icon: MapIcon, description: 'Heatmaps, menu funnels and domain interactions.' },
  },

  // Anything else: a Not Found page with links home and to the account page.
  notFound: { path: '*', layout: 'public', access: PUBLIC, title: 'Page not found' },
});

export type RouteId = keyof typeof ROUTES;

export const ROUTE_LIST: RouteMeta[] = Object.values(ROUTES);

/** Old list pages of the builders: they open on the Entity setup page now. Kept so bookmarks work. */
export const REDIRECTS: { from: string; to: string }[] = [
  { from: '/admin/form-configurations', to: '/forms' },
  { from: '/admin/display-configurations', to: '/forms' },
];

const MATCHABLE = ROUTE_LIST.map(route => ({ path: route.path, id: route.id }));

/** The table entry for `pathname` (react-router's ranking: `/admin/users/balance-log` beats `/admin/users/:id`). */
export function matchRoute(pathname: string): { route: RouteMeta; params: Record<string, string | undefined> } | null {
  const matches = matchRoutes(MATCHABLE, pathname);
  const last = matches?.[matches.length - 1];
  if (!last) return null;
  return { route: ROUTES[last.route.id as RouteId], params: last.params };
}

/** The route and its parents, nearest first (`playerProfile`, `moderation`). */
export function lineageOf(route: RouteMeta): RouteMeta[] {
  const chain: RouteMeta[] = [];
  let current: RouteMeta | undefined = route;
  while (current && !chain.includes(current)) {
    chain.push(current);
    current = current.parent ? ROUTES[current.parent as RouteId] : undefined;
  }
  return chain;
}

/** Whether `route` is `target` or below it (breadcrumb parents): lights up `target`'s links. */
export function isWithin(route: RouteMeta | null | undefined, targetId: string): boolean {
  return !!route && lineageOf(route).some(r => r.id === targetId);
}

export function groupOf(id: AdminGroupId | undefined) {
  return ADMIN_GROUPS.find(group => group.id === id);
}

/** The anchor of a group on the /admin overview (its breadcrumb links there). */
export function adminGroupHref(id: AdminGroupId): string {
  return `/admin#admin-group-${id}`;
}

/** The group crumb that starts every admin trail ("Content", linking to that group on /admin). */
export function groupCrumb(route: RouteMeta | null | undefined): Breadcrumb[] {
  const group = groupOf(route?.group);
  return group ? [{ label: group.label, to: adminGroupHref(group.id) }] : [];
}

/** The layout's trail: group › parents (links) › this page. Empty outside the admin console. */
export function trailFor(route: RouteMeta | null | undefined): Breadcrumb[] {
  if (!route || route.layout !== 'admin' || !route.group) return [];
  const [self, ...parents] = lineageOf(route);
  return [
    ...groupCrumb(route),
    // A parent with the page's own title is the same page under another URL (/dashboard for /dashboard/Town).
    ...parents.reverse().filter(parent => parent.title !== self.title)
      .map(parent => ({ label: parent.title ?? parent.id, to: parent.path })),
    { label: self.title ?? self.id },
  ];
}

/** The node a route needs, if any (for the sidebar's checks). */
export function nodeOf(access: RouteAccess): string | undefined {
  return access.kind === 'staff' || access.kind === 'owner' ? access.node : undefined;
}

/** The pages of the admin sidebar, in group and table order. */
export const SIDEBAR_ROUTES: RouteMeta[] = ADMIN_GROUPS.flatMap(group =>
  ROUTE_LIST.filter(route => route.group === group.id && route.sidebar));

/** Every node a sidebar page needs: checked once per login for the sidebar, the overview and the bar's Admin link. */
export const ADMIN_NODES: string[] = Array.from(new Set(
  SIDEBAR_ROUTES.map(route => nodeOf(route.access)).filter((node): node is string => !!node),
));

/** The id of the /admin overview: its bar link is current on the admin pages no other bar link covers. */
export const ADMIN_HOME_ID = 'adminHome';

/**
 * The links of the top bar, in table order with the Admin overview last: Home, Leaderboards, Guides,
 * Dashboard (LW4-1, only with its node), Admin.
 */
export const TOP_NAV_ROUTES: RouteMeta[] = [
  ...ROUTE_LIST.filter(route => route.topNav && route.id !== ADMIN_HOME_ID),
  ...ROUTE_LIST.filter(route => route.topNav && route.id === ADMIN_HOME_ID),
];

/** The nodes the bar's own links need (the Dashboard's); the Admin link follows the sidebar's nodes. */
export const TOP_NAV_NODES: string[] = Array.from(new Set(
  TOP_NAV_ROUTES.map(route => nodeOf(route.access)).filter((node): node is string => !!node),
));
