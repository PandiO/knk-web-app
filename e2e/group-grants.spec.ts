import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { KNIGHT_ID, MANAGE_USERS, USER_PERMISSIONS, groupUrl, mockGroupDetail } from './fixtures/groupGrants';
import type { Page } from '@playwright/test';
import type { MockApi } from './support/mockApi';
import type { PagedQueryDto } from '../src/types/dtos/common/PagedQuery';
import type { UpsertPermissionGrantByNodeDto } from '../src/types/dtos/userManagement/PermissionGrantDto';

/**
 * A permission group's own grants on its detail page (PandiO/knk-workspace#50): the Permissions panel lists the
 * group's nodes, grants, denies, changes the expiry and removes a node through the by-node routes (no default expiry),
 * asks with the blast radius before a node flips or is removed, shows the group's History, and is read-only without
 * `knk.admin.user.perm`. Smoke test: knk-workspace docs/guides/dashboard-access-smoke-test.md § 8.7.
 */

test.use({ strictApi: true });

const panel = (page: Page) => page.getByTestId('group-permissions');
const nodes = (page: Page) => page.getByRole('table', { name: 'Permission nodes of Knight' });
const row = (page: Page, node: string) => nodes(page).getByRole('row').filter({ hasText: node });
const history = (page: Page) => page.getByRole('table', { name: 'History of Knight' });
const writes = (api: MockApi) => api.calls('PUT', 'PermissionGrants/by-node').map(r => r.body as UpsertPermissionGrantByNodeDto);
const removals = (api: MockApi) => api.calls('DELETE', 'PermissionGrants/by-node').map(r => r.query.toString());

async function open(page: Page, api: MockApi, allowed: (node: string) => boolean, count?: Parameters<typeof mockGroupDetail>[1]) {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex, allowed);
  mockContentDefaults(api);
  const state = mockGroupDetail(api, count);
  await page.goto(groupUrl);
  return state;
}

