import { test, expect } from './support/mockApi';
import type { Page } from '@playwright/test';
import { alex, mockSession, startLoggedIn, steve } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { CONTENT, mockDashboardTypes, USERS, WORLD } from './fixtures/dashboardAccess';
import type { FormConfigurationDto } from '../src/types/dtos/forms/FormModels';
import type { BulkDeleteResponseDto } from '../src/apiClients/dashboardClient';
import type { EntityReferenceRowsDto } from '../src/apiClients/entityReferenceClient';
import type { DisplayConfigurationDto } from '../src/types/dtos/displayConfig/DisplayModels';

/**
 * Who opens the dashboard and which actions they get (PandiO/knk-workspace#280 AM3, #205, #371): the explorer
 * per area, actions greyed out with "Requires <node>", single and bulk delete, export through the endpoint.
 * Smoke test: knk-workspace docs/guides/dashboard-access-smoke-test.md § 8 (backfill #511).
 */

const explorerItem = (page: Page, type: string) => page.getByRole('button', { name: new RegExp(`^${type}`) });
const nodes = (...held: string[]) => (node: string) => held.includes(node);

test.beforeEach(async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockContentDefaults(api);
  for (const type of ['Street', 'Town', 'Category', 'User']) {
    api.json<FormConfigurationDto[]>('GET', `FormConfigurations/${type}`, []);
  }
});

test('a player: no dashboard in the bar, no metadata requests, /dashboard says Staff only with the area nodes', async ({ page, api }) => {
  mockSession(api, steve, () => false);
  mockDashboardTypes(api);
  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'Staff only' })).toBeVisible();
  await expect(page.getByText('This page needs one of these permissions:')).toContainText(CONTENT);
  await expect(page.getByText('This page needs one of these permissions:')).toContainText(WORLD);
  await expect(page.getByRole('navigation').first().getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
  expect(api.calls('GET', 'Metadata/entities')).toHaveLength(0);
  expect(api.calls('GET', 'EntityTypeConfiguration')).toHaveLength(0);
});

test('world-only: the explorer lists only world types, and a content type in the URL falls back to one', async ({ page, api }) => {
  mockSession(api, alex, nodes(WORLD));
  mockDashboardTypes(api);
  await page.goto('/dashboard/Category');

  await expect(page).toHaveURL(/\/dashboard\/(Street|Town)$/);
  await expect(explorerItem(page, 'Street')).toBeVisible();
  await expect(explorerItem(page, 'Town')).toBeVisible();
  await expect(explorerItem(page, 'Category')).toHaveCount(0);
  await expect(explorerItem(page, 'User')).toHaveCount(0);
});

test('content-only: only content types, and a world type in the URL falls back', async ({ page, api }) => {
  mockSession(api, alex, nodes(CONTENT));
  mockDashboardTypes(api);
  await page.goto('/dashboard/Town');

  await expect(page).toHaveURL(/\/dashboard\/Category$/);
  await expect(explorerItem(page, 'Category')).toBeVisible();
  await expect(explorerItem(page, 'Town')).toHaveCount(0);
  await expect(explorerItem(page, 'Street')).toHaveCount(0);
});

test('Staff on User: New, Delete, the cogwheel and Export greyed out with "Requires …"; Edit stays; no bulk Delete', async ({ page, api }) => {
  mockSession(api, alex, nodes(USERS));
  mockDashboardTypes(api);
  await page.goto('/dashboard/User');

  // The default columns are ID and Name; a user has a username, so the row reads 42 and "-".
  const row = page.getByRole('row').filter({ hasText: '42' });
  await expect(row).toBeVisible();
  await expect(page.getByRole('button', { name: 'New User – Requires knk.admin.content', exact: true })).toBeDisabled();
  await expect(page.getByText('New User: Requires knk.admin.content')).toBeVisible();
  await expect(row.getByRole('button', { name: 'Delete – Requires knk.admin.delete' })).toBeDisabled();
  await expect(row.getByRole('button', { name: 'Edit' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Configure User – Requires knk.admin.content' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  await expect(page.getByText('Requires knk.admin.export')).toBeVisible();

  await row.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: /^Delete \(\d+\)/ })).toHaveCount(0);
});

test('world-only on Town: New and Edit need knk.admin.content; Delete and Export keep their own nodes; the forms are refused', async ({ page, api }) => {
  mockSession(api, alex, nodes(WORLD, 'knk.admin.delete', 'knk.admin.export'));
  mockDashboardTypes(api);
  await page.goto('/dashboard/Town');

  const row = page.getByRole('row').filter({ hasText: 'Cinix' });
  await expect(page.getByRole('button', { name: 'New Town – Requires knk.admin.content', exact: true })).toBeDisabled();
  await expect(page.getByText('New Town: Requires knk.admin.content')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Town with another form' })).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Edit – Requires knk.admin.content' })).toBeDisabled();
  await expect(row.getByRole('button', { name: 'Delete', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeEnabled();

  for (const url of ['/forms/Town', '/forms/Town?autoOpen=true', '/forms/Town/edit/1']) {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: 'Staff only' })).toBeVisible();
    await expect(page.getByText('knk.admin.content')).toBeVisible();
  }
});

