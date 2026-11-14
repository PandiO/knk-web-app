import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import type { PagedQueryDto, PagedResultDto } from '../src/types/dtos/common/PagedQuery';
import type { FormConfigurationDto } from '../src/types/dtos/forms/FormModels';
import type { TownDto } from '../src/types/dtos/town/TownDto';

/**
 * The dashboard's entity list (/dashboard/town): the table shows the page the API returns, and the
 * search box asks the API again with the search term.
 */

const towns: TownDto[] = [
  { id: 1, name: 'Eldoria', allowEntry: true, requiredTitle: 0, worldName: 'world' },
  { id: 2, name: 'Brightwater', allowEntry: false, requiredTitle: 0, worldName: 'world_nether' },
  { id: 3, name: 'Stonebridge', allowEntry: true, requiredTitle: 0, worldName: 'world' },
];

function pageOf(items: TownDto[], query: PagedQueryDto): PagedResultDto<TownDto> {
  return { items, totalCount: items.length, page: query.page, pageSize: query.pageSize, totalPages: 1 };
}

test.beforeEach(async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex, () => true);
  mockContentDefaults(api);
  api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/town', []);
  api.on<PagedResultDto<TownDto>>('POST', 'Towns/search', ({ body }) => {
    const query = body as PagedQueryDto;
    const term = (query.searchTerm ?? '').toLowerCase();
    return { body: pageOf(towns.filter(t => t.name.toLowerCase().includes(term)), query) };
  });
});

test('lists the towns the API returns', async ({ page }) => {
  await page.goto('/dashboard/town');

  await expect(page.getByRole('heading', { name: 'Town', level: 2 })).toBeVisible();
  const table = page.getByRole('table');
  for (const town of towns) {
    await expect(table.getByRole('row').filter({ hasText: town.name })).toBeVisible();
  }
  await expect(page.getByText('Export takes all 3 results')).toBeVisible();
});

test('the search box asks the API with the search term', async ({ page, api }) => {
  await page.goto('/dashboard/town');
  const table = page.getByRole('table');
  await expect(table.getByRole('row').filter({ hasText: 'Eldoria' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Search...' }).fill('bright');

  await expect(table.getByRole('row').filter({ hasText: 'Brightwater' })).toBeVisible();
  await expect(table.getByRole('row').filter({ hasText: 'Eldoria' })).toHaveCount(0);
  const searches = api.calls('POST', 'Towns/search').map(r => (r.body as PagedQueryDto).searchTerm);
  expect(searches).toContain('bright');
});