test.describe('staff with knk.admin.user.manage and knk.admin.user.perm', () => {
  const both = (node: string) => node === MANAGE_USERS || node === USER_PERMISSIONS || node === 'knk.admin.delete';

  test("lists the group's own nodes with effect and expiry, the players it reaches and its history", async ({ page, api }) => {
    await open(page, api, both);

    await expect(panel(page).getByRole('heading', { name: 'Permissions' })).toBeVisible();
    await expect(row(page, 'knk.fly')).toContainText('Denied');
    await expect(row(page, 'knk.fly')).toContainText('Never');
    await expect(row(page, 'knk.gate.open')).toContainText('Granted');
    await expect(row(page, 'knk.kit.knight')).not.toContainText('Never');
    await expect(page.getByTestId('group-member-count')).toHaveText('7 players (with 2 inheriting groups)');
    await expect(history(page).getByRole('row').filter({ hasText: 'Permission granted' })).toContainText('Alex');
    const search = api.calls('POST', 'PermissionGrants/search')[0].body as PagedQueryDto;
    expect(search.filters).toEqual({ holderId: String(KNIGHT_ID) });
    expect(api.calls('GET', 'audit-log')[0].query.get('subjectType')).toBe('PermissionGroup');
  });

  test('grants a new node permanently by default, without a confirmation, and the History shows it', async ({ page, api }) => {
    await open(page, api, both);
    await expect(row(page, 'knk.fly')).toBeVisible();

    await expect(page.getByLabel('Expires (permanent)', { exact: true })).toHaveValue('');
    await page.getByLabel('Node', { exact: true }).fill('knk.warp.castle');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(row(page, 'knk.warp.castle')).toContainText('Granted');
    await expect(row(page, 'knk.warp.castle')).toContainText('Never');
    expect(writes(api)).toEqual([{ holderId: KNIGHT_ID, node: 'knk.warp.castle', value: true, expiresAt: null }]);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(history(page).getByRole('row').filter({ hasText: 'knk.warp.castle' })).toContainText('Permission granted');
  });

  test('denies a new node', async ({ page, api }) => {
    await open(page, api, both);
    await expect(row(page, 'knk.fly')).toBeVisible();

    await page.getByLabel('Node', { exact: true }).fill('knk.pvp');
    await page.getByLabel('Value', { exact: true }).selectOption('false');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(row(page, 'knk.pvp')).toContainText('Denied');
    expect(writes(api)).toEqual([{ holderId: KNIGHT_ID, node: 'knk.pvp', value: false, expiresAt: null }]);
  });

  test('Edit then Save changes the expiry of the same row, never a second one', async ({ page, api }) => {
    const state = await open(page, api, both);

    await row(page, 'knk.gate.open').getByRole('button', { name: 'Edit knk.gate.open' }).click();
    await expect(page.getByLabel('Node', { exact: true })).toHaveValue('knk.gate.open');
    await page.getByLabel(/^Expires/).fill('2027-05-01T08:00');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(row(page, 'knk.gate.open')).not.toContainText('Never');
    await expect(row(page, 'knk.gate.open')).toHaveCount(1);
    expect(state.grants.filter(g => g.node === 'knk.gate.open')).toHaveLength(1);
    const [write] = writes(api);
    expect(write).toMatchObject({ holderId: KNIGHT_ID, node: 'knk.gate.open', value: true });
    expect(new Date(write.expiresAt!).getTime()).toBe(new Date('2027-05-01T08:00').getTime());
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(history(page).getByRole('row').filter({ hasText: 'Permission updated' })).toBeVisible();
  });

  test('changing Granted to Denied asks first with the blast radius; Cancel sends nothing', async ({ page, api }) => {
    await open(page, api, both);

    await row(page, 'knk.gate.open').getByRole('button', { name: 'Change knk.gate.open to Denied' }).click();
    const question = page.getByRole('alertdialog', { name: 'Deny knk.gate.open on Knight?' });
    await expect(question).toContainText('This affects 7 players (members of Knight and of 2 groups that inherit from it).');
    await expect(question).toContainText('Online players get the change within seconds.');
    await question.getByRole('button', { name: 'Cancel' }).click();
    expect(writes(api)).toHaveLength(0);

    await row(page, 'knk.gate.open').getByRole('button', { name: 'Change knk.gate.open to Denied' }).click();
    await page.getByRole('alertdialog', { name: 'Deny knk.gate.open on Knight?' }).getByRole('button', { name: 'Deny' }).click();

    await expect(row(page, 'knk.gate.open')).toContainText('Denied');
    expect(writes(api)).toEqual([{ holderId: KNIGHT_ID, node: 'knk.gate.open', value: false, expiresAt: null }]);
  });

  test('saving Grant on a denied node from the form asks first too', async ({ page, api }) => {
    await open(page, api, both);
    await expect(row(page, 'knk.fly')).toBeVisible();

    await page.getByLabel('Node', { exact: true }).fill('knk.fly');
    await page.getByRole('button', { name: 'Save' }).click();
    const question = page.getByRole('alertdialog', { name: 'Grant knk.fly on Knight?' });
    await expect(question).toContainText('changes from Denied to Granted');
    await question.getByRole('button', { name: 'Grant' }).click();

    await expect(row(page, 'knk.fly')).toContainText('Granted');
    expect(writes(api)).toHaveLength(1);
  });

  test('Remove asks with the blast radius, then removes the node and the History shows it', async ({ page, api }) => {
    await open(page, api, both);

    await row(page, 'knk.fly').getByRole('button', { name: 'Remove knk.fly' }).click();
    const question = page.getByRole('alertdialog', { name: 'Remove knk.fly from Knight?' });
    await expect(question).toContainText('This affects 7 players');
    await question.getByRole('button', { name: 'Cancel' }).click();
    expect(removals(api)).toHaveLength(0);

    await row(page, 'knk.fly').getByRole('button', { name: 'Remove knk.fly' }).click();
    await page.getByRole('alertdialog', { name: 'Remove knk.fly from Knight?' }).getByRole('button', { name: 'Remove' }).click();

    await expect(row(page, 'knk.fly')).toHaveCount(0);
    expect(removals(api)).toEqual([`holderId=${KNIGHT_ID}&node=knk.fly`]);
    await expect(history(page).getByRole('row').filter({ hasText: 'Permission removed' })).toContainText('knk.fly');
  });

  test("the confirmation says so when the players couldn't be counted", async ({ page, api }) => {
    await open(page, api, both, null);

    await row(page, 'knk.fly').getByRole('button', { name: 'Remove knk.fly' }).click();

    await expect(page.getByRole('alertdialog', { name: 'Remove knk.fly from Knight?' }))
      .toContainText("Couldn't count the players this affects.");
  });

  test("the API's refusal is shown (a group ranked at or above the staff member's own)", async ({ page, api }) => {
    await open(page, api, both);
    api.on('PUT', 'PermissionGrants/by-node', {
      status: 403,
      body: { error: 'Forbidden', message: 'You can only change groups ranked below your own.' },
    });
    await expect(row(page, 'knk.fly')).toBeVisible();

    await page.getByLabel('Node', { exact: true }).fill('knk.warp.castle');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(panel(page).getByRole('alert')).toHaveText('You can only change groups ranked below your own.');
    await expect(row(page, 'knk.warp.castle')).toHaveCount(0);
  });
});

test('without knk.admin.user.perm the panel is read-only with "Requires …", and the History still shows', async ({ page, api }) => {
  await open(page, api, node => node === MANAGE_USERS);

  await expect(row(page, 'knk.fly')).toContainText('Denied');
  await expect(page.getByLabel('Node', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  await expect(page.getByTestId('group-grant-hint')).toHaveText(`Requires ${USER_PERMISSIONS}`);
  await expect(row(page, 'knk.fly').getByRole('button', { name: 'Remove knk.fly' })).toBeDisabled();
  await expect(row(page, 'knk.fly').getByRole('button', { name: 'Change knk.fly to Granted' })).toBeDisabled();
  await expect(history(page).getByRole('row').filter({ hasText: 'Permission granted' })).toBeVisible();
  expect(writes(api)).toHaveLength(0);
});

test("without knk.admin.user.manage nothing of the group is read: the detail page is staff-only", async ({ page, api }) => {
  await open(page, api, node => node === USER_PERMISSIONS);

  // knk.admin.user.manage is the type's view node, so the group's detail page (and its panel) needs it first.
  await expect(page.getByRole('heading', { name: 'Staff only', level: 1 })).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  expect(api.calls('POST', 'PermissionGrants/search')).toHaveLength(0);
  expect(api.calls('GET', 'audit-log')).toHaveLength(0);
  expect(api.calls('GET', `PermissionGroups/${KNIGHT_ID}/member-count`)).toHaveLength(0);
});
