import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { noStepProgress, noValidationRules, savedProgress, workflowSession } from './fixtures/forms';
import { generalDisplay } from './fixtures/territory';
import {
  PHOENIX,
  QUARRY,
  QUARRY_OUTPUT,
  WORLD,
  mockStoragesOf,
  productionStructureMetadata,
  quarry,
  storageDetail,
  storageRow,
  territoryOf,
} from './fixtures/productionWorld';
import {
  COAL,
  COBBLESTONE,
  QUARRY_KIND,
  mockProductionLookups,
  mockRows,
  productionKindMetadata,
  quarryKind,
  quarryProduction,
} from './fixtures/productionEngine';
import {
  COAL_OVERRIDE,
  MILL_WOOD,
  OVER_CAP,
  PIT,
  SURVEY_2,
  areaRows,
  areaSurveyMetadata,
  latestSurvey,
  pitOverlaps,
  pitTrend,
  productionAreaForm,
  productionAreaFormMetadata,
  productionAreaMetadata,
  quarryOverrides,
  quarryPit,
  quarryYield,
  surveyRows,
} from './fixtures/productionYield';
import type { DisplayConfigurationDto } from '../src/types/dtos/displayConfig/DisplayModels';
import type { FieldValidationRuleDto } from '../src/types/dtos/forms/FieldValidationRuleDtos';
import type { FormConfigurationDto, FormSubmissionProgressDto } from '../src/types/dtos/forms/FormModels';
import type { StepProgressReadDto, WorkflowSessionReadDto } from '../src/types/dtos/workflow/WorkflowDtos';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { StorageDto } from '../src/types/dtos/stock/StockDtos';
import type { ProductionKindDto, ProductionOverviewDto } from '../src/types/dtos/production/ProductionEngineDtos';
import type {
  AreaSurveyDto,
  AreaSurveyTrendDto,
  ProductionAreaDto,
  ProductionAreaOverlapDto,
  ProductionYieldDto,
  ProductionYieldOverrideDto,
  ProductionYieldOverrideListDto,
} from '../src/types/dtos/production/ProductionYieldDtos';
import type { ProductionStructureDto } from '../src/types/dtos/structure/ProductionWorldDtos';
import type { StructureTerritoryDto } from '../src/types/dtos/territory/TerritoryDtos';

import { mockNoTransport } from './fixtures/transport';
/**
 * Yield areas P4 in the web app (PandiO/knk-workspace#680; PRODUCTION_KINDS § 3-4, decisions P-D1, G5, G7, G17,
 * acceptance A10, A23, insight #65): a production structure's yield source, areas, Survey now and why each rate is what
 * it is; the Hybrid override editor; an area's size against its cap, plot, composition, trend and history; a survey's
 * composition; a kind's yield table and primary outputs; the areas on the dashboard. Smoke test: knk-workspace
 * docs/guides/production-storage-transport-smoke-test.md § 5.3.
 */

const nodes = (...held: string[]) => (node: string) => held.includes(node);

test.beforeEach(async ({ page }) => {
  await startLoggedIn(page, 'access-1');
});

function mockDetailPage(api: Parameters<typeof mockContentDefaults>[0], metadata: EntityMetadataDto, id: string): void {
  mockContentDefaults(api);
  api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [metadata]);
  api.json<DisplayConfigurationDto>('GET', `DisplayConfigurations/entity/${metadata.entityName}`, generalDisplay(metadata.entityName, id));
  api.on('POST', 'hubs/web/negotiate', { status: 404 });
  mockProductionLookups(api);
}

