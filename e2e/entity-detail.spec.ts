import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { CONTENT, mockDashboardTypes, WORLD } from './fixtures/dashboardAccess';
import { mockTownDetail } from './fixtures/entityDetail';
import { expectNoSidewaysScroll } from './support/layout';

/**
 * A record's detail page (PandiO/knk-workspace#188, #189): readable values with links, counts and paging,
 * hot edit, readable errors, Unlink that never deletes, Add from the lookup, Delete as a separate red action
 * and the gates without the nodes. Smoke test: knk-workspace docs/guides/entity-detail-smoke-test.md and
 * dashboard-access-smoke-test.md § 8 step 9b (backfill #511).
 */

const townUrl = '/display/Town/1';

test.beforeEach(async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockContentDefaults(api);
  mockDashboardTypes(api);
});

test.describe('as an admin', () => {
  test.beforeEach(({ api }) => mockSession(api, alex, () => true));

  test('a collection has a count and pages of 12; each item links to its own detail page and Back returns', async ({ page, api }) => {
    mockTownDetail(api, 14);
    await page.goto(townUrl);

    await expect(page.getByText('Showing 1 to 12 of 14 streets')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Showing 13 to 14 of 14 streets')).toBeVisible();
    await page.getByRole('button', { name: 'Previous' }).click();

    await page.getByRole('link', { name: 'Main Street' }).click();
    await expect(page).toHaveURL(/\/display\/Street\/1/);
    await page.goBack();
    await expect(page).toHaveURL(/\/display\/Town\/1/);
  });

  test('an empty collection says so and still offers Add…', async ({ page, api }) => {
    mockTownDetail(api, 0);
    await page.goto(townUrl);
    await expect(page.getByText('No streets yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add…' })).toBeEnabled();
  });

  test('hot edit: Enter saves the value, Escape saves nothing', async ({ page, api }) => {
    mockTownDetail(api);
    await page.goto(townUrl);

    await page.getByRole('button', { name: 'Edit Name' }).click();
    await page.getByRole('textbox').last().fill('Cinix Prime');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Cinix Prime').first()).toBeVisible();
    expect(api.calls('PUT', 'Towns/1').map(r => (r.body as { name: string }).name)).toEqual(['Cinix Prime']);

    await page.getByRole('button', { name: 'Edit Name' }).click();
    await page.getByRole('textbox').last().fill('Not saved');
    await page.keyboard.press('Escape');
    expect(api.calls('PUT', 'Towns/1')).toHaveLength(1);
  });

  test('Unlink asks a plain question and removes only the link: no delete request', async ({ page, api }) => {
    mockTownDetail(api);
    await page.goto(townUrl);

    await page.getByRole('button', { name: 'Unlink Main Street' }).click();
    const question = page.getByRole('alertdialog', { name: 'Unlink "Main Street"?' });
    await expect(question).toContainText('only its link to Town "Cinix" is removed');
    await question.getByRole('button', { name: 'Cancel' }).click();
    expect(api.calls('POST', 'Relationships/Town/1/streets/unlink')).toHaveLength(0);

    await page.getByRole('button', { name: 'Unlink Main Street' }).click();
    await page.getByRole('alertdialog', { name: 'Unlink "Main Street"?' }).getByRole('button', { name: 'Unlink' }).click();
    await expect(page.getByText('"Main Street" unlinked.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Main Street' })).toHaveCount(0);
    expect(api.calls('POST', 'Relationships/Town/1/streets/unlink').map(r => r.body)).toEqual([{ relatedId: 1 }]);
    expect(api.requests.filter(r => r.method === 'DELETE')).toHaveLength(0);
  });

  test('Add… searches the lookup, marks what is linked, and links the pick with a toast', async ({ page, api }) => {
    mockTownDetail(api);
    await page.goto(townUrl);

    await page.getByRole('button', { name: 'Add…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a Street to "Cinix"' });
    const search = dialog.getByRole('searchbox').or(dialog.getByRole('textbox')).first();
    await expect(search).toBeFocused();
    await expect(dialog.getByRole('listitem').filter({ hasText: 'Main Street' })).toContainText('Linked');

    await search.fill('market');
    const market = dialog.getByRole('listitem').filter({ hasText: 'Market Lane' });
    await expect(market).toBeVisible();
    await expect(dialog.getByRole('listitem').filter({ hasText: 'Main Street' })).toHaveCount(0);
    await market.getByRole('button', { name: /^Add/ }).click();

    await expect(page.getByText('"Market Lane" added.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Market Lane' })).toBeVisible();
    expect(api.calls('POST', 'Relationships/Town/1/streets/link').map(r => (r.body as { relatedId: number }).relatedId)).toEqual([2]);
  });

  test('Delete on an item is a separate red question that names the record and the town; Cancel deletes nothing', async ({ page, api }) => {
    mockTownDetail(api);
    await page.goto(townUrl);

    await page.getByRole('button', { name: 'Delete Harbour Road' }).click();
    const question = page.getByRole('alertdialog', { name: 'Delete Street "Harbour Road"?' });
    await expect(question).toContainText("This can't be undone.");
    await question.getByRole('button', { name: 'Cancel' }).click();
    expect(api.requests.filter(r => r.method === 'DELETE')).toHaveLength(0);
  });

  test('a record that does not exist says so in words with Back', async ({ page, api }) => {
    mockTownDetail(api);
    api.on('GET', 'Towns/999999', { status: 404, body: { error: 'NotFound', message: 'Town not found' } });
    await page.goto('/display/Town/999999');
    await expect(page.getByText("This Town (#999999) doesn't exist.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
    await expect(page.getByText(/^Error:/)).toHaveCount(0);
  });

  test('a load failure says it could not be loaded and offers Try again', async ({ page, api }) => {
    mockTownDetail(api);
    api.on('GET', 'Towns/1', { status: 500, body: { error: 'ServerError' } });
    await page.goto(townUrl);
    await expect(page.getByText(/couldn't be loaded/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('at 390 px the detail page does not scroll sideways', async ({ page, api }) => {
    mockTownDetail(api, 14);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(townUrl);
    await expect(page.getByRole('link', { name: 'Main Street' })).toBeVisible();
    await expectNoSidewaysScroll(page);
  });
});

test('without knk.admin.delete: Delete is disabled with the node; Unlink and Add… still work', async ({ page, api }) => {
  mockSession(api, alex, node => node !== 'knk.admin.delete');
  mockTownDetail(api);
  await page.goto(townUrl);

  await expect(page.getByRole('button', { name: /^Delete Main Street/ })).toBeDisabled();
  await expect(page.getByText('Delete: Requires knk.admin.delete').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unlink Main Street' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Add…' })).toBeEnabled();
});

