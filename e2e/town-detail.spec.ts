import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { cinix, townDisplay, townMetadata, townStreetsHint } from './fixtures/towns';
import type { DisplayConfigurationDto } from '../src/types/dtos/displayConfig/DisplayModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { TownDto } from '../src/types/dtos/town/TownDto';

/**
 * The town detail page (/display/Town/4), PandiO/knk-workspace#409: a town's streets are the streets of its districts.
 * The Streets section lists them, offers no Add…, Unlink, Create New or Delete (even when the stored configuration
 * asks for them) and says where streets are changed.
 */

test.use({ strictApi: true });

test.beforeEach(async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  // A world admin with every node: nothing is hidden for lack of permission.
  mockSession(api, alex, () => true);
  mockContentDefaults(api);
  api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', townMetadata);
  api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Town', townDisplay);
  api.json<TownDto>('GET', 'Towns/4', cinix);
  // Realtime stays offline: the page works without live updates.
  api.on('POST', 'hubs/web/negotiate', { status: 404 });
});

const streetsSection = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Streets' });

test("lists the town's streets from its districts", async ({ page }) => {
  await page.goto('/display/Town/4');

  const list = streetsSection(page).getByRole('list', { name: 'Streets' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByRole('link', { name: 'Harbour Road' })).toBeVisible();
  await expect(list.getByRole('link', { name: 'Main Street' })).toBeVisible();
  await expect(list.getByRole('button', { name: 'View Main Street' })).toBeVisible();
  await expect(list.getByRole('button', { name: 'Edit Main Street' })).toBeVisible();
});

test('shows no Add…, Unlink, Create New or Delete on the streets', async ({ page }) => {
  await page.goto('/display/Town/4');
  const section = streetsSection(page);
  await expect(section.getByRole('link', { name: 'Main Street' })).toBeVisible();

  await expect(section.getByRole('button', { name: /Add…/ })).toHaveCount(0);
  await expect(section.getByRole('button', { name: /Unlink/ })).toHaveCount(0);
  await expect(section.getByRole('button', { name: /Delete/ })).toHaveCount(0);
  await expect(section.getByRole('button', { name: 'Create New' })).toHaveCount(0);
});

test('says the streets are managed on the district', async ({ page, api }) => {
  await page.goto('/display/Town/4');

  await expect(streetsSection(page).getByTestId('derived-hint')).toHaveText(townStreetsHint);
  await expect(streetsSection(page).getByText('Streets are managed on the district')).toBeVisible();
  // Nothing on the page tries to link or unlink a town's street.
  expect(api.calls('POST', /^Relationships\//)).toHaveLength(0);
});