test.describe('as an admin', () => {
  test.beforeEach(({ api }) => mockSession(api, alex, () => true));

  test('a single Delete asks in red and removes the row with a toast', async ({ page, api }) => {
    const live = mockDashboardTypes(api);
    api.on('DELETE', /^Streets\/\d+$/, ({ path }) => {
      const id = Number(path.split('/').pop());
      live.splice(live.findIndex(s => s.id === id), 1);
      return { status: 204 };
    });
    await page.goto('/dashboard/Street');

    await page.getByRole('row').filter({ hasText: 'Main Street' }).getByRole('button', { name: 'Delete', exact: true }).click();
    const question = page.getByRole('alertdialog', { name: 'Delete Street "Main Street"?' });
    await question.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Street "Main Street" was deleted.')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Main Street' })).toHaveCount(0);
    expect(api.calls('DELETE', 'Streets/1')).toHaveLength(1);
  });

  test('bulk Delete names count and type; a refused row is listed with its reason and stays ticked', async ({ page, api }) => {
    const live = mockDashboardTypes(api);
    api.on<BulkDeleteResponseDto>('POST', 'Dashboard/bulk-delete', ({ body }) => {
      const ids = (body as { ids: number[] }).ids;
      const deleted = ids.filter(id => id !== 3);
      for (const id of deleted) live.splice(live.findIndex(s => s.id === id), 1);
      return { body: { deleted, refused: ids.includes(3) ? [{ id: 3, reason: 'It is still used by 1 structure.', code: 'InUse' }] : [] } };
    });
    await page.goto('/dashboard/Street');

    for (const name of ['Main Street', 'Market Lane', 'Harbour Road']) {
      await page.getByRole('row').filter({ hasText: name }).getByRole('checkbox').check();
    }
    await page.getByRole('button', { name: 'Delete (3)' }).click();
    await page.getByRole('alertdialog', { name: 'Delete 3 Streets?' }).getByRole('button', { name: /^Delete/ }).click();

    await expect(page.getByText("Deleted 2 of 3 Streets; 1 weren't deleted.")).toBeVisible();
    const report = page.getByRole('alertdialog', { name: 'Deleted 2 of 3 Streets' });
    await expect(report).toContainText('It is still used by 1 structure.');
    await expect(report.getByRole('button', { name: 'Show what uses it' })).toBeVisible();
    await report.getByRole('button', { name: 'Close', exact: true }).click();

    await expect(page.getByRole('row').filter({ hasText: 'Main Street' })).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: 'Harbour Road' }).getByRole('checkbox')).toBeChecked();
    expect((api.calls('POST', 'Dashboard/bulk-delete')[0].body as { entityType: string; ids: number[] })).toEqual({ entityType: 'Street', ids: [1, 2, 3] });
  });

  test('bulk Delete: "Show what uses it" on an in-use row loads its list on request; a row refused by a rule has none (#289)', async ({ page, api }) => {
    mockDashboardTypes(api);
    api.on<BulkDeleteResponseDto>('POST', 'Dashboard/bulk-delete', () => ({
      body: {
        deleted: [],
        refused: [
          { id: 2, reason: "This street can't be deleted: it is still used by 1 structure.", code: 'InUse' },
          { id: 3, reason: 'Streets of a road network are deleted on the road page.', code: 'Refused' },
        ],
      },
    }));
    api.json<EntityReferenceRowsDto>('GET', 'EntityReferences/Street/2/rows', {
      entityTypeName: 'Street',
      id: 2,
      groups: [{ referencedBy: 'Structure.StreetId', entityType: 'Structure', count: 1, listed: true, readable: true, nodes: [WORLD], rows: [{ id: 3, label: 'Smithy' }], more: false }],
    });
    api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Structure', { name: 'Structure display', entityTypeName: 'Structure', isDefault: true, isDraft: false, sections: [] });
    api.json('GET', 'Structures/3', { id: 3, name: 'Smithy' });
    await page.goto('/dashboard/Street');

    for (const name of ['Market Lane', 'Harbour Road']) {
      await page.getByRole('row').filter({ hasText: name }).getByRole('checkbox').check();
    }
    await page.getByRole('button', { name: 'Delete (2)' }).click();
    await page.getByRole('alertdialog', { name: 'Delete 2 Streets?' }).getByRole('button', { name: /^Delete/ }).click();

    const report = page.getByRole('alertdialog', { name: 'No Street was deleted' });
    const inUse = report.getByRole('listitem').filter({ hasText: 'Market Lane' });
    const refused = report.getByRole('listitem').filter({ hasText: 'Harbour Road' });
    await expect(refused.getByRole('button', { name: 'Show what uses it' })).toHaveCount(0);
    expect(api.calls('GET', /^EntityReferences\//)).toHaveLength(0);

    await inUse.getByRole('button', { name: 'Show what uses it' }).click();
    await expect(inUse.getByRole('heading', { name: '1 structure' })).toBeVisible();
    await inUse.getByRole('button', { name: 'Hide' }).click();
    await expect(inUse.getByRole('link', { name: 'Smithy' })).toHaveCount(0);
    await inUse.getByRole('button', { name: 'Show what uses it' }).click();
    expect(api.calls('GET', 'EntityReferences/Street/2/rows')).toHaveLength(1);

    await inUse.getByRole('link', { name: 'Smithy' }).click();
    await expect(page).toHaveURL(/\/display\/Structure\/3/);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('a delete refused as in use: "Show what uses it" loads the list only on request, links the record, and Hide keeps it', async ({ page, api }) => {
    mockDashboardTypes(api);
    api.on('DELETE', 'Streets/1', {
      status: 409,
      body: { error: 'Conflict', code: 'DbConstraint', message: "This street can't be deleted: it is still used by 1 structure." },
    });
    api.json<EntityReferenceRowsDto>('GET', 'EntityReferences/Street/1/rows', {
      entityTypeName: 'Street',
      id: 1,
      groups: [{ referencedBy: 'Structure.StreetId', entityType: 'Structure', count: 1, listed: true, readable: true, nodes: [WORLD], rows: [{ id: 3, label: 'Smithy' }], more: false }],
    });
    api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Structure', { name: 'Structure display', entityTypeName: 'Structure', isDefault: true, isDraft: false, sections: [] });
    api.json('GET', 'Structures/3', { id: 3, name: 'Smithy' });
    await page.goto('/dashboard/Street');

    await page.getByRole('row').filter({ hasText: 'Main Street' }).getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('alertdialog', { name: 'Delete Street "Main Street"?' }).getByRole('button', { name: 'Delete' }).click();
    const failed = page.getByRole('alertdialog', { name: 'Delete Failed' });
    await expect(failed).toContainText("This street can't be deleted: it is still used by 1 structure.");
    expect(api.calls('GET', 'EntityReferences/Street/1/rows')).toHaveLength(0);

    await failed.getByRole('button', { name: 'Show what uses it' }).click();
    await expect(failed.getByRole('link', { name: 'Smithy' })).toBeVisible();
    await failed.getByRole('button', { name: 'Hide details' }).click();
    await failed.getByRole('button', { name: 'Show what uses it' }).click();
    await expect(failed.getByRole('link', { name: 'Smithy' })).toBeVisible();
    expect(api.calls('GET', 'EntityReferences/Street/1/rows')).toHaveLength(1);

    await failed.getByRole('link', { name: 'Smithy' }).click();
    await expect(page).toHaveURL(/\/display\/Structure\/3/);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('a delete that fails for another reason has no "Show what uses it"', async ({ page, api }) => {
    mockDashboardTypes(api);
    api.on('DELETE', 'Streets/1', { status: 500, body: { error: 'ServerError' } });
    await page.goto('/dashboard/Street');
    await page.getByRole('row').filter({ hasText: 'Main Street' }).getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('alertdialog', { name: 'Delete Street "Main Street"?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(/error occurred while deleting/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show what uses it' })).toHaveCount(0);
  });

  test('on User there is no bulk Delete, one at a time only', async ({ page, api }) => {
    mockDashboardTypes(api);
    await page.goto('/dashboard/User');
    await page.getByRole('row').filter({ hasText: '42' }).getByRole('checkbox').check();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Delete \(\d+\)/ })).toHaveCount(0);
  });
});

