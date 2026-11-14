import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { mockDashboardTypes } from './fixtures/dashboardAccess';
import { mockPlayerSearch, playerRow } from './fixtures/players';
import type { DisplayConfigurationDto } from '../src/types/dtos/displayConfig/DisplayModels';
import type { StreetDto } from '../src/types/dtos/street/StreetDto';

/**
 * The shared table, pager and dialogs in the browser (PandiO/knk-workspace#187, #33): sorting and paging in the
 * URL, the row link and the row click, the delete question's focus and Escape, and numbers in the browser's
 * language. Smoke tests: knk-workspace docs/guides/data-primitives-smoke-test.md and feedback-primitives-smoke-test.md
 * (backfill #511).
 */

const manyStreets: StreetDto[] = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Street ${String(i + 1).padStart(2, '0')}` }));

const streetDisplay: DisplayConfigurationDto = {
  id: '12',
  name: 'Street display',
  entityTypeName: 'Street',
  isDefault: true,
  isDraft: false,
  sections: [{ sectionGuid: 's0', sectionName: 'Street', isReusable: false, isLinkedToSource: false, isCollection: false, fields: [], subSections: [] }],
};

test.beforeEach(async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex, () => true);
  mockContentDefaults(api);
  api.json<DisplayConfigurationDto[]>('GET', /^DisplayConfigurations\/?$/, [streetDisplay]);
  api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Street', streetDisplay);
  api.on<StreetDto>('GET', /^Streets\/\d+$/, ({ path }) => ({ body: manyStreets[Number(path.split('/')[1]) - 1] }));
});

test('a header sorts ascending, descending, then off, with the URL following; Enter on a header sorts too', async ({ page, api }) => {
  mockDashboardTypes(api, [...manyStreets]);
  await page.goto('/dashboard/Street');
  const name = page.getByRole('columnheader', { name: /Name/ });

  await name.getByRole('button').click();
  await expect(name).toHaveAttribute('aria-sort', 'ascending');
  await expect(page).toHaveURL(/sort=name/);
  await name.getByRole('button').click();
  await expect(name).toHaveAttribute('aria-sort', 'descending');
  await expect(page).toHaveURL(/dir=desc/);
  await name.getByRole('button').click();
  await expect(page).not.toHaveURL(/sort=/);

  await name.getByRole('button').focus();
  await page.keyboard.press('Enter');
  await expect(name).toHaveAttribute('aria-sort', 'ascending');
});

test('Next and Previous page the table with "Page 2 of 3" and ?page=2', async ({ page, api }) => {
  mockDashboardTypes(api, [...manyStreets]);
  await page.goto('/dashboard/Street');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Page 2 of 3')).toBeVisible();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('row').filter({ hasText: 'Street 11' })).toBeVisible();
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.getByText('Page 1 of 3')).toBeVisible();
});

test('the first cell is a link to the detail page; Back returns to the same page and sort', async ({ page, api }) => {
  mockDashboardTypes(api, [...manyStreets]);
  await page.goto('/dashboard/Street?page=2&sort=name&dir=desc');
  await expect(page.getByText('Page 2 of 3')).toBeVisible();

  await page.getByRole('table').getByRole('link').first().click();
  await expect(page).toHaveURL(/\/display\/Street\/\d+/);
  await page.goBack();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/sort=name&dir=desc/);
  await expect(page.getByText('Page 2 of 3')).toBeVisible();
});

test('a click elsewhere on a row opens it; the row\'s Delete opens only the delete question', async ({ page, api }) => {
  mockDashboardTypes(api, [...manyStreets]);
  await page.goto('/dashboard/Street');
  const row = page.getByRole('row').filter({ hasText: 'Street 01' });

  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: 'Delete Street "Street 01"?' })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/Street/);
  await page.keyboard.press('Escape');

  await row.getByRole('cell').filter({ hasText: 'Street 01' }).click();
  await expect(page).toHaveURL(/\/display\/Street\/1/);
});

test('the delete question starts on Cancel, keeps Tab inside, and Escape closes it with focus back on its button', async ({ page, api }) => {
  mockDashboardTypes(api, [...manyStreets]);
  await page.goto('/dashboard/Street');
  const deleteButton = page.getByRole('row').filter({ hasText: 'Street 01' }).getByRole('button', { name: 'Delete', exact: true });

  await deleteButton.click();
  const question = page.getByRole('alertdialog', { name: 'Delete Street "Street 01"?' });
  await expect(question.getByRole('button', { name: 'Cancel' })).toBeFocused();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    await expect(question.locator(':focus')).toHaveCount(1);
  }
  await page.keyboard.press('Escape');
  await expect(question).toHaveCount(0);
  await expect(deleteButton).toBeFocused();
  expect(api.requests.filter(r => r.method === 'DELETE')).toHaveLength(0);
});

test.describe('in a Dutch browser', () => {
  test.use({ locale: 'nl-NL' });

  test('coins and XP on the moderation list read 12.345', async ({ page, api }) => {
    mockPlayerSearch(api, [playerRow(42, 'Steve', 12345)]);
    await page.goto('/admin/users?tab=all');
    const row = page.getByRole('table', { name: 'All players' }).getByRole('row').filter({ hasText: 'Steve' });
    await expect(row).toContainText('12.345');
    await expect(row).toContainText('24.690');
  });
});

test('in an English browser the same numbers read 12,345', async ({ page, api }) => {
  mockPlayerSearch(api, [playerRow(42, 'Steve', 12345)]);
  await page.goto('/admin/users?tab=all');
  await expect(page.getByRole('table', { name: 'All players' }).getByRole('row').filter({ hasText: 'Steve' })).toContainText('12,345');
});
