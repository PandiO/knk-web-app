import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { gameSettings, generalDisplay } from './fixtures/territory';
import {
  PHOENIX,
  QUARRY,
  QUARRY_OUTPUT,
  WORLD,
  mockStoragesOf,
  productionRows,
  productionStructureMetadata,
  quarry,
  storageDetail,
  storageRow,
  territoryOf,
} from './fixtures/productionWorld';
import { cobblestoneCycle, quarryProduction } from './fixtures/productionEngine';
import { mockConfiguredYield } from './fixtures/productionYield';
import {
  COBBLESTONE,
  LANE_NORTH,
  NORTH,
  NORTH_DELIVERY,
  ORDER_DELIVERED,
  ORDER_ON_ROAD,
  ORDER_WAITING,
  OUTPUT_FULL,
  SOUTH_DELIVERY,
  UNCONNECTED_ROAD,
  dryRun,
  laneRows,
  mockPaged,
  mockTransportLookups,
  orderOnRoad,
  orderRows,
  quarryTransport,
  transportLaneMetadata,
  transportOrderMetadata,
} from './fixtures/transport';
import type { DisplayConfigurationDto } from '../src/types/dtos/displayConfig/DisplayModels';
import type { FormConfigurationDto } from '../src/types/dtos/forms/FormModels';
import type { GameSettingsDto, GameSettingsUpdateDto } from '../src/types/dtos/gameSettings/GameSettingsModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { PagedQueryDto, PagedResultDto } from '../src/types/dtos/common/PagedQuery';
import type { StorageDto } from '../src/types/dtos/stock/StockDtos';
import type { ProductionOverviewDto } from '../src/types/dtos/production/ProductionEngineDtos';
import type { ProductionStructureDto, ProductionWorldListDto } from '../src/types/dtos/structure/ProductionWorldDtos';
import type { StructureTerritoryDto } from '../src/types/dtos/territory/TerritoryDtos';
import type {
  TransportLaneListDto,
  TransportOrderCreateDto,
  TransportOrderDto,
  TransportOrderListDto,
  TransportPlanDto,
  TransportStructureViewDto,
  TransportSweepResultDto,
} from '../src/types/dtos/production/TransportDtos';
import { mockNoConsumerLogistics } from './fixtures/logistics';

/**
 * Transport core P5 in the web app (PandiO/knk-workspace#682; production DESIGN § 7.1-7.4, § 7.6, § 11.1, decision G17,
 * acceptance A12, A13, A23, insight #65): the order list with its filters, an order's page (status, cargo, route,
 * timeline, Cancel), the manual order page with the dry run, a production structure's transport (warnings, the held
 * trigger, open orders, lanes), the order and lane lists on the dashboard, the transport settings card with Run
 * transport now, and the #838 reads (kind name, blueprint names of consumed inputs). Smoke test: knk-workspace
 * docs/guides/production-storage-transport-smoke-test.md § 6.3.
 */

const nodes = (...held: string[]) => (node: string) => held.includes(node);

test.beforeEach(async ({ page }) => {
  await startLoggedIn(page, 'access-1');
});

/** A detail page: metadata, a one-field display and the realtime hub offline. */
function mockDetailPage(api: Parameters<typeof mockContentDefaults>[0], metadata: EntityMetadataDto, id: string): void {
  mockContentDefaults(api);
  api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [metadata]);
  api.json<DisplayConfigurationDto>('GET', `DisplayConfigurations/entity/${metadata.entityName}`, generalDisplay(metadata.entityName, id));
  api.on('POST', 'hubs/web/negotiate', { status: 404 });
}

