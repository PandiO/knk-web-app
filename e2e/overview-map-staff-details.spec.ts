import { test, expect } from './support/mockApi';
import type { Frame, Page } from '@playwright/test';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { mockMapOn, serveFakeBlueMap } from './fixtures/map';
import { mockBakeryDetails, mockBakeryPanel } from './fixtures/mapStaffDetails';
import { expectNoSidewaysScroll } from './support/layout';
import type { MockApi } from './support/mockApi';

/**
 * Staff details in the map panel (PandiO/knk-workspace#740; OVERVIEW_MAP_DESIGN § 4 item 5, § 5 rule 10, § 6.3.3, O16;
 * A17): a viewer with knk.admin.world sees "Details" under the public part, the type's default display configuration
 * in compact form with "Open full page"; anyone else sees no such section and the page asks for no display
 * configuration. Smoke test: knk-workspace docs/guides/overview-map-smoke-test.md § 6.
 */

test.use({ strictApi: true });

async function openBakery(page: Page): Promise<void> {
  await page.goto('/map');
  const handle = await page.locator('iframe[title="Map of Knights and Kings"]').elementHandle();
  const frame = (await handle!.contentFrame()) as Frame;
  await frame.locator('[data-marker="structure:10|pin"]').click();
  await expect(page.getByRole('complementary', { name: 'Place details' }).getByRole('heading', { name: 'Bakery' })).toBeVisible();
}

const panel = (page: Page) => page.getByRole('complementary', { name: 'Place details' });

/** The map on with the Bakery's public panel (after mockSession, whose default is the map off). */
function mockMap(api: MockApi): void {
  mockMapOn(api);
  mockBakeryPanel(api);
}

test.beforeEach(async ({ page }) => {
  await serveFakeBlueMap(page);
});

test.describe('world staff (knk.admin.world)', () => {
  test.beforeEach(async ({ page, api }) => {
    await startLoggedIn(page, 'access-1');
    mockSession(api, alex, node => node === 'knk.admin.world');
    mockContentDefaults(api);
    mockMap(api);
    mockBakeryDetails(api);
  });

  test('a structure shows "Details" in compact form under the public part, with "Open full page" (A17)', async ({ page, api }) => {
    await openBakery(page);
    const details = panel(page).getByRole('region', { name: 'Details' });
    await expect(details.getByRole('heading', { name: 'Details' })).toBeVisible();
    // Under the public part: the public description comes first.
    await expect(panel(page).getByText('Fresh bread every morning.').first()).toBeVisible();
    await expect(details.getByText('Street number')).toBeVisible();
    await expect(details.getByText('3', { exact: true })).toBeVisible();
    // No header: the configuration's name and description are not shown.
    await expect(details.getByText('Structure (e2e)')).toHaveCount(0);
    await expect(details.getByText('Everything about a structure.')).toHaveCount(0);
    await expect(details.getByRole('link', { name: 'Open full page' }))
      .toHaveAttribute('href', '/display/Structure/10?returnTo=%2Fmap');
    expect(api.calls('GET', 'DisplayConfigurations/entity/Structure')).toHaveLength(1);
    expect(api.calls('GET', 'Structures/10')).toHaveLength(1);
  });

  test('details are read-only: links instead of buttons, no hot edit', async ({ page }) => {
    await openBakery(page);
    const details = panel(page).getByRole('region', { name: 'Details' });
    await expect(details.getByRole('link', { name: 'Old Market' })).toHaveAttribute('href', /\/display\/District\/5/);
    await expect(details.getByRole('button')).toHaveCount(0);
  });

  test('collections are collapsed and open on a click, their items as links', async ({ page }) => {
    await openBakery(page);
    const locations = panel(page).getByRole('group', { name: 'Locations' });
    await expect(locations.getByLabel('2 items')).toBeVisible();
    await expect(locations.getByRole('link', { name: 'Bakery door' })).toBeHidden();
    await locations.getByText('Locations').click();
    await expect(locations.getByRole('link', { name: 'Bakery door' })).toBeVisible();
    await expect(locations.getByRole('link', { name: 'Bakery oven' })).toHaveAttribute('href', /\/display\/Location\/42/);
  });

  test('on a phone the details fit the bottom sheet without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openBakery(page);
    await expect(panel(page).getByRole('region', { name: 'Details' }).getByText('Street number')).toBeVisible();
    await expectNoSidewaysScroll(page);
  });
});

test('a logged-in player without knk.admin.world sees no "Details" and no display configuration is requested (A17)', async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex);
  mockContentDefaults(api);
  mockMap(api);
  await openBakery(page);
  await expect(panel(page).getByText('Old Market')).toBeVisible();
  // The node's check has been answered (the panel shares one check per node with the bar), so the panel has decided.
  await expect.poll(() => api.calls('GET', `Users/${alex.id}/permissions/check`)
    .filter(call => call.query.get('node') === 'knk.admin.world').length).toBeGreaterThan(0);
  await expect(panel(page).getByRole('region', { name: 'Details' })).toHaveCount(0);
  await expect(panel(page).getByRole('region', { name: 'Staff details' })).toHaveCount(0);
  expect(api.calls('GET', /^DisplayConfigurations\/entity\//)).toHaveLength(0);
  expect(api.calls('GET', /^Structures\//)).toHaveLength(0);
});

test('an anonymous viewer sees no "Details", and no permission or display configuration request is made (A17)', async ({ page, api }) => {
  mockMap(api);
  await openBakery(page);
  await expect(panel(page).getByText('Old Market')).toBeVisible();
  await expect(panel(page).getByRole('region', { name: 'Details' })).toHaveCount(0);
  expect(api.calls('GET', /permissions\/check/)).toHaveLength(0);
  expect(api.calls('GET', /^DisplayConfigurations/)).toHaveLength(0);
  expect(api.calls('GET', /^Structures\//)).toHaveLength(0);
});
