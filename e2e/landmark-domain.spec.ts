import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { accessMetadata, WORLD } from './fixtures/dashboardAccess';
import { noStepProgress, noValidationRules, savedProgress, workflowSession } from './fixtures/forms';
import {
  domainRows,
  landmarkDomainForm,
  landmarkDomainFormMetadata,
  landmarkMetadata,
  landmarkRows,
  mockDomainSearch,
  mockLandmarkSearch,
  throneRoom,
} from './fixtures/landmarks';
import { generalDisplay } from './fixtures/territory';
import type { PagedQueryDto } from '../src/types/dtos/common/PagedQuery';
import type { DisplayConfigurationDto } from '../src/types/dtos/displayConfig/DisplayModels';
import type { DomainDto } from '../src/types/dtos/domain/DomainDtos';
import type { FieldValidationRuleDto } from '../src/types/dtos/forms/FieldValidationRuleDtos';
import type { FormConfigurationDto, FormFieldDto, FormStepDto, FormSubmissionProgressDto } from '../src/types/dtos/forms/FormModels';
import type { LandmarkDto, LandmarkListDto } from '../src/types/dtos/landmark/LandmarkDtos';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { StepProgressReadDto, WorkflowSessionReadDto, WorldTaskCreateDto, WorldTaskReadDto } from '../src/types/dtos/workflow/WorkflowDtos';
import { FieldType } from '../src/utils/enums';

/**
 * Landmarks as a Domain subtype in the web app (landmark-domain phase 4, PandiO/knk-workspace#986; knk-workspace
 * docs/specs/landmark-domain/DESIGN.md § 4.1, § 4.3, § 6.3; smoke test docs/guides/landmark-domain-smoke-test.md § 4):
 * the domain list's type column and filter (A07), a landmark row opening as a landmark (§ 4.3), the landmark form's area
 * steps (A17), the parent picker with the type and without the landmark's own subtree (A18), the child landmarks on a
 * landmark's page, and a drawn region's bounds filling a production area's empty bounds (PandiO/knk-workspace#951).
 */

const parentPicker = (page: import('@playwright/test').Page) => page.getByRole('combobox', { name: /Parent$/ });

const domainMetadata: EntityMetadataDto = { ...accessMetadata('Domain', WORLD), displayName: 'Domain' };

test.beforeEach(async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex, () => true);
  mockContentDefaults(api);
});

test.describe('the domain list', () => {
  test.beforeEach(async ({ api }) => {
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [domainMetadata, landmarkMetadata]);
    api.json<FormConfigurationDto[]>('GET', /^FormConfigurations\/(Domain|Landmark)$/i, []);
    mockDomainSearch(api);
  });

  test('shows each domain with its type, and the type filter keeps one type (A07)', async ({ page, api }) => {
    await page.goto('/dashboard/Domain');

    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    await expect(table.getByRole('row').filter({ hasText: 'Cinix' })).toContainText('Town');
    await expect(table.getByRole('row').filter({ hasText: 'East gate' })).toContainText('Gate');
    await expect(table.getByRole('row').filter({ hasText: 'Throne room' })).toContainText('Landmark');

    await page.getByRole('combobox', { name: 'Domain type filter' }).selectOption({ label: 'Landmark' });

    await expect(table.getByRole('row').filter({ hasText: 'Cinix' })).toHaveCount(0);
    await expect(table.getByRole('row').filter({ hasText: 'Throne room' })).toBeVisible();
    await expect(table.getByRole('row').filter({ hasText: 'Nether portal' })).toBeVisible();
    const filters = api.calls('POST', 'Domains/search').map(r => (r.body as PagedQueryDto & { filters?: Record<string, string> }).filters);
    expect(filters).toContainEqual(expect.objectContaining({ domainType: 'Landmark' }));
  });

  test('edits a landmark with the landmark form, and a town with the domain form (DESIGN § 4.3)', async ({ page }) => {
    await page.goto('/dashboard/Domain');
    const table = page.getByRole('table');

    await table.getByRole('row').filter({ hasText: 'Throne room' }).getByRole('button', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/forms\/Landmark\/edit\/1(\?|$)/);

    await page.goto('/dashboard/Domain');
    await page.getByRole('table').getByRole('row').filter({ hasText: 'Cinix' }).getByRole('button', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/forms\/Domain\/edit\/4(\?|$)/);
  });
});

