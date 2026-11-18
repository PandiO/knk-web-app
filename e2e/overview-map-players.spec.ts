import { test, expect } from './support/mockApi';
import type { Frame, Page } from '@playwright/test';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import {
  defaultJoe,
  mapConfig,
  mapConfigLive,
  mockMapOn,
  netherNell,
  ownerPandi,
  playersSnapshot,
  premiumRich,
  serveFakeBlueMap,
  staffMod,
} from './fixtures/map';
import type { MapPlayerDto, MapPlayersDto } from '../src/types/dtos/map/MapDtos';
import { expectNoSidewaysScroll } from './support/layout';

/**
 * The live players layer of the overview map (PandiO/knk-workspace#739; OVERVIEW_MAP_DESIGN § 4.1, 4.4, 4.7,
 * § 5 rules 6–9 and 14; A11–A16, page side). The API is mocked (`GET api/Map/players` answers per audience the way
 * the API's snapshots do); BlueMap is the fake web app running the real bridge script (e2e/fixtures/map.ts).
 * Smoke test: knk-workspace docs/guides/overview-map-smoke-test.md § 5.
 */

test.use({ strictApi: true });

async function mapFrame(page: Page): Promise<Frame> {
  const handle = await page.locator('iframe[title="Map of Knights and Kings"]').elementHandle();
  const frame = await handle!.contentFrame();
  await expect(frame!.locator('[data-set="knk-pins"]').first()).toBeAttached();
  return frame!;
}

const playerMarker = (frame: Frame, uuid: string) => frame.locator(`[data-set="knk-players"][data-marker="player|${uuid}"]`);
const markerData = (frame: Frame, uuid: string) => frame.evaluate(id => {
  const set = (window as unknown as { bluemap: { mapViewer: { markers: { markerSets: Map<string, { markers: Map<string, { markerData: { position: { x: number; y: number; z: number } } }> }> } } } })
    .bluemap.mapViewer.markers.markerSets.get('knk-players');
  return set?.markers.get(`player|${id}`)?.markerData.position ?? null;
}, uuid);

const snapshotFor = (body: MapPlayersDto) => ({ status: 200, body, headers: { 'Cache-Control': 'no-store' } });

