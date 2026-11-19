import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { accessMetadata } from './fixtures/dashboardAccess';
import { noStepProgress, noValidationRules, savedProgress, workflowSession } from './fixtures/forms';
import {
  ammoForm,
  ammoFormMetadata,
  CONTENT,
  mockAmmoSearch,
  mockTemplateSearch,
  SIEGE,
  siegeMetadata,
  templateForm,
  templateFormMetadata,
} from './fixtures/siegeWeapons';
import type { PagedQueryDto } from '../src/types/dtos/common/PagedQuery';
import type { FieldValidationRuleDto } from '../src/types/dtos/forms/FieldValidationRuleDtos';
import type { FormConfigurationDto, FormSubmissionProgressDto } from '../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { SiegeAmmoTypeDto, SiegeWeaponTemplateDto } from '../src/types/dtos/siege/SiegeWeaponDtos';
import type { StepProgressReadDto, WorkflowSessionReadDto } from '../src/types/dtos/workflow/WorkflowDtos';

/**
 * Siege weapons in the web app (phase 1, PandiO/knk-workspace#782, acceptance A01, web part): the dashboard lists weapon
 * templates and ammo types through their search endpoints with their own columns, staff without the siege node don't
 * get the types, and the form wizard saves a template and an ammo type (with structure damage) through their POST
 * endpoints. Smoke test: knk-workspace docs/guides/siege-weapons-smoke-test.md § 1.
 */

const nodes = (...held: string[]) => (node: string) => held.includes(node);

test.beforeEach(async ({ page }) => {
  await startLoggedIn(page, 'access-1');
});