test.describe("a landmark's page", () => {
  test.use({ strictApi: true });

  test("lists its child landmarks, not the landmark itself", async ({ page, api }) => {
    const rows: LandmarkListDto[] = [
      ...landmarkRows,
      {
        id: 5, name: 'Dais', world: 'world', x: 101, y: 73, z: -40, parentDomainId: 1, parentDomainName: 'Throne room',
        parentDomainType: 'Landmark', areaKind: 'None', wgRegionId: null, preference: 1, navigationEnabled: true, kind: 'General',
      },
    ];
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [landmarkMetadata]);
    api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Landmark', generalDisplay('Landmark', '61'));
    api.json<LandmarkDto>('GET', 'landmarks/1', throneRoom);
    mockLandmarkSearch(api, rows);

    await page.goto('/display/Landmark/1');

    const list = page.getByRole('region', { name: 'Landmarks' }).getByRole('list', { name: 'Landmarks' });
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await expect(list.getByRole('link', { name: 'Dais' })).toHaveAttribute('href', /\/display\/Landmark\/5\?returnTo=/);
    await expect(list.getByRole('link', { name: 'Throne room' })).toHaveCount(0);
    const [search] = api.calls('POST', 'landmarks/search');
    expect((search.body as PagedQueryDto & { filters: Record<string, string> }).filters).toEqual({ parentDomainId: '1' });
  });
});