test.describe('anonymous, live players on', () => {
  test('players appear with head and name label and move with the next poll (A11)', async ({ page, api }) => {
    await page.clock.install();
    let current: MapPlayerDto[] = [ownerPandi, netherNell];
    mockMapOn(api, mapConfigLive);
    api.on('GET', 'Map/players', () => snapshotFor(playersSnapshot(current)));
    await serveFakeBlueMap(page);
    await page.goto('/map');
    const frame = await mapFrame(page);

    const pandi = playerMarker(frame, ownerPandi.uuid);
    await expect(pandi.locator('.knk-player-label')).toHaveText('[OWNER]-{King}- Pandi');
    // The head: BlueMap's default head without a `heads=` setting.
    await expect(pandi.locator('.knk-player-head')).toHaveAttribute('style', /assets\/steve\.png/);
    // Only the current BlueMap map's world.
    await expect(playerMarker(frame, netherNell.uuid)).toHaveCount(0);
    expect(await markerData(frame, ownerPandi.uuid)).toEqual({ x: 20.5, y: 71.8, z: 30.5 });
    // Anonymous: no token goes with the request.
    expect(api.calls('GET', 'Map/players')[0].bearer).toBeNull();

    current = [{ ...ownerPandi, x: 40.5, z: 50.5 }];
    await page.clock.runFor(2000);
    await expect.poll(() => markerData(frame, ownerPandi.uuid)).toEqual({ x: 40.5, y: 71.8, z: 50.5 });
    expect(api.calls('GET', 'Map/players').length).toBeGreaterThanOrEqual(2);
  });

  test('labels have the in-game chat format and colours; AFK shows as a tag (A13, A15)', async ({ page, api }) => {
    await page.clock.install();
    let joe: MapPlayerDto = { ...defaultJoe, afk: false };
    mockMapOn(api, mapConfigLive);
    api.on('GET', 'Map/players', () => snapshotFor(playersSnapshot([ownerPandi, staffMod, premiumRich, joe])));
    await serveFakeBlueMap(page);
    await page.goto('/map');
    const frame = await mapFrame(page);

    const label = (uuid: string) => playerMarker(frame, uuid).locator('.knk-player-label');
    await expect(label(ownerPandi.uuid)).toHaveText('[OWNER]-{King}- Pandi');
    await expect(label(ownerPandi.uuid).locator('span').nth(0)).toHaveCSS('color', 'rgb(255, 170, 0)'); // [ &6
    await expect(label(ownerPandi.uuid).locator('span').nth(1)).toHaveCSS('color', 'rgb(170, 0, 170)'); // OWNER &5
    await expect(label(ownerPandi.uuid).locator('span').nth(4)).toHaveCSS('font-weight', '700'); // King, bold
    await expect(label(staffMod.uuid)).toHaveText('[STAFF]-{Knight}- Mod');
    await expect(label(staffMod.uuid).locator('span').nth(0)).toHaveCSS('color', 'rgb(0, 170, 170)'); // &3
    await expect(label(staffMod.uuid).locator('span').nth(6)).toHaveCSS('color', 'rgb(85, 85, 255)'); // &9
    await expect(label(premiumRich.uuid)).toHaveText('-{Noble Squire}- Rich');
    await expect(label(premiumRich.uuid).locator('span').nth(1)).toHaveCSS('color', 'rgb(255, 85, 255)'); // &d
    await expect(label(premiumRich.uuid).locator('span').nth(1)).toHaveCSS('font-weight', '400');
    await expect(label(defaultJoe.uuid)).toHaveText('Joe');
    await expect(label(defaultJoe.uuid).locator('span')).toHaveCSS('color', 'rgb(85, 255, 85)'); // &a
    await expect(playerMarker(frame, defaultJoe.uuid).locator('[data-knk-tag]')).toHaveCount(0);

    // Joe goes AFK: the tag shows with the next poll.
    joe = { ...defaultJoe, afk: true };
    await page.clock.runFor(2000);
    await expect(playerMarker(frame, defaultJoe.uuid).locator('[data-knk-tag="afk"]')).toHaveText('AFK');
    await expect(playerMarker(frame, defaultJoe.uuid).locator('.knk-player')).toHaveClass(/knk-player-afk/);
    // No mode tags reach anonymous viewers.
    await expect(frame.locator('[data-knk-tag="staff"], [data-knk-tag="owner"]')).toHaveCount(0);
  });

  test('a running siege shows one arena pin instead of its participants (A14)', async ({ page, api }) => {
    mockMapOn(api, mapConfigLive);
    api.on('GET', 'Map/players', () => snapshotFor(playersSnapshot([ownerPandi], [{
      minigame: 'Siege', label: '[Siege] 12 players', playerCount: 12,
      pin: { world: 'world', x: 10, y: 66, z: 10, source: 'location' },
    }])));
    await serveFakeBlueMap(page);
    await page.goto('/map');
    const frame = await mapFrame(page);

    const arena = frame.locator('[data-set="knk-pins"][data-marker="arena:1|label"]');
    await expect(arena).toHaveText('[Siege] 12 players');
    await expect(arena).toHaveAttribute('data-max-distance', String(mapConfig.labels.arena));
    await expect(frame.locator('[data-set="knk-players"]')).toHaveCount(1);
    // The place pins are still there, sent once more with the arena.
    await expect(frame.locator('[data-set="knk-pins"][data-marker="town:1|label"]')).toHaveText('Aldmoor');
  });

  test('a player who quits disappears with the next poll (A16)', async ({ page, api }) => {
    await page.clock.install();
    let current: MapPlayerDto[] = [ownerPandi, premiumRich];
    mockMapOn(api, mapConfigLive);
    api.on('GET', 'Map/players', () => snapshotFor(playersSnapshot(current)));
    await serveFakeBlueMap(page);
    await page.goto('/map');
    const frame = await mapFrame(page);
    await expect(frame.locator('[data-set="knk-players"]')).toHaveCount(2);

    current = [ownerPandi];
    await page.clock.runFor(2000);
    await expect(playerMarker(frame, premiumRich.uuid)).toHaveCount(0);
    await expect(playerMarker(frame, ownerPandi.uuid)).toHaveCount(1);
  });

  test('clicking a player opens the name card with the label and tags only (§ 4.4)', async ({ page, api }) => {
    mockMapOn(api, mapConfigLive);
    api.on('GET', 'Map/players', () => snapshotFor(playersSnapshot([ownerPandi, defaultJoe])));
    await serveFakeBlueMap(page);
    await page.goto('/map');
    const frame = await mapFrame(page);

    await playerMarker(frame, defaultJoe.uuid).click();
    const card = page.getByRole('complementary', { name: 'Player details' });
    await expect(card.getByRole('heading', { name: 'Joe' })).toBeVisible();
    await expect(card.getByLabel('Name label')).toHaveText('Joe');
    await expect(card.getByRole('list', { name: 'Tags' }).getByRole('listitem')).toHaveText(['AFK']);
    await expect(card.getByRole('group', { name: 'Actions' })).toHaveCount(0);
    await expect(card).not.toContainText('40'); // no position
    // Nothing is fetched for the card: it shows the snapshot's own entry.
    expect(api.requests.filter(r => r.path.toLowerCase().startsWith('users'))).toHaveLength(0);

    // A place's pin replaces the card, and the other way round.
    await frame.locator('[data-set="knk-pins"][data-marker="town:1|label"]').click();
    await expect(page.getByRole('complementary', { name: 'Place details' })).toBeVisible();
    await expect(card).toHaveCount(0);
    // The open panel covers this marker in the fake viewer's flat layout: dispatch the click to the marker itself.
    await playerMarker(frame, ownerPandi.uuid).dispatchEvent('click');
    await expect(page.getByRole('complementary', { name: 'Place details' })).toHaveCount(0);
    await expect(card.getByLabel('Name label')).toHaveText('[OWNER]-{King}- Pandi');
    // Escape closes (keyboard focus on the page, not inside the map's iframe).
    await card.getByLabel('Name label').click();
    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
  });

  test('on a phone the name card is a bottom sheet and the page does not scroll sideways', async ({ page, api }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    mockMapOn(api, mapConfigLive);
    api.on('GET', 'Map/players', () => snapshotFor(playersSnapshot([premiumRich])));
    await serveFakeBlueMap(page);
    await page.goto('/map');
    const frame = await mapFrame(page);
    await playerMarker(frame, premiumRich.uuid).click();
    const card = page.getByRole('complementary', { name: 'Player details' });
    await expect(card.getByRole('heading', { name: 'Rich' })).toBeVisible();
    const box = (await card.boundingBox())!;
    expect(Math.round(box.x)).toBe(0);
    expect(Math.round(box.width)).toBe(390);
    expect(Math.round(box.y + box.height)).toBe(844);
    await expectNoSidewaysScroll(page);
    await page.getByRole('button', { name: 'Close details' }).click();
    await expect(card).toHaveCount(0);
  });

  test('a heads= setting draws each head from that address', async ({ page, api }) => {
    mockMapOn(api, mapConfigLive);
    api.on('GET', 'Map/players', () => snapshotFor(playersSnapshot([ownerPandi])));
    await serveFakeBlueMap(page, `heads=${encodeURIComponent('https://heads.example.test/avatar/{uuid}/16')}`);
    await page.route('https://heads.example.test/**', route => route.fulfill({ status: 404 }));
    await page.goto('/map');
    const frame = await mapFrame(page);
    await expect(playerMarker(frame, ownerPandi.uuid).locator('.knk-player-head'))
      .toHaveAttribute('style', `background-image:url('https://heads.example.test/avatar/${ownerPandi.uuid}/16')`);
  });
});

