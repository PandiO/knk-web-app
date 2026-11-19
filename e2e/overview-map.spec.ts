import { test, expect } from './support/mockApi';
import type { Frame, Page } from '@playwright/test';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { mapConfig, mapMarkers, mockMapOff, mockMapOn, serveFakeBlueMap } from './fixtures/map';
import { expectNoSidewaysScroll } from './support/layout';

/**
 * The public overview map page (PandiO/knk-workspace#737; OVERVIEW_MAP_DESIGN § 4, § 5 rules 2–5, 13–15; A07–A10).
 * The API is mocked; BlueMap is a fake web app that runs the real bridge script (e2e/fixtures/map.ts).
 * Smoke test: knk-workspace docs/guides/overview-map-smoke-test.md § 3.
 */

test.use({ strictApi: true });

async function mapFrame(page: Page): Promise<Frame> {
  const handle = await page.locator('iframe[title="Map of Knights and Kings"]').elementHandle();
  const frame = await handle!.contentFrame();
  // The bridge has drawn the pins.
  await expect(frame!.locator('[data-set="knk-pins"]').first()).toBeAttached();
  return frame!;
}

const label = (frame: Frame, kind: string, id: number) =>
  frame.locator(`[data-set="knk-pins"][data-marker="${kind}:${id}|label"]`);
const fake = <T>(frame: Frame, fn: string) => frame.evaluate(`window.__fake.${fn}`) as Promise<T>;