test.describe('dashboard', () => {
  test.beforeEach(async ({ api }) => {
    mockContentDefaults(api);
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [
      siegeMetadata('SiegeWeaponTemplate'), siegeMetadata('SiegeAmmoType'), accessMetadata('Category', CONTENT),
    ]);
    api.json<FormConfigurationDto[]>('GET', /^FormConfigurations\/(SiegeWeaponTemplate|SiegeAmmoType|Category)$/i, []);
    mockTemplateSearch(api);
    mockAmmoSearch(api);
  });

  test('lists the weapon templates with kind, size and prices', async ({ page, api }) => {
    mockSession(api, alex, nodes(SIEGE, CONTENT));
    await page.goto('/dashboard/SiegeWeaponTemplate');

    const table = page.getByRole('table');
    for (const header of ['Kind', 'Size', 'Match price', 'Unlock price', 'Ammo types']) {
      await expect(table.getByRole('columnheader', { name: header })).toBeVisible();
    }
    const trebuchet = table.getByRole('row').filter({ hasText: 'Trebuchet' });
    await expect(trebuchet).toContainText('Indirect');
    await expect(trebuchet).toContainText('Large');
    await expect(trebuchet).toContainText('800');
    await expect(table.getByRole('row').filter({ hasText: 'Ballista' })).toContainText('Direct');
  });

  test('the template search box asks the API with the search term', async ({ page, api }) => {
    mockSession(api, alex, nodes(SIEGE, CONTENT));
    await page.goto('/dashboard/SiegeWeaponTemplate');
    const table = page.getByRole('table');
    await expect(table.getByRole('row').filter({ hasText: 'Trebuchet' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Search...' }).fill('ballista');

    await expect(table.getByRole('row').filter({ hasText: 'Ballista' })).toBeVisible();
    await expect(table.getByRole('row').filter({ hasText: 'Trebuchet' })).toHaveCount(0);
    const terms = api.calls('POST', 'SiegeWeaponTemplates/search').map(r => (r.body as PagedQueryDto).searchTerm);
    expect(terms).toContain('ballista');
  });

  test('lists the ammo types with effect, damage and structure damage', async ({ page, api }) => {
    mockSession(api, alex, nodes(SIEGE, CONTENT));
    await page.goto('/dashboard/SiegeAmmoType');

    const table = page.getByRole('table');
    for (const header of ['Effect', 'Damage', 'Structure damage', 'Price per shot']) {
      await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
    }
    const boulder = table.getByRole('row').filter({ hasText: 'Heavy boulder' });
    await expect(boulder).toContainText('Impact');
    await expect(boulder).toContainText('120');
  });

  test('content-only staff do not get the siege weapon types', async ({ page, api }) => {
    mockSession(api, alex, nodes(CONTENT));
    await page.goto('/dashboard/SiegeWeaponTemplate');

    await expect(page).toHaveURL(/\/dashboard\/Category$/);
    await expect(page.getByRole('button', { name: /^SiegeWeaponTemplate/ })).toHaveCount(0);
    expect(api.calls('POST', 'SiegeWeaponTemplates/search')).toHaveLength(0);
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

  test('saves a weapon template through POST api/SiegeWeaponTemplates', async ({ page, api }) => {
    api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/SiegeWeaponTemplate', [templateForm]);
    api.json<FormConfigurationDto>('GET', `FormConfigurations/${templateForm.id}`, templateForm);
    api.json<EntityMetadataDto>('GET', 'Metadata/entities/SiegeWeaponTemplate', templateFormMetadata);
    api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${templateForm.id}`, noValidationRules);
    api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, templateForm));
    api.on<SiegeWeaponTemplateDto>('POST', /^SiegeWeaponTemplates\/?$/, ({ body }) => ({
      status: 201, body: { ...(body as SiegeWeaponTemplateDto), id: 3 },
    }));
    mockTemplateSearch(api);

    await page.goto('/forms/SiegeWeaponTemplate');
    await page.getByRole('button', { name: 'Use' }).click();
    await page.getByRole('textbox', { name: 'Name*' }).fill('Trebuchet');
    await page.getByRole('spinbutton', { name: 'Max range (blocks)' }).fill('120');
    await page.getByRole('spinbutton', { name: 'Start spread (blocks)' }).fill('8');
    await page.getByRole('spinbutton', { name: 'Minimum spread (blocks)' }).fill('3');
    await page.getByRole('spinbutton', { name: 'Unlock price (coins)' }).fill('5000');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect.poll(() => api.calls('POST', /^SiegeWeaponTemplates\/?$/).length).toBe(1);
    const [create] = api.calls('POST', /^SiegeWeaponTemplates\/?$/);
    // The wizard sends the form's field names; the API binds them without case (ASP.NET Core's web JSON defaults).
    expect(create.body).toMatchObject({ Name: 'Trebuchet', MaxRange: 120, StartSpreadRadius: 8, MinSpreadRadius: 3, UnlockPrice: 5000 });
  });

  test('saves an ammo type with its structure damage through POST api/SiegeAmmoTypes', async ({ page, api }) => {
    api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/SiegeAmmoType', [ammoForm]);
    api.json<FormConfigurationDto>('GET', `FormConfigurations/${ammoForm.id}`, ammoForm);
    api.json<EntityMetadataDto>('GET', 'Metadata/entities/SiegeAmmoType', ammoFormMetadata);
    api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${ammoForm.id}`, noValidationRules);
    api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, ammoForm));
    api.on<SiegeAmmoTypeDto>('POST', /^SiegeAmmoTypes\/?$/, ({ body }) => ({
      status: 201, body: { ...(body as SiegeAmmoTypeDto), id: 13 },
    }));
    mockAmmoSearch(api);

    await page.goto('/forms/SiegeAmmoType');
    await page.getByRole('button', { name: 'Use' }).click();
    await page.getByRole('textbox', { name: 'Name*' }).fill('Heavy boulder');
    await page.getByRole('spinbutton', { name: 'Player damage' }).fill('12');
    await page.getByRole('spinbutton', { name: 'Structure damage' }).fill('120');
    await page.getByRole('spinbutton', { name: 'Price per shot (siege points)' }).fill('20');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect.poll(() => api.calls('POST', /^SiegeAmmoTypes\/?$/).length).toBe(1);
    const [create] = api.calls('POST', /^SiegeAmmoTypes\/?$/);
    expect(create.body).toMatchObject({ Name: 'Heavy boulder', Damage: 12, StructureDamage: 120, PricePerShot: 20 });
  });
});
