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
  spotForm,
  spotFormMetadata,
  spotRules,
  templateForm,
  templateFormMetadata,
} from './fixtures/siegeWeapons';
import type { PagedQueryDto } from '../src/types/dtos/common/PagedQuery';
import type {
  FieldValidationRuleDto,
  ValidateFieldRequestDto,
  ValidateFieldsBatchRequestDto,
  ValidateFieldsBatchResultDto,
  ValidationResultDto,
} from '../src/types/dtos/forms/FieldValidationRuleDtos';
import type { FormConfigurationDto, FormSubmissionProgressDto } from '../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { SiegeAmmoTypeDto, SiegeWeaponSpotDto, SiegeWeaponTemplateDto } from '../src/types/dtos/siege/SiegeWeaponDtos';
import type {
  StepProgressReadDto,
  WorkflowSessionReadDto,
  WorldTaskCreateDto,
  WorldTaskReadDto,
} from '../src/types/dtos/workflow/WorkflowDtos';

/**
 * Siege weapons in the web app (phase 1, PandiO/knk-workspace#782, acceptance A01, web part): the dashboard lists weapon
 * templates and ammo types through their search endpoints with their own columns, staff without the siege node don't
 * get the types, and the form wizard saves a template and an ammo type (with structure damage) through their POST
 * endpoints. Smoke test: knk-workspace docs/guides/siege-weapons-smoke-test.md § 1.
 *
 * The weapon spot form since PandiO/knk-workspace#988 (A02 web part): the spot is its WorldGuard region, drawn with the
 * normal region world task; the size rule shows the class for the chosen facing (or "too small", blocking) and the site
 * rule warns about the floor; the form saves the spot without bounds. Smoke test § 2.
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

test.describe('the weapon spot region (#988)', () => {
  const REGION = 'tempregion_worldtask_9001';
  // The game server's answers as the API passes them on: the region is 9 wide (x) x 17 high x 15 long (z), so Large
  // facing north and Medium turned east; the floor under it has 3 open blocks.
  const sizeAnswer = (region: string, facing: string): ValidationResultDto => {
    if (region === 'tiny_spot') {
      const reason = 'The region is too small for a weapon facing North: 5 wide x 5 long x 5 high, the small class needs at least 7 wide x 9 long x 5 high.';
      return { isValid: false, isBlocking: true, message: '{sizeReason}', placeholders: { sizeReason: reason } };
    }
    const sizeClass = facing === 'East' || facing === 'West' ? 'Medium' : 'Large';
    const dims = sizeClass === 'Large' ? '9 wide x 15 long x 17 high' : '15 wide x 9 long x 17 high';
    return { isValid: true, isBlocking: false, message: `Size class ${sizeClass}: the region is ${dims} facing ${facing}.` };
  };
  const siteWarning = "The floor isn't solid: 3 of 135 blocks under the spot are air or not solid, so a weapon would hang in the air.";
  const answer = (region: unknown, context: Record<string, unknown> | undefined): ValidationResultDto => {
    const r = String(region ?? '');
    if (!r) return { isValid: true, isBlocking: false, message: '' };
    const size = sizeAnswer(r, String(context?.Facing ?? 'North'));
    if (!size.isValid) return { ...size, placeholders: { ...size.placeholders, siteReason: siteWarning } };
    return { isValid: false, isBlocking: false, message: '{siteReason}', placeholders: { siteReason: `${size.message} ${siteWarning}` } };
  };

  test.beforeEach(async ({ api }) => {
    mockSession(api, alex, () => true);
    mockContentDefaults(api);
    api.json<StepProgressReadDto[]>('GET', 'Workflows/501/progress', noStepProgress);
    for (const method of ['POST', 'PUT'] as const) {
      api.on<FormSubmissionProgressDto>(method, /^FormSubmissionProgress(\/.*)?$/, ({ body }) => ({
        body: savedProgress(body as FormSubmissionProgressDto),
      }));
    }
    api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/SiegeWeaponSpot', [spotForm]);
    api.json<FormConfigurationDto>('GET', `FormConfigurations/${spotForm.id}`, spotForm);
    api.json<EntityMetadataDto>('GET', 'Metadata/entities/SiegeWeaponSpot', spotFormMetadata);
    api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${spotForm.id}`, spotRules);
    api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, spotForm));
    api.on<ValidationResultDto>('POST', 'field-validation-rules/validate', ({ body }) => {
      const request = body as ValidateFieldRequestDto;
      return { body: answer(request.fieldValue, request.formContextData) };
    });
    api.on<ValidateFieldsBatchResultDto>('POST', 'field-validation-rules/validate-batch', ({ body }) => {
      const request = body as ValidateFieldsBatchRequestDto;
      const results: Record<string, ValidationResultDto> = {};
      for (const item of request.fields) results[String(item.fieldId)] = answer(item.fieldValue, request.formContextData);
      return { body: { results } };
    });
  });

  test('draws the region with the region task, shows the size class for the facing and the site warning, and saves the spot', async ({ page, api }) => {
    const pending: WorldTaskReadDto = {
      id: 9001, workflowSessionId: 501, stepNumber: 0, fieldName: 'WgRegionId', taskType: 'ReagionCreate',
      status: 'Pending', linkCode: 'SPOT42', createdAt: '2026-11-22T12:00:00Z',
    };
    let completed = false;
    api.on<WorldTaskReadDto>('POST', /^WorldTasks\/?$/, ({ body }) => ({
      status: 201, body: { ...pending, inputJson: (body as WorldTaskCreateDto).inputJson },
    }));
    api.on<WorldTaskReadDto>('GET', 'WorldTasks/9001', () => ({
      body: completed
        ? { ...pending, status: 'Completed', claimedByMinecraftUsername: 'Alex', completedAt: '2026-11-22T12:01:00Z',
          outputJson: JSON.stringify({ regionId: REGION, worldName: 'siege' }) }
        : pending,
    }));
    api.on<WorldTaskReadDto>('POST', 'WorldTasks/9001/applied', () => ({ body: { ...pending, status: 'Completed' } }));
    api.on<SiegeWeaponSpotDto>('POST', /^SiegeScenarios\/3\/weapon-spots$/, ({ body }) => ({
      status: 201, body: { ...(body as SiegeWeaponSpotDto), id: 41, sizeClass: 'Medium' },
    }));

    await page.goto('/forms/SiegeWeaponSpot');
    await page.getByRole('button', { name: 'Use' }).click();
    await page.getByRole('spinbutton', { name: 'Scenario id' }).fill('3');
    await page.getByRole('textbox', { name: 'Name*' }).fill('East tower');
    // No bounds fields any more; the size class is read-only.
    await expect(page.getByRole('spinbutton', { name: 'Min X' })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Size class' })).toBeDisabled();

    // The normal region task on the region field, with its code for /knk task-claim.
    await page.getByRole('button', { name: 'Send to Minecraft' }).click();
    await expect.poll(() => api.calls('POST', /^WorldTasks\/?$/).length).toBe(1);
    expect(api.calls('POST', /^WorldTasks\/?$/)[0].body).toMatchObject({ fieldName: 'WgRegionId', taskType: 'ReagionCreate' });
    await expect(page.getByText('SPOT42').first()).toBeVisible();

    // The admin draws a box in game: the region field gets the temp region, and the rules answer.
    completed = true;
    await expect(page.getByRole('textbox', { name: /Region/ })).toHaveValue(REGION, { timeout: 10_000 });
    await expect(page.getByText(/Size class Large: the region is 9 wide x 15 long x 17 high facing North\./)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/The floor isn't solid: 3 of 135 blocks/)).toBeVisible();

    // Turning the weapon east re-runs the size check with the new facing.
    await page.getByRole('combobox', { name: 'Facing' }).selectOption('East');
    await page.getByRole('textbox', { name: /Region/ }).focus();
    await page.getByRole('textbox', { name: /Region/ }).blur();
    await expect(page.getByText(/Size class Medium: the region is 15 wide x 9 long x 17 high facing East\./)).toBeVisible({ timeout: 10_000 });

    // The site check is a warning: the spot saves.
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect.poll(() => api.calls('POST', /^SiegeScenarios\/3\/weapon-spots$/).length).toBe(1);
    const save = api.calls('POST', /^SiegeScenarios\/3\/weapon-spots$/)[0].body as Record<string, unknown>;
    expect(save).toMatchObject({ Name: 'East tower', Facing: 'East', WgRegionId: REGION });
    for (const gone of ['MinX', 'MinY', 'MinZ', 'MaxX', 'MaxY', 'MaxZ']) expect(save).not.toHaveProperty(gone);
  });

  test('a region smaller than the small class blocks Submit with the reason', async ({ page, api }) => {
    await page.goto('/forms/SiegeWeaponSpot');
    await page.getByRole('button', { name: 'Use' }).click();
    await page.getByRole('spinbutton', { name: 'Scenario id' }).fill('3');
    await page.getByRole('textbox', { name: 'Name*' }).fill('Tiny');
    await page.getByRole('textbox', { name: /Region/ }).fill('tiny_spot');
    await page.getByRole('textbox', { name: /Region/ }).blur();

    const reason = /The region is too small for a weapon facing North: 5 wide x 5 long x 5 high/;
    await expect(page.getByText(reason).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByRole('alert', { name: /^fix (this problem|these \d+ problems) to continue$/i })).toBeVisible();
    expect(api.calls('POST', /^SiegeScenarios\/3\/weapon-spots$/)).toHaveLength(0);
  });
});