test('world-only (#374): Add… and Unlink need knk.admin.content; Delete of a street still works', async ({ page, api }) => {
  mockSession(api, alex, node => [WORLD, 'knk.admin.delete'].includes(node));
  mockTownDetail(api);
  await page.goto(townUrl);

  await expect(page.getByRole('button', { name: /^Add…/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^Unlink Main Street/ })).toBeDisabled();
  await expect(page.getByText(/Requires knk\.admin\.(world and knk\.admin\.)?content/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Main Street' })).toBeEnabled();
  // #383: the hot edit pencil needs knk.admin.content too.
  await expect(page.getByRole('button', { name: 'Edit Name – Requires knk.admin.content' })).toBeDisabled();
});

test('content-only: a world record says "You don\'t have access" with the lookup name and the nodes', async ({ page, api }) => {
  mockSession(api, alex, node => node === CONTENT);
  mockTownDetail(api);
  api.on('GET', 'Towns/1', {
    status: 403,
    body: { error: 'Forbidden', code: 'NoReadAccess', entityType: 'Town', nodes: [WORLD, 'knk.admin.config', 'knk.admin.road'], message: 'No read access' },
  });
  await page.goto(townUrl);
  await expect(page.getByText(`You don't have access to Town "Cinix".`)).toBeVisible();
  await expect(page.getByText(/Requires one of: knk\.admin\.world/)).toBeVisible();
});
