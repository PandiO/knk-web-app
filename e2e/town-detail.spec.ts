import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { cinix, townDisplay, townMetadata, townStreetsHint } from './fixtures/towns';
import { mockNoTownTerritory } from './fixtures/territory';
import type { DisplayConfigurationDto } from '../src/types/dtos/displayConfig/DisplayModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { TownDto } from '../src/types/dtos/town/TownDto';
import { mockNoTownLogistics } from './fixtures/logistics';
import { mockNoTownAccount, phoenixAccount } from './fixtures/shops';
import type { TownAccountDto } from '../src/types/dtos/production/ShopDtos';

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
  // The territory panel below the details (PandiO/knk-workspace#690): empty here; e2e/territory.spec.ts covers it.
  mockNoTownTerritory(api, 4);
  mockNoTownLogistics(api, 4);
  // The town account summary (PandiO/knk-workspace#938): none yet; the tests at the end cover it.
  mockNoTownAccount(api, 4);
  // The landmark list below the details (PandiO/knk-workspace#708): none here; e2e/landmarks.spec.ts covers it.
  api.on('POST', 'landmarks/search', { body: { items: [], totalCount: 0, page: 1, pageSize: 100, totalPages: 0 } });
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

// ---- the town's account (PandiO/knk-workspace#938; shops DESIGN § 3.1) ----

test("shows the town's account: its coins, the ledger check and a link to the ledger", async ({ page, api }) => {
  api.json<TownAccountDto>('GET', 'TownAccounts/by-town/4', phoenixAccount({ id: 8, townId: 4, coins: 1250 }));
  await page.goto('/display/Town/4');

  const summary = page.getByRole('region', { name: 'Town account' });
  await expect(summary.getByTestId('town-account-summary-coins')).toHaveText('1,250 coins');
  await expect(summary.getByText('Matches the last ledger entry')).toBeVisible();
  await expect(summary.getByRole('link', { name: 'Open the ledger' })).toHaveAttribute('href', /^\/display\/TownAccount\/8/);
});

test('flags a town account that does not match its ledger', async ({ page, api }) => {
  api.json<TownAccountDto>('GET', 'TownAccounts/by-town/4', phoenixAccount({ id: 8, townId: 4, reconciled: false, ledgerBalance: 1200 }));
  await page.goto('/display/Town/4');

  await expect(page.getByRole('region', { name: 'Town account' })).toContainText('Does not match: the ledger says 1,200 coins');
});

test('a town without an account yet says it opens with the first shop sale', async ({ page }) => {
  await page.goto('/display/Town/4');

  await expect(page.getByRole('region', { name: 'Town account' }))
    .toContainText('No account yet: it opens with the first shop sale in this town.');
});

test('without knk.admin.world the town account is not shown and not read', async ({ page, api }) => {
  mockSession(api, alex, node => node !== 'knk.admin.world');
  await page.goto('/display/Town/4');

  await expect(streetsSection(page).getByRole('link', { name: 'Main Street' })).toBeVisible();
  await expect(page.getByTestId('town-account-summary')).toHaveCount(0);
  expect(api.calls('GET', 'TownAccounts/by-town/4')).toHaveLength(0);
});
