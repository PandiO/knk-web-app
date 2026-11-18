import { test, expect } from './support/mockApi';
import type { Frame, Page } from '@playwright/test';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { serveFakeBlueMap } from './fixtures/map';
import { GATE_ADMIN, mockGateCommands } from './fixtures/mapGateCommands';
import { expectNoSidewaysScroll } from './support/layout';

/**
 * Gate command buttons in the map panel (PandiO/knk-workspace#742; OVERVIEW_MAP_DESIGN § 4 item 6, § 5 rules 11 and 13,
 * O14, O17; A18 page side, A22): a knk.gate.admin holder gets Open, Close, Toggle and Repair for the whole gate and per
 * door while `config.gateCommands.enabled` is on; each sends `POST api/GateStructures/{id}/commands`, shows the result
 * and reads the panel again. During a siege match the buttons are disabled with "Gate is in a running siege". Nobody
 * else sees them or causes a door or command request. Smoke test: knk-workspace docs/guides/overview-map-smoke-test.md
 * § 8.
 */

test.use({ strictApi: true });

async function openNorthGate(page: Page): Promise<void> {
  await page.goto('/map');
  const handle = await page.locator('iframe[title="Map of Knights and Kings"]').elementHandle();
  const frame = (await handle!.contentFrame()) as Frame;
  await frame.locator('[data-marker="structure:9|pin"]').click();
  await expect(panel(page).getByRole('heading', { name: 'North Gate' })).toBeVisible();
}

const panel = (page: Page) => page.getByRole('complementary', { name: 'Place details' });
const commands = (page: Page) => panel(page).getByRole('region', { name: 'Gate commands' });
const publicDoor = (page: Page, name: string) => panel(page).getByRole('region', { name: 'Gate doors' }).getByRole('listitem', { name });

test.beforeEach(async ({ page }) => {
  await serveFakeBlueMap(page);
});

