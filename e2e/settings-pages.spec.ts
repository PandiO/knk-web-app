import { test, expect } from './support/mockApi';
import type { Page } from '@playwright/test';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { coinsPolicy, mockCurrencyPolicy, mockLootboxSettings, mockRoadNetwork, mockSiegeSettings } from './fixtures/settings';
import type { CurrencyPolicyDto } from '../src/types/dtos/currency/CurrencyDtos';
import type { LootboxConfigurationDto } from '../src/types/dtos/lootbox/LootboxDtos';
import { expectNoSidewaysScroll } from './support/layout';

/**
 * The settings pages on the SettingsPage shell in the real admin layout (PandiO/knk-workspace#26, #187):
 * the unsaved-changes count, the leave question from a sidebar link, the browser's Back and a reload,
 * Save with its toast, a stale currency policy, and phone width. The units, help lines and previews are
 * in the pages' Jest tests. Smoke tests: knk-workspace docs/guides/settings-pages-smoke-test.md and
 * data-primitives-smoke-test.md § 4 (backfill #511).
 */

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Admin' }).first();
const leaveQuestion = (page: Page) => page.getByRole('alertdialog', { name: 'Leave without saving?' });

test.beforeEach(async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex, node => node !== 'knk.owner.privacy.manage');
  mockContentDefaults(api);
});

test.describe('Lootboxes → Settings', () => {
  test.beforeEach(({ api }) => mockLootboxSettings(api));

  test('a sidebar link with a change asks first; Stay keeps the value, Leave goes', async ({ page, api }) => {
    mockRoadNetwork(api);
    await page.goto('/admin/lootboxes?tab=settings');
    const header = page.getByRole('banner', { name: 'Lootbox settings' });
    await expect(header).toContainText('No unsaved changes.');

    await page.getByLabel('Max active boxes (all areas)').fill('20');
    await expect(header).toContainText('1 unsaved change.');
    await expect(page.getByRole('region', { name: 'Limits' })).toContainText('Changed');

    await sidebar(page).getByRole('link', { name: 'Road network' }).click();
    const question = leaveQuestion(page);
    await expect(question).toContainText('1 unsaved change');
    await expect(question.getByRole('button', { name: 'Stay' })).toBeFocused();
    await question.getByRole('button', { name: 'Stay' }).click();
    await expect(page).toHaveURL(/\/admin\/lootboxes\?tab=settings$/);
    await expect(page.getByLabel('Max active boxes (all areas)')).toHaveValue('20');

    await sidebar(page).getByRole('link', { name: 'Road network' }).click();
    await leaveQuestion(page).getByRole('button', { name: 'Leave' }).click();
    await expect(page).toHaveURL(/\/admin\/roads$/);
    expect(api.calls('PUT', /^LootboxConfiguration\/?$/)).toHaveLength(0);
  });

  test('closing or reloading the tab with a change asks the browser question; without a change it does not', async ({ page }) => {
    await page.goto('/admin/lootboxes?tab=settings');
    await expect(page.getByLabel('Max active boxes (all areas)')).toHaveValue('15');

    const asked: string[] = [];
    page.on('dialog', dialog => {
      asked.push(dialog.type());
      void dialog.dismiss();
    });
    await page.reload();
    await expect(page.getByLabel('Max active boxes (all areas)')).toHaveValue('15');
    expect(asked).toEqual([]);

    await page.getByLabel('Max active boxes (all areas)').fill('20');
    await expect(page.getByRole('banner', { name: 'Lootbox settings' })).toContainText('1 unsaved change.');
    await page.close({ runBeforeUnload: true });
    await expect.poll(() => asked).toEqual(['beforeunload']);
  });

  test('switching lootboxes off asks in red first, then saves with a toast and a clean header', async ({ page, api }) => {
    await page.goto('/admin/lootboxes?tab=settings');
    const header = page.getByRole('banner', { name: 'Lootbox settings' });
    await page.getByLabel('Lootboxes enabled').uncheck();
    await header.getByRole('button', { name: 'Save (1)' }).click();

    const question = page.getByRole('alertdialog', { name: 'Switch lootboxes off?' });
    await question.getByRole('button', { name: 'Cancel' }).click();
    await expect(header).toContainText('1 unsaved change.');
    expect(api.calls('PUT', /^LootboxConfiguration\/?$/)).toHaveLength(0);

    await header.getByRole('button', { name: 'Save (1)' }).click();
    await page.getByRole('alertdialog', { name: 'Switch lootboxes off?' }).getByRole('button', { name: 'Switch off and save' }).click();
    await expect(page.getByText('Lootbox settings saved.')).toBeVisible();
    await expect(header).toContainText('No unsaved changes.');
    const saved = api.calls('PUT', /^LootboxConfiguration\/?$/).map(r => (r.body as LootboxConfigurationDto).enabled);
    expect(saved).toEqual([false]);
  });

  test('a refused save shows the API reason in the header and keeps the value', async ({ page, api }) => {
    api.on('PUT', /^LootboxConfiguration\/?$/, { status: 400, body: { error: 'ValidationFailed', message: 'globalMaxActive must be at most 500.' } });
    await page.goto('/admin/lootboxes?tab=settings');
    const header = page.getByRole('banner', { name: 'Lootbox settings' });
    await page.getByLabel('Max active boxes (all areas)').fill('9999');
    await header.getByRole('button', { name: 'Save (1)' }).click();

    await expect(header.getByRole('alert')).toContainText('globalMaxActive must be at most 500.');
    await expect(page.getByLabel('Max active boxes (all areas)')).toHaveValue('9999');
  });
});

