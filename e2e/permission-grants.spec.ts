import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import {
  MANAGE_USERS,
  USER_PERMISSIONS,
  permissionGrantMetadata,
  searchGrants,
  townMetadata,
} from './fixtures/permissionGrants';
import type { PagedQueryDto, PagedResultDto } from '../src/types/dtos/common/PagedQuery';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { FormConfigurationDto } from '../src/types/dtos/forms/FormModels';
import type { PermissionGrantListDto } from '../src/types/dtos/userManagement/PermissionGrantListDto';
import type { MockApi } from './support/mockApi';

/**
 * The dashboard's PermissionGrant table (/dashboard/permissiongrant, PandiO/knk-workspace#408): it lists, pages, sorts
 * and searches through POST api/PermissionGrants/search for a viewer with `knk.admin.user.manage`, offers no way to
 * write a grant without `knk.admin.user.perm`, and shows the normal refusal instead of a broken table.
 */

test.use({ strictApi: true });

type Search = PagedQueryDto & { pageNumber?: number };

function mockDashboard(api: MockApi, allowed: (node: string) => boolean): void {
  mockSession(api, alex, allowed);
  mockContentDefaults(api);
  // Realtime stays offline: the page works without live updates (strict mode lists any call left unmocked).
  api.on('POST', 'hubs/web/negotiate', { status: 503, body: { error: 'Offline' } });
  api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [permissionGrantMetadata, townMetadata]);
  api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/permissiongrant', []);
  api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/town', []);
  api.on<PagedResultDto<PermissionGrantListDto>>('POST', 'PermissionGrants/search', ({ body }) => ({ body: searchGrants(body as Search) }));
}

const searches = (api: MockApi) => api.calls('POST', 'PermissionGrants/search').map(r => r.body as Search);
const rows = (page: import('@playwright/test').Page) => page.getByRole('table').getByRole('row');

test.describe('an Owner or Admin (every node)', () => {
  test.beforeEach(async ({ page, api }) => {
    await startLoggedIn(page, 'access-1');
    mockDashboard(api, () => true);
  });

  test('lists the first page of grants with node, effect, holder and expiry', async ({ page, api }) => {
    await page.goto('/dashboard/permissiongrant');

    await expect(page.getByRole('heading', { name: 'Permission Grant', level: 2 })).toBeVisible();
    for (const header of ['ID', 'Node', 'Effect', 'Holder', 'Expires (UTC)']) {
      await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
    }
    const deny = rows(page).filter({ hasText: 'knk.fly' });
    await expect(deny).toContainText('Denied');
    await expect(deny).toContainText('Group #8');
    await expect(rows(page).filter({ hasText: 'knk.admin.world' })).toContainText('2027-01-15 10:30');
    await expect(rows(page).filter({ hasText: 'knk.admin.content' })).toContainText('Never');
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    expect(searches(api)[0]).toMatchObject({ pageNumber: 1, pageSize: 10 });
  });

  test('Next shows the second page', async ({ page, api }) => {
    await page.goto('/dashboard/permissiongrant');
    await expect(rows(page).filter({ hasText: 'knk.admin.content' })).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('Page 2 of 2')).toBeVisible();
    await expect(rows(page).filter({ hasText: 'knk.tasks' })).toBeVisible();
    await expect(rows(page).filter({ hasText: 'knk.admin.content' })).toHaveCount(0);
    expect(searches(api).slice(-1)[0]).toMatchObject({ pageNumber: 2 });
  });

  test('a column header sorts through the API, ascending then descending', async ({ page, api }) => {
    await page.goto('/dashboard/permissiongrant');
    await expect(rows(page).filter({ hasText: 'knk.admin.content' })).toBeVisible();
    const expires = page.getByRole('columnheader', { name: 'Expires (UTC)' });

    await expires.getByRole('button').click();
    await expect(expires).toHaveAttribute('aria-sort', 'ascending');
    expect(searches(api).slice(-1)[0]).toMatchObject({ sortBy: 'expiresAt', sortDescending: false });

    await expires.getByRole('button').click();
    await expect(expires).toHaveAttribute('aria-sort', 'descending');
    await expect(rows(page).nth(1)).toContainText('knk.admin.world');
    expect(searches(api).slice(-1)[0]).toMatchObject({ sortBy: 'expiresAt', sortDescending: true });
  });

  test('the search box asks the API with the search term', async ({ page, api }) => {
    await page.goto('/dashboard/permissiongrant');
    await expect(rows(page).filter({ hasText: 'knk.fly' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Search...' }).fill('gate');

    await expect(rows(page).filter({ hasText: 'knk.gate.open' })).toBeVisible();
    await expect(rows(page).filter({ hasText: 'knk.fly' })).toHaveCount(0);
    expect(searches(api).map(s => s.searchTerm)).toContain('gate');
  });
});

test('a viewer with knk.admin.user.manage but not knk.admin.user.perm reads the table and cannot write a grant', async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockDashboard(api, node => node === MANAGE_USERS);

  await page.goto('/dashboard/permissiongrant');

  await expect(rows(page).filter({ hasText: 'knk.gate.open' })).toBeVisible();
  await expect(page.getByTestId('dashboard-new')).toBeDisabled();
  await expect(page.getByTestId('dashboard-create-hint')).toContainText(`Requires ${USER_PERMISSIONS}`);
  await expect(page.getByRole('button', { name: `Edit – Requires ${USER_PERMISSIONS}` }).first()).toBeDisabled();
});

test('a viewer without knk.admin.user.manage is not offered the table', async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockDashboard(api, node => node === 'knk.admin.world');
  api.on<PagedResultDto<unknown>>('POST', 'Towns/search', ({ body }) => ({
    body: { items: [], totalCount: 0, page: (body as Search).page, pageSize: (body as Search).pageSize, totalPages: 0 },
  }));

  await page.goto('/dashboard/permissiongrant');

  // The type of another area in the URL falls back to one the viewer may see (#280 decision 8).
  await expect(page.getByRole('heading', { name: 'Town', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Permission Grant', level: 2 })).toHaveCount(0);
  expect(searches(api)).toHaveLength(0);
});

test('when the API refuses the read, the table shows the normal "Requires …" refusal', async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  // The page's check says yes, but the API decides: a grant removed meanwhile, or an API older than #408 that still
  // asks for the write node on the search.
  mockDashboard(api, node => node === MANAGE_USERS);
  api.on('POST', 'PermissionGrants/search', {
    status: 403,
    body: { error: 'Forbidden', message: `Requires the ${USER_PERMISSIONS} permission.` },
  });

  await page.goto('/dashboard/permissiongrant');

  // The label comes from the URL's type name ("Permissiongrant" for a lower-case URL); the node is the point here.
  await expect(page.getByText(/^You don't have access to Permission ?grant\. Requires the knk\.admin\.user\.perm permission\.$/i)).toBeVisible();
  await expect(page.getByText('Failed to load data')).toHaveCount(0);
  await expect(rows(page).filter({ hasText: 'knk.' })).toHaveCount(0);
});