test.describe('the order list', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    mockContentDefaults(api);
    api.on('POST', 'hubs/web/negotiate', { status: 404 });
    mockPaged<TransportOrderListDto>(api, 'TransportOrders/search', orderRows);
  });

  test('lists the orders newest first with status in words, route and units, each linking to its page (A12)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    await page.goto('/admin/transport/orders');

    const table = page.getByRole('table', { name: 'Transport orders' });
    const onRoad = table.getByRole('row').filter({ hasText: `#${ORDER_ON_ROAD}` });
    await expect(onRoad).toContainText('On the road');
    await expect(onRoad).toContainText('Quarry');
    await expect(onRoad).toContainText('North - deliveries');
    await expect(onRoad).toContainText('0 of 64 delivered');
    await expect(table.getByRole('row').filter({ hasText: `#${ORDER_DELIVERED}` })).toContainText('North - deliveries → South - deliveries');
    await expect(table.getByRole('row').filter({ hasText: `#${ORDER_WAITING}` })).toContainText('South - deliveries has no room for 30 Cobblestone.');
    await expect(onRoad.getByRole('link', { name: `#${ORDER_ON_ROAD}` })).toHaveAttribute('href', new RegExp(`^/display/TransportOrder/${ORDER_ON_ROAD}`));
    expect(api.calls('POST', 'TransportOrders/search')[0].body).toEqual({ pageNumber: 1, pageSize: 25, sortDescending: true, filters: {} });
    await expect(page.getByRole('link', { name: 'New manual order' })).toBeVisible();
  });

  test('filters by open, status, origin, structure and storage through the URL', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    await page.goto(`/admin/transport/orders?structureId=${QUARRY}`);
    await expect.poll(() => api.calls('POST', 'TransportOrders/search').length).toBe(1);
    expect((api.calls('POST', 'TransportOrders/search')[0].body as { filters: Record<string, string> }).filters).toEqual({ structureId: String(QUARRY) });

    const filters = page.getByRole('form', { name: 'Order filters' });
    await filters.getByLabel('Open or final').selectOption('true');
    await filters.getByLabel('Status').selectOption('AwaitingSpace');
    await filters.getByLabel('Origin').selectOption('Automatic');
    await filters.getByLabel('Storage id').fill(String(SOUTH_DELIVERY));
    await filters.getByRole('button', { name: 'Apply filters' }).click();

    await expect(page).toHaveURL(/open=true/);
    await expect.poll(() => api.calls('POST', 'TransportOrders/search').length).toBe(2);
    expect((api.calls('POST', 'TransportOrders/search')[1].body as { filters: Record<string, string> }).filters).toEqual({
      status: 'AwaitingSpace', origin: 'Automatic', open: 'true', structureId: String(QUARRY), storageId: String(SOUTH_DELIVERY),
    });
  });
});

