import { test, expect } from './support/mockApi';
import type { Page } from '@playwright/test';
import { alex, mockSession, startLoggedIn, steve } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { mockPlayerProfile, playerId } from './fixtures/players';
import { expectNoSidewaysScroll } from './support/layout';

/**
 * The admin navigation (PandiO/knk-workspace#30): the top bar, the grouped admin sidebar, the /admin overview,
 * breadcrumbs and tab titles, for the owner, a staff account with only some nodes and a player.
 * Smoke test: knk-workspace docs/guides/admin-navigation-smoke-test.md (backfill #511).
 */

const topBar = (page: Page) => page.getByRole('navigation').first();
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Admin' }).first();
const trail = (page: Page) => page.getByRole('navigation', { name: 'Breadcrumb' });

/** The nodes of the partial staff account in the guide: currency history, invites, config, orphaned locations. */
const PARTIAL_NODES = new Set(['knk.admin.currency.history', 'knk.admin.invites', 'knk.admin.config', 'knk.admin.location.orphans']);

test.beforeEach(async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockContentDefaults(api);
});

test.describe('as the owner', () => {
  test.beforeEach(({ api }) => mockSession(api, alex, () => true));

  test('the bar reads Home, Leaderboards, Guides, Dashboard, Admin', async ({ page }) => {
    await page.goto('/admin');
    await expect(topBar(page).getByRole('link', { name: 'Admin' })).toBeVisible();
    for (const name of ['Home', 'Leaderboards', 'Guides', 'Dashboard']) {
      await expect(topBar(page).getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(topBar(page).getByRole('link', { name: /Game Settings|Moderation/ })).toHaveCount(0);
  });

  test('Dashboard is current on the dashboard and Entity setup, Admin on the other admin pages', async ({ page }) => {
    for (const url of ['/dashboard/Town', '/forms/Town']) {
      await page.goto(url);
      await expect(topBar(page).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
      await expect(topBar(page).getByRole('link', { name: 'Admin' })).not.toHaveAttribute('aria-current', 'page');
    }
    for (const url of ['/admin', '/admin/game-settings', '/admin/users']) {
      await page.goto(url);
      await expect(topBar(page).getByRole('link', { name: 'Admin' })).toHaveAttribute('aria-current', 'page');
      await expect(topBar(page).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current', 'page');
    }
    await page.goto('/leaderboards');
    await expect(topBar(page).getByRole('link', { name: 'Leaderboards' })).toHaveAttribute('aria-current', 'page');
  });

  test('/admin lists every group with its pages and what each is for, without a sidebar', async ({ page }) => {
    await page.goto('/admin');
    for (const group of ['Content', 'World', 'Players & support', 'Economy', 'Settings', 'Owner']) {
      await expect(page.getByRole('heading', { name: group, exact: true })).toBeVisible();
    }
    for (const name of ['Dashboard', 'Minecraft catalogue', 'Lootboxes', 'Domain discovery', 'Road network', 'Orphaned Locations',
      'Player moderation', 'Invitations', 'Balance event log', 'Currency policy', 'Currency alerts', 'Game settings',
      'Siege settings', 'Mail log', 'Diagnostics', 'Data deletion requests', 'World analytics']) {
      // An overview link's name is the page name followed by what it is for.
      await expect(page.getByRole('link', { name: new RegExp(`^${name} `) })).toBeVisible();
    }
    await expect(sidebar(page)).toHaveCount(0);
  });

  test('a page below a sidebar page keeps its link current, with the trail back', async ({ page, api }) => {
    mockPlayerProfile(api);
    await page.goto(`/admin/users/${playerId}`);
    await expect(sidebar(page).getByRole('link', { name: 'Player moderation' })).toHaveAttribute('aria-current', 'page');
    await expect(trail(page)).toContainText('Players & support');
    await expect(trail(page)).toContainText('Player moderation');
    await expect(trail(page)).toContainText('Player profile');

    await trail(page).getByRole('link', { name: 'Players & support' }).click();
    await expect(page).toHaveURL(/\/admin(\?|#|$)/);
    await expect(page.getByRole('heading', { name: 'Players & support', exact: true })).toBeVisible();
  });

  test('Invitations is in the sidebar (#262)', async ({ page }) => {
    await page.goto('/admin/game-settings');
    await expect(sidebar(page).getByRole('link', { name: 'Invitations' })).toBeVisible();
  });

  test('Game settings: trail Settings › Game settings, heading and tab title', async ({ page }) => {
    await page.goto('/admin/game-settings');
    await expect(trail(page)).toContainText('Settings');
    await expect(trail(page)).toContainText('Game settings');
    await expect(page.getByRole('heading', { name: 'Game settings', level: 1 })).toBeVisible();
    await expect(page).toHaveTitle('Game settings · Knights & Kings');
  });

  test('a transaction shows Economy › Balance event log › Transaction, with Balance event log current', async ({ page }) => {
    await page.goto('/admin/economy/transactions/tx-1');
    await expect(trail(page)).toContainText('Economy');
    await expect(trail(page)).toContainText('Balance event log');
    await expect(trail(page)).toContainText('Transaction');
    await expect(sidebar(page).getByRole('link', { name: 'Balance event log' })).toHaveAttribute('aria-current', 'page');
  });

  test('the dashboard shows Content › Dashboard and fills the window without a page scrollbar', async ({ page }) => {
    await page.goto('/dashboard/Town');
    await expect(trail(page)).toContainText('Content');
    await expect(trail(page)).toContainText('Dashboard');
    await expect(sidebar(page).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight))
      .toBeLessThanOrEqual(1);
  });

  test('Entity setup shows Content › Dashboard › Town › Entity setup, and "Town" opens the dashboard on Town', async ({ page }) => {
    await page.goto('/forms/Town');
    await expect(trail(page)).toContainText('Content');
    await expect(trail(page)).toContainText('Dashboard');
    await expect(trail(page)).toContainText('Entity setup');
    await trail(page).getByRole('link', { name: 'Town' }).click();
    await expect(page).toHaveURL(/\/dashboard\/Town$/i);
  });

  test('pages that had no tab title have one', async ({ page }) => {
    for (const [url, title] of [
      ['/admin/roads', 'Road network'],
      ['/admin/email', 'Mail log'],
      ['/admin/invitations', 'Invitations'],
      ['/admin/minecraft-catalog', 'Minecraft catalogue'],
      ['/leaderboards', 'Leaderboards'],
      ['/owner/telemetry', 'Diagnostics'],
      ['/owner/privacy', 'Data deletion requests'],
      ['/owner/analytics', 'World analytics'],
      ['/admin/locations/orphans', 'Orphaned Locations'],
    ]) {
      await page.goto(url);
      await expect(page).toHaveTitle(`${title} · Knights & Kings`);
    }
  });

  test('old builder list URLs open Entity setup', async ({ page }) => {
    for (const url of ['/admin/form-configurations', '/admin/display-configurations']) {
      await page.goto(url);
      await expect(page).toHaveURL(/\/forms$/);
      await expect(page).toHaveTitle(/^Entity setup/);
    }
  });

  test('below 1280 px the "Admin pages" button opens the list; a choice or Escape closes it', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('/admin/game-settings');
    const button = page.getByRole('button', { name: 'Admin pages' });
    await button.click();
    const list = sidebar(page);
    await expect(list.getByRole('link', { name: 'Mail log' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(list.getByRole('link', { name: 'Mail log' })).toBeHidden();

    await button.click();
    await page.mouse.click(1000, 700);
    await expect(list.getByRole('link', { name: 'Mail log' })).toBeHidden();

    await button.click();
    await sidebar(page).getByRole('link', { name: 'Mail log' }).click();
    await expect(page).toHaveURL(/\/admin\/email$/);
    await expect(sidebar(page).getByRole('link', { name: 'Mail log' })).toBeHidden();
  });
});

test.describe('as staff with only some nodes', () => {
  test.beforeEach(({ api }) => mockSession(api, alex, node => PARTIAL_NODES.has(node)));

  test('the bar has Admin but no Dashboard; /admin lists exactly the five pages the nodes open', async ({ page }) => {
    await page.goto('/admin');
    await expect(topBar(page).getByRole('link', { name: 'Admin' })).toBeVisible();
    await expect(topBar(page).getByRole('link', { name: 'Dashboard' })).toHaveCount(0);

    const pages = page.getByRole('link', { name: /^(Orphaned Locations|Invitations|Balance event log|Game settings|Mail log) / });
    await expect(pages).toHaveCount(5);
    for (const hidden of ['Player moderation', 'Siege settings', 'Currency policy', 'Currency alerts', 'Diagnostics', 'Minecraft catalogue']) {
      await expect(page.getByRole('link', { name: new RegExp(`^${hidden} `) })).toHaveCount(0);
    }
    await expect(page.getByRole('heading', { name: 'Owner', exact: true })).toHaveCount(0);
  });

  test('Balance event log and Orphaned Locations open from the sidebar', async ({ page }) => {
    await page.goto('/admin/email');
    await sidebar(page).getByRole('link', { name: 'Balance event log' }).click();
    await expect(page).toHaveURL(/\/admin\/users\/balance-log$/);
    await sidebar(page).getByRole('link', { name: 'Orphaned Locations' }).click();
    await expect(page).toHaveURL(/\/admin\/locations\/orphans$/);
  });

  test('a page without its node says "Staff only" with the node, and the sidebar stays', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Staff only' })).toBeVisible();
    await expect(page.getByText('knk.admin.user.manage')).toBeVisible();
    await expect(sidebar(page).getByRole('link', { name: 'Mail log' })).toBeVisible();

    await page.goto('/admin/siege-configuration');
    await expect(page.getByRole('heading', { name: 'Staff only' })).toBeVisible();
    await expect(page.getByText('knk.siege.admin.manage')).toBeVisible();
  });

  test('at 390 px "Admin pages" lists the same five pages', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Game settings: Mail log and Invitations still scroll sideways at 390 px (PandiO/knk-workspace#535).
    await page.goto('/admin/game-settings');
    await page.getByRole('button', { name: 'Admin pages' }).click();
    await expect(sidebar(page).getByRole('link')).toHaveText(['Orphaned Locations', 'Invitations', 'Balance event log', 'Game settings', 'Mail log']);
    await expectNoSidewaysScroll(page);
  });
});

test('a player without staff nodes sees Home, Leaderboards, Guides only, and /admin says "No admin pages"', async ({ page, api }) => {
  mockSession(api, steve, () => false);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'No admin pages' })).toBeVisible();
  for (const name of ['Home', 'Leaderboards', 'Guides']) {
    await expect(topBar(page).getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(topBar(page).getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
});
