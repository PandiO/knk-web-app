import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { noStepProgress, noValidationRules, savedProgress, workflowSession } from './fixtures/forms';
import { generalDisplay } from './fixtures/territory';
import {
  CONFLICT,
  CONTESTED_WARNING,
  ECONOMY,
  MAIN,
  MARKET,
  MARKET_WAREHOUSE,
  MILL,
  MILL_OUTPUT,
  P2_WARNING,
  PHOENIX,
  QUARRY,
  QUARRY_OUTPUT,
  UNCONNECTED_WARNING,
  WAREHOUSE_DELIVERY,
  WORLD,
  marketWarehouse,
  mill,
  mockStoragesOf,
  mockStructureSearch,
  productionRows,
  productionStructureForm,
  productionStructureFormMetadata,
  productionStructureMetadata,
  quarry,
  storageDetail,
  storageRow,
  structureMetadata,
  structureRows,
  territoryOf,
  warehouseForm,
  warehouseFormMetadata,
  warehouseMetadata,
  warehouseRows,
} from './fixtures/productionWorld';
import type { DisplayConfigurationDto } from '../src/types/dtos/displayConfig/DisplayModels';
import type { DomainWorldResolutionDto } from '../src/types/dtos/domain/DomainWorldDtos';
import type { FieldValidationRuleDto } from '../src/types/dtos/forms/FieldValidationRuleDtos';
import type { FormConfigurationDto, FormSubmissionProgressDto } from '../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { StorageDto, StorageListDto } from '../src/types/dtos/stock/StockDtos';
import type { ProductionOverviewDto } from '../src/types/dtos/production/ProductionEngineDtos';
import type { ProductionStructureDto, WarehouseDto } from '../src/types/dtos/structure/ProductionWorldDtos';
import type { StructureTerritoryDto } from '../src/types/dtos/territory/TerritoryDtos';
import type {
  StepProgressReadDto,
  WorkflowSessionReadDto,
  WorldTaskCreateDto,
  WorldTaskReadDto,
} from '../src/types/dtos/workflow/WorkflowDtos';

/**
 * P2 world in the web app (PandiO/knk-workspace#676; production DESIGN § 3.3-3.4, decisions R1-R3, acceptance A06, A07,
 * A23): warehouses and production structures on the dashboard (placement, road connection, the territory flag filter
 * for flagged structures), the seeded forms with the region's world task and the town picker for a rural structure
 * (District-xor-Town), the placement warnings a save answers and the API's reason for a refused save, and the detail
 * pages: placement and warnings, the territory flag, and the structure's storages with their stock. Smoke test:
 * knk-workspace docs/guides/production-storage-transport-smoke-test.md § 3.2.
 */

const nodes = (...held: string[]) => (node: string) => held.includes(node);

test.beforeEach(async ({ page }) => {
  await startLoggedIn(page, 'access-1');
});

test.describe('dashboard', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    mockContentDefaults(api);
    mockSession(api, alex, nodes(WORLD));
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [structureMetadata, warehouseMetadata, productionStructureMetadata]);
    api.json<FormConfigurationDto[]>('GET', /^FormConfigurations\/(Structure|Warehouse|ProductionStructure)$/i, []);
    mockStructureSearch(api, 'Warehouses/search', warehouseRows);
    mockStructureSearch(api, 'ProductionStructures/search', productionRows);
    mockStructureSearch(api, 'Structures/search', structureRows);
  });

  test('lists the warehouses with their town, placement, deliveries and priority', async ({ page }) => {
    await page.goto('/dashboard/Warehouse');

    const table = page.getByRole('table');
    for (const header of ['Town', 'Placement', 'District', 'Accepts deliveries', 'Priority', 'Territory flag']) {
      await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
    }
    const row = table.getByRole('row').filter({ hasText: 'Market warehouse' });
    await expect(row).toContainText('Phoenix');
    await expect(row).toContainText('District');
    await expect(row).toContainText('Yes');
    await expect(row).toContainText('10');
  });

  test('lists the production structures: a rural one with its town and road connection, one in a district (A06, D5)', async ({ page }) => {
    await page.goto('/dashboard/ProductionStructure');

    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'Road connection' })).toBeVisible();
    const quarryRow = table.getByRole('row').filter({ hasText: 'Quarry' });
    await expect(quarryRow).toContainText('Phoenix');
    await expect(quarryRow).toContainText('Rural');
    await expect(quarryRow).toContainText('Unconnected');
    await expect(quarryRow).toContainText('In a contested zone');
    const millRow = table.getByRole('row').filter({ hasText: 'Mill' });
    await expect(millRow).toContainText('Market');
    await expect(millRow).toContainText('In a district');
    await expect(millRow).toContainText('Off');
  });

  test('the structure list shows the flagged structures through the Territory flag filter (A07)', async ({ page, api }) => {
    await page.goto('/dashboard/Structure');

    const table = page.getByRole('table');
    await expect(table.getByRole('row').filter({ hasText: 'Mill' })).toBeVisible();
    await page.getByLabel('Territory flag filter').selectOption('Contested');

    await expect(table.getByRole('row').filter({ hasText: 'Mill' })).toHaveCount(0);
    await expect(table.getByRole('row').filter({ hasText: 'Quarry' })).toContainText('In a contested zone');
    const searches = api.calls('POST', 'Structures/search');
    const last = searches[searches.length - 1];
    expect((last.body as { filters?: Record<string, string> }).filters).toMatchObject({ territoryFlag: 'Contested' });

    await page.getByLabel('Territory flag filter').selectOption('OutsideTerritory');
    await expect(table.getByRole('row').filter({ hasText: 'Market keep' })).toContainText("Outside its town's territory");
    await expect(table.getByRole('row').filter({ hasText: 'Quarry' })).toHaveCount(0);
  });
});