test.describe('an order', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    mockDetailPage(api, transportOrderMetadata, '830');
  });

  test('shows the status, cargo, the route with distance sources and the timeline oldest first (A12)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<TransportOrderDto>('GET', `TransportOrders/${ORDER_ON_ROAD}`, orderOnRoad());
    await page.goto(`/display/TransportOrder/${ORDER_ON_ROAD}`);

    const panel = page.getByRole('region', { name: 'Transport', exact: true });
    await expect(panel.getByTestId('transport-status')).toHaveText('On the road');
    await expect(panel.getByTestId('transport-carrier')).toHaveText('A worker of Quarry, up to 64 units');
    await expect(panel.getByTestId('transport-source').getByRole('link', { name: 'Quarry - output' }))
      .toHaveAttribute('href', new RegExp(`^/display/Storage/${QUARRY_OUTPUT}`));

    const cargo = panel.getByRole('table', { name: 'Cargo' });
    await expect(cargo.getByRole('row').nth(1)).toHaveText(/Cobblestone\s*64\s*64\s*0\s*0\s*0/);
    await expect(panel.getByTestId('transport-in-transit')).toHaveText('On the road now: 64 × Cobblestone');

    const stop = panel.getByRole('list', { name: 'Route' }).getByRole('listitem', { name: 'Stop 1: North - deliveries' });
    await expect(stop).toContainText('(current)');
    await expect(stop.getByTestId('stop-7011-distance')).toHaveText('431.7 blocks (measured lane)');
    await expect(stop).toContainText('0 of 64 Cobblestone');

    const timeline = panel.getByRole('list', { name: 'Timeline' }).getByRole('listitem');
    await expect(timeline).toHaveCount(4);
    await expect(timeline.nth(0)).toContainText('Created');
    await expect(timeline.nth(0)).toContainText('Output at 80 of 100 units (threshold 75).');
    await expect(timeline.nth(1)).toContainText('Carrier assigned');
    await expect(timeline.nth(2)).toContainText('Loaded');
    await expect(timeline.nth(2).getByRole('link', { name: 'transaction #901' })).toHaveAttribute('href', /^\/display\/StockTransaction\/901/);
    await expect(timeline.nth(3)).toContainText('Departed');
    await expect(timeline.nth(3)).toContainText('Stop: North - deliveries');
  });

  test('an estimated leg, a re-route and a wait are shown in words; a final order has no Cancel', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    const order = orderOnRoad({
      id: ORDER_WAITING, status: 'AwaitingSpace', statusReason: 'South - deliveries has no room for 30 Cobblestone.', waitingSince: '2026-11-20T10:02:00Z',
      stops: [{ ...orderOnRoad().stops[0], distanceSource: 'Estimated', distanceBlocks: 420, status: 'Skipped' },
        { ...orderOnRoad().stops[0], id: 7012, sequence: 2, storageId: SOUTH_DELIVERY, storage: { id: SOUTH_DELIVERY, name: 'South - deliveries' }, reroutedFromStopId: 7011, distanceSource: 'Fallback', distanceBlocks: 200 }],
      currentStopId: 7012, reroutes: 1,
    });
    api.json<TransportOrderDto>('GET', `TransportOrders/${ORDER_WAITING}`, order);
    await page.goto(`/display/TransportOrder/${ORDER_WAITING}`);

    const panel = page.getByRole('region', { name: 'Transport', exact: true });
    await expect(panel.getByTestId('transport-status')).toHaveText('Waiting for room');
    await expect(panel.getByTestId('transport-status-reason')).toHaveText('South - deliveries has no room for 30 Cobblestone.');
    await expect(panel.getByTestId('stop-7011-distance')).toHaveText('420 blocks (estimated (straight line × factor))');
    await expect(panel.getByTestId('stop-7012-distance')).toHaveText('200 blocks (fallback distance)');
    await expect(panel.getByRole('listitem', { name: 'Stop 2: South - deliveries' })).toContainText('re-routed from North - deliveries');
    await expect(panel.getByRole('button', { name: 'Cancel the order' })).toBeVisible();

    api.json<TransportOrderDto>('GET', `TransportOrders/${ORDER_DELIVERED}`, orderOnRoad({ id: ORDER_DELIVERED, status: 'Delivered', isFinal: true, completedAt: '2026-11-20T09:05:00Z' }));
    await page.goto(`/display/TransportOrder/${ORDER_DELIVERED}`);
    await expect(panel.getByTestId('transport-status')).toHaveText('Delivered');
    await expect(panel.getByRole('button', { name: 'Cancel the order' })).toHaveCount(0);
  });

  test('Cancel says what happens, sends the reason and shows the API\'s refusal', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<TransportOrderDto>('GET', `TransportOrders/${ORDER_ON_ROAD}`, orderOnRoad());
    api.on('POST', `TransportOrders/${ORDER_ON_ROAD}/cancel`, { status: 409, body: { error: 'The order is already returning.' } });
    await page.goto(`/display/TransportOrder/${ORDER_ON_ROAD}`);

    const panel = page.getByRole('region', { name: 'Transport', exact: true });
    await panel.getByRole('button', { name: 'Cancel the order' }).click();
    await expect(panel).toContainText('The cargo is loaded: the carrier turns back and the order ends Returned.');
    await panel.getByLabel('Reason (optional)').fill('Wrong warehouse');
    await panel.getByRole('button', { name: 'Cancel the order now' }).click();
    await expect(panel.getByRole('alert')).toHaveText('The order is already returning.');
    expect(api.calls('POST', `TransportOrders/${ORDER_ON_ROAD}/cancel`)[0].body).toEqual({ reason: 'Wrong warehouse' });

    // Accepted: the API answers the order, and the page reads it again.
    api.json<TransportOrderDto>('POST', `TransportOrders/${ORDER_ON_ROAD}/cancel`, orderOnRoad({ status: 'Returning', cancelRequested: true }));
    api.json<TransportOrderDto>('GET', `TransportOrders/${ORDER_ON_ROAD}`, orderOnRoad({ status: 'Returning', cancelRequested: true }));
    await panel.getByRole('button', { name: 'Cancel the order now' }).click();
    await expect(panel.getByTestId('transport-status')).toHaveText('Returning');
    await expect(panel.getByRole('button', { name: 'Cancel the order' })).toHaveCount(0);
  });

  test('without knk.admin.world the order is read only', async ({ page, api }) => {
    mockSession(api, alex, nodes('knk.admin.content'));
    api.json<TransportOrderDto>('GET', `TransportOrders/${ORDER_ON_ROAD}`, orderOnRoad());
    await page.goto(`/display/TransportOrder/${ORDER_ON_ROAD}`);
    await expect(page.getByRole('region', { name: 'Transport', exact: true }).getByRole('button', { name: 'Cancel the order' })).toBeDisabled();
  });
});

