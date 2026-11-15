import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import type { PagedQueryDto, PagedResultDto } from '../src/types/dtos/common/PagedQuery';
import type { FormConfigurationDto } from '../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { TownDto } from '../src/types/dtos/town/TownDto';
import type { DashboardExportResponseDto } from '../src/apiClients/dashboardClient';

/**
 * PandiO/knk-workspace#404–#406 on the dashboard's entity list (/dashboard/town): every row looks the same, the
 * row actions are the row's last plain cell (#606 reverted #405's pinned column), and a right-click (or Shift+F10)
 * opens a menu whose items follow the same permission nodes as the buttons; its Export as CSV downloads at once (#607).
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

test('the row actions are the last cell of the row and scroll with the table (#606)', async ({ page, api }) => {
  setUp(api, () => true);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/dashboard/town');

  const eldoria = row(page, 'Eldoria');
  const edit = eldoria.getByRole('button', { name: 'Edit', exact: true });
  await expect(edit).toBeAttached();
  const cells = eldoria.getByRole('cell');
  const last = cells.last();
  await expect(last).toHaveAttribute('data-testid', 'row-actions');
  await expect(last.getByRole('button', { name: 'View', exact: true })).toBeAttached();
  await expect(last.getByRole('button', { name: 'Delete', exact: true })).toBeAttached();
  // Not pinned: a plain cell, so it moves with the table when the table scrolls sideways.
  expect(await last.evaluate(cell => getComputedStyle(cell).position)).toBe('static');
  const head = page.getByRole('table').getByRole('columnheader').last();
  expect(await head.evaluate(cell => getComputedStyle(cell).position)).not.toBe('sticky');

  const scroller = page.getByTestId('data-table-scroll');
  const before = (await last.boundingBox())!.x;
  const scrolled = await scroller.evaluate(el => {
    el.scrollLeft = 120;
    return el.scrollLeft;
  });
  expect(scrolled).toBeGreaterThan(0);
  await expect.poll(async () => (await last.boundingBox())!.x).toBeCloseTo(before - scrolled, 0);
});

test('at phone width the row menu\'s View and Edit open the row (#406, #606)', async ({ page, api }) => {
  setUp(api, () => true);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/dashboard/town');

  await row(page, 'Brightwater').getByRole('link').first().click({ button: 'right' });
  await page.getByRole('menu').getByRole('menuitem', { name: 'View' }).click();
  await expect(page).toHaveURL(/\/display\/town\/2(\?|$)/);

  await page.goto('/dashboard/town');
  await row(page, 'Stonebridge').getByRole('link').first().click({ button: 'right' });
  await page.getByRole('menu').getByRole('menuitem', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/\/forms\/town\/edit\/3(\?|$)/);
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

/** The CSV's lines without the UTF-8 byte order mark. */
async function csvLines(download: import('@playwright/test').Download): Promise<string[]> {
  const path = await download.path();
  const text = (await import('fs')).readFileSync(path!, 'utf8').replace(/^\uFEFF/, '');
  return text.split('\r\n').filter(line => line.length > 0);
}

/** The table's column headers as the CSV's header row (without the checkbox and actions columns). */
async function tableHeaderRow(page: import('@playwright/test').Page): Promise<string> {
  const heads = await page.getByRole('table').getByRole('columnheader').evaluateAll(cells =>
    cells.filter(cell => !cell.querySelector('input, .sr-only')).map(cell => (cell.textContent ?? '').trim()));
  return heads.join(',');
}

function mockExport(api: Parameters<typeof mockSession>[0]) {
  api.on<DashboardExportResponseDto<TownDto>>('POST', 'Dashboard/export', ({ body }) => {
    const ids = (body as { ids?: number[] }).ids;
    const items = ids ? towns.filter(town => ids.includes(town.id)) : towns;
    return { body: { items, total: items.length, truncated: false } };
  });
}

test('the row menu\'s Export as CSV downloads <Type>-<date>.csv at once, with no dialog in between (#607)', async ({ page, api }) => {
  setUp(api, () => true);
  mockExport(api);
  await page.goto('/dashboard/town');
  await expect(row(page, 'Brightwater')).toBeVisible();
  const fileChooser = page.waitForEvent('filechooser', { timeout: 2_000 }).then(() => true, () => false);

  await row(page, 'Brightwater').click({ button: 'right' });
  const download = page.waitForEvent('download');
  await page.getByRole('menu').getByRole('menuitem', { name: 'Export as CSV' }).click();
  const file = await download;

  expect(file.suggestedFilename()).toMatch(/^town-\d{4}-\d{2}-\d{2}\.csv$/);
  const lines = await csvLines(file);
  expect(lines[0]).toBe(await tableHeaderRow(page));
  expect(lines).toHaveLength(2);
  expect(lines[1]).toContain('Brightwater');
  expect(api.calls('POST', 'Dashboard/export')[0].body).toEqual(expect.objectContaining({ ids: [2] }));
  // Nothing of the app's own stands between the click and the file: no dialog, no save picker.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(await fileChooser).toBe(false);
});

test('the toolbar\'s Export CSV downloads the whole search at once, header row first (#607)', async ({ page, api }) => {
  setUp(api, () => true);
  mockExport(api);
  await page.goto('/dashboard/town');
  await expect(row(page, 'Stonebridge')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByTestId('export-csv').click();
  const file = await download;

  expect(file.suggestedFilename()).toMatch(/^town-\d{4}-\d{2}-\d{2}\.csv$/);
  const lines = await csvLines(file);
  expect(lines[0]).toBe(await tableHeaderRow(page));
  expect(lines).toHaveLength(1 + towns.length);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