test.describe('the forms', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    mockSession(api, alex, () => true);
    mockContentDefaults(api);
    api.json<StepProgressReadDto[]>('GET', 'Workflows/501/progress', noStepProgress);
    api.on<StepProgressReadDto>('POST', /^Workflows\/501\/steps\/[^/]+\/complete$/, ({ path }) => ({
      body: { id: 1, workflowSessionId: 501, stepKey: decodeURIComponent(path.split('/')[3]), stepIndex: 0, status: 'Completed', createdAt: '2026-11-19T12:00:00Z' },
    }));
    for (const method of ['POST', 'PUT'] as const) {
      api.on<FormSubmissionProgressDto>(method, /^FormSubmissionProgress(\/.*)?$/, ({ body }) => ({ body: savedProgress(body as FormSubmissionProgressDto) }));
    }
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [
      warehouseFormMetadata, productionStructureFormMetadata, structureMetadata,
      { ...structureMetadata, entityName: 'District', displayName: 'District' },
      { ...structureMetadata, entityName: 'Street', displayName: 'Street' },
      { ...structureMetadata, entityName: 'Town', displayName: 'Town' },
    ]);
    for (const [type, form, metadata] of [
      ['Warehouse', warehouseForm, warehouseFormMetadata],
      ['ProductionStructure', productionStructureForm, productionStructureFormMetadata],
    ] as const) {
      api.json<FormConfigurationDto[]>('GET', `FormConfigurations/${type}`, [form]);
      api.json<FormConfigurationDto>('GET', `FormConfigurations/${form.id}`, form);
      api.json<EntityMetadataDto>('GET', `Metadata/entities/${type}`, metadata);
      api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${form.id}`, noValidationRules);
    }
    api.on('GET', /^DisplayConfigurations\/entity\/(District|Street|Town)$/, { status: 404, body: { error: 'NotFound' } });
    api.on('POST', 'Districts/search', { body: { items: [{ id: MARKET, name: 'Market', townName: 'Phoenix' }], totalCount: 1, page: 1, pageSize: 10, totalPages: 1 } });
    api.on('POST', 'Streets/search', { body: { items: [{ id: MAIN, name: 'Main' }], totalCount: 1, page: 1, pageSize: 10, totalPages: 1 } });
    api.on('POST', 'Towns/search', { body: { items: [{ id: PHOENIX, name: 'Phoenix' }, { id: 5, name: 'Rivertown' }], totalCount: 2, page: 1, pageSize: 10, totalPages: 1 } });
    api.on('POST', /^Lookup\/District\/search$/, { body: { items: [{ id: MARKET, label: 'Market' }], total: 1 } });
    api.on('POST', /^Lookup\/Street\/search$/, { body: { items: [{ id: MAIN, label: 'Main' }], total: 1 } });
    api.on('POST', /^Lookup\/Town\/search$/, { body: { items: [{ id: PHOENIX, label: 'Phoenix' }, { id: 5, label: 'Rivertown' }], total: 2 } });
    api.json<DomainWorldResolutionDto>('POST', 'Domains/world/resolve', { worldName: 'world', source: 'region world task', needsWorld: false });
  });

  test('saves a warehouse in a district with its region drawn in game (A06, A23)', async ({ page, api }) => {
    api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, warehouseForm));
    const pending: WorldTaskReadDto = {
      id: 9101, workflowSessionId: 501, stepNumber: 2, fieldName: 'WgRegionId', taskType: 'RegionClaim',
      status: 'Pending', linkCode: 'WH4242', createdAt: '2026-11-19T12:00:00Z',
    };
    let completed = false;
    api.on<WorldTaskReadDto>('POST', /^WorldTasks\/?$/, ({ body }) => ({ status: 201, body: { ...pending, inputJson: (body as WorldTaskCreateDto).inputJson } }));
    api.on<WorldTaskReadDto>('GET', 'WorldTasks/9101', () => ({
      body: completed
        ? { ...pending, status: 'Completed', claimedByMinecraftUsername: 'Alex', completedAt: '2026-11-19T12:01:00Z',
          outputJson: JSON.stringify({ regionId: 'tempregion_worldtask_9101', worldName: 'world' }) }
        : pending,
    }));
    api.on<WorldTaskReadDto>('POST', 'WorldTasks/9101/applied', () => ({ body: { ...pending, status: 'Completed' } }));
    api.on<WarehouseDto>('POST', /^Warehouses\/?$/, ({ body }) => ({ status: 201, body: { ...marketWarehouse(), ...(body as WarehouseDto), placementWarnings: [] } }));
    mockStructureSearch(api, 'Warehouses/search', warehouseRows);

    await page.goto('/forms/Warehouse');
    await page.getByRole('button', { name: 'Use', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name*' }).fill('Market warehouse');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByPlaceholder(/Search District/).click();
    await page.getByRole('option', { name: /Market/ }).click();
    await page.getByPlaceholder(/Search Street/).click();
    await page.getByRole('option', { name: /Main/ }).click();
    await page.getByRole('spinbutton', { name: /House number/ }).fill('3');
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('button', { name: 'Send to Minecraft' }).click();
    await expect.poll(() => api.calls('POST', /^WorldTasks\/?$/).length).toBe(1);
    expect(api.calls('POST', /^WorldTasks\/?$/)[0].body).toMatchObject({ fieldName: 'WgRegionId', taskType: 'RegionClaim' });
    await expect(page.getByText('WH4242').first()).toBeVisible();
    completed = true;
    await expect(page.getByRole('textbox', { name: /Region/ })).toHaveValue('tempregion_worldtask_9101', { timeout: 10_000 });

    await page.getByRole('button', { name: 'Submit' }).click();
    await expect.poll(() => api.calls('POST', /^Warehouses\/?$/).length).toBe(1);
    const sent = api.calls('POST', /^Warehouses\/?$/)[0].body as Record<string, unknown>;
    expect(sent).toMatchObject({ Name: 'Market warehouse', DistrictId: MARKET, StreetId: MAIN, HouseNumber: 3, WgRegionId: 'tempregion_worldtask_9101' });
    expect(sent.TownId ?? null).toBeNull();
    // The world comes from the region's world task; a domain's district is its parent.
    expect(api.calls('POST', 'Domains/world/resolve')[0].body).toMatchObject({ entityType: 'Warehouse', districtId: MARKET, townId: null });
    await expect(page.getByText('Warehouse created.')).toBeVisible();
  });

  test('saves a rural production structure with only its town and shows the placement warning (A06, R2)', async ({ page, api }) => {
    api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, productionStructureForm));
    api.on<ProductionStructureDto>('POST', /^ProductionStructures\/?$/, ({ body }) => ({
      status: 201, body: { ...quarry(), ...(body as ProductionStructureDto), placementWarnings: [P2_WARNING] },
    }));
    mockStructureSearch(api, 'ProductionStructures/search', productionRows);

    await page.goto('/forms/ProductionStructure');
    await page.getByRole('button', { name: 'Use', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name*' }).fill('Outpost');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByPlaceholder(/Search Town/).click();
    await page.getByRole('option', { name: /Phoenix/ }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: /Region/ }).fill('outpost_region');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect.poll(() => api.calls('POST', /^ProductionStructures\/?$/).length).toBe(1);
    const sent = api.calls('POST', /^ProductionStructures\/?$/)[0].body as Record<string, unknown>;
    expect(sent).toMatchObject({ Name: 'Outpost', TownId: PHOENIX, WgRegionId: 'outpost_region', Level: 1 });
    expect(sent.DistrictId ?? null).toBeNull();
    expect(sent.StreetId ?? null).toBeNull();
    // A rural structure's town is its parent for the world.
    expect(api.calls('POST', 'Domains/world/resolve')[0].body).toMatchObject({ entityType: 'ProductionStructure', townId: PHOENIX, districtId: null });
    await expect(page.getByText('ProductionStructure created.')).toBeVisible();
    await expect(page.getByText(`Saved with a placement warning: ${P2_WARNING}`)).toBeVisible();
  });

  test('a refused save shows the API\'s reason: both a district and a town (A06)', async ({ page, api }) => {
    api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, productionStructureForm));
    api.on('POST', /^ProductionStructures\/?$/, {
      status: 400, body: { error: "A structure is either in a district (districtId) or rural (townId): set exactly one of the two. (Parameter 'dto')" },
    });

    await page.goto('/forms/ProductionStructure');
    await page.getByRole('button', { name: 'Use', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name*' }).fill('Both');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByPlaceholder(/Search District/).click();
    await page.getByRole('option', { name: /Market/ }).click();
    await page.getByPlaceholder(/Search Town/).click();
    await page.getByRole('option', { name: /Phoenix/ }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: /Region/ }).fill('both_region');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByText('The form could not be submitted. A structure is either in a district (districtId) or rural (townId): set exactly one of the two.', { exact: true })).toBeVisible();
    expect(api.calls('POST', /^ProductionStructures\/?$/)).toHaveLength(1);
  });
});

test.describe('the detail pages', () => {
  test.use({ strictApi: true });

  let territory: Record<number, StructureTerritoryDto>;
  const quarryOutput = storageRow(QUARRY_OUTPUT, 'Quarry - output', 'Output', QUARRY, 'Quarry', 5);
  const millOutput = storageRow(MILL_OUTPUT, 'Mill - output', 'Output', MILL, 'Mill');
  const delivery = storageRow(WAREHOUSE_DELIVERY, 'Market warehouse - deliveries', 'Delivery', MARKET_WAREHOUSE, 'Market warehouse');

  test.beforeEach(async ({ api }) => {
    territory = {
      [QUARRY]: territoryOf(QUARRY, 'Quarry', 'Contested'),
      [MILL]: territoryOf(MILL, 'Mill'),
      [MARKET_WAREHOUSE]: territoryOf(MARKET_WAREHOUSE, 'Market warehouse'),
    };
    mockContentDefaults(api);
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [warehouseMetadata, productionStructureMetadata]);
    api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/ProductionStructure', generalDisplay('ProductionStructure', '821'));
    api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Warehouse', generalDisplay('Warehouse', '822'));
    api.json<ProductionStructureDto>('GET', `ProductionStructures/${QUARRY}`, quarry());
    api.json<ProductionStructureDto>('GET', `ProductionStructures/${MILL}`, mill());
    api.json<WarehouseDto>('GET', `Warehouses/${MARKET_WAREHOUSE}`, marketWarehouse());
    api.on<StructureTerritoryDto>('GET', /^Territory\/structures\/\d+$/, ({ path }) => ({ body: territory[Number(path.split('/').pop())] }));
    api.json('GET', /^Towns\/?$/, [{ id: PHOENIX, name: 'Phoenix', allowEntry: true, requiredTitle: 0 }]);
    api.on('POST', 'hubs/web/negotiate', { status: 404 });
    // P3b (#678): the production panel of a production structure; no kind and no lines here (e2e/production-engine.spec.ts covers it).
    api.on<ProductionOverviewDto>('GET', /^ProductionStructures\/\d+\/production$/, ({ path }) => ({
      body: {
        productionStructureId: Number(path.split('/')[1]), featureEnabled: true, productionEnabled: true, productionKind: null, level: 1,
        workersPresent: 0, workersTotal: 2, outputStorageId: null, inputStorageId: null, climateZone: null, weatherToday: null,
        notProducingReasons: ['It has no production kind.'], lines: [], recentCycles: [],
      },
    }));
    mockStoragesOf(api, [quarryOutput, millOutput, delivery]);
    for (const [row, stone] of [[quarryOutput, 5], [millOutput, 0], [delivery, 0]] as [StorageListDto, number][]) {
      api.json<StorageDto>('GET', `Storages/${row.id}`, storageDetail(row, stone));
    }
  });

  test('a rural production structure: its town, the contested and road warnings, the flag and its output storage (A06, A07)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, ECONOMY));
    await page.goto(`/display/ProductionStructure/${QUARRY}`);

    const placement = page.getByRole('region', { name: 'Placement' });
    await expect(placement.getByTestId('structure-placement-kind')).toHaveText("Rural, in its town's territory (no district or street)");
    await expect(placement.getByTestId('structure-effective-town').getByRole('link', { name: 'Phoenix' }))
      .toHaveAttribute('href', new RegExp(`^/display/Town/${PHOENIX}`));
    const warnings = placement.getByRole('list', { name: 'Warnings' });
    await expect(warnings.getByRole('listitem')).toHaveText([UNCONNECTED_WARNING, CONTESTED_WARNING]);
    await expect(placement.getByTestId('structure-road-connection')).toContainText("Not connected to its town's roads");
    await expect(placement.getByTestId('structure-production')).toHaveText('On, level 1');
    await expect(placement.getByTestId('structure-workers')).toHaveText('1 of 2');
    await expect(placement.getByTestId('structure-delivers-to').getByRole('link', { name: 'Market warehouse' }))
      .toHaveAttribute('href', new RegExp(`^/display/Warehouse/${MARKET_WAREHOUSE}`));

    // A07: the structure keeps its town and is flagged, with the conflict.
    const territoryPanel = page.getByRole('region', { name: 'Territory and loyalty' });
    await expect(territoryPanel.getByTestId('structure-territory-flag')).toContainText('In a contested zone');
    await expect(territoryPanel.getByRole('link', { name: `Conflict #${CONFLICT}` })).toBeVisible();

    // Its storages (api/Storages/search with domainId), each linked and shown with its stock.
    const storages = page.getByRole('region', { name: 'Storages' });
    await expect(storages.getByRole('link', { name: 'Quarry - output' })).toHaveAttribute('href', new RegExp(`^/display/Storage/${QUARRY_OUTPUT}`));
    await expect(storages.getByRole('row').filter({ hasText: 'Quarry - output' })).toContainText('Output');
    const search = api.calls('POST', 'Storages/search')[0].body as { filters?: Record<string, string> };
    expect(search.filters).toEqual({ domainId: String(QUARRY) });
    const stock = page.getByRole('region', { name: 'Stock: Quarry - output' });
    await expect(stock.getByRole('table', { name: 'Stock lines' }).getByRole('row').filter({ hasText: 'Stone' })).toContainText('5');
    await expect(stock.getByRole('button', { name: 'Adjust stock' })).toBeEnabled();
  });

  test('a production structure in a district has no warnings and uses its town\'s roads', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    await page.goto(`/display/ProductionStructure/${MILL}`);

    const placement = page.getByRole('region', { name: 'Placement' });
    await expect(placement.getByTestId('structure-no-warnings')).toHaveText('No warnings.');
    await expect(placement.getByTestId('structure-placement-kind')).toHaveText('In district Market, Main 2');
    await expect(placement.getByTestId('structure-effective-town')).toHaveText('Phoenix (through its district)');
    await expect(placement.getByTestId('structure-road-connection')).toHaveText("In a district: uses its town's roads");
    await expect(placement.getByTestId('structure-production')).toHaveText('Off, level 4');
    await expect(placement.getByTestId('structure-delivers-to')).toHaveText('The nearest warehouse of its town that accepts deliveries');
    await expect(page.getByRole('region', { name: 'Territory and loyalty' }).getByTestId('structure-territory-flag'))
      .toHaveText("Inside its town's territory");
    // Without knk.economy.admin the stock is shown but can't be adjusted.
    await expect(page.getByRole('region', { name: 'Stock: Mill - output' }).getByRole('button', { name: 'Adjust stock' })).toBeDisabled();
  });

  test('a warehouse in a district: its address, town, deliveries and delivery storage', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    await page.goto(`/display/Warehouse/${MARKET_WAREHOUSE}`);

    const placement = page.getByRole('region', { name: 'Placement' });
    await expect(placement.getByTestId('structure-placement-kind')).toHaveText('In district Market, Main 3');
    await expect(placement.getByTestId('structure-placement-kind').getByRole('link', { name: 'Market' }))
      .toHaveAttribute('href', new RegExp(`^/display/District/${MARKET}`));
    await expect(placement.getByTestId('warehouse-deliveries')).toHaveText('Accepts deliveries, priority 10');
    await expect(placement.getByRole('link', { name: 'Market warehouse - deliveries' }))
      .toHaveAttribute('href', new RegExp(`^/display/Storage/${WAREHOUSE_DELIVERY}`));
    await expect(placement.getByTestId('structure-warnings')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Storages' }).getByRole('row').filter({ hasText: 'Market warehouse - deliveries' }))
      .toContainText('Delivery');
    await expect(page.getByRole('region', { name: 'Stock: Market warehouse - deliveries' })).toBeVisible();
  });
});