test.describe('the manual order page', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    mockContentDefaults(api);
    api.on('POST', 'hubs/web/negotiate', { status: 404 });
    mockSession(api, alex, nodes(WORLD));
    mockTransportLookups(api);
  });

  async function fillStop(page: import('@playwright/test').Page): Promise<void> {
    const stop = page.getByRole('listitem', { name: 'Stop 1' });
    await stop.getByLabel('Stop 1 storage').fill('South');
    await stop.getByRole('button', { name: 'South - deliveries' }).click();
    await stop.getByLabel('Stop 1 item 1').fill('Cobble');
    await stop.getByRole('button', { name: 'Cobblestone' }).click();
    await stop.getByRole('spinbutton', { name: 'Stop 1 amount 1' }).fill('64');
  }

  test('fills the source and carrier from a structure page, dry-runs first, then makes the order once (G17)', async ({ page, api }) => {
    const output = storageRow(QUARRY_OUTPUT, 'Quarry - output', 'Output', QUARRY, 'Quarry', 40);
    api.json<StorageDto>('GET', `Storages/${QUARRY_OUTPUT}`, storageDetail(output, 40));
    api.json<ProductionStructureDto>('GET', `ProductionStructures/${QUARRY}`, quarry());
    api.json<TransportPlanDto>('POST', 'TransportOrders/dry-run', dryRun());
    api.json<TransportOrderDto>('POST', /^TransportOrders\/?$/, orderOnRoad({ id: 704, origin: 'Manual' }));
    api.json<TransportOrderDto>('GET', 'TransportOrders/704', orderOnRoad({ id: 704, origin: 'Manual' }));
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [transportOrderMetadata]);
    api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/TransportOrder', generalDisplay('TransportOrder', '830'));
    await page.goto(`/admin/transport/orders/new?sourceStorageId=${QUARRY_OUTPUT}&carrierStructureId=${QUARRY}`);

    await expect(page.getByText('Quarry - output (#31)')).toBeVisible();
    await expect(page.getByText(`Quarry (#${QUARRY})`)).toBeVisible();
    const make = page.getByRole('button', { name: 'Make the order' });
    await expect(make).toBeDisabled();
    await expect(page.getByRole('list', { name: 'Order problems' })).toContainText('Stop 1: pick its storage.');

    await fillStop(page);
    await expect(page.getByRole('list', { name: 'Order problems' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Dry run' }).click();

    const plan = page.getByRole('region', { name: 'Dry run', exact: true });
    await expect(plan.getByTestId('transport-plan-verdict')).toHaveText('The order can be made.');
    await expect(plan.getByRole('list', { name: 'Plan warnings' })).toContainText('Only 40 of 64 Cobblestone at the source: loading takes 40.');
    await expect(plan.getByRole('table', { name: 'Plan cargo' })).toContainText('40 (short)');
    await expect(plan.getByRole('table', { name: 'Plan legs' }).getByRole('row').nth(1))
      .toHaveText(/1\s*South - deliveries\s*420 blocks \(estimated \(straight line × factor\)\)\s*1 min\s*64 × Cobblestone\s*Uncapped/);
    expect(api.calls('POST', 'TransportOrders/dry-run')[0].body).toEqual({
      sourceStorageId: QUARRY_OUTPUT, carrierStructureId: QUARRY, origin: 'Manual', executeAfter: null, note: null, clientKey: null,
      stops: [{ storageId: SOUTH_DELIVERY, lines: [{ itemBlueprintId: COBBLESTONE, amount: 64 }] }],
    });

    // A change after the dry run asks for a new one.
    await page.getByLabel('Note').fill('Stock the south');
    await expect(make).toBeDisabled();
    await page.getByRole('button', { name: 'Dry run' }).click();
    await expect(make).toBeEnabled();
    await make.click();

    await expect(page).toHaveURL(/\/display\/TransportOrder\/704/);
    const created = api.calls('POST', /^TransportOrders\/?$/);
    expect(created).toHaveLength(1);
    const body = created[0].body as TransportOrderCreateDto;
    expect(body.note).toBe('Stock the south');
    expect(body.clientKey).toMatch(/^web-transport-/);
  });

  test('a plan with errors can\'t be made, and the API\'s refusal of a create is shown', async ({ page, api }) => {
    let valid = false;
    api.on<TransportPlanDto>('POST', 'TransportOrders/dry-run', () => ({
      body: valid ? dryRun({ warnings: [] }) : dryRun({ valid: false, errors: ['No Cobblestone in Quarry - output.'], warnings: [] }),
    }));
    api.on('POST', /^TransportOrders\/?$/, { status: 400, body: { error: 'No Cobblestone in Quarry - output.' } });
    await page.goto('/admin/transport/orders/new');

    await page.getByLabel('Source storage').fill('Quarry');
    await page.getByRole('button', { name: 'Quarry - output' }).click();
    await fillStop(page);
    await page.getByRole('button', { name: 'Dry run' }).click();
    const plan = page.getByRole('region', { name: 'Dry run', exact: true });
    await expect(plan.getByTestId('transport-plan-verdict')).toHaveText("The order can't be made.");
    await expect(plan.getByRole('list', { name: 'Plan errors' })).toHaveText('No Cobblestone in Quarry - output.');
    await expect(page.getByRole('button', { name: 'Make the order' })).toBeDisabled();

    valid = true;
    await page.getByRole('button', { name: 'Dry run' }).click();
    await page.getByRole('button', { name: 'Make the order' }).click();
    await expect(page.getByRole('region', { name: 'Order' }).getByRole('alert')).toHaveText('No Cobblestone in Quarry - output.');
  });

  test('two stops with two items each are sent in visiting order', async ({ page, api }) => {
    api.json<TransportPlanDto>('POST', 'TransportOrders/dry-run', dryRun());
    await page.goto('/admin/transport/orders/new');
    await page.getByLabel('Source storage').fill('Quarry');
    await page.getByRole('button', { name: 'Quarry - output' }).click();
    await fillStop(page);
    const first = page.getByRole('listitem', { name: 'Stop 1' });
    await first.getByRole('button', { name: 'Add an item to stop 1' }).click();
    await first.getByLabel('Stop 1 item 2').fill('Coal');
    await first.getByRole('button', { name: 'Coal' }).click();
    await first.getByRole('spinbutton', { name: 'Stop 1 amount 2' }).fill('4');
    await page.getByRole('button', { name: 'Add a stop' }).click();
    const second = page.getByRole('listitem', { name: 'Stop 2' });
    await second.getByLabel('Stop 2 storage').fill('North');
    await second.getByRole('button', { name: 'North - deliveries' }).click();
    await second.getByLabel('Stop 2 item 1').fill('Cobble');
    await second.getByRole('button', { name: 'Cobblestone' }).click();
    await second.getByRole('spinbutton', { name: 'Stop 2 amount 1' }).fill('10');
    await page.getByRole('button', { name: 'Dry run' }).click();

    await expect.poll(() => api.calls('POST', 'TransportOrders/dry-run').length).toBe(1);
    expect((api.calls('POST', 'TransportOrders/dry-run')[0].body as TransportOrderCreateDto).stops).toEqual([
      { storageId: SOUTH_DELIVERY, lines: [{ itemBlueprintId: COBBLESTONE, amount: 64 }, { itemBlueprintId: 6, amount: 4 }] },
      { storageId: NORTH_DELIVERY, lines: [{ itemBlueprintId: COBBLESTONE, amount: 10 }] },
    ]);
  });
});