test.describe('anonymous, map on', () => {
  test.beforeEach(async ({ page, api }) => {
    mockMapOn(api);
    await serveFakeBlueMap(page);
  });

  test('the start page links to the map, and /map shows pins with labels by zoom (A07)', async ({ page, api }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'map', exact: true }).click();
    await expect(page).toHaveURL(/\/map$/);
    await expect(page).toHaveTitle(/Map/);

    const frame = await mapFrame(page);
    // Towns at every zoom; districts and structures only when close (the configured distances).
    await expect(label(frame, 'town', 1)).toHaveText('Aldmoor');
    await expect(label(frame, 'town', 1)).toHaveAttribute('data-max-distance', 'none');
    await expect(label(frame, 'district', 4)).toHaveText('Harbour');
    await expect(label(frame, 'district', 4)).toHaveAttribute('data-max-distance', '1500');
    await expect(label(frame, 'structure', 9)).toHaveText('North GateStructure, Gate');
    await expect(label(frame, 'structure', 9)).toHaveAttribute('data-max-distance', '600');
    // Only the current BlueMap map's world; no region outlines until asked for.
    await expect(label(frame, 'structure', 11)).toHaveCount(0);
    await expect(frame.locator('.fake-extrude')).toHaveCount(0);
    expect(api.calls('GET', 'Map/markers')).toHaveLength(1);
  });

  test('clicking a town flashes its outline three times and opens its public panel (A08)', async ({ page, api }) => {
    await page.goto('/map');
    const frame = await mapFrame(page);

    await label(frame, 'town', 1).click();
    const panel = page.getByRole('complementary', { name: 'Place details' });
    await expect(panel.getByRole('heading', { name: 'Aldmoor' })).toBeVisible();
    await expect(panel.getByText('A harbour town on the west coast.')).toBeVisible();
    await expect(panel.getByText('Districts')).toBeVisible();
    await expect.poll(() => fake<number>(frame, 'flashOn')).toBe(mapConfig.flash.count);
    await expect.poll(() => fake<boolean>(frame, 'flashVisible')).toBe(false);
    await expect(frame.locator('.fake-extrude')).toHaveCount(0);
    expect(api.calls('GET', 'Map/towns/1')).toHaveLength(1);
  });

  test('Escape closes the panel after a click inside the map frame (#757)', async ({ page }) => {
    await page.goto('/map');
    const frame = await mapFrame(page);
    await label(frame, 'town', 1).click();
    const panel = page.getByRole('complementary', { name: 'Place details' });
    await expect(panel.getByRole('heading', { name: 'Aldmoor' })).toBeVisible();
    // The keyboard focus is inside BlueMap's iframe now, where the page's own keydown listener cannot hear it;
    // the bridge reports the key (escapePressed).
    expect(await frame.evaluate(() => document.hasFocus())).toBe(true);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
  });

  test('"Show region" shows the town and all its districts by name, and hides them again (A08)', async ({ page }) => {
    await page.goto('/map');
    const frame = await mapFrame(page);
    await label(frame, 'town', 1).click();
    const toggle = page.getByRole('switch', { name: 'Show region' });
    await expect(toggle).not.toBeChecked();

    await toggle.check();
    const shown = frame.locator('[data-set="knk-regions"]');
    await expect(frame.locator('.fake-extrude[data-set="knk-regions"]')).toHaveText(['Aldmoor', 'Harbour', 'Old Market']);
    await expect(shown.locator('.knk-region-label')).toHaveText(['Aldmoor', 'Harbour', 'Old Market']);
    // Brightwater's district is not part of it; nothing shows a region id.
    await expect(shown.getByText('Riverside', { exact: true })).toHaveCount(0);
    await expect(frame.locator('body')).not.toContainText('domain_');

    // Closing the panel keeps the region; switching it off hides it.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('complementary', { name: 'Place details' })).toHaveCount(0);
    await expect(frame.locator('.fake-extrude')).toHaveCount(3);
    await label(frame, 'town', 1).click();
    await expect(page.getByRole('switch', { name: 'Show region' })).toBeChecked();
    await page.getByRole('switch', { name: 'Show region' }).uncheck();
    await expect(frame.locator('.fake-extrude')).toHaveCount(0);
  });

  test('clicking a gate shows its doors with open/closed, destroyed and a health bar (A09)', async ({ page }) => {
    await page.goto('/map');
    const frame = await mapFrame(page);
    await frame.locator('[data-marker="structure:9|pin"]').click();

    const panel = page.getByRole('complementary', { name: 'Place details' });
    await expect(panel.getByRole('heading', { name: 'North Gate' })).toBeVisible();
    await expect(panel.getByText('Structure, Gate').first()).toBeVisible();
    await expect(panel.getByText('Gate Road 1')).toBeVisible();
    const left = panel.getByRole('listitem', { name: 'Left door' });
    await expect(left.getByText('Open', { exact: true })).toBeVisible();
    await expect(left.getByRole('progressbar', { name: 'Left door health' })).toHaveAttribute('aria-valuenow', '75');
    const right = panel.getByRole('listitem', { name: 'Right door' });
    await expect(right.getByText('Closed', { exact: true })).toBeVisible();
    await expect(right.getByText('Destroyed')).toBeVisible();
    await expect(right.getByRole('progressbar', { name: 'Right door health' })).toHaveAttribute('aria-valuenow', '0');
    await expect(panel.getByText('Under siege')).toHaveCount(0);
    // Nothing for staff: no actions or staff details are registered in this phase.
    await expect(panel.getByRole('group', { name: 'Actions' })).toHaveCount(0);
  });

  test('bridge messages from another origin or another window are ignored (A10)', async ({ page, api }) => {
    await page.route('http://other-origin.test/**', route => route.fulfill({
      contentType: 'text/html',
      body: `<script>parent.postMessage({ v: 1, type: 'markerClicked', payload: { kind: 'town', id: 1 } }, '*');</script>`,
    }));
    await page.goto('/map');
    const frame = await mapFrame(page);

    // Another origin.
    await page.evaluate(() => {
      const evil = document.createElement('iframe');
      evil.src = 'http://other-origin.test/attack';
      document.body.appendChild(evil);
    });
    // The page's own origin, but not the map's iframe.
    await page.evaluate(() => window.postMessage({ v: 1, type: 'markerClicked', payload: { kind: 'town', id: 1 } }, '*'));
    // The right iframe, but another protocol version.
    await frame.evaluate(() => window.parent.postMessage({ v: 2, type: 'markerClicked', payload: { kind: 'town', id: 1 } }, window.location.origin));
    await page.waitForTimeout(500);
    await expect(page.getByRole('complementary', { name: 'Place details' })).toHaveCount(0);
    expect(api.calls('GET', 'Map/towns/1')).toHaveLength(0);

    // The bridge too only listens to its parent: a message from inside the map's own window is ignored.
    await frame.evaluate(() => window.postMessage({ v: 1, type: 'setMarkers', payload: { version: 'x', pins: [], regions: [] } }, '*'));
    await page.waitForTimeout(200);
    await expect(label(frame, 'town', 1)).toHaveCount(1);

    // A genuine click still works.
    await label(frame, 'town', 1).click();
    await expect(page.getByRole('heading', { name: 'Aldmoor' })).toBeVisible();
  });

  test("the bridge keeps its pins when BlueMap reloads its own marker file", async ({ page }) => {
    await page.goto('/map');
    const frame = await mapFrame(page);
    await frame.evaluate('window.__fake.reloadMarkerFile()');
    await expect(label(frame, 'town', 1)).toHaveCount(1);
    await expect(label(frame, 'district', 4)).toHaveCount(1);
  });

  test('a new marker version reloads the markers (§ 5 rule 2)', async ({ page, api }) => {
    await page.clock.install();
    await page.goto('/map');
    const frame = await mapFrame(page);
    expect(api.calls('GET', 'Map/markers')).toHaveLength(1);

    api.json('GET', 'Map/config', { ...mapConfig, markerVersion: 'v-two' });
    api.json('GET', 'Map/markers', { ...mapMarkers, version: 'v-two', towns: [{ ...mapMarkers.towns[0], name: 'Aldmoor Royal' }] });
    await page.clock.runFor(61_000);
    await expect(label(frame, 'town', 1)).toHaveText('Aldmoor Royal');
    expect(api.calls('GET', 'Map/markers')).toHaveLength(2);
  });

  test('on a phone the panel opens as a bottom sheet and the page does not scroll sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/map');
    const frame = await mapFrame(page);
    await frame.locator('[data-marker="structure:9|pin"]').click();
    const panel = page.getByRole('complementary', { name: 'Place details' });
    await expect(panel.getByRole('heading', { name: 'North Gate' })).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(Math.round(box.x)).toBe(0);
    expect(Math.round(box.width)).toBe(390);
    expect(Math.round(box.y + box.height)).toBe(844);
    expect(box.height).toBeLessThan(844 * 0.61);
    await expectNoSidewaysScroll(page);
    await page.getByRole('button', { name: 'Close details' }).click();
    await expect(panel).toHaveCount(0);
  });
});

