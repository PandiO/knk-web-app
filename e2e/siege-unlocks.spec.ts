import { test, expect } from './support/mockApi';
import type { Page } from '@playwright/test';
import { mockSession, startLoggedIn, steve } from './fixtures/auth';
import { mockSiegeUnlocks } from './fixtures/siegeUnlocks';
import { expectNoSidewaysScroll } from './support/layout';

/**
 * The Siege unlocks panel on the player's own account page (siege shop L4, PandiO/knk-workspace#869, DESIGN § 4.2.2,
 * acceptance A27): every siege weapon type with its coin price, minimum title and the player's state; unlocking asks
 * for a confirmation and charges once; a refusal says why. The checks behind it (title before coins, one charge per
 * type) are knk-web-api's `SiegeWeaponUnlockPurchaseServiceTests`. Smoke test: knk-workspace
 * docs/guides/siege-shop-smoke-test.md § 4.
 */

const panel = (page: Page) => page.getByRole('region', { name: 'Siege unlocks' });
const row = (page: Page, name: string) => panel(page).getByRole('listitem', { name });

test.beforeEach(async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, steve);
});

test('lists every weapon type with price, minimum title and state (A27)', async ({ page, api }) => {
  mockSiegeUnlocks(api, steve.id);
  await page.goto('/account');

  await expect(panel(page).getByText(/^Coins: 1200/)).toBeVisible();
  await expect(row(page, 'Ballista')).toContainText('500 coins');
  await expect(row(page, 'Ballista')).toContainText('minimum title: none');
  await expect(row(page, 'Ballista').getByRole('button', { name: 'Unlock for 500 coins' })).toBeVisible();
  await expect(row(page, 'Trebuchet')).toContainText('minimum title: Squire');
  await expect(row(page, 'Trebuchet')).toContainText('Needs title Squire');
  await expect(row(page, 'Trebuchet').getByRole('button')).toHaveCount(0);
  await expectNoSidewaysScroll(page);
});

test('unlocking asks to confirm, then charges once even on a double click (A27)', async ({ page, api }) => {
  const state = mockSiegeUnlocks(api, steve.id, undefined, { delayMs: 300 });
  await page.goto('/account');

  await row(page, 'Ballista').getByRole('button', { name: 'Unlock for 500 coins' }).click();
  expect(api.calls('POST', 'SiegeWeaponUnlocks/purchase')).toHaveLength(0);
  const confirm = row(page, 'Ballista').getByRole('button', { name: 'Confirm: unlock for 500 coins' });
  await confirm.dblclick();

  await expect(panel(page).getByRole('status')).toHaveText('Unlocked the Ballista for 500 coins. You can buy it in siege matches now.');
  await expect(row(page, 'Ballista')).toContainText('Unlocked');
  await expect(panel(page).getByText(/^Coins: 700/)).toBeVisible();
  const posts = api.calls('POST', 'SiegeWeaponUnlocks/purchase');
  expect(posts).toHaveLength(1);
  expect(posts[0].body).toEqual({ templateId: 3 });
  expect(state.coins).toBe(700);
  // 700 left: the catapult (800) now says why it can't be unlocked.
  await expect(row(page, 'Catapult')).toContainText('Not enough coins: 700/800');
});

test('cancel leaves everything as it was', async ({ page, api }) => {
  mockSiegeUnlocks(api, steve.id);
  await page.goto('/account');

  await row(page, 'Ballista').getByRole('button', { name: 'Unlock for 500 coins' }).click();
  await row(page, 'Ballista').getByRole('button', { name: 'Cancel' }).click();

  await expect(row(page, 'Ballista').getByRole('button', { name: 'Unlock for 500 coins' })).toBeVisible();
  expect(api.calls('POST', 'SiegeWeaponUnlocks/purchase')).toHaveLength(0);
});

test('the API\'s refusal is shown and nothing changes (A27)', async ({ page, api }) => {
  // The list said unlockable, but the coins were spent in game in the meantime.
  const state = mockSiegeUnlocks(api, steve.id);
  await page.goto('/account');
  await row(page, 'Ballista').getByRole('button', { name: 'Unlock for 500 coins' }).click();
  state.coins = 300;

  await row(page, 'Ballista').getByRole('button', { name: 'Confirm: unlock for 500 coins' }).click();

  await expect(panel(page).getByRole('alert')).toHaveText('Not enough coins to unlock the Ballista: 300/500.');
  await expect(row(page, 'Ballista')).toContainText('Not enough coins: 300/500');
  expect(state.unlocked.size).toBe(0);
});

test('a player without a linked Minecraft account has no panel', async ({ page, api }) => {
  mockSession(api, { ...steve, uuid: undefined, minecraftLinked: false });
  mockSiegeUnlocks(api, steve.id);
  await page.goto('/account');

  await expect(page.getByRole('heading', { name: 'Account Information' })).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  expect(api.calls('GET', 'SiegeWeaponUnlocks/mine')).toHaveLength(0);
});
