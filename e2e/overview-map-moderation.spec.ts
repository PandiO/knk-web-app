import { test, expect } from './support/mockApi';
import type { Frame, Page } from '@playwright/test';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { defaultJoe, serveFakeBlueMap } from './fixtures/map';
import { JOE_USER_ID, mockMapModeration } from './fixtures/mapModeration';
import { expectNoSidewaysScroll } from './support/layout';

/**
 * The player context panel with moderation actions on the overview map (PandiO/knk-workspace#743; OVERVIEW_MAP_DESIGN
 * § 4.4, § 5 rule 12, O11, O25; A20, A21): a viewer holding any of knk.freeze, knk.unfreeze, knk.kick, knk.ban or
 * knk.admin.user.manage gets a Moderation section under the clicked player's name card; each action shows only under
 * its own node and calls the profile page's endpoints; "Open profile" links to the player profile page. Everyone
 * else gets only the name card and causes no account or moderation request. Mocked API; BlueMap is the fake web app
 * running the real bridge script. Smoke test: knk-workspace docs/guides/overview-map-smoke-test.md § 9.
 */

test.use({ strictApi: true });

const MODERATION_NODES = ['knk.freeze', 'knk.unfreeze', 'knk.kick', 'knk.ban', 'knk.admin.user.manage'];

async function clickJoe(page: Page): Promise<void> {
  await page.goto('/map');
  const handle = await page.locator('iframe[title="Map of Knights and Kings"]').elementHandle();
  const frame = (await handle!.contentFrame()) as Frame;
  await frame.locator(`[data-set="knk-players"][data-marker="player|${defaultJoe.uuid}"]`).click();
  await expect(card(page).getByLabel('Name label')).toHaveText('Joe');
}

const card = (page: Page) => page.getByRole('complementary', { name: 'Player details' });
const moderation = (page: Page) => card(page).getByRole('region', { name: 'Moderation' });
const actions = (page: Page) => moderation(page).getByRole('group', { name: 'Moderation actions' });
const accountReads = (api: { calls: (method: 'GET', path: string) => unknown[] }) =>
  api.calls('GET', `Users/uuid/${defaultJoe.uuid}`);

test.beforeEach(async ({ page }) => {
  await serveFakeBlueMap(page);
});

test('a viewer with only knk.kick sees only Kick and "Open profile"; kicking works as on the profile (A20)', async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex, node => node === 'knk.kick');
  mockContentDefaults(api);
  const fake = mockMapModeration(api);
  await clickJoe(page);

  await expect(moderation(page).getByRole('heading', { name: 'Moderation' })).toBeVisible();
  await expect(actions(page).getByRole('button')).toHaveText(['Kick…']);
  await expect(moderation(page).getByRole('link', { name: 'Open profile' })).toHaveAttribute('href', `/admin/users/${JOE_USER_ID}`);
  expect(accountReads(api)).toHaveLength(1);

  await actions(page).getByRole('button', { name: 'Kick…' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Kick Joe?' });
  await dialog.getByLabel('Reason').fill('AFK farming');
  await dialog.getByRole('button', { name: 'Kick' }).click();
  await expect(page.getByText('Joe is being kicked')).toBeVisible();
  expect(fake.writes).toEqual([{ action: 'kick', body: { reason: 'AFK farming' } }]);
});

test('a viewer with every moderation node freezes, unfreezes and bans from the panel', async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex, node => MODERATION_NODES.includes(node));
  mockContentDefaults(api);
  const fake = mockMapModeration(api);
  await clickJoe(page);
  await expect(actions(page).getByRole('button')).toHaveText(['Freeze…', 'Kick…', 'Ban…']);

  await actions(page).getByRole('button', { name: 'Freeze…' }).click();
  const freeze = page.getByRole('alertdialog', { name: 'Freeze Joe?' });
  await freeze.getByLabel('Reason').fill('Griefing');
  await freeze.getByRole('button', { name: 'Freeze' }).click();
  await expect(page.getByText('Joe is frozen')).toBeVisible();
  // The account is read again: frozen, with the reason, and the button turns into Unfreeze.
  await expect(moderation(page).getByText('Reason: Griefing')).toBeVisible();
  await expect(actions(page).getByRole('button')).toHaveText(['Unfreeze', 'Kick…', 'Ban…']);

  await actions(page).getByRole('button', { name: 'Unfreeze' }).click();
  await page.getByRole('alertdialog', { name: 'Unfreeze Joe?' }).getByRole('button', { name: 'Unfreeze' }).click();
  await expect(page.getByText('Joe is unfrozen')).toBeVisible();
  await expect(actions(page).getByRole('button', { name: 'Freeze…' })).toBeVisible();

  await actions(page).getByRole('button', { name: 'Ban…' }).click();
  const ban = page.getByRole('alertdialog', { name: 'Ban Joe permanently?' });
  await ban.getByLabel('Reason').fill('X-ray');
  await ban.getByRole('button', { name: 'Ban permanently' }).click();
  await expect(page.getByText('Joe is banned')).toBeVisible();

  expect(fake.writes).toEqual([
    { action: 'freeze', body: { reason: 'Griefing' } },
    { action: 'unfreeze', body: undefined },
    { action: 'ban', body: { reason: 'X-ray' } },
  ]);
});

test('a logged-in viewer without any moderation node gets only the name card (A21)', async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex);
  mockContentDefaults(api);
  const fake = mockMapModeration(api);
  await clickJoe(page);

  await expect(card(page).getByRole('list', { name: 'Tags' })).toBeVisible();
  // Let every node check answer before looking for what is not there.
  await expect.poll(() => api.calls('GET', `Users/${alex.id}/permissions/check`)
    .filter(call => MODERATION_NODES.includes(call.query.get('node') ?? '')).length).toBe(MODERATION_NODES.length);
  await expect(moderation(page)).toHaveCount(0);
  await expect(card(page).getByRole('link', { name: 'Open profile' })).toHaveCount(0);
  expect(accountReads(api)).toHaveLength(0);
  expect(fake.writes).toHaveLength(0);
});

test('anonymous viewers get only the name card and make no permission or account request (A21)', async ({ page, api }) => {
  mockMapModeration(api);
  await clickJoe(page);
  await expect(moderation(page)).toHaveCount(0);
  expect(api.requests.filter(request => /^users\//i.test(request.path))).toHaveLength(0);
});

test('on a phone the panel is a bottom sheet and the page does not scroll sideways', async ({ page, api }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex, node => MODERATION_NODES.includes(node));
  mockContentDefaults(api);
  mockMapModeration(api);
  await clickJoe(page);
  await expect(actions(page).getByRole('button')).toHaveText(['Freeze…', 'Kick…', 'Ban…']);
  const box = (await card(page).boundingBox())!;
  expect(Math.round(box.width)).toBe(390);
  await expectNoSidewaysScroll(page);
});