test.describe('a production structure\'s transport', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    const output = storageRow(QUARRY_OUTPUT, 'Quarry - output', 'Output', QUARRY, 'Quarry', 100);
    mockDetailPage(api, productionStructureMetadata, '821');
    api.json<ProductionStructureDto>('GET', `ProductionStructures/${QUARRY}`, quarry());
    api.json<StructureTerritoryDto>('GET', `Territory/structures/${QUARRY}`, territoryOf(QUARRY, 'Quarry'));
    api.json('GET', /^Towns\/?$/, [{ id: PHOENIX, name: 'Phoenix', allowEntry: true, requiredTitle: 0 }]);
    mockStoragesOf(api, [output]);
    api.json<StorageDto>('GET', `Storages/${QUARRY_OUTPUT}`, storageDetail(output, 100));
    api.json<ProductionOverviewDto>('GET', `ProductionStructures/${QUARRY}/production`, quarryProduction({ productionKind: null }));
    mockConfiguredYield(api);
    mockPaged<TransportLaneListDto>(api, 'TransportLanes/search', laneRows);
    // Town logistics P9b (#686): the consumer panel, empty here.
    mockNoConsumerLogistics(api);
  });

  test('shows the missing road and the full Output as warnings and why the trigger is held (A13)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<TransportStructureViewDto>('GET', `ProductionStructures/${QUARRY}/transport`, quarryTransport());
    await page.goto(`/display/ProductionStructure/${QUARRY}`);

    const panel = page.getByRole('region', { name: 'Transport', exact: true });
    await expect(panel.getByRole('list', { name: 'Transport warnings' }).getByRole('listitem')).toHaveText([UNCONNECTED_ROAD, OUTPUT_FULL]);
    await expect(panel.getByTestId('transport-output')).toHaveText('100 / 100 units');
    await expect(panel.getByTestId('transport-threshold')).toHaveText('75 units');
    await expect(panel.getByTestId('transport-workers')).toHaveText('1 of 2 present, 1 away carrying');
    await expect(panel.getByRole('list', { name: 'Why it would send an order' })).toHaveText('Output at 100 of 100 units (threshold 75).');
    await expect(panel.getByRole('list', { name: 'Why no order is sent' })).toHaveText('No road connection: automatic transport is held (D5).');
    await expect(panel.getByTestId('transport-destination').getByRole('link')).toHaveAttribute('href', new RegExp(`^/display/Warehouse/${NORTH}`));

    await expect(panel.getByRole('table', { name: 'Open orders' }).getByRole('row').filter({ hasText: `#${ORDER_ON_ROAD}` })).toContainText('On the road');
    await expect(panel.getByRole('link', { name: 'All orders of this structure' })).toHaveAttribute('href', new RegExp(`^/admin/transport/orders\\?structureId=${QUARRY}`));
    await expect(panel.getByRole('link', { name: 'New order from here' }))
      .toHaveAttribute('href', new RegExp(`^/admin/transport/orders/new\\?sourceStorageId=${QUARRY_OUTPUT}&carrierStructureId=${QUARRY}`));

    const lane = panel.getByRole('table', { name: 'Lanes' }).getByRole('row').filter({ hasText: 'Quarry → North' });
    await expect(lane).toContainText('431.7 blocks');
    await expect(lane).toContainText('Plugin');
    await expect(lane.getByRole('link')).toHaveAttribute('href', new RegExp(`^/display/TransportLane/${LANE_NORTH}`));
    expect((api.calls('POST', 'TransportLanes/search')[0].body as { filters: Record<string, string> }).filters).toEqual({ structureId: String(QUARRY) });
  });

  test('shows the order the trigger would make now', async ({ page, api }) => {
    mockSession(api, alex, nodes('knk.admin.content'));
    api.json<TransportStructureViewDto>('GET', `ProductionStructures/${QUARRY}/transport`, quarryTransport({
      roadConnection: 'Connected', warnings: [], heldReasons: [], wouldCreate: dryRun({ warnings: [] }),
    }));
    await page.goto(`/display/ProductionStructure/${QUARRY}`);

    const panel = page.getByRole('region', { name: 'Transport', exact: true });
    const plan = panel.getByRole('region', { name: 'The order the trigger would make' });
    await expect(plan.getByTestId('transport-plan-units')).toHaveText('64 units');
    await expect(plan.getByTestId('transport-plan-time')).toHaveText('1 min');
    await expect(panel.getByRole('list', { name: 'Transport warnings' })).toHaveCount(0);
    // Without knk.admin.world: no manual order or lane links.
    await expect(panel.getByRole('link', { name: 'New order from here' })).toHaveCount(0);
    await expect(panel.getByRole('link', { name: 'Add a lane' })).toHaveCount(0);
  });
});