test.describe('map off (Map:Enabled false)', () => {
  test('anonymous: no map link on the start page, and /map says not available', async ({ page, api }) => {
    mockMapOff(api);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'player guides' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'map', exact: true })).toHaveCount(0);
    await page.goto('/map');
    await expect(page.getByText('The map is not available.')).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(api.calls('GET', 'Map/markers')).toHaveLength(0);
  });

  test('logged in: the bar has no Map entry', async ({ page, api }) => {
    await startLoggedIn(page, 'access-1');
    mockSession(api, alex);
    mockContentDefaults(api);
    mockMapOff(api);
    await page.goto('/guides');
    await expect(page.getByRole('link', { name: 'Guides' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Map' })).toHaveCount(0);
  });
});

test('logged in with the map on: the bar has a Map entry that opens the map', async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex);
  mockContentDefaults(api);
  mockMapOn(api);
  await serveFakeBlueMap(page);
  await page.goto('/guides');
  await page.getByRole('link', { name: 'Map' }).click();
  await expect(page).toHaveURL(/\/map$/);
  await expect(page.getByRole('link', { name: 'Map' })).toHaveAttribute('aria-current', 'page');
  const frame = await mapFrame(page);
  await expect(label(frame, 'town', 1)).toHaveText('Aldmoor');
});