test.describe('the production structure page', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    const output = storageRow(QUARRY_OUTPUT, 'Quarry - output', 'Output', QUARRY, 'Quarry', 5);
    mockDetailPage(api, productionStructureMetadata, '821');
    api.json<ProductionStructureDto>('GET', `ProductionStructures/${QUARRY}`, {
      ...quarry(), productionKindId: QUARRY_KIND, productionKind: { id: QUARRY_KIND, name: 'Quarry' }, yieldSource: 'Hybrid', areas: [areaRows[0], areaRows[1]],
    });
    api.json<StructureTerritoryDto>('GET', `Territory/structures/${QUARRY}`, territoryOf(QUARRY, 'Quarry'));
    api.json('GET', /^Towns\/?$/, [{ id: PHOENIX, name: 'Phoenix', allowEntry: true, requiredTitle: 0 }]);
    mockStoragesOf(api, [output]);
    api.json<StorageDto>('GET', `Storages/${QUARRY_OUTPUT}`, storageDetail(output, 5));
    api.json<ProductionKindDto>('GET', `ProductionKinds/${QUARRY_KIND}`, quarryKind());
    api.json<ProductionOverviewDto>('GET', `ProductionStructures/${QUARRY}/production`, quarryProduction());
    mockRows<ProductionYieldOverrideListDto>(api, 'ProductionYieldOverrides/search', quarryOverrides);
    // P5c (#682): the transport panel (e2e/transport.spec.ts covers it).
    mockNoTransport(api);
  });

  test('shows the yield source, the areas against the level cap and why each rate is what it is (A10, #65)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<ProductionYieldDto>('GET', `ProductionStructures/${QUARRY}/yield`, quarryYield());
    await page.goto(`/display/ProductionStructure/${QUARRY}`);

    const panel = page.getByRole('region', { name: 'Yield', exact: true });
    await expect(panel.getByTestId('yield-source')).toContainText('Yield source Hybrid.');
    const areas = panel.getByRole('table', { name: 'Areas' });
    await expect(areas.getByRole('row').filter({ hasText: 'Quarry pit' })).toContainText('320 of 400 blocks');
    await expect(areas.getByRole('row').filter({ hasText: 'North slope' })).toContainText('Shared');
    await expect(areas.getByRole('link', { name: 'Quarry pit' })).toHaveAttribute('href', new RegExp(`^/display/ProductionArea/${PIT}`));

    const coal = panel.getByRole('listitem', { name: 'Output Coal' });
    await expect(coal).toContainText('primary');
    await expect(coal.getByTestId('yield-explanation')).toContainText('Surveyed 1/h, Scale × 0.5 → base 0.5/h, then the primary multiplier as a modifier.');
    await coal.getByRole('button', { name: 'Show the 1 survey unit' }).click();
    await expect(coal.getByRole('table', { name: 'Survey units of Coal' }).getByRole('row').nth(1))
      .toHaveText(/Quarry pit\s*BLOCK:COAL_ORE\s*BLOCK:\*\s*100\s*1\/2 \(shared\)\s*0\.02\s*1\s*1\/h/);
    const cobble = panel.getByRole('listitem', { name: 'Output Cobblestone' });
    await expect(cobble.getByRole('link', { name: 'Line #41' })).toBeVisible();
    await expect(panel.getByRole('list', { name: 'Unmatched survey units' })).toHaveText('BLOCK:DIORITE');
  });

  test('Survey now asks the game server to survey the enabled areas; a refusal shows the API\'s reason', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<ProductionYieldDto>('GET', `ProductionStructures/${QUARRY}/yield`, quarryYield());
    api.json<ProductionAreaDto[]>('POST', `ProductionStructures/${QUARRY}/survey`, [quarryPit()]);
    await page.goto(`/display/ProductionStructure/${QUARRY}`);

    const panel = page.getByRole('region', { name: 'Yield', exact: true });
    await panel.getByRole('button', { name: 'Survey now' }).click();
    await expect(page.getByText('Survey requested for 1 area: the game server surveys at its next poll.')).toBeVisible();
    expect(api.calls('POST', `ProductionStructures/${QUARRY}/survey`)[0].body).toEqual({});

    api.on('POST', `ProductionStructures/${QUARRY}/survey`, { status: 409, body: { error: 'The structure has no enabled area to survey.' } });
    await panel.getByRole('button', { name: 'Survey now' }).click();
    await expect(panel.getByRole('alert')).toHaveText('The structure has no enabled area to survey.');
  });

  test('a Configured structure is never surveyed: no Survey now and no outputs list (A10, G5)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<ProductionYieldDto>('GET', `ProductionStructures/${QUARRY}/yield`, { ...quarryYield(), yieldSource: 'Configured', areas: [], outputs: [], unmatchedUnitKeys: [] });
    await page.goto(`/display/ProductionStructure/${QUARRY}`);

    const panel = page.getByRole('region', { name: 'Yield', exact: true });
    await expect(panel.getByTestId('yield-source')).toContainText('The structure is never surveyed.');
    await expect(panel.getByText('A Configured structure is never surveyed, so there is no Survey now (G5).')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Survey now' })).toHaveCount(0);
    await expect(panel.getByRole('list', { name: 'Outputs' })).toHaveCount(0);
  });

  test('the Hybrid override editor pins, changes and removes an override per output', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<ProductionYieldDto>('GET', `ProductionStructures/${QUARRY}/yield`, quarryYield());
    api.on<ProductionYieldOverrideDto>('POST', 'ProductionYieldOverrides', ({ body }) => ({ status: 201, body: { ...(body as ProductionYieldOverrideDto), id: 90 } }));
    api.on<ProductionYieldOverrideDto>('PUT', `ProductionYieldOverrides/${COAL_OVERRIDE}`, ({ body }) => ({ body: body as ProductionYieldOverrideDto }));
    api.on('DELETE', `ProductionYieldOverrides/${COAL_OVERRIDE}`, { status: 204 });
    await page.goto(`/display/ProductionStructure/${QUARRY}`);

    const panel = page.getByRole('region', { name: 'Yield', exact: true });
    const cobble = panel.getByRole('listitem', { name: 'Output Cobblestone' });
    await cobble.getByRole('combobox', { name: 'Override of Cobblestone' }).selectOption('Pin');
    await expect(cobble.getByRole('button', { name: 'Save override' })).toBeDisabled();
    await cobble.getByRole('spinbutton', { name: 'Override value of Cobblestone' }).fill('12');
    await cobble.getByRole('button', { name: 'Save override' }).click();
    await expect.poll(() => api.calls('POST', 'ProductionYieldOverrides').length).toBe(1);
    expect(api.calls('POST', 'ProductionYieldOverrides')[0].body).toEqual({
      id: 0, productionStructureId: QUARRY, itemBlueprintId: COBBLESTONE, kind: 'Pin', value: 12,
    });
    // The panel reads the yield again after a save; wait for it before the next edit.
    await expect(page.getByText('Override saved: Pin 12/h.')).toBeVisible();

    const coal = panel.getByRole('listitem', { name: 'Output Coal' });
    await expect(coal.getByRole('combobox', { name: 'Override of Coal' })).toHaveValue('Scale');
    await expect(coal.getByRole('spinbutton', { name: 'Override value of Coal' })).toHaveValue('0.5');
    await coal.getByRole('combobox', { name: 'Override of Coal' }).selectOption('Exclude');
    await coal.getByRole('button', { name: 'Save override' }).click();
    await expect.poll(() => api.calls('PUT', `ProductionYieldOverrides/${COAL_OVERRIDE}`).length).toBe(1);
    expect(api.calls('PUT', `ProductionYieldOverrides/${COAL_OVERRIDE}`)[0].body).toEqual({
      id: COAL_OVERRIDE, productionStructureId: QUARRY, itemBlueprintId: COAL, kind: 'Exclude', value: 0,
    });
    await expect(page.getByText('Override saved: Exclude.')).toBeVisible();

    await coal.getByRole('combobox', { name: 'Override of Coal' }).selectOption('None');
    await coal.getByRole('button', { name: 'Save override' }).click();
    await expect.poll(() => api.calls('DELETE', `ProductionYieldOverrides/${COAL_OVERRIDE}`).length).toBe(1);
  });

  test('pins an output the survey does not yield', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<ProductionYieldDto>('GET', `ProductionStructures/${QUARRY}/yield`, { ...quarryYield(), outputs: [quarryYield().outputs[0]] });
    // No override stored yet (one per output: a stored one would be updated instead).
    mockRows<ProductionYieldOverrideListDto>(api, 'ProductionYieldOverrides/search', []);
    api.on<ProductionYieldOverrideDto>('POST', 'ProductionYieldOverrides', ({ body }) => ({ status: 201, body: { ...(body as ProductionYieldOverrideDto), id: 90 } }));
    await page.goto(`/display/ProductionStructure/${QUARRY}`);

    const box = page.getByTestId('new-override');
    await box.getByPlaceholder('Search output…').fill('Coal');
    await box.getByRole('button', { name: 'Coal' }).click();
    await box.getByRole('spinbutton', { name: 'New override value' }).fill('2');
    await box.getByRole('button', { name: 'Add override' }).click();
    await expect.poll(() => api.calls('POST', 'ProductionYieldOverrides').length).toBe(1);
    expect(api.calls('POST', 'ProductionYieldOverrides')[0].body).toEqual({
      id: 0, productionStructureId: QUARRY, itemBlueprintId: COAL, kind: 'Pin', value: 2,
    });
  });
});