test('a user-level deny of knk.admin.delete.bulk: no Delete (n), single Delete still works', async ({ page, api }) => {
  mockSession(api, alex, node => node !== 'knk.admin.delete.bulk');
  mockDashboardTypes(api);
  await page.goto('/dashboard/Street');

  const row = page.getByRole('row').filter({ hasText: 'Main Street' });
  await row.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: 'Export CSV (1)' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Delete \(\d+\)/ })).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Delete', exact: true })).toBeEnabled();
});

test('content-only: Export CSV goes through the endpoint with the current sort and downloads Category-<date>.csv', async ({ page, api }) => {
  mockSession(api, alex, nodes(CONTENT, 'knk.admin.export'));
  mockDashboardTypes(api);
  api.on('POST', 'Dashboard/export', {
    body: { items: [{ id: 1, name: 'Weapons' }, { id: 2, name: 'Armour' }, { id: 3, name: 'Tools' }], total: 3, truncated: false },
  });
  await page.goto('/dashboard/Category');
  await expect(page.getByRole('row').filter({ hasText: 'Weapons' })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await download).suggestedFilename()).toMatch(/^Category-\d{4}-\d{2}-\d{2}.*\.csv$/);
  const sent = api.calls('POST', 'Dashboard/export');
  expect(sent).toHaveLength(1);
  expect(sent[0].body).toEqual(expect.objectContaining({ entityType: 'Category' }));
});