test('logged in: the token goes with every poll and staff viewers see mode players tagged (A12)', async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex);
  mockContentDefaults(api);
  mockMapOn(api, mapConfigLive);
  // As the API: the token selects the audience; only the "may see hidden" snapshot lists mode players.
  const hiddenMod: MapPlayerDto = { ...staffMod, mode: 'staff' };
  const hiddenPandi: MapPlayerDto = { ...ownerPandi, mode: 'owner', minigame: 'Siege' };
  api.on('GET', 'Map/players', req => snapshotFor(playersSnapshot(
    req.bearer === 'access-1' ? [premiumRich, hiddenMod, hiddenPandi] : [premiumRich],
  )));
  await serveFakeBlueMap(page);
  await page.goto('/map');
  const frame = await mapFrame(page);

  await expect(playerMarker(frame, staffMod.uuid).locator('[data-knk-tag="staff"]')).toHaveText('Staff mode');
  await expect(playerMarker(frame, ownerPandi.uuid).locator('[data-knk-tag]')).toHaveText(['Owner mode', 'Siege']);
  await expect(playerMarker(frame, premiumRich.uuid).locator('[data-knk-tag]')).toHaveCount(0);
  expect(api.calls('GET', 'Map/players').every(call => call.bearer === 'access-1')).toBe(true);

  await playerMarker(frame, staffMod.uuid).click();
  await expect(page.getByRole('complementary', { name: 'Player details' }).getByRole('listitem')).toHaveText(['Staff mode']);
});

test('anonymous: mode players the API leaves out are not drawn (A12)', async ({ page, api }) => {
  mockMapOn(api, mapConfigLive);
  api.on('GET', 'Map/players', req => snapshotFor(playersSnapshot(req.bearer ? [premiumRich, { ...staffMod, mode: 'staff' }] : [premiumRich])));
  await serveFakeBlueMap(page);
  await page.goto('/map');
  const frame = await mapFrame(page);
  await expect(playerMarker(frame, premiumRich.uuid)).toHaveCount(1);
  await expect(playerMarker(frame, staffMod.uuid)).toHaveCount(0);
  await expect(frame.locator('body')).not.toContainText('Staff mode');
});

test('live players off (Map:LivePlayers:Enabled false): no players request and no player layer (O27)', async ({ page, api }) => {
  await page.clock.install();
  mockMapOn(api, mapConfig);
  await serveFakeBlueMap(page);
  await page.goto('/map');
  const frame = await mapFrame(page);
  await page.clock.runFor(10_000);
  expect(api.calls('GET', 'Map/players')).toHaveLength(0);
  await expect(frame.locator('[data-set="knk-players"]')).toHaveCount(0);
  const received = await frame.evaluate('window.__fake.received') as string[];
  expect(received).not.toContain('setPlayers');
});
