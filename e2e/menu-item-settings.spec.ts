import { test, expect } from './support/mockApi';
import type { Page } from '@playwright/test';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { mockMenuItemGameSettings, seededMenuItem } from './fixtures/menuItem';
import type { GameSettingsUpdateDto } from '../src/types/dtos/gameSettings/GameSettingsModels';
import { expectNoSidewaysScroll } from './support/layout';

/**
 * The Menu item card on the game settings page (PandiO/knk-workspace#870, siege shop DESIGN § 4.3, acceptance A29):
 * the seeded look and click tables, editing the look, a click and an override, the inline checks and the API's
 * refusal. That a save reaches online players is the API's GameSettingsChanged event (knk-web-api
 * `MenuItemSettingsTests`) and the plugin (#871). Smoke test: knk-workspace docs/guides/siege-shop-smoke-test.md § 5.
 */

const card = (page: Page) => page.getByRole('region', { name: 'Menu item' });
const putBodies = (api: { calls: (m: 'PUT', p: RegExp) => Array<{ body: unknown }> }) =>
  api.calls('PUT', /^GameSettings\/?$/).map(c => c.body as GameSettingsUpdateDto);

test.beforeEach(async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex, () => true);
  mockContentDefaults(api);
  mockMenuItemGameSettings(api);
});

test('shows the seeded menu item: today\'s look, clicks to the main menu and the siege overrides', async ({ page }) => {
  await page.goto('/admin/game-settings');
  const menuItem = card(page);

  await expect(menuItem.getByRole('checkbox', { name: /Menu item enabled/ })).toBeChecked();
  await expect(menuItem.getByLabel('Material')).toHaveValue('NETHER_STAR');
  await expect(menuItem.getByLabel('Name')).toHaveValue('&6&lMenu &7(click to open)');
  await expect(menuItem.getByLabel('Slot')).toHaveValue('8');
  await expect(menuItem.getByLabel('Who gets it')).toHaveValue('all');
  for (const click of ['Left click', 'Right click', 'Shift + left click', 'Shift + right click', 'Click in the inventory']) {
    await expect(menuItem.getByLabel(`${click} action`, { exact: true })).toHaveValue('OpenMenu');
    await expect(menuItem.getByLabel(`${click} menu key`, { exact: true })).toHaveValue('main');
  }

  const match = menuItem.getByRole('group', { name: 'Siege match override' });
  await expect(match.getByLabel('Siege match: Right click menu key')).toHaveValue('siege.information');
  await expect(match.getByLabel('Siege match: Shift + right click menu key')).toHaveValue('siege.shop');
  await expect(match.getByLabel('Siege match: Shift + left click action')).toHaveValue('');
  await expect(menuItem.getByRole('group', { name: 'Siege Survival match override' })
    .getByLabel('Siege Survival match: Shift + right click menu key')).toHaveValue('siege.shop');
  await expect(menuItem.getByRole('group', { name: 'Siege hub override' })
    .getByLabel('Siege hub: Left click menu key')).toHaveValue('siege.information');
});

test('saves the look, a click and an override in the menuItem section (A29)', async ({ page, api }) => {
  await page.goto('/admin/game-settings');
  const menuItem = card(page);

  await menuItem.getByLabel('Name').fill('&bKnK menu');
  await menuItem.getByLabel('Shift + left click action', { exact: true }).selectOption('RunCommand');
  await menuItem.getByLabel('Shift + left click command', { exact: true }).fill('siege points');
  await menuItem.getByRole('group', { name: 'Siege hub override' })
    .getByLabel('Siege hub: Shift + right click action').selectOption('OpenMenu');
  await menuItem.getByRole('group', { name: 'Siege hub override' })
    .getByLabel('Siege hub: Shift + right click menu key').fill('siege.shop');
  await menuItem.getByRole('group', { name: 'Siege match override' })
    .getByLabel('Siege match: Left click action').selectOption('');
  await expect(menuItem.getByRole('heading', { name: /Menu item/ })).toContainText('(changed)');
  await page.getByRole('button', { name: /^Save/ }).click();

  await expect.poll(() => putBodies(api).length).toBe(1);
  const sent = putBodies(api)[0].menuItem!;
  expect(sent.name).toBe('&bKnK menu');
  expect(sent.lore).toEqual(seededMenuItem.lore);
  expect(sent.clicks.SHIFT_LEFT_CLICK).toEqual({ type: 'RunCommand', command: 'siege points' });
  expect(sent.clicks.RIGHT_CLICK).toEqual({ type: 'OpenMenu', menuKey: 'main' });
  expect(sent.overrides['siege.hub'].SHIFT_RIGHT_CLICK).toEqual({ type: 'OpenMenu', menuKey: 'siege.shop' });
  expect(sent.overrides['siege.match']).toEqual({
    RIGHT_CLICK: { type: 'OpenMenu', menuKey: 'siege.information' },
    SHIFT_RIGHT_CLICK: { type: 'OpenMenu', menuKey: 'siege.shop' },
  });
  await expect(page.getByRole('banner', { name: 'Game settings' })).toContainText('No unsaved changes.');
});

test('removes an override and adds it back empty; an empty override is not sent', async ({ page, api }) => {
  await page.goto('/admin/game-settings');
  const menuItem = card(page);

  await menuItem.getByRole('button', { name: 'Remove Siege hub' }).click();
  await expect(menuItem.getByRole('group', { name: 'Siege hub override' })).toHaveCount(0);
  await menuItem.getByLabel('Situation').selectOption('siege.hub');
  await menuItem.getByRole('button', { name: 'Add override' }).click();
  await expect(menuItem.getByRole('group', { name: 'Siege hub override' })
    .getByLabel('Siege hub: Left click action')).toHaveValue('');
  await page.getByRole('button', { name: /^Save/ }).click();

  await expect.poll(() => putBodies(api).length).toBe(1);
  expect(Object.keys(putBodies(api)[0].menuItem!.overrides).sort()).toEqual(['siege.match', 'siege.survival.match']);
});

test('says what the API would refuse and keeps Save off', async ({ page }) => {
  await page.goto('/admin/game-settings');
  const menuItem = card(page);

  await menuItem.getByLabel('Left click menu key', { exact: true }).fill('Siege Shop');
  await menuItem.getByLabel('Slot').fill('40');

  await expect(menuItem.getByRole('list', { name: 'Menu item problems' }).getByRole('listitem')).toHaveText([
    'Slot must be 0 to 35.',
    'Left click: "Siege Shop" is not a menu key (lower case letters, digits, ".", "_" and "-", such as siege.shop).',
  ]);
  await expect(page.getByRole('button', { name: /^Save/ })).toBeDisabled();
});

test('a refused save shows the API reason in the header', async ({ page, api }) => {
  api.on('PUT', /^GameSettings\/?$/, {
    status: 400,
    body: { message: "menuItem.material must be a material name such as NETHER_STAR." },
  });
  await page.goto('/admin/game-settings');

  await card(page).getByLabel('Material').fill('NOT_A_BLOCK');
  await page.getByRole('button', { name: /^Save/ }).click();

  await expect(page.getByRole('banner', { name: 'Game settings' }).getByRole('alert'))
    .toContainText('menuItem.material must be a material name such as NETHER_STAR.');
});

test('at phone width the card does not make the page scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/game-settings');
  await expect(card(page)).toBeVisible();
  await expectNoSidewaysScroll(page);
});