test.describe('gate admin (knk.gate.admin)', () => {
  test.beforeEach(async ({ page, api }) => {
    await startLoggedIn(page, 'access-1');
    mockSession(api, alex, node => node === GATE_ADMIN);
    mockContentDefaults(api);
  });

  test('sees Open, Close, Toggle and Repair for the whole gate and per door (A18)', async ({ page, api }) => {
    mockGateCommands(api);
    await openNorthGate(page);
    const section = commands(page);
    await expect(section.getByRole('heading', { name: 'Gate commands' })).toBeVisible();
    for (const target of ['whole gate', 'Left door', 'Right door']) {
      for (const label of ['Open', 'Close', 'Toggle', 'Repair']) {
        await expect(section.getByRole('button', { name: `${label} ${target}`, exact: true })).toBeEnabled();
      }
    }
    expect(api.calls('GET', 'GateStructures/9/doors')).toHaveLength(1);
    // Without knk.admin.world there are no staff details.
    await expect(panel(page).getByRole('region', { name: 'Details', exact: true })).toHaveCount(0);
  });

  test('opens a door: the command carries its doorId, the result shows and the panel shows the new state (A18)', async ({ page, api }) => {
    const gate = mockGateCommands(api);
    await openNorthGate(page);
    await expect(publicDoor(page, 'Right door').getByText('Closed', { exact: true })).toBeVisible();
    await commands(page).getByRole('button', { name: 'Open Right door', exact: true }).click();
    await expect(commands(page).getByRole('status')).toHaveText('Done: open sent to Right door.');
    expect(gate.commands).toEqual([{ action: 'open', doorId: 32 }]);
    // Re-read after the result: the public panel and the staff door list say "Opening".
    await expect(publicDoor(page, 'Right door').getByText('Opening', { exact: true })).toBeVisible();
    await expect(commands(page).getByRole('listitem', { name: 'Right door' }).getByText('Opening', { exact: true })).toBeVisible();
    expect(api.calls('GET', 'Map/structures/9').length).toBeGreaterThanOrEqual(2);
    expect(api.calls('GET', 'GateStructures/9/doors').length).toBeGreaterThanOrEqual(2);
  });

  test('closes, toggles and repairs; a whole-gate command has no doorId (A18)', async ({ page, api }) => {
    const gate = mockGateCommands(api);
    await openNorthGate(page);
    const section = commands(page);
    await section.getByRole('button', { name: 'Close Left door', exact: true }).click();
    await expect(section.getByRole('status')).toHaveText('Done: close sent to Left door.');
    await expect(publicDoor(page, 'Left door').getByText('Closed', { exact: true })).toBeVisible();
    await section.getByRole('button', { name: 'Toggle whole gate', exact: true }).click();
    await expect(section.getByRole('status')).toHaveText('Done: toggle sent to Left door and Right door.');
    await section.getByRole('button', { name: 'Repair Right door', exact: true }).click();
    await expect(section.getByRole('status')).toHaveText('Done: repair sent to Right door.');
    await expect(publicDoor(page, 'Right door').getByText('Destroyed')).toHaveCount(0);
    expect(gate.commands).toEqual([
      { action: 'close', doorId: 31 },
      { action: 'toggle' },
      { action: 'repair', doorId: 32 },
    ]);
  });

  test('during a siege match every button is disabled with "Gate is in a running siege"', async ({ page, api }) => {
    const gate = mockGateCommands(api, { underSiege: true });
    await openNorthGate(page);
    const section = commands(page);
    await expect(section.getByText('Gate is in a running siege')).toBeVisible();
    await expect(section.getByRole('button', { name: 'Open Left door', exact: true })).toBeVisible();
    const buttons = section.getByRole('button');
    await expect(buttons).toHaveCount(12);
    for (const button of await buttons.all()) {
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute('title', 'Gate is in a running siege');
    }
    expect(gate.commands).toHaveLength(0);
  });

  test('a 409 from the API (siege started meanwhile) disables the buttons too', async ({ page, api }) => {
    mockGateCommands(api, { answer: { status: 409, body: { error: 'GateInSiege', message: 'The gate is in a running siege match.' } } });
    await openNorthGate(page);
    await commands(page).getByRole('button', { name: 'Open whole gate', exact: true }).click();
    await expect(commands(page).getByRole('status')).toHaveText('Gate is in a running siege');
    await expect(commands(page).getByRole('button', { name: 'Close whole gate', exact: true })).toBeDisabled();
  });

  test('shows a refusal, "no game server" and a time-out as the API words them', async ({ page, api }) => {
    const answers: Array<{ status: number; body: unknown }> = [
      { status: 200, body: { commandId: 'c1', gateId: 9, doorId: 31, action: 'open', result: 'refused', message: 'Door is destroyed.', doors: [] } },
      { status: 503, body: { error: 'NoGameServerConnected', message: 'No game server is connected.' } },
      { status: 504, body: { commandId: 'c3', gateId: 9, doorId: null, action: 'close', result: 'timeout', message: 'The game server did not answer within 5 s.', doors: [] } },
    ];
    mockGateCommands(api);
    let next = 0;
    api.on('POST', 'GateStructures/9/commands', () => answers[next++]);
    await openNorthGate(page);
    const section = commands(page);
    await section.getByRole('button', { name: 'Open Left door', exact: true }).click();
    await expect(section.getByRole('status')).toHaveText('Refused: Door is destroyed.');
    await section.getByRole('button', { name: 'Close whole gate', exact: true }).click();
    await expect(section.getByRole('status')).toHaveText('No game server is connected.');
    await section.getByRole('button', { name: 'Close whole gate', exact: true }).click();
    await expect(section.getByRole('status')).toHaveText('The game server did not answer within 5 s.');
  });

  test('with Map:GateCommands:Enabled off there are no buttons and no door or command request', async ({ page, api }) => {
    const gate = mockGateCommands(api, { enabled: false });
    await openNorthGate(page);
    await expect(publicDoor(page, 'Left door')).toBeVisible();
    await expect(commands(page)).toHaveCount(0);
    expect(api.calls('GET', 'GateStructures/9/doors')).toHaveLength(0);
    expect(gate.commands).toHaveLength(0);
  });

  test('on a phone the buttons fit the bottom sheet without sideways scrolling', async ({ page, api }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    mockGateCommands(api);
    await openNorthGate(page);
    await expect(commands(page).getByRole('button', { name: 'Repair Right door', exact: true })).toBeVisible();
    await expectNoSidewaysScroll(page);
  });
});

test('a logged-in player without knk.gate.admin sees the doors but no buttons, and no door ids are requested', async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex);
  mockContentDefaults(api);
  const gate = mockGateCommands(api);
  await openNorthGate(page);
  await expect(publicDoor(page, 'Left door')).toBeVisible();
  await expect.poll(() => api.calls('GET', `Users/${alex.id}/permissions/check`)
    .filter(call => call.query.get('node') === GATE_ADMIN).length).toBeGreaterThan(0);
  await expect(commands(page)).toHaveCount(0);
  expect(api.calls('GET', /^GateStructures\//)).toHaveLength(0);
  expect(gate.commands).toHaveLength(0);
});

test('an anonymous viewer sees the doors, no buttons, and no permission, door or command request is made', async ({ page, api }) => {
  const gate = mockGateCommands(api);
  await openNorthGate(page);
  await expect(publicDoor(page, 'Left door')).toBeVisible();
  await expect(publicDoor(page, 'Right door').getByText('Destroyed')).toBeVisible();
  await expect(commands(page)).toHaveCount(0);
  expect(api.calls('GET', /permissions\/check/)).toHaveLength(0);
  expect(api.calls('GET', /^GateStructures\//)).toHaveLength(0);
  expect(gate.commands).toHaveLength(0);
});
