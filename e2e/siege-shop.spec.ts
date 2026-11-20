import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { accessMetadata } from './fixtures/dashboardAccess';
import { noStepProgress, noValidationRules, savedProgress, workflowSession } from './fixtures/forms';
import { CONTENT, SIEGE, siegeMetadata } from './fixtures/siegeWeapons';
import {
  categoryForm,
  categoryFormMetadata,
  entryForm,
  entryFormMetadata,
  mockCategorySearch,
  mockEntrySearch,
} from './fixtures/siegeShop';
import type { PagedQueryDto } from '../src/types/dtos/common/PagedQuery';
import type { FieldValidationRuleDto } from '../src/types/dtos/forms/FieldValidationRuleDtos';
import type { FormConfigurationDto, FormSubmissionProgressDto } from '../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { SiegeShopCategoryDto, SiegeShopEntryDto } from '../src/types/dtos/siege/SiegeShopDtos';
import type { StepProgressReadDto, WorkflowSessionReadDto } from '../src/types/dtos/workflow/WorkflowDtos';

/**
 * Siege shop catalogue in the web app (PandiO/knk-workspace#867, acceptance A13, web part): the dashboard lists shop
 * categories and entries (both modes' defaults and scenario-only entries) through their search endpoints with their own
 * columns, staff without the siege node don't get the types, and the form wizard saves a category and an entry through
 * their POST endpoints. Smoke test: knk-workspace docs/guides/siege-shop-smoke-test.md § 2.
 */

const nodes = (...held: string[]) => (node: string) => held.includes(node);

test.beforeEach(async ({ page }) => {
  await startLoggedIn(page, 'access-1');
});

test.describe('dashboard', () => {
  test.beforeEach(async ({ api }) => {
    mockContentDefaults(api);
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [
      siegeMetadata('SiegeShopCategory'), siegeMetadata('SiegeShopEntry'), accessMetadata('Category', CONTENT),
    ]);
    api.json<FormConfigurationDto[]>('GET', /^FormConfigurations\/(SiegeShopCategory|SiegeShopEntry|Category)$/i, []);
    mockCategorySearch(api);
    mockEntrySearch(api);
  });

  test('lists the shop entries of both modes with category, kind, price and cap', async ({ page, api }) => {
    mockSession(api, alex, nodes(SIEGE, CONTENT));
    await page.goto('/dashboard/SiegeShopEntry');

    const table = page.getByRole('table');
    for (const header of ['Mode', 'Scenario', 'Category', 'Kind', 'Price', 'Max per match', 'Enabled']) {
      await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
    }
    const pearl = table.getByRole('row').filter({ hasText: 'Ender Pearl' });
    await expect(pearl.filter({ hasText: 'PvP Siege' })).toContainText('300');
    await expect(pearl.filter({ hasText: 'Siege Survival' })).toContainText('3000');
    // A weapon entry without a price uses its template's match price (A16).
    await expect(table.getByRole('row').filter({ hasText: 'Trebuchet' })).toContainText('Template price');
    const scenarioOnly = table.getByRole('row').filter({ hasText: 'Arrow x16' });
    await expect(scenarioOnly).toContainText('Siege of Cinix');
    await expect(scenarioOnly).toContainText('No');
  });

  test('the entry search box asks the API with the search term', async ({ page, api }) => {
    mockSession(api, alex, nodes(SIEGE, CONTENT));
    await page.goto('/dashboard/SiegeShopEntry');
    const table = page.getByRole('table');
    await expect(table.getByRole('row').filter({ hasText: 'Trebuchet' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Search...' }).fill('potion');

    await expect(table.getByRole('row').filter({ hasText: 'Splash Potion of Healing II' })).toBeVisible();
    await expect(table.getByRole('row').filter({ hasText: 'Trebuchet' })).toHaveCount(0);
    const terms = api.calls('POST', 'SiegeShopEntries/search').map(r => (r.body as PagedQueryDto).searchTerm);
    expect(terms).toContain('potion');
  });

  test('lists the seeded categories with their keys', async ({ page, api }) => {
    mockSession(api, alex, nodes(SIEGE, CONTENT));
    await page.goto('/dashboard/SiegeShopCategory');

    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'Key' })).toBeVisible();
    for (const key of ['siege-weapons', 'consumables', 'magic']) {
      await expect(table.getByRole('row').filter({ hasText: key })).toBeVisible();
    }
  });

  test('content-only staff do not get the shop types', async ({ page, api }) => {
    mockSession(api, alex, nodes(CONTENT));
    await page.goto('/dashboard/SiegeShopEntry');

    await expect(page).toHaveURL(/\/dashboard\/Category$/);
    await expect(page.getByRole('button', { name: /^SiegeShopEntry/ })).toHaveCount(0);
    expect(api.calls('POST', 'SiegeShopEntries/search')).toHaveLength(0);
  });
});