test.describe('dashboard', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    mockContentDefaults(api);
    mockSession(api, alex, nodes(WORLD));
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [transportOrderMetadata, transportLaneMetadata, productionStructureMetadata]);
    api.json<FormConfigurationDto[]>('GET', /^FormConfigurations\/(TransportOrder|TransportLane|ProductionStructure)$/i, []);
  });

  /** The dashboard's own paging (`page`, `totalPages`). */
  function mockRows<T>(api: Parameters<typeof mockContentDefaults>[0], path: string, rows: T[]): void {
    api.on<PagedResultDto<T>>('POST', path, ({ body }) => {
      const query = body as PagedQueryDto & { pageNumber?: number };
      return { body: { items: rows, totalCount: rows.length, page: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1 } };
    });
  }

  test('lists the orders with status in words and the lanes with their distances (A23)', async ({ page, api }) => {
    mockRows<TransportOrderListDto>(api, 'TransportOrders/search', orderRows);
    mockRows<TransportLaneListDto>(api, 'TransportLanes/search', laneRows);

    await page.goto('/dashboard/TransportOrder');
    const orders = page.getByRole('table');
    await expect(orders.getByRole('row').filter({ hasText: 'Waiting for room' })).toContainText('South - deliveries');
    await expect(orders.getByRole('row').filter({ hasText: 'Manual' })).toContainText('20 of 20');

    await page.goto('/dashboard/TransportLane');
    const lane = page.getByRole('table').getByRole('row').filter({ hasText: 'North' });
    await expect(lane).toContainText('431.7 blocks');
    await expect(lane).toContainText('300 blocks');
    await expect(lane).toContainText('Plugin');
  });

  test('lists production structures with their kind\'s name (#838)', async ({ page, api }) => {
    mockRows<ProductionWorldListDto>(api, 'ProductionStructures/search', productionRows.map(row => ({ ...row, productionKindName: row.id === QUARRY ? 'Quarry kind' : null })));
    await page.goto('/dashboard/ProductionStructure');
    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'Kind', exact: true })).toBeVisible();
    await expect(table.getByRole('row').filter({ hasText: 'Quarry kind' })).toHaveCount(1);
  });
});