test.describe('Currency policy', () => {
  test.beforeEach(({ api }) => mockCurrencyPolicy(api));

  test('a Coins and a Gems change count together, a sidebar link asks, and one Save stores both', async ({ page, api }) => {
    mockRoadNetwork(api);
    await page.goto('/admin/economy/policy');
    const header = page.getByRole('banner', { name: 'Currency policy' });
    const coins = page.getByRole('region', { name: 'Coins' });
    const gems = page.getByRole('region', { name: 'Gems' });

    await coins.getByLabel('Signup grant').fill('300');
    await gems.getByLabel('Maximum payment').fill('400');
    await expect(header).toContainText('2 unsaved changes.');
    await expect(coins).toContainText('Changed');
    await expect(gems).toContainText('Changed');

    await sidebar(page).getByRole('link', { name: 'Road network' }).click();
    await leaveQuestion(page).getByRole('button', { name: 'Stay' }).click();
    await expect(coins.getByLabel('Signup grant')).toHaveValue('300');

    await header.getByRole('button', { name: 'Save (2)' }).click();
    await expect(page.getByText('Saved the coins and gems policies.')).toBeVisible();
    await expect(header).toContainText('No unsaved changes.');
    expect(api.calls('PUT', 'currency/admin/policy/coins').map(r => (r.body as CurrencyPolicyDto).signupGrant)).toEqual([300]);
    expect(api.calls('PUT', 'currency/admin/policy/gems').map(r => (r.body as CurrencyPolicyDto).maxTransfer)).toEqual([400]);
  });

  test('a policy changed elsewhere since loading: the header says so, Save stays off, Reload current policy shows it', async ({ page, api }) => {
    const changed: CurrencyPolicyDto = { ...coinsPolicy, signupGrant: 999, updatedAt: '2026-11-14T09:00:00.000001' };
    api.on('PUT', 'currency/admin/policy/coins', {
      status: 409,
      body: { error: 'PolicyChanged', code: 'PolicyChanged', message: 'The Coins policy was changed since you loaded it.', details: changed },
    });
    await page.goto('/admin/economy/policy');
    const header = page.getByRole('banner', { name: 'Currency policy' });
    const coins = page.getByRole('region', { name: 'Coins' });

    await coins.getByLabel('Maximum payment').fill('500000');
    await header.getByRole('button', { name: 'Save (1)' }).click();
    await expect(header.getByRole('alert')).toContainText('Coins: This policy was changed since you loaded it');
    await expect(header.getByRole('button', { name: 'Save (1)' })).toBeDisabled();

    api.json<CurrencyPolicyDto[]>('GET', 'currency/admin/policy', [changed]);
    await coins.getByRole('button', { name: 'Reload current policy' }).click();
    await expect(coins.getByLabel('Signup grant')).toHaveValue('999');
    await expect(coins.getByRole('button', { name: 'Reload current policy' })).toHaveCount(0);
  });
});

