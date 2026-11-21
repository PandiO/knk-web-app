import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { accessMetadata, WORLD } from './fixtures/dashboardAccess';
import { noStepProgress, noValidationRules, savedProgress, workflowSession } from './fixtures/forms';
import {
  CONTENT,
  LANDMARK,
  landmarkForm,
  landmarkFormMetadata,
  landmarkMetadata,
  landmarkRows,
  mockLandmarkSearch,
} from './fixtures/landmarks';
import { cinix, townDisplay, townMetadata } from './fixtures/towns';
import { mockNoTownTerritory } from './fixtures/territory';
import type { PagedQueryDto } from '../src/types/dtos/common/PagedQuery';
import type { DisplayConfigurationDto } from '../src/types/dtos/displayConfig/DisplayModels';
import type { FieldValidationRuleDto } from '../src/types/dtos/forms/FieldValidationRuleDtos';
import type { FormConfigurationDto, FormSubmissionProgressDto } from '../src/types/dtos/forms/FormModels';
import type { LandmarkDto } from '../src/types/dtos/landmark/LandmarkDtos';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { TownDto } from '../src/types/dtos/town/TownDto';
import type { StepProgressReadDto, WorkflowSessionReadDto } from '../src/types/dtos/workflow/WorkflowDtos';
import { mockNoTownLogistics } from './fixtures/logistics';

/**
 * Landmarks in the web app (off-road navigation phase 5.1, PandiO/knk-workspace#708, acceptance A12, web part): the
 * dashboard lists them through api/landmarks/search with their own columns, the search asks the API, staff without the
 * World area don't see the type, a town's page lists the landmarks linked to it, and the form saves through
 * POST api/landmarks. Smoke test: knk-workspace docs/guides/navigation-offroad-smoke-test.md "Phase 5.1".
 */

const nodes = (...held: string[]) => (node: string) => held.includes(node);

test.beforeEach(async ({ page }) => {
  await startLoggedIn(page, 'access-1');
});

test.describe('dashboard', () => {
  test.beforeEach(async ({ api }) => {
    mockContentDefaults(api);
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [landmarkMetadata, accessMetadata('Category', CONTENT)]);
    api.json<FormConfigurationDto[]>('GET', /^FormConfigurations\/(Landmark|Category)$/i, []);
    mockLandmarkSearch(api);
  });

  test('lists the landmarks with world, point, domain, area and /navigate', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, CONTENT, LANDMARK));
    await page.goto('/dashboard/Landmark');

    const table = page.getByRole('table');
    for (const header of ['World', 'Point', 'Domain', 'Area', 'In /navigate']) {
      await expect(table.getByRole('columnheader', { name: header })).toBeVisible();
    }
    const throne = table.getByRole('row').filter({ hasText: 'Throne room' });
    await expect(throne).toContainText('100 72 -41');
    await expect(throne).toContainText('Cinix (Town)');
    await expect(throne).toContainText('Region');
    const well = table.getByRole('row').filter({ hasText: 'Market well' });
    await expect(well).toContainText('Radius');
    await expect(well).toContainText('No');
    await expect(table.getByRole('row').filter({ hasText: 'Nether portal' })).toContainText('world_nether');
  });

  test('the search box asks the API with the search term', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, CONTENT, LANDMARK));
    await page.goto('/dashboard/Landmark');
    const table = page.getByRole('table');
    await expect(table.getByRole('row').filter({ hasText: 'Throne room' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Search...' }).fill('nether');

    await expect(table.getByRole('row').filter({ hasText: 'Nether portal' })).toBeVisible();
    await expect(table.getByRole('row').filter({ hasText: 'Throne room' })).toHaveCount(0);
    const terms = api.calls('POST', 'landmarks/search').map(r => (r.body as PagedQueryDto).searchTerm);
    expect(terms).toContain('nether');
  });

  test('content-only staff do not get the landmark type', async ({ page, api }) => {
    mockSession(api, alex, nodes(CONTENT));
    await page.goto('/dashboard/Landmark');

    await expect(page).toHaveURL(/\/dashboard\/Category$/);
    await expect(page.getByRole('button', { name: /^Landmark/ })).toHaveCount(0);
    expect(api.calls('POST', 'landmarks/search')).toHaveLength(0);
  });
});