test.describe('the production page\'s cycles (#838)', () => {
  test.use({ strictApi: true });

  test('names the blueprints a cycle consumed and links to all cycle records', async ({ page, api }) => {
    const output = storageRow(QUARRY_OUTPUT, 'Quarry - output', 'Output', QUARRY, 'Quarry', 5);
    mockDetailPage(api, productionStructureMetadata, '821');
    mockNoConsumerLogistics(api);
    mockSession(api, alex, nodes(WORLD));
    api.json<ProductionStructureDto>('GET', `ProductionStructures/${QUARRY}`, quarry());
    api.json<StructureTerritoryDto>('GET', `Territory/structures/${QUARRY}`, territoryOf(QUARRY, 'Quarry'));
    api.json('GET', /^Towns\/?$/, [{ id: PHOENIX, name: 'Phoenix', allowEntry: true, requiredTitle: 0 }]);
    mockStoragesOf(api, [output]);
    api.json<StorageDto>('GET', `Storages/${QUARRY_OUTPUT}`, storageDetail(output, 5));
    mockConfiguredYield(api);
    mockPaged<TransportLaneListDto>(api, 'TransportLanes/search', []);
    api.json<TransportStructureViewDto>('GET', `ProductionStructures/${QUARRY}/transport`, quarryTransport({ warnings: [], heldReasons: [], triggerReasons: [], openOrders: [] }));
    const cycle = { ...cobblestoneCycle(), inputs: [{ itemBlueprintId: 7, itemBlueprintName: 'Wheat', consumed: 3 }] };
    api.json<ProductionOverviewDto>('GET', `ProductionStructures/${QUARRY}/production`, quarryProduction({ productionKind: null, recentCycles: [cycle] }));
    await page.goto(`/display/ProductionStructure/${QUARRY}`);

    const production = page.getByRole('region', { name: 'Production', exact: true });
    await production.getByRole('table', { name: 'Recent cycles' }).getByRole('button').first().click();
    await expect(production).toContainText('3 × Wheat');
    await expect(production.getByRole('link', { name: 'All cycle records' })).toHaveAttribute('href', /^\/dashboard\/ProductionCycleRecord/);
  });
});