test.describe('Road network', () => {
  test.beforeEach(({ api }) => mockRoadNetwork(api));

  test('a default and a compass change are counted, Discard puts them back, Save stores both with a toast', async ({ page, api }) => {
    await page.goto('/admin/roads');
    const header = page.getByRole('banner', { name: 'Road network' });

    await page.getByLabel('Towns navigation default').selectOption('Region');
    await page.getByLabel('Material').fill('RECOVERY_COMPASS');
    await expect(header).toContainText('2 unsaved changes.');
    expect(api.calls('PUT', /^navigation-settings\//)).toHaveLength(0);

    await header.getByRole('button', { name: 'Discard' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: /^Discard/ }).click();
    await expect(page.getByLabel('Towns navigation default')).toHaveValue('Spawn');
    await expect(header).toContainText('No unsaved changes.');

    await page.getByLabel('Towns navigation default').selectOption('Region');
    await page.getByLabel('Material').fill('RECOVERY_COMPASS');
    await header.getByRole('button', { name: 'Save (2)' }).click();
    await expect(page.getByText('Saved 2 changes. The game server picks them up within a minute.')).toBeVisible();
    expect(api.calls('PUT', 'navigation-settings/domain-defaults/Town').map(r => r.body)).toEqual([{ defaultMode: 'Region' }]);
    expect(api.calls('PUT', 'navigation-settings/compass').map(r => (r.body as { material: string }).material)).toEqual(['RECOVERY_COMPASS']);
  });
});

test.describe('Siege settings (data primitives § 4)', () => {
  test.beforeEach(({ api }) => mockSiegeSettings(api));

  test('the browser Back with a change asks the leave question', async ({ page }) => {
    // Arrive inside the app (a client-side navigation), so Back stays in the app too.
    await page.goto('/admin');
    await page.getByRole('link', { name: /^Siege settings/ }).click();
    await page.getByLabel('Headshot multiplier').fill('2');
    await expect(page.getByRole('banner', { name: 'Siege settings' })).toContainText('1 unsaved change.');

    await page.goBack();
    await leaveQuestion(page).getByRole('button', { name: 'Stay' }).click();
    await expect(page).toHaveURL(/\/admin\/siege-configuration$/);
    await expect(page.getByLabel('Headshot multiplier')).toHaveValue('2');
  });

  test('fields show their unit and what the value means (ticks, per mille, fraction)', async ({ page }) => {
    await page.goto('/admin/siege-configuration');
    const delay = page.getByLabel('Spawn picker / respawn delay');
    await expect(delay).toHaveValue('20');
    await expect(delay).toHaveAccessibleDescription(/= 1 s/);
    await expect(page.getByLabel('Drop chance per second')).toHaveAccessibleDescription(/= 3%/);
    await expect(page.getByLabel('Side-capture reduction')).toHaveAccessibleDescription(/= 40%/);
  });

  test('letters in a whole-number field say so and keep Save off; two changes save with "Saved 2 settings."', async ({ page, api }) => {
    await page.goto('/admin/siege-configuration');
    const header = page.getByRole('banner', { name: 'Siege settings' });

    await page.getByLabel('Attack base').fill('abc');
    await expect(page.getByText('Whole number required.')).toBeVisible();
    await expect(header.getByRole('button', { name: /^Save/ })).toBeDisabled();

    await page.getByLabel('Attack base').fill('6');
    await page.getByLabel('Headshot multiplier').fill('2');
    await header.getByRole('button', { name: 'Save (2)' }).click();
    await expect(page.getByText('Saved 2 settings.')).toBeVisible();
    await expect(header).toContainText('No unsaved changes.');
    expect(api.calls('PUT', /^SiegeConfiguration\/?$/).map(r => r.body)).toEqual([{ captureAttackBase: 6, headshotMultiplier: 2 }]);
  });

  test('the siege points section shows the earn amounts and saves them with the transfer switch (#878)', async ({ page, api }) => {
    await page.goto('/admin/siege-configuration');
    const header = page.getByRole('banner', { name: 'Siege settings' });
    await expect(page.getByRole('heading', { name: 'Siege points' })).toBeVisible();
    await expect(page.getByLabel('Points per kill')).toHaveValue('100');
    await expect(page.getByLabel('Kill streak cap')).toHaveValue('1.5');
    await expect(page.getByLabel('Assist window')).toHaveAccessibleDescription(/0–600/);
    await expect(page.getByLabel('Allow teammate transfers')).not.toBeChecked();

    await page.getByLabel('Points per kill').fill('120');
    await page.getByLabel('Trickle interval').fill('30');
    await page.getByLabel('Allow teammate transfers').check();
    await header.getByRole('button', { name: 'Save (3)' }).click();
    await expect(page.getByText('Saved 3 settings.')).toBeVisible();
    expect(api.calls('PUT', /^SiegeConfiguration\/?$/).map(r => r.body))
      .toEqual([{ pointsPerKill: 120, trickleIntervalSeconds: 30, pointTransfersEnabled: true }]);
  });
});

test('at phone width the settings pages do not scroll sideways', async ({ page, api }) => {
  mockLootboxSettings(api);
  mockCurrencyPolicy(api);
  mockRoadNetwork(api);
  mockSiegeSettings(api);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [url, title] of [
    ['/admin/lootboxes?tab=settings', 'Lootbox settings'],
    ['/admin/economy/policy', 'Currency policy'],
    ['/admin/roads', 'Road network'],
    ['/admin/siege-configuration', 'Siege settings'],
  ]) {
    await page.goto(url);
    await expect(page.getByRole('banner', { name: title })).toBeVisible();
    await expectNoSidewaysScroll(page);
  }
});