test.describe('the form wizard', () => {
  test.beforeEach(async ({ api }) => {
    mockSession(api, alex, () => true);
    mockContentDefaults(api);
    api.json<StepProgressReadDto[]>('GET', 'Workflows/501/progress', noStepProgress);
    for (const method of ['POST', 'PUT'] as const) {
      api.on<FormSubmissionProgressDto>(method, /^FormSubmissionProgress(\/.*)?$/, ({ body }) => ({
        body: savedProgress(body as FormSubmissionProgressDto),
      }));
    }
  });

  test('saves a shop category through POST api/SiegeShopCategories', async ({ page, api }) => {
    api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/SiegeShopCategory', [categoryForm]);
    api.json<FormConfigurationDto>('GET', `FormConfigurations/${categoryForm.id}`, categoryForm);
    api.json<EntityMetadataDto>('GET', 'Metadata/entities/SiegeShopCategory', categoryFormMetadata);
    api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${categoryForm.id}`, noValidationRules);
    api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, categoryForm));
    api.on<SiegeShopCategoryDto>('POST', /^SiegeShopCategories\/?$/, ({ body }) => ({
      status: 201, body: { ...(body as SiegeShopCategoryDto), id: 4 },
    }));
    mockCategorySearch(api);

    await page.goto('/forms/SiegeShopCategory');
    await page.getByRole('button', { name: 'Use' }).click();
    await page.getByRole('textbox', { name: 'Key*' }).fill('traps');
    await page.getByRole('textbox', { name: 'Name*' }).fill('Traps');
    await page.getByRole('textbox', { name: 'Icon' }).fill('minecraft:tripwire_hook');
    await page.getByRole('spinbutton', { name: 'Order' }).fill('3');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect.poll(() => api.calls('POST', /^SiegeShopCategories\/?$/).length).toBe(1);
    const [create] = api.calls('POST', /^SiegeShopCategories\/?$/);
    // The wizard sends the form's field names; the API binds them without case (ASP.NET Core's web JSON defaults).
    expect(create.body).toMatchObject({ Key: 'traps', Name: 'Traps', IconMaterial: 'minecraft:tripwire_hook', SortOrder: 3 });
  });

  test('saves a shop entry with its price and brakes through POST api/SiegeShopEntries', async ({ page, api }) => {
    api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/SiegeShopEntry', [entryForm]);
    api.json<FormConfigurationDto>('GET', `FormConfigurations/${entryForm.id}`, entryForm);
    api.json<EntityMetadataDto>('GET', 'Metadata/entities/SiegeShopEntry', entryFormMetadata);
    api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${entryForm.id}`, noValidationRules);
    api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, entryForm));
    api.on<SiegeShopEntryDto>('POST', /^SiegeShopEntries\/?$/, ({ body }) => ({
      status: 201, body: { ...(body as SiegeShopEntryDto), id: 20 },
    }));
    mockEntrySearch(api);

    await page.goto('/forms/SiegeShopEntry');
    await page.getByRole('button', { name: 'Use' }).click();
    await page.getByRole('textbox', { name: 'Display name' }).fill('Pearl');
    await page.getByRole('spinbutton', { name: 'Price', exact: true }).fill('300');
    await page.getByRole('spinbutton', { name: 'Price step' }).fill('50');
    await page.getByRole('spinbutton', { name: 'Cooldown (seconds)' }).fill('20');
    await page.getByRole('spinbutton', { name: 'Max per match' }).fill('8');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect.poll(() => api.calls('POST', /^SiegeShopEntries\/?$/).length).toBe(1);
    const [create] = api.calls('POST', /^SiegeShopEntries\/?$/);
    expect(create.body).toMatchObject({ DisplayName: 'Pearl', Price: 300, PriceStep: 50, CooldownSeconds: 20, MaxPerMatch: 8 });
  });
});
