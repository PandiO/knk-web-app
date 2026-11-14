import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { auditEntry, ledgerLine, mockPlayerProfile, mockPlayerSearch, playerId, playerRow, playerUuid } from './fixtures/players';
import { expectNoSidewaysScroll } from './support/layout';

/**
 * The staff player profile (PandiO/knk-workspace#119): status strip, tabs in the URL, freeze and unfreeze
 * with a reason, the Activity timeline and audit log, and actions greyed out without their node.
 * Smoke test: knk-workspace docs/guides/player-profile-smoke-test.md § 1–4 (backfill #511).
 */

const profileUrl = `/admin/users/${playerId}`;

/** The staff nodes of the full moderator: everything the profile offers. */
const moderatorNodes = (node: string) => node !== 'knk.owner.privacy.manage';

test.beforeEach(async ({ page }) => {
  await startLoggedIn(page, 'access-1');
});

test.describe('as a moderator with every node', () => {
  test.beforeEach(({ api }) => {
    mockSession(api, alex, moderatorNodes);
    mockContentDefaults(api);
  });

  test('the header shows the player, the status chips and Freeze; Overview is open without ?tab=', async ({ page, api }) => {
    mockPlayerProfile(api);
    await page.goto(profileUrl);

    await expect(page.getByRole('heading', { name: 'Steve', level: 1 })).toBeVisible();
    await expect(page.getByText(`User #${playerId}`)).toBeVisible();
    await expect(page.getByText('Online', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Freeze' })).toBeEnabled();
    const tabs = page.getByRole('tablist', { name: 'Player profile sections' }).getByRole('tab');
    await expect(tabs).toHaveText(['Overview', 'Economy', 'Permissions', 'Moderation', 'Activity', 'Privacy']);
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(new URL(page.url()).search).toBe('');
  });

  test('a tab is kept in the URL and survives a reload; arrow keys and End move along the tabs', async ({ page, api }) => {
    mockPlayerProfile(api);
    await page.goto(profileUrl);

    await page.getByRole('tab', { name: 'Economy' }).click();
    await expect(page).toHaveURL(/\?tab=economy$/);
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Economy' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: 'Economy' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Permissions' })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Permissions' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Privacy' })).toHaveAttribute('aria-selected', 'true');
  });

  test('the breadcrumb leads back to Player moderation', async ({ page, api }) => {
    mockPlayerProfile(api);
    api.on('POST', /^Users\/search$/, { body: { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 1 } });
    await page.goto(profileUrl);

    const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(trail).toContainText('Players & support');
    await expect(trail).toContainText('Player profile');
    await trail.getByRole('link', { name: 'Player moderation' }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
  });

  test('Freeze asks a reason, refuses an empty one, then shows Frozen with the reason and Unfreeze', async ({ page, api }) => {
    mockPlayerProfile(api);
    await page.goto(profileUrl);

    await page.getByRole('button', { name: 'Freeze' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Freeze Steve?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Freeze' }).click();
    await expect(dialog.getByText('Enter a reason.')).toBeVisible();
    expect(api.calls('PUT', `Users/${playerId}/freeze`)).toHaveLength(0);

    await dialog.getByLabel('Reason').fill('Smoke test #119');
    await dialog.getByRole('button', { name: 'Freeze' }).click();

    await expect(page.getByText('Steve is frozen')).toBeVisible();
    await expect(page.getByText('Frozen', { exact: true })).toBeVisible();
    await expect(page.getByText(/Reason: Smoke test #119/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unfreeze' })).toBeVisible();
    expect(api.calls('PUT', `Users/${playerId}/freeze`).map(r => r.body)).toEqual([{ reason: 'Smoke test #119' }]);
  });

  test('the Moderation tab holds the same freeze card; Unfreeze confirms without a reason', async ({ page, api }) => {
    mockPlayerProfile(api, { frozen: { reason: 'Griefing spawn' } });
    await page.goto(`${profileUrl}?tab=moderation`);

    const panel = page.getByRole('tabpanel', { name: 'Moderation' });
    await expect(panel.getByText(/Griefing spawn/).first()).toBeVisible();
    await panel.getByRole('button', { name: 'Unfreeze' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Unfreeze Steve?' });
    await expect(dialog.getByLabel('Reason')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Unfreeze' }).click();

    await expect(page.getByText('Steve is unfrozen')).toBeVisible();
    await expect(page.getByText('Frozen', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Freeze' }).first()).toBeVisible();
    expect(api.calls('PUT', `Users/${playerId}/unfreeze`)).toHaveLength(1);
  });

  test('Activity merges audit entries and balance changes newest first; the Economy chip hides the coin lines', async ({ page, api }) => {
    mockPlayerProfile(api, {
      audit: [auditEntry(1, 'GroupAssigned', '2026-11-09T10:00:00', '{"group":"Builder"}')],
      ledger: [ledgerLine(11, '2026-11-10T10:00:00', 500, 'Event prize')],
    });
    await page.goto(`${profileUrl}?tab=activity`);

    await expect(page.getByText('From the audit log and the balance history.', { exact: false })).toBeVisible();
    const coinLine = page.getByText('+500 coins');
    await expect(coinLine).toBeVisible();
    await expect(page.getByText('Event prize').first()).toBeVisible();

    await page.getByRole('button', { name: 'Economy' }).click();
    await expect(coinLine).toHaveCount(0);
    await page.getByRole('button', { name: 'Economy' }).click();
    await expect(coinLine).toBeVisible();
  });

  test('the audit log pages on the server and filters by action from page 1', async ({ page, api }) => {
    const audit = Array.from({ length: 30 }, (_, i) =>
      auditEntry(i + 1, i % 10 === 0 ? 'PlayerFrozen' : 'GrantAdded', `2026-11-${String(1 + (i % 28)).padStart(2, '0')}T10:${String(i).padStart(2, '0')}:00`));
    mockPlayerProfile(api, { audit });
    await page.goto(`${profileUrl}?tab=activity`);

    await expect(page.getByText('Showing 1 to 25 of 30 entries')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).last().click();
    await expect(page.getByText('Showing 26 to 30 of 30 entries')).toBeVisible();

    await page.getByLabel('Action').selectOption({ label: 'Player frozen' });
    await expect(page.getByText(/Showing 1 to 3 of 3 entries/)).toBeVisible();
    const auditCalls = api.calls('GET', /^audit-log\/?$/);
    const lastAuditCall = auditCalls[auditCalls.length - 1];
    expect(lastAuditCall?.query.get('action')).toBe('PlayerFrozen');
    expect(lastAuditCall?.query.get('pageNumber')).toBe('1');
  });

  test('at phone width no tab scrolls the page sideways', async ({ page, api }) => {
    mockPlayerProfile(api, { ledger: [ledgerLine(11, '2026-11-10T10:00:00', 500, 'Event prize')] });
    await page.setViewportSize({ width: 390, height: 844 });
    for (const tab of ['overview', 'economy', 'permissions', 'moderation', 'activity', 'privacy']) {
      await page.goto(`${profileUrl}?tab=${tab}`);
      await expect(page.getByRole('heading', { name: 'Steve', level: 1 })).toBeVisible();
      await expectNoSidewaysScroll(page);
    }
  });
});

test.describe('as staff without the nodes', () => {
  test.beforeEach(({ api }) => {
    // Moderator only: may open profiles, holds none of the action nodes.
    mockSession(api, alex, node => node === 'knk.admin.user.manage');
    mockContentDefaults(api);
  });

  test('Freeze, group and grant changes and Grant on kits are greyed out with "Requires <node>"', async ({ page, api }) => {
    mockPlayerProfile(api);
    await page.goto(profileUrl);

    await expect(page.getByRole('button', { name: 'Freeze' })).toBeDisabled();
    await expect(page.getByText('Requires knk.freeze').first()).toBeVisible();

    await page.getByRole('tab', { name: 'Permissions' }).click();
    await expect(page.getByText('Requires knk.admin.user.group').first()).toBeVisible();
    await expect(page.getByText('Requires knk.admin.user.perm').first()).toBeVisible();

    await page.getByRole('tab', { name: 'Economy' }).click();
    await expect(page.getByRole('button', { name: 'Grant' }).first()).toBeDisabled();
    await expect(page.getByText('Requires knk.kit.give').first()).toBeVisible();
  });

  test('Activity says balance changes need knk.admin.currency.history and shows only audit entries', async ({ page, api }) => {
    mockPlayerProfile(api, {
      audit: [auditEntry(1, 'GroupAssigned', '2026-11-09T10:00:00', '{"group":"Builder"}')],
      ledger: [ledgerLine(11, '2026-11-10T10:00:00', 500, 'Event prize')],
    });
    await page.goto(`${profileUrl}?tab=activity`);

    await expect(page.getByText('Balance changes need knk.admin.currency.history.')).toBeVisible();
    await expect(page.getByText('+500 coins')).toHaveCount(0);
    expect(api.calls('GET', /^currency\/admin\/ledger$/)).toHaveLength(0);
  });
});

test.describe('Player moderation: All players (§ 5)', () => {
  // 25 players: two pages of 20. Steve (id 42) is online; the others were last seen earlier.
  const rows = [
    playerRow(playerId, 'Steve', 300, true),
    ...Array.from({ length: 24 }, (_, i) => playerRow(100 + i, `Player${String(i + 1).padStart(2, '0')}`, (i + 1) * 10)),
  ].map(r => (r.id === playerId ? { ...r, uuid: playerUuid } : r));

  test.beforeEach(({ api }) => {
    mockSession(api, alex, moderatorNodes);
    mockContentDefaults(api);
    mockPlayerSearch(api, rows);
    mockPlayerProfile(api);
  });

  test('a dashless UUID is recognised, searched with its dashes and kept in the URL', async ({ page, api }) => {
    await page.goto('/admin/users?tab=all');
    const box = page.getByLabel('Search username / email / UUID');
    await box.fill(playerUuid.replace(/-/g, ''));
    await expect(page.getByText('Searching by UUID.')).toBeVisible();
    await box.press('Enter');

    const table = page.getByRole('table', { name: 'All players' });
    await expect(table.getByRole('link', { name: 'Steve' })).toBeVisible();
    await expect(table.getByRole('row')).toHaveCount(2);
    await expect(page).toHaveURL(new RegExp(`q=${playerUuid.replace(/-/g, '')}`));
    const terms = api.calls('POST', /^Users\/search$/).map(r => (r.body as { searchTerm?: string }).searchTerm);
    expect(terms).toContain(playerUuid);
  });

  test('a header sorts on the server, the URL keeps sort, direction and page, and Back from a profile restores them', async ({ page, api }) => {
    await page.goto('/admin/users?tab=all');
    const table = page.getByRole('table', { name: 'All players' });
    await expect(table.getByRole('link', { name: 'Steve' })).toBeVisible();

    await table.getByRole('button', { name: /Coins/ }).click();
    await expect(page).toHaveURL(/sort=coins/);
    await table.getByRole('button', { name: /Coins/ }).click();
    await expect(page).toHaveURL(/sort=coins&dir=desc/);
    await expect(table.getByRole('row').nth(1)).toContainText('Steve');

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText('Page 2 of 2')).toBeVisible();
    const last = api.calls('POST', /^Users\/search$/).pop()?.body as { sortBy?: string; sortDescending?: boolean; pageNumber?: number };
    expect(last).toEqual(expect.objectContaining({ sortBy: 'coins', sortDescending: true, pageNumber: 2 }));

    await table.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/admin\/users\/\d+/);
    await page.goBack();
    await expect(page).toHaveURL(/sort=coins&dir=desc/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText('Page 2 of 2')).toBeVisible();
  });

  test('Recently opened lists the profiles this viewer opened, and Clear empties it; online players show "Now"', async ({ page }) => {
    await page.goto('/admin/users?tab=all');
    const table = page.getByRole('table', { name: 'All players' });
    await expect(table.getByRole('row').filter({ hasText: 'Steve' })).toContainText('Now');

    await table.getByRole('link', { name: 'Steve' }).click();
    await expect(page.getByRole('heading', { name: 'Steve', level: 1 })).toBeVisible();
    await page.goBack();

    const recent = page.getByRole('list', { name: 'Recently opened players' });
    await expect(recent.getByRole('link', { name: 'Steve' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(recent).toHaveCount(0);
  });
});