test.describe('an area and its surveys', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    mockDetailPage(api, productionAreaMetadata, '861');
    mockSession(api, alex, nodes(WORLD));
    api.json<ProductionAreaDto>('GET', `ProductionAreas/${PIT}`, quarryPit());
    api.json<ProductionAreaOverlapDto[]>('GET', `ProductionAreas/${PIT}/overlaps`, pitOverlaps);
    api.json<AreaSurveyDto>('GET', `AreaSurveys/${SURVEY_2}`, latestSurvey());
    api.json<AreaSurveyTrendDto>('GET', /^AreaSurveys\/trend/, pitTrend());
    mockRows(api, 'AreaSurveys/search', surveyRows);
  });

  test('shows the size against the cap, the plot with its overlaps, the composition, the trend and the history', async ({ page }) => {
    await page.goto(`/display/ProductionArea/${PIT}`);

    const panel = page.getByRole('region', { name: 'Area and surveys' });
    await expect(panel.getByTestId('area-size')).toHaveText('320 of 400 blocks');
    await expect(panel.getByRole('img', { name: 'Plot of Quarry pit from above with 1 overlapping area' })).toBeVisible();
    await expect(panel.getByRole('table', { name: 'Overlapping areas' }).getByRole('link', { name: 'Mill wood' }))
      .toHaveAttribute('href', new RegExp(`^/display/ProductionArea/${MILL_WOOD}`));

    const composition = panel.getByRole('table', { name: 'Composition' });
    await expect(composition.getByRole('row')).toHaveText([
      /Unit\s*Count\s*Share of the survey\s*Split\s*Extra/,
      /BLOCK:STONE\s*300\s*71\.4%\s*Own/,
      /BLOCK:COAL_ORE\s*100\s*23\.8%\s*Shared by 2/,
      /BLOCK:DIORITE\s*20\s*4\.8%\s*Own/,
    ]);

    const trend = panel.getByRole('table', { name: 'Trend' });
    await expect(trend.getByRole('row').filter({ hasText: 'BLOCK:STONE' })).toHaveText(/BLOCK:STONE\s*320\s*300\s*-20/);
    await expect(trend.getByRole('img', { name: 'BLOCK:COAL_ORE: 120, 100' })).toBeVisible();

    await expect(panel.getByRole('list', { name: 'Survey history' }).getByRole('listitem')).toHaveCount(2);
    await expect(panel.getByRole('list', { name: 'Survey history' }).getByRole('listitem').first()).toContainText('Admin, 420 units, profile v1');
  });

  test('Survey this area now asks for this area only', async ({ page, api }) => {
    api.json<ProductionAreaDto[]>('POST', `ProductionStructures/${QUARRY}/survey`, [quarryPit()]);
    await page.goto(`/display/ProductionArea/${PIT}`);

    await page.getByRole('region', { name: 'Area and surveys' }).getByRole('button', { name: 'Survey this area now' }).click();
    await expect(page.getByText('Survey requested: the game server surveys the area at its next poll.')).toBeVisible();
    expect(api.calls('POST', `ProductionStructures/${QUARRY}/survey`)[0].body).toEqual({ productionAreaId: PIT });
  });
});