test.describe("a town's page", () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    mockContentDefaults(api);
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [...townMetadata, landmarkMetadata]);
    api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Town', townDisplay);
    api.json<TownDto>('GET', 'Towns/4', cinix);
    mockLandmarkSearch(api);
    // The territory panel below the details (PandiO/knk-workspace#690): empty here; e2e/territory.spec.ts covers it.
    mockNoTownTerritory(api, 4);
    mockNoTownLogistics(api, 4);
  });

  test('lists the landmarks linked to the town, each linking to its page', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    await page.goto('/display/Town/4');

    const section = page.getByRole('region', { name: 'Landmarks' });
    const list = section.getByRole('list', { name: 'Landmarks' });
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await expect(list.getByRole('link', { name: 'Throne room' })).toHaveAttribute('href', /\/display\/Landmark\/1\?returnTo=/);
    await expect(list.getByRole('listitem').filter({ hasText: 'Market well' })).toContainText('not in /navigate');
    await expect(section.getByRole('button', { name: 'Add landmark' })).toBeEnabled();

    const [search] = api.calls('POST', 'landmarks/search');
    expect((search.body as PagedQueryDto & { filters: Record<string, string> }).filters).toEqual({ domainId: '4' });
  });

  test('Add landmark needs the landmark node, and says which', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, CONTENT));
    await page.goto('/display/Town/4');

    const add = page.getByRole('region', { name: 'Landmarks' }).getByRole('button', { name: 'Add landmark' });
    await expect(add).toBeDisabled();
    await expect(add).toHaveAttribute('title', `Requires ${LANDMARK}`);
  });

  test('says when no landmark is linked', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    api.on('POST', 'landmarks/search', { body: { items: [], totalCount: 0, page: 1, pageSize: 100, totalPages: 0 } });
    await page.goto('/display/Town/4');

    await expect(page.getByRole('region', { name: 'Landmarks' })).toContainText(`No landmarks are linked to ${cinix.name}.`);
  });
});

test('the landmark form saves through POST api/landmarks', async ({ page, api }) => {
  mockSession(api, alex, () => true);
  mockContentDefaults(api);
  api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/Landmark', [landmarkForm]);
  api.json<FormConfigurationDto>('GET', `FormConfigurations/${landmarkForm.id}`, landmarkForm);
  api.json<EntityMetadataDto>('GET', 'Metadata/entities/Landmark', landmarkFormMetadata);
  api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${landmarkForm.id}`, noValidationRules);
  api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, landmarkForm));
  api.json<StepProgressReadDto[]>('GET', 'Workflows/501/progress', noStepProgress);
  for (const method of ['POST', 'PUT'] as const) {
    api.on<FormSubmissionProgressDto>(method, /^FormSubmissionProgress(\/.*)?$/, ({ body }) => ({
      body: savedProgress(body as FormSubmissionProgressDto),
    }));
  }
  api.on<LandmarkDto>('POST', /^landmarks\/?$/, ({ body }) => ({ status: 201, body: { ...(body as LandmarkDto), id: 9 } }));
  mockLandmarkSearch(api, landmarkRows);

  await page.goto('/forms/Landmark');
  await page.getByRole('button', { name: 'Use' }).click();
  await page.getByRole('textbox', { name: 'Name*' }).fill('Great hall');
  await page.getByRole('spinbutton', { name: 'Radius (blocks)' }).fill('12');
  await page.getByRole('spinbutton', { name: 'Route preference' }).fill('0.8');
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect.poll(() => api.calls('POST', /^landmarks\/?$/).length).toBe(1);
  const [create] = api.calls('POST', /^landmarks\/?$/);
  // The wizard sends the form's field names; the API binds them without case (ASP.NET Core's web JSON defaults).
  expect(create.body).toMatchObject({ Name: 'Great hall', Radius: 12, Preference: 0.8 });
});