test.describe('game settings', () => {
  const transport = {
    walkingSpeedBlocksPerSecond: 5, defaultCarrierCapacity: 32, defaultThresholdPercent: 80, defaultThresholdUnits: 64,
    unmeasuredRouteFactor: 1.4, fallbackDistanceBlocks: 200, awaitingSpaceMinutes: 30, maxReroutes: 2, laneMaxAgeHours: 24,
  };
  const stored: GameSettingsDto = {
    ...gameSettings,
    production: {
      enabled: true, territory: { baseRange: 100, powerFactor: 2, capitalMultiplier: 1.5 },
      engine: { baseCycleMinutes: 10, catchUpCapHours: 24, weatherDayMinutes: 20 }, transport,
    },
  };

  test.beforeEach(async ({ api }) => {
    mockSession(api, alex, () => true);
    api.json<GameSettingsDto>('GET', /^GameSettings\/?$/, stored);
    api.on<GameSettingsDto>('PUT', /^GameSettings\/?$/, ({ body }) => ({
      body: { ...stored, ...(body as GameSettingsUpdateDto), settingsVersion: '8' } as GameSettingsDto,
    }));
  });

  test('shows and keeps the transport section on a save of another section, and saves a changed one', async ({ page, api }) => {
    await page.goto('/admin/game-settings');
    const card = page.getByRole('region', { name: 'Transport' });
    await expect(card.getByRole('spinbutton', { name: 'Walking speed (blocks/s)' })).toHaveValue('5');
    await expect(card.getByRole('spinbutton', { name: 'Carrier capacity (units)' })).toHaveValue('32');

    await page.getByRole('region', { name: 'Production engine' }).getByRole('spinbutton', { name: 'Base cycle (minutes)' }).fill('5');
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect.poll(() => api.calls('PUT', /^GameSettings\/?$/).length).toBe(1);
    expect((api.calls('PUT', /^GameSettings\/?$/)[0].body as GameSettingsUpdateDto).production?.transport).toEqual(transport);

    await card.getByRole('spinbutton', { name: 'Re-routes per order' }).fill('11');
    await expect(card.getByRole('list', { name: 'Transport problems' }))
      .toHaveText('production.transport.maxReroutes must be a whole number between 0 and 10.');
    await expect(page.getByRole('button', { name: /^Save/ })).toBeDisabled();
    await card.getByRole('spinbutton', { name: 'Re-routes per order' }).fill('3');
    await card.getByRole('spinbutton', { name: 'Walking speed (blocks/s)' }).fill('4.317');
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect.poll(() => api.calls('PUT', /^GameSettings\/?$/).length).toBe(2);
    expect((api.calls('PUT', /^GameSettings\/?$/)[1].body as GameSettingsUpdateDto).production?.transport)
      .toEqual({ ...transport, maxReroutes: 3, walkingSpeedBlocksPerSecond: 4.317 });
  });

  test('Run transport now reports the sweep, and the API\'s 409 while production is off', async ({ page, api }) => {
    api.json<TransportSweepResultDto>('POST', 'TransportOrders/run-now', {
      featureEnabled: true, ranAt: '2026-11-20T10:05:00Z', ordersCreated: 1, ordersAdvanced: 3, ordersFailed: 0,
    });
    await page.goto('/admin/game-settings');
    const card = page.getByRole('region', { name: 'Transport' });
    await card.getByRole('button', { name: 'Run transport now' }).click();
    await expect(card.getByTestId('transport-run-result')).toHaveText('1 orders created, 3 moved on.');

    api.on('POST', 'TransportOrders/run-now', { status: 409, body: { error: 'Production is turned off (Production:Enabled).' } });
    await card.getByRole('button', { name: 'Run transport now' }).click();
    await expect(card.getByRole('alert')).toHaveText('Production is turned off (Production:Enabled).');
  });
});