test.describe('a survey', () => {
  test.use({ strictApi: true });

  test('lists what the game server counted, largest first', async ({ page, api }) => {
    mockDetailPage(api, areaSurveyMetadata, '862');
    mockSession(api, alex, nodes(WORLD));
    api.json<AreaSurveyDto>('GET', `AreaSurveys/${SURVEY_2}`, latestSurvey());
    await page.goto(`/display/AreaSurvey/${SURVEY_2}`);

    const panel = page.getByRole('region', { name: 'Composition' });
    await expect(panel).toContainText('420 units');
    await expect(panel.getByRole('link', { name: 'Quarry pit' })).toHaveAttribute('href', new RegExp(`^/display/ProductionArea/${PIT}`));
    await expect(panel.getByRole('table', { name: 'Composition' }).getByRole('row').nth(1)).toContainText('BLOCK:STONE');
  });
});

test.describe('a kind\'s yield table', () => {
  test.use({ strictApi: true });

  test('edits the yield table and primary outputs; the lists replace the stored ones (G17)', async ({ page, api }) => {
    mockDetailPage(api, productionKindMetadata, '831');
    mockSession(api, alex, nodes(WORLD));
    let stored: ProductionKindDto = {
      ...quarryKind(), surveyProfileJson: '{"unitTypes":["BLOCK"]}', surveyProfileVersion: 2, primaryMultiplier: 1.5,
      yieldTable: [{ id: 1, unitKey: 'BLOCK:STONE', itemBlueprintId: COBBLESTONE, itemBlueprint: { id: COBBLESTONE, name: 'Cobblestone' }, ratePerUnitPerHour: 0.01, byproductChance: 1, minLevel: 1 }],
      primaryOutputs: [],
    };
    api.on<ProductionKindDto>('GET', `ProductionKinds/${QUARRY_KIND}`, () => ({ body: stored }));
    api.on('PUT', `ProductionKinds/${QUARRY_KIND}`, ({ body }) => {
      const sent = body as ProductionKindDto;
      stored = { ...stored, yieldTable: sent.yieldTable, primaryOutputs: sent.primaryOutputs };
      return { status: 204 };
    });
    await page.goto(`/display/ProductionKind/${QUARRY_KIND}`);

    const panel = page.getByRole('region', { name: 'Yield table' });
    await expect(panel.getByTestId('survey-profile')).toHaveText("Survey profile v2, primary multiplier × 1.5 (both on the kind's form).");
    await panel.getByRole('button', { name: 'Add row' }).click();
    const row = panel.getByRole('listitem', { name: 'Yield row 2' });
    await row.getByRole('textbox', { name: 'Unit key' }).fill('BLOCK:*:COAL');
    await row.getByPlaceholder('Search output…').fill('Coal');
    await row.getByRole('button', { name: 'Coal' }).click();
    await row.getByRole('spinbutton', { name: 'Rate per unit/h' }).fill('0.02');
    await expect(panel.getByRole('list', { name: 'Problems' })).toContainText('Row 2: a unit key is parts');
    await expect(panel.getByRole('button', { name: 'Save yield table' })).toBeDisabled();
    await row.getByRole('textbox', { name: 'Unit key' }).fill('block:coal_ore');
    await row.getByRole('spinbutton', { name: 'Chance' }).fill('0.5');

    await panel.getByRole('button', { name: 'Add primary output' }).click();
    const primary = panel.getByRole('listitem', { name: 'Primary output 1' });
    await primary.getByPlaceholder('Search blueprint…').fill('Coal');
    await primary.getByRole('button', { name: 'Coal' }).click();
    await panel.getByRole('button', { name: 'Save yield table' }).click();

    await expect.poll(() => api.calls('PUT', `ProductionKinds/${QUARRY_KIND}`).length).toBe(1);
    expect(api.calls('PUT', `ProductionKinds/${QUARRY_KIND}`)[0].body).toEqual({
      id: QUARRY_KIND,
      yieldTable: [
        { unitKey: 'BLOCK:STONE', itemBlueprintId: COBBLESTONE, ratePerUnitPerHour: 0.01, byproductChance: 1, minLevel: 1 },
        { unitKey: 'BLOCK:COAL_ORE', itemBlueprintId: COAL, ratePerUnitPerHour: 0.02, byproductChance: 0.5, minLevel: 1 },
      ],
      primaryOutputs: [{ itemBlueprintId: COAL }],
    });
  });
});

