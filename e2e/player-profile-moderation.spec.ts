import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { auditEntry, gameSession, mockPlayerProfile, mockPlayerSearch, playerId, playerRow } from './fixtures/players';

/**
 * The player profile API part (PandiO/knk-workspace#565, part of #119): the frozen banner from the profile summary,
 * the unfreeze reason, game sessions in the timeline, Kick and Ban (developer decisions 2026-11-15) and the moderation
 * search's state filters, sort keys and list fields. Mocked API; the game server's side of kick/ban is knk-plugin
 * (#574). Smoke test: knk-workspace docs/guides/player-profile-smoke-test.md § 6.
 */

const profileUrl = `/admin/users/${playerId}`;
const moderatorNodes = (node: string) => node !== 'knk.owner.privacy.manage';

test.beforeEach(async ({ page }) => {
  await startLoggedIn(page, 'access-1');
});

test.describe('with every node', () => {
  test.beforeEach(({ api }) => {
    mockSession(api, alex, moderatorNodes);
    mockContentDefaults(api);
  });

  test('the frozen banner shows since when, by whom and why from the profile summary alone', async ({ page, api }) => {
    mockPlayerProfile(api, { frozen: { reason: 'Griefing spawn', at: '2026-11-08T07:30:00', by: 'Mod' } });
    await page.goto(profileUrl);

    const banner = page.getByTestId('frozen-banner');
    await expect(banner).toContainText('Frozen since');
    await expect(banner).toContainText('by Mod');
    await expect(banner).toContainText('Reason: Griefing spawn');
    // No second read of the user and no audit lookup per profile load.
    expect(api.calls('GET', `Users/${playerId}`)).toHaveLength(0);
    expect(api.calls('GET', /^audit-log\/?$/).filter(r => r.query.get('action') === 'PlayerFrozen')).toHaveLength(0);
  });

  test('Unfreeze sends the optional reason and the timeline shows it', async ({ page, api }) => {
    mockPlayerProfile(api, { frozen: { reason: 'Griefing spawn' } });
    await page.goto(profileUrl);

    await page.getByTestId('unfreeze-button').click();
    const dialog = page.getByRole('alertdialog', { name: 'Unfreeze Steve?' });
    await expect(dialog.locator('label')).toHaveText('Reason (optional)');
    await dialog.getByLabel(/Reason/).fill('Appeal accepted');
    await dialog.getByRole('button', { name: 'Unfreeze' }).click();

    await expect(page.getByText('Steve is unfrozen')).toBeVisible();
    await expect(page.getByTestId('frozen-banner')).toHaveCount(0);
    expect(api.calls('PUT', `Users/${playerId}/unfreeze`).map(r => r.body)).toEqual([{ reason: 'Appeal accepted' }]);

    await page.getByRole('tab', { name: 'Activity' }).click();
    await expect(page.getByTestId('timeline').getByText('Reason: Appeal accepted')).toBeVisible();
  });

  test('game sessions are a third timeline source with their own filter chip', async ({ page, api }) => {
    mockPlayerProfile(api, {
      audit: [auditEntry(1, 'GroupAssigned', '2026-11-09T10:00:00', '{"group":"Builder"}')],
      sessions: [
        gameSession('s2', '2026-11-10T18:00:00', null, null, 600),
        gameSession('s1', '2026-11-08T12:00:00', '2026-11-08T13:30:00', 'Kick', 4500, 'lobby'),
      ],
    });
    await page.goto(`${profileUrl}?tab=activity`);

    const timeline = page.getByTestId('timeline');
    const titles = timeline.getByTestId('timeline-event').locator('p.font-medium');
    await expect(titles).toHaveText(['In game on survival', 'Group assigned', 'Played on lobby']);
    await expect(timeline.getByTestId('timeline-event').nth(2)).toContainText('Active 1 h 15 min');
    await expect(timeline.getByTestId('timeline-event').nth(2)).toContainText('Kicked');
    expect(api.calls('GET', `statistics/users/${playerId}/sessions`)[0]?.query.get('page')).toBe('1');

    await page.getByRole('button', { name: 'Game sessions' }).click();
    await expect(titles).toHaveText(['Group assigned']);
  });

  test('Kick asks an optional reason, sends it and shows a toast', async ({ page, api }) => {
    mockPlayerProfile(api);
    await page.goto(profileUrl);

    await page.getByTestId('kick-button').click();
    const dialog = page.getByRole('alertdialog', { name: 'Kick Steve?' });
    // The dialog adds "(optional)" itself; the label says it once.
    await expect(dialog.locator('label')).toHaveText('Reason (optional)');
    await dialog.getByLabel(/Reason/).fill('AFK farming');
    await dialog.getByRole('button', { name: 'Kick' }).click();

    await expect(page.getByText('Steve is being kicked')).toBeVisible();
    expect(api.calls('POST', `Users/${playerId}/kick`).map(r => r.body)).toEqual([{ reason: 'AFK farming' }]);
  });

  test('Ban says it is permanent and lifted with /pardon, needs a reason, then sends it', async ({ page, api }) => {
    mockPlayerProfile(api);
    await page.goto(`${profileUrl}?tab=moderation`);

    await page.getByTestId('kickban-card').getByRole('button', { name: 'Ban…' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Ban Steve permanently?' });
    await expect(dialog).toContainText('permanent');
    await expect(dialog).toContainText('/pardon in game');
    await dialog.getByRole('button', { name: 'Ban permanently' }).click();
    await expect(dialog.getByText('Enter a reason.')).toBeVisible();
    expect(api.calls('POST', `Users/${playerId}/ban`)).toHaveLength(0);

    await dialog.getByLabel(/Reason/).fill('X-ray');
    await dialog.getByRole('button', { name: 'Ban permanently' }).click();
    await expect(page.getByText('Steve is banned')).toBeVisible();
    expect(api.calls('POST', `Users/${playerId}/ban`).map(r => r.body)).toEqual([{ reason: 'X-ray' }]);
  });

  test('a refused kick (player offline) shows the API reason', async ({ page, api }) => {
    mockPlayerProfile(api, { kickBanRefusal: { status: 409, error: 'PlayerNotOnline', message: 'Steve is not online, so there is nothing to kick.' } });
    await page.goto(profileUrl);

    await page.getByTestId('kick-button').click();
    await page.getByRole('alertdialog', { name: 'Kick Steve?' }).getByRole('button', { name: 'Kick' }).click();
    await expect(page.getByText('Could not kick Steve: Steve is not online, so there is nothing to kick.')).toBeVisible();
  });

  test('the Moderation tab no longer says kick and ban are game-only', async ({ page, api }) => {
    mockPlayerProfile(api);
    await page.goto(`${profileUrl}?tab=moderation`);
    const card = page.getByTestId('kickban-card');
    await expect(card.getByRole('button', { name: 'Kick…' })).toBeEnabled();
    await expect(card.getByRole('button', { name: 'Ban…' })).toBeEnabled();
    await expect(page.getByText(/can.t send them yet/)).toHaveCount(0);
  });
});

test.describe('without knk.kick and knk.ban', () => {
  test.beforeEach(({ api }) => {
    mockSession(api, alex, node => node !== 'knk.kick' && node !== 'knk.ban' && node !== 'knk.owner.privacy.manage');
    mockContentDefaults(api);
  });

  test('Kick and Ban are greyed out with "Requires knk.kick" / "Requires knk.ban"', async ({ page, api }) => {
    mockPlayerProfile(api);
    await page.goto(profileUrl);

    await expect(page.getByTestId('kick-button')).toBeDisabled();
    await expect(page.getByText('Requires knk.kick').first()).toBeVisible();
    await expect(page.getByTestId('ban-button')).toBeDisabled();
    await expect(page.getByText('Requires knk.ban').first()).toBeVisible();
    await expect(page.getByTestId('freeze-button')).toBeEnabled();
    expect(api.calls('POST', `Users/${playerId}/kick`)).toHaveLength(0);
  });
});

test.describe('Player moderation: state filters and sort keys', () => {
  const rows = [
    { ...playerRow(playerId, 'Steve', 300, true), experiencePoints: 50, lastSeenAt: '2026-11-12T10:00:00' },
    { ...playerRow(101, 'Frosty', 100), isFrozen: true, experiencePoints: 900, lastSeenAt: '2026-11-11T10:00:00' },
    { ...playerRow(102, 'Broke', 200), paymentsLocked: true, experiencePoints: 400, lastSeenAt: '2026-11-13T10:00:00' },
  ].map(r => ({ ...r, createdAt: '2026-09-01T10:00:00' }));

  test.beforeEach(({ api }) => {
    mockSession(api, alex, moderatorNodes);
    mockContentDefaults(api);
    mockPlayerSearch(api, rows);
  });

  test('the Frozen and Online filters narrow the list on the server and stay in the URL', async ({ page, api }) => {
    await page.goto('/admin/users?tab=all');
    const table = page.getByRole('table', { name: 'All players' });
    await expect(table.getByRole('row')).toHaveCount(4);
    await expect(table.getByRole('row').filter({ hasText: 'Frosty' })).toContainText('Frozen');
    await expect(table.getByRole('row').filter({ hasText: 'Broke' })).toContainText('Payments locked');

    await page.getByLabel('Frozen').selectOption({ label: 'Frozen' });
    await expect(table.getByRole('row')).toHaveCount(2);
    await expect(table.getByRole('link', { name: 'Frosty' })).toBeVisible();
    await expect(page).toHaveURL(/frozen=true/);
    const last = api.calls('POST', /^Users\/search$/).pop()?.body as { filters?: Record<string, string> };
    expect(last.filters).toEqual({ frozen: 'true' });

    await page.getByLabel('Frozen').selectOption({ label: 'Any' });
    await page.getByLabel('Online').selectOption({ label: 'Online' });
    await expect(table.getByRole('row')).toHaveCount(2);
    await expect(table.getByRole('link', { name: 'Steve' })).toBeVisible();
    await expect(page).toHaveURL(/online=true/);
    await expect(page).not.toHaveURL(/frozen=/);

    await page.reload();
    await expect(page.getByLabel('Online')).toHaveValue('true');
    await expect(table.getByRole('row')).toHaveCount(2);
  });

  test('the Payments filter finds the locked player', async ({ page }) => {
    await page.goto('/admin/users?tab=all&paymentsLocked=true');
    const table = page.getByRole('table', { name: 'All players' });
    await expect(table.getByRole('row')).toHaveCount(2);
    await expect(table.getByRole('link', { name: 'Broke' })).toBeVisible();
  });

  test('Last seen and XP sort on the server with the new keys', async ({ page, api }) => {
    await page.goto('/admin/users?tab=all');
    const table = page.getByRole('table', { name: 'All players' });
    await expect(table.getByRole('row')).toHaveCount(4);

    await table.getByRole('button', { name: /XP/ }).click();
    await table.getByRole('button', { name: /XP/ }).click();
    await expect(page).toHaveURL(/sort=experiencePoints&dir=desc/);
    await expect(table.getByRole('row').nth(1)).toContainText('Frosty');
    let last = api.calls('POST', /^Users\/search$/).pop()?.body as { sortBy?: string; sortDescending?: boolean };
    expect(last).toEqual(expect.objectContaining({ sortBy: 'experiencepoints', sortDescending: true }));

    await table.getByRole('button', { name: /Last seen/ }).click();
    await expect(page).toHaveURL(/sort=lastSeenAt&dir=asc/);
    last = api.calls('POST', /^Users\/search$/).pop()?.body as { sortBy?: string; sortDescending?: boolean };
    expect(last).toEqual(expect.objectContaining({ sortBy: 'lastseenat', sortDescending: false }));
    await expect(table.getByRole('columnheader', { name: /Created/ })).toBeVisible();
  });
});
