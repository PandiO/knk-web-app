import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import type { PagedQueryDto, PagedResultDto } from '../src/types/dtos/common/PagedQuery';
import type { FormConfigurationDto } from '../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { TownDto } from '../src/types/dtos/town/TownDto';

/**
 * PandiO/knk-workspace#404–#406 on the dashboard's entity list (/dashboard/town): every row looks the same, the
 * row actions stay in view at phone width, and a right-click (or Shift+F10) opens a menu whose items follow the
 * same permission nodes as the buttons.
 */

const towns: TownDto[] = [
  { id: 1, name: 'Eldoria', allowEntry: true, requiredTitle: 0, worldName: 'world' },
  { id: 2, name: 'Brightwater', allowEntry: false, requiredTitle: 0, worldName: 'world_nether' },
  { id: 3, name: 'Stonebridge', allowEntry: true, requiredTitle: 0, worldName: 'world' },
];

/** The access model's metadata for Town (#280), so the dashboard gates its actions itself. */
const townMetadata: EntityMetadataDto = {
  entityName: 'Town',
  displayName: 'Town',
  fields: [],
  area: 'world',
  accessNode: 'knk.admin.world',
  deletable: true,
  bulkDeletable: true,
  exportable: true,
  actionNodes: {
    view: ['knk.admin.world'],
    create: ['knk.admin.world', 'knk.admin.content'],
    edit: ['knk.admin.world', 'knk.admin.content'],
    delete: ['knk.admin.world', 'knk.admin.delete'],
    bulkDelete: ['knk.admin.world', 'knk.admin.delete.bulk'],
    export: ['knk.admin.world', 'knk.admin.export'],
  },
};

function setUp(api: Parameters<typeof mockSession>[0], allowed: (node: string) => boolean, withMetadata = false) {
  mockSession(api, alex, allowed);
  mockContentDefaults(api);
  if (withMetadata) api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [townMetadata]);
  api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/town', []);
  api.on<PagedResultDto<TownDto>>('POST', 'Towns/search', ({ body }) => {
    const query = body as PagedQueryDto;
    return { body: { items: towns, totalCount: towns.length, page: query.page, pageSize: query.pageSize, totalPages: 1 } };
  });
}

function row(page: import('@playwright/test').Page, name: string) {
  return page.getByRole('table').getByRole('row').filter({ hasText: name });
}

test.beforeEach(async ({ page }) => {
  await startLoggedIn(page, 'access-1');
});

test('every row has the same left edge and row line (#404)', async ({ page, api }) => {
  setUp(api, () => true);
  await page.goto('/dashboard/town');
  await expect(row(page, 'Stonebridge')).toBeVisible();

  const edges = await page.getByRole('table').locator('tbody tr').evaluateAll(rows =>
    rows.map(r => {
      const style = getComputedStyle(r);
      const cell = getComputedStyle(r.querySelector('td') as Element);
      return `${style.borderLeftWidth}/${cell.borderBottomWidth}/${cell.borderBottomColor}`;
    }));
  expect(edges.length).toBe(3);
  // No row has a left border any more; every row but the last carries the same 1px row line.
  expect(edges.every(e => e.startsWith('0px/'))).toBe(true);
  expect(new Set(edges.slice(0, -1)).size).toBe(1);
  expect(edges[0]).toMatch(/^0px\/1px\//);
});

test('the row actions stay in view at phone width (#405)', async ({ page, api }) => {
  setUp(api, () => true);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/dashboard/town');

  const edit = row(page, 'Eldoria').getByRole('button', { name: 'Edit', exact: true });
  await expect(edit).toBeVisible();
  const box = await edit.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await expect(edit).toBeInViewport();
});

test('a right-click opens View, Edit, Delete and Export for that row (#406)', async ({ page, api }) => {
  setUp(api, () => true);
  await page.goto('/dashboard/town');

  await row(page, 'Brightwater').click({ button: 'right' });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  for (const name of ['View', 'Edit', 'Delete', 'Export as CSV']) {
    await expect(menu.getByRole('menuitem', { name })).toBeVisible();
  }
  await expect(menu.getByRole('menuitem', { name: 'Delete' })).not.toHaveAttribute('aria-disabled', 'true');
  await expect(menu.getByRole('menuitem', { name: 'Export as CSV' })).not.toHaveAttribute('aria-disabled', 'true');

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
});

test('a menu item without its node is greyed out with the node it needs (#406)', async ({ page, api }) => {
  setUp(api, node => node !== 'knk.admin.delete' && node !== 'knk.admin.export', true);
  await page.goto('/dashboard/town');

  await row(page, 'Eldoria').click({ button: 'right' });
  const menu = page.getByRole('menu');
  const del = menu.getByRole('menuitem', { name: /^Delete/ });
  await expect(del).toHaveAttribute('aria-disabled', 'true');
  await expect(del).toContainText('Requires knk.admin.delete');
  const exp = menu.getByRole('menuitem', { name: /^Export as CSV/ });
  await expect(exp).toHaveAttribute('aria-disabled', 'true');
  await expect(exp).toContainText('Requires knk.admin.export');
  // The row's own Delete button says the same.
  await page.keyboard.press('Escape');
  await expect(row(page, 'Eldoria').getByRole('button', { name: 'Delete – Requires knk.admin.delete' })).toBeDisabled();
});

test('Shift+F10 on a focused row opens the menu and Escape gives the focus back (#406)', async ({ page, api }) => {
  setUp(api, () => true);
  await page.goto('/dashboard/town');

  const link = row(page, 'Stonebridge').getByRole('link').first();
  await link.focus();
  await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Edit' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(link).toBeFocused();
});