test.describe('dashboard', () => {
  test.use({ strictApi: true });

  test('lists the areas with their structure, shape, size and last survey', async ({ page, api }) => {
    mockContentDefaults(api);
    mockSession(api, alex, nodes(WORLD));
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [productionAreaMetadata]);
    api.json<FormConfigurationDto[]>('GET', /^FormConfigurations\/ProductionArea$/i, []);
    mockRows(api, 'ProductionAreas/search', areaRows);
    await page.goto('/dashboard/ProductionArea');

    const table = page.getByRole('table');
    for (const header of ['Structure', 'Model', 'Shape', 'Exclusive', 'Size', 'Last survey']) {
      await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
    }
    await expect(table.getByRole('row').filter({ hasText: 'North slope' })).toContainText('Never');
    await expect(table.getByRole('row').filter({ hasText: 'Quarry pit' })).toContainText('Cuboid');
  });
});

test.describe('the area form', () => {
  test.use({ strictApi: true });

  test('an area over the level\'s cap is refused with the maximum (A11, G6)', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    mockContentDefaults(api);
    api.json<StepProgressReadDto[]>('GET', 'Workflows/501/progress', noStepProgress);
    api.on<StepProgressReadDto>('POST', /^Workflows\/501\/steps\/[^/]+\/complete$/, ({ path }) => ({
      body: { id: 1, workflowSessionId: 501, stepKey: decodeURIComponent(path.split('/')[3]), stepIndex: 0, status: 'Completed', createdAt: '2026-11-19T12:00:00Z' },
    }));
    for (const method of ['POST', 'PUT'] as const) {
      api.on<FormSubmissionProgressDto>(method, /^FormSubmissionProgress(\/.*)?$/, ({ body }) => ({ body: savedProgress(body as FormSubmissionProgressDto) }));
    }
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [productionAreaFormMetadata]);
    api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/ProductionArea', [productionAreaForm]);
    api.json<FormConfigurationDto>('GET', `FormConfigurations/${productionAreaForm.id}`, productionAreaForm);
    api.json<EntityMetadataDto>('GET', 'Metadata/entities/ProductionArea', productionAreaFormMetadata);
    api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${productionAreaForm.id}`, noValidationRules);
    api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, productionAreaForm));
    api.on('POST', /^ProductionAreas\/?$/, { status: 400, body: { error: OVER_CAP } });

    await page.goto('/forms/ProductionArea');
    await page.getByRole('button', { name: 'Use', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name*' }).fill('Forest');
    await page.getByRole('spinbutton', { name: 'Radius' }).fill('33');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByText(`The form could not be submitted. ${OVER_CAP}`, { exact: true })).toBeVisible();
    expect(api.calls('POST', /^ProductionAreas\/?$/)).toHaveLength(1);
  });
});