test.describe('the landmark form', () => {
  test.beforeEach(async ({ api }) => {
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [landmarkMetadata, domainMetadata]);
    api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/Landmark', [landmarkDomainForm]);
    api.json<FormConfigurationDto>('GET', `FormConfigurations/${landmarkDomainForm.id}`, landmarkDomainForm);
    api.json<EntityMetadataDto>('GET', 'Metadata/entities/Landmark', landmarkDomainFormMetadata);
    api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${landmarkDomainForm.id}`, noValidationRules);
    api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, landmarkDomainForm));
    api.json<StepProgressReadDto[]>('GET', 'Workflows/501/progress', noStepProgress);
    for (const method of ['POST', 'PUT'] as const) {
      api.on<FormSubmissionProgressDto>(method, /^FormSubmissionProgress(\/.*)?$/, ({ body }) => ({
        body: savedProgress(body as FormSubmissionProgressDto),
      }));
    }
    api.on('GET', /^DisplayConfigurations\/entity\/Domain$/, { status: 404, body: { error: 'NotFound' } });
    api.json<DomainDto>('GET', 'Domains/4', { id: 4, name: 'Cinix', description: 'A town', wgRegionId: 'town_cinix', worldName: 'world' });
    mockDomainSearch(api);
  });

  const areaOptions = async (page: import('@playwright/test').Page) =>
    page.getByRole('combobox', { name: 'Area' }).locator('option').allTextContents();

  test('shows the region, access, warp and sub-region steps only with Own region (A17)', async ({ page }) => {
    await page.goto('/forms/Landmark');
    await page.getByRole('button', { name: 'Use' }).click();
    await page.getByRole('textbox', { name: 'Name*' }).fill('Old well');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Area', level: 2 })).toBeVisible();

    // A point: no region field, and Area is the last step.
    await page.getByRole('combobox', { name: 'Area' }).selectOption('None');
    await expect(page.getByRole('textbox', { name: 'Region' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0);

    // Own region: the region field and the three steps after it.
    await page.getByRole('combobox', { name: 'Area' }).selectOption({ label: 'Own region' });
    await expect(page.getByRole('textbox', { name: 'Region' })).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Access and messages', level: 2 })).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Warp destination', level: 2 })).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Sub-regions', level: 2 })).toBeVisible();
  });

  test("offers Linked domain's area only with a parent that has a region (A17)", async ({ page }) => {
    await page.goto('/forms/Landmark');
    await page.getByRole('button', { name: 'Use' }).click();
    await page.getByRole('textbox', { name: 'Name*' }).fill('Gatehouse');
    await page.getByRole('button', { name: 'Next' }).click();

    // No parent.
    expect(await areaOptions(page)).toEqual(expect.arrayContaining(['Point', 'Own region']));
    expect(await areaOptions(page)).not.toContain("Linked domain's area");
    await expect(page.getByText("Linked domain's area is offered once the parent has a region.")).toBeVisible();

    // A parent with a region (the town).
    await page.getByRole('button', { name: 'Previous' }).click();
    await parentPicker(page).click();
    await page.getByRole('option', { name: /Cinix/ }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect.poll(() => areaOptions(page)).toContain("Linked domain's area");
    await page.getByRole('combobox', { name: 'Area' }).selectOption({ label: "Linked domain's area" });
    await expect(page.getByRole('textbox', { name: 'Region' })).toHaveCount(0);

    // A parent without a region (a point landmark): the option goes, the picked value says why.
    await page.getByRole('button', { name: 'Previous' }).click();
    await parentPicker(page).click();
    await page.getByRole('option', { name: /Nether portal/ }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText("Area Linked domain's area needs a parent with a region.")).toBeVisible();
    await page.getByRole('combobox', { name: 'Area' }).selectOption('None');
    await expect.poll(() => areaOptions(page)).not.toContain("Linked domain's area");
  });

  test('the parent picker shows the type and leaves out the landmark and its descendants (A18)', async ({ page, api }) => {
    api.json<LandmarkDto>('GET', 'landmarks/1', throneRoom);

    await page.goto('/forms/Landmark/edit/1');
    await expect(page.getByRole('textbox', { name: 'Name*' })).toHaveValue('Throne room');
    await parentPicker(page).click();

    const results = page.getByRole('listbox');
    await expect(results.getByRole('option', { name: /East gate/ })).toContainText('Type: Gate');
    await expect(results.getByRole('option', { name: /Nether portal/ })).toContainText('Type: Landmark');
    await expect(results.getByRole('option', { name: /Throne room/ })).toHaveCount(0);
    await expect(results.getByRole('option', { name: /Dais/ })).toHaveCount(0);
    const filters = api.calls('POST', 'Domains/search').map(r => (r.body as PagedQueryDto & { filters?: Record<string, string> }).filters);
    expect(filters).toContainEqual(expect.objectContaining({ excludeSubtreeOf: '1' }));
  });

  test('a new landmark offers every domain as parent', async ({ page, api }) => {
    await page.goto('/forms/Landmark');
    await page.getByRole('button', { name: 'Use' }).click();
    await parentPicker(page).click();

    await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(domainRows.length);
    const filters = api.calls('POST', 'Domains/search').map(r => (r.body as PagedQueryDto & { filters?: Record<string, string> }).filters ?? {});
    expect(filters.every(f => !('excludeSubtreeOf' in f))).toBe(true);
  });
});

// ===== PandiO/knk-workspace#951 (web part): a drawn region's bounds =====

const field = (values: Pick<FormFieldDto, 'id' | 'fieldName' | 'label' | 'fieldType' | 'order'> & Partial<FormFieldDto>): FormFieldDto =>
  ({ isRequired: false, isReadOnly: false, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, validations: [], ...values });

const bound = (id: string, name: string, order: number) => field({ id, fieldName: name, label: name, fieldType: FieldType.Integer, order });

const areaStep: FormStepDto = {
  id: '952', stepName: 'Shape', order: 0, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false,
  isManyToManyRelationship: false, childFormSteps: [], conditions: [],
  fields: [
    field({
      id: '953', fieldName: 'WgRegionId', label: 'Region id', fieldType: FieldType.String, order: 0,
      settingsJson: JSON.stringify({ worldTask: { enabled: true, taskType: 'RegionClaim' } }),
    }),
    bound('954', 'MinX', 1), bound('955', 'MinY', 2), bound('956', 'MinZ', 3),
    bound('957', 'MaxX', 4), bound('958', 'MaxY', 5), bound('959', 'MaxZ', 6),
  ],
};

const productionAreaForm: FormConfigurationDto = {
  id: '951', entityTypeName: 'ProductionArea', configurationName: 'Production area (e2e)', isDefault: true, steps: [areaStep],
};

test("a drawn region's bounding box fills the empty bounds and keeps typed ones (#951)", async ({ page, api }) => {
  api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [accessMetadata('ProductionArea', WORLD)]);
  api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/ProductionArea', [productionAreaForm]);
  api.json<FormConfigurationDto>('GET', `FormConfigurations/${productionAreaForm.id}`, productionAreaForm);
  api.json<EntityMetadataDto>('GET', 'Metadata/entities/ProductionArea', accessMetadata('ProductionArea', WORLD));
  api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${productionAreaForm.id}`, noValidationRules);
  api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, productionAreaForm));
  api.json<StepProgressReadDto[]>('GET', 'Workflows/501/progress', noStepProgress);
  for (const method of ['POST', 'PUT'] as const) {
    api.on<FormSubmissionProgressDto>(method, /^FormSubmissionProgress(\/.*)?$/, ({ body }) => ({
      body: savedProgress(body as FormSubmissionProgressDto),
    }));
  }
  const pending: WorldTaskReadDto = {
    id: 9510, workflowSessionId: 501, stepNumber: 0, fieldName: 'WgRegionId', taskType: 'RegionClaim',
    status: 'Pending', linkCode: 'PA9510', createdAt: '2026-11-22T12:00:00Z',
  };
  let completed = false;
  api.on<WorldTaskReadDto>('POST', /^WorldTasks\/?$/, ({ body }) => ({ status: 201, body: { ...pending, inputJson: (body as WorldTaskCreateDto).inputJson } }));
  api.on<WorldTaskReadDto>('GET', 'WorldTasks/9510', () => ({
    body: completed
      ? {
        ...pending, status: 'Completed', claimedByMinecraftUsername: 'Alex', completedAt: '2026-11-22T12:01:00Z',
        outputJson: JSON.stringify({
          regionId: 'tempregion_worldtask_9510', worldName: 'world',
          bounds: { minX: -10, minY: 60, minZ: 5, maxX: 20, maxY: 80, maxZ: 30 },
        }),
      }
      : pending,
  }));
  api.on<WorldTaskReadDto>('POST', 'WorldTasks/9510/applied', () => ({ body: { ...pending, status: 'Completed' } }));

  await page.goto('/forms/ProductionArea');
  await page.getByRole('button', { name: 'Use' }).click();
  await page.getByRole('spinbutton', { name: 'MaxY' }).fill('99');
  await page.getByRole('button', { name: 'Send to Minecraft' }).click();
  await expect(page.getByText('PA9510').first()).toBeVisible();
  completed = true;

  await expect(page.getByRole('textbox', { name: /Region id/ })).toHaveValue('tempregion_worldtask_9510', { timeout: 10_000 });
  await expect(page.getByRole('spinbutton', { name: 'MinX' })).toHaveValue('-10');
  await expect(page.getByRole('spinbutton', { name: 'MinY' })).toHaveValue('60');
  await expect(page.getByRole('spinbutton', { name: 'MinZ' })).toHaveValue('5');
  await expect(page.getByRole('spinbutton', { name: 'MaxX' })).toHaveValue('20');
  await expect(page.getByRole('spinbutton', { name: 'MaxY' })).toHaveValue('99');
  await expect(page.getByRole('spinbutton', { name: 'MaxZ' })).toHaveValue('30');
});
