import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { gameSettings, generalDisplay } from './fixtures/territory';
import {
  ECONOMY,
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
  COAL_LINE,
  COBBLE_LINE,
  COBBLESTONE,
  DEFAULT_ZONE,
  FULL_REASON,
  LEVEL_1,
  LEVEL_2,
  OFF_REASON,
  QUARRY_KIND,
  RAIN,
  STEVE,
  STORM,
  climateZoneMetadata,
  cobblestoneCycle,
  cobblestoneLine,
  defaultZone,
  kindRows,
  lineRows,
  mockProductionLookups,
  mockRows,
  modifierRows,
  productionKindLevelMetadata,
  productionKindMetadata,
  productionLineMetadata,
  productionModifierMetadata,
  quarryKind,
  quarryLevels,
  quarryProduction,
  rain,
  weatherTypeMetadata,
  zoneRolls,
} from './fixtures/productionEngine';
import type { DisplayConfigurationDto } from '../src/types/dtos/displayConfig/DisplayModels';
import type { FormConfigurationDto } from '../src/types/dtos/forms/FormModels';
import type { GameSettingsDto, GameSettingsUpdateDto } from '../src/types/dtos/gameSettings/GameSettingsModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { StockPagedResultDto, StorageDto } from '../src/types/dtos/stock/StockDtos';
import type {
  ClimateZoneDto,
  ProductionCycleRecordDto,
  ProductionKindDto,
  ProductionKindLevelDto,
  ProductionLineDto,
  ProductionOverviewDto,
  ProductionSettleResultDto,
  ProductionSweepResultDto,
  ProductionUpgradeResultDto,
  WeatherRollDto,
  WeatherTypeDto,
} from '../src/types/dtos/production/ProductionEngineDtos';
import type { ProductionStructureDto } from '../src/types/dtos/structure/ProductionWorldDtos';
import type { StructureTerritoryDto } from '../src/types/dtos/territory/TerritoryDtos';

/**
 * Production engine P3 in the web app (PandiO/knk-workspace#678; production DESIGN § 9, § 11.1, PRODUCTION_KINDS § 4-5,
 * decisions G8, D4, G17, acceptance A08, A09, A23): the catalogue on the dashboard, a kind's levels, a level's unlocks
 * and upgrade cost, a line's inputs, Settle now and cycles, a climate zone's odds, towns and stored rolls, a weather
 * type's effects, a production structure's production view (why not producing, the rate per modifier, workers, the
 * upgrade with its cost, the cycle trace) and the engine timing on the game settings page. Smoke test: knk-workspace
 * docs/guides/production-storage-transport-smoke-test.md § 4.2.
 */

const nodes = (...held: string[]) => (node: string) => held.includes(node);

test.beforeEach(async ({ page }) => {
  await startLoggedIn(page, 'access-1');
});

/** The detail page of any production engine type: metadata, a one-field display and the realtime hub offline. */
function mockDetailPage(api: Parameters<typeof mockContentDefaults>[0], metadata: EntityMetadataDto, id: string): void {
  mockContentDefaults(api);
  api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [metadata]);
  api.json<DisplayConfigurationDto>('GET', `DisplayConfigurations/entity/${metadata.entityName}`, generalDisplay(metadata.entityName, id));
  api.on('POST', 'hubs/web/negotiate', { status: 404 });
  mockProductionLookups(api);
}

test.describe('dashboard', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    mockContentDefaults(api);
    mockSession(api, alex, nodes(WORLD));
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [productionKindMetadata, productionLineMetadata, productionModifierMetadata]);
    api.json<FormConfigurationDto[]>('GET', /^FormConfigurations\/(ProductionKind|ProductionLine|ProductionModifier)$/i, []);
    mockRows(api, 'ProductionKinds/search', kindRows);
    mockRows(api, 'ProductionLines/search', lineRows);
    mockRows(api, 'ProductionModifiers/search', modifierRows);
  });

  test('lists the kinds with their area model, category, default workers and structures', async ({ page }) => {
    await page.goto('/dashboard/ProductionKind');

    const table = page.getByRole('table');
    for (const header of ['Area model', 'Resource category', 'Default workers', 'Structures', 'Active']) {
      await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
    }
    const row = table.getByRole('row').filter({ hasText: 'Quarry' });
    await expect(row).toContainText('ExclusiveVolume');
    await expect(row).toContainText('Stone');
  });

  test('lists the lines with their rate and state, a blocked one in words (D4)', async ({ page }) => {
    await page.goto('/dashboard/ProductionLine');

    const table = page.getByRole('table');
    await expect(table.getByRole('row').filter({ hasText: 'Cobblestone' })).toContainText('10/h');
    await expect(table.getByRole('row').filter({ hasText: 'Coal' })).toContainText('Blocked: output storage full');
  });

  test('lists the modifiers with their scope, effect and window', async ({ page }) => {
    await page.goto('/dashboard/ProductionModifier');

    const row = page.getByRole('table').getByRole('row').filter({ hasText: 'Festival' });
    await expect(row).toContainText(`Town #${PHOENIX}`);
    await expect(row).toContainText('+2/h');
    await expect(row).toContainText('From 2026-11-19 00:00');
  });
});

test.describe('kinds and levels', () => {
  test.use({ strictApi: true });

  test('a kind\'s page lists its levels with multipliers, caps, upgrade cost and unlocks (A09)', async ({ page, api }) => {
    mockDetailPage(api, productionKindMetadata, '831');
    mockSession(api, alex, nodes(WORLD));
    api.json<ProductionKindDto>('GET', `ProductionKinds/${QUARRY_KIND}`, quarryKind());
    await page.goto(`/display/ProductionKind/${QUARRY_KIND}`);

    const levels = page.getByRole('region', { name: 'Levels' }).getByRole('table', { name: 'Levels' });
    const two = levels.getByRole('row').filter({ hasText: 'Level 2' });
    await expect(two).toContainText('× 1.1');
    await expect(two).toContainText('2000');
    await expect(two).toContainText('500');
    await expect(two).toContainText('64 × Cobblestone');
    await expect(two).toContainText('Coal');
    await expect(two.getByRole('link', { name: 'Level 2' })).toHaveAttribute('href', new RegExp(`^/display/ProductionKindLevel/${LEVEL_2}`));
  });

  test('edits a level\'s unlocks and upgrade cost; the list replaces the stored one (G8, G17)', async ({ page, api }) => {
    mockDetailPage(api, productionKindLevelMetadata, '832');
    mockSession(api, alex, nodes(WORLD));
    let stored = quarryLevels()[0];
    api.on<ProductionKindLevelDto>('GET', `ProductionKindLevels/${LEVEL_1}`, () => ({ body: stored }));
    api.on('PUT', `ProductionKindLevels/${LEVEL_1}`, ({ body }) => {
      stored = { ...stored, items: (body as ProductionKindLevelDto).items };
      return { status: 204 };
    });
    await page.goto(`/display/ProductionKindLevel/${LEVEL_1}`);

    const panel = page.getByRole('region', { name: 'Unlocks and upgrade cost' });
    await expect(panel).toContainText('No unlocks and no upgrade cost.');
    await panel.getByRole('button', { name: 'Add item' }).click();
    const item = panel.getByRole('listitem', { name: 'Item 1' });
    await item.getByPlaceholder('Search blueprint…').fill('Cobble');
    await item.getByRole('button', { name: 'Cobblestone' }).click();
    // An upgrade cost needs an amount: Save stays off until there is one.
    await expect(panel.getByRole('list', { name: 'Problems' })).toHaveText('An upgrade cost needs a whole amount above 0.');
    await expect(panel.getByRole('button', { name: 'Save items' })).toBeDisabled();
    await item.getByRole('spinbutton', { name: 'Amount' }).fill('32');

    await panel.getByRole('button', { name: 'Add item' }).click();
    const unlock = panel.getByRole('listitem', { name: 'Item 2' });
    await unlock.getByRole('combobox', { name: 'Role' }).selectOption('Unlock');
    await expect(unlock.getByRole('spinbutton', { name: 'Amount' })).toBeDisabled();
    await unlock.getByPlaceholder('Search blueprint…').fill('Coal');
    await unlock.getByRole('button', { name: 'Coal' }).click();
    await panel.getByRole('button', { name: 'Save items' }).click();

    await expect.poll(() => api.calls('PUT', `ProductionKindLevels/${LEVEL_1}`).length).toBe(1);
    const sent = api.calls('PUT', `ProductionKindLevels/${LEVEL_1}`)[0].body as ProductionKindLevelDto;
    expect(sent.id).toBe(LEVEL_1);
    expect(sent.items).toEqual([
      { role: 'UpgradeCost', itemBlueprintId: COBBLESTONE, amount: 32 },
      { role: 'Unlock', itemBlueprintId: COAL, amount: 0 },
    ]);
  });
});

test.describe('a line', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    mockDetailPage(api, productionLineMetadata, '833');
    api.on<StockPagedResultDto<ProductionCycleRecordDto>>('POST', 'ProductionCycleRecords/search', ({ body }) => {
      const lineId = Number((body as { filters?: Record<string, string> }).filters?.productionLineId);
      const items = [cobblestoneCycle()].filter(c => c.productionLineId === lineId);
      return { body: { items, totalCount: items.length, pageNumber: 1, pageSize: 20 } };
    });
  });

  test('shows its state and adds an input taken per hour; the list replaces the stored one', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    let stored = cobblestoneLine();
    api.on<ProductionLineDto>('GET', `ProductionLines/${COBBLE_LINE}`, () => ({ body: stored }));
    api.on('PUT', `ProductionLines/${COBBLE_LINE}`, ({ body }) => {
      const inputs = (body as ProductionLineDto).inputs ?? [];
      stored = { ...stored, inputs: inputs.map(i => ({ ...i, itemBlueprintName: 'Coal', accrued: 0 })) };
      return { status: 204 };
    });
    await page.goto(`/display/ProductionLine/${COBBLE_LINE}`);

    const panel = page.getByRole('region', { name: 'Production line' });
    await expect(panel.getByTestId('line-status')).toHaveText('Running');
    await expect(panel.getByRole('link', { name: 'Quarry' })).toHaveAttribute('href', new RegExp(`^/display/ProductionStructure/${QUARRY}`));
    await expect(panel.getByRole('table', { name: 'Line cycles' }).getByRole('row').nth(1)).toContainText('4 of 4');

    await panel.getByRole('button', { name: 'Add input' }).click();
    const input = panel.getByRole('listitem', { name: 'Input 1' });
    await input.getByPlaceholder('Search blueprint…').fill('Coal');
    await input.getByRole('button', { name: 'Coal' }).click();
    await input.getByRole('spinbutton', { name: 'Per hour' }).fill('0.5');
    await panel.getByRole('button', { name: 'Save inputs' }).click();

    await expect.poll(() => api.calls('PUT', `ProductionLines/${COBBLE_LINE}`).length).toBe(1);
    expect(api.calls('PUT', `ProductionLines/${COBBLE_LINE}`)[0].body)
      .toEqual({ id: COBBLE_LINE, inputs: [{ itemBlueprintId: COAL, amountPerHour: 0.5 }] });
    await expect(panel.getByRole('listitem', { name: 'Input 1' })).toContainText('Coal');
    await expect(panel.getByRole('button', { name: 'Save inputs' })).toBeDisabled();
  });

  test('Settle now settles the line; while production is off the API\'s reason is shown (A21)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<ProductionLineDto>('GET', `ProductionLines/${COBBLE_LINE}`, cobblestoneLine());
    api.json<ProductionSettleResultDto>('POST', `ProductionLines/${COBBLE_LINE}/settle`, { settled: true, cycle: cobblestoneCycle() });
    await page.goto(`/display/ProductionLine/${COBBLE_LINE}`);

    const panel = page.getByRole('region', { name: 'Production line' });
    await panel.getByRole('button', { name: 'Settle now' }).click();
    await expect(page.getByText('Settled: 4 of 4 accepted.')).toBeVisible();

    api.on('POST', `ProductionLines/${COBBLE_LINE}/settle`, { status: 409, body: { error: 'Production is turned off (Production:Enabled).' } });
    await panel.getByRole('button', { name: 'Settle now' }).click();
    await expect(panel.getByRole('alert')).toHaveText('Production is turned off (Production:Enabled).');
  });
});

test.describe('weather', () => {
  test.use({ strictApi: true });

  test('a climate zone: odds at most 100% with the rest clear, a town added, the stored rolls', async ({ page, api }) => {
    mockDetailPage(api, climateZoneMetadata, '834');
    mockSession(api, alex, nodes(WORLD));
    let stored = defaultZone();
    api.on<ClimateZoneDto>('GET', `ClimateZones/${DEFAULT_ZONE}`, () => ({ body: stored }));
    api.on('PUT', `ClimateZones/${DEFAULT_ZONE}`, ({ body }) => {
      const sent = body as ClimateZoneDto;
      if (sent.weatherOdds) {
        stored = { ...stored, weatherOdds: sent.weatherOdds.map(o => ({ ...o, weatherTypeName: o.weatherTypeId === RAIN ? 'Rain' : 'Storm' })) };
      }
      if (sent.towns) stored = { ...stored, towns: sent.towns.map(t => ({ ...t, townName: t.townId === PHOENIX ? 'Phoenix' : 'Rivertown' })) };
      return { status: 204 };
    });
    api.on<StockPagedResultDto<WeatherRollDto>>('POST', 'ClimateZones/rolls/search', {
      body: { items: zoneRolls, totalCount: 40, pageNumber: 1, pageSize: 30 },
    });
    await page.goto(`/display/ClimateZone/${DEFAULT_ZONE}`);

    const panel = page.getByRole('region', { name: 'Weather', exact: true });
    await expect(panel.getByTestId('climate-zone-default')).toBeVisible();
    await expect(panel.getByTestId('climate-zone-clear')).toHaveText('Together 30%; clear 70%.');
    const rolls = panel.getByRole('table', { name: 'Weather rolls' });
    await expect(rolls.getByRole('row').nth(1)).toContainText('Rain');
    await expect(rolls.getByRole('row').nth(2)).toContainText('Clear');
    await expect(panel).toContainText('The newest 2 of 40 rolls.');
    const search = api.calls('POST', 'ClimateZones/rolls/search')[0].body as { filters?: Record<string, string> };
    expect(search.filters).toEqual({ climateZoneId: String(DEFAULT_ZONE) });

    await panel.getByRole('button', { name: 'Add weather type' }).click();
    const storm = panel.getByRole('listitem', { name: 'Weather 2' });
    await storm.getByPlaceholder('Search weather type…').fill('Storm');
    await storm.getByRole('button', { name: 'Storm' }).click();
    await storm.getByRole('spinbutton', { name: 'Chance %' }).fill('80');
    await expect(panel.getByRole('list', { name: 'Problems' })).toHaveText('The chances add up to 110%: at most 100%.');
    await expect(panel.getByRole('button', { name: 'Save odds' })).toBeDisabled();
    await storm.getByRole('spinbutton', { name: 'Chance %' }).fill('10');
    await expect(panel.getByTestId('climate-zone-clear')).toHaveText('Together 40%; clear 60%.');
    await panel.getByRole('button', { name: 'Save odds' }).click();
    await expect.poll(() => api.calls('PUT', `ClimateZones/${DEFAULT_ZONE}`).length).toBe(1);
    expect(api.calls('PUT', `ClimateZones/${DEFAULT_ZONE}`)[0].body).toEqual({
      id: DEFAULT_ZONE,
      weatherOdds: [{ weatherTypeId: RAIN, chancePercent: 30 }, { weatherTypeId: STORM, chancePercent: 10 }],
    });

    await panel.getByPlaceholder('Search town…').fill('River');
    await panel.getByRole('button', { name: 'Rivertown' }).click();
    await panel.getByRole('button', { name: 'Add town' }).click();
    await panel.getByRole('button', { name: 'Save towns' }).click();
    await expect.poll(() => api.calls('PUT', `ClimateZones/${DEFAULT_ZONE}`).length).toBe(2);
    expect(api.calls('PUT', `ClimateZones/${DEFAULT_ZONE}`)[1].body).toEqual({ id: DEFAULT_ZONE, towns: [{ townId: PHOENIX }, { townId: 5 }] });
    await expect(panel.getByRole('list', { name: 'Towns' }).getByRole('link', { name: 'Rivertown' })).toBeVisible();
  });

  test('a weather type\'s effects per category', async ({ page, api }) => {
    mockDetailPage(api, weatherTypeMetadata, '835');
    mockSession(api, alex, nodes(WORLD));
    api.json<WeatherTypeDto>('GET', `WeatherTypes/${RAIN}`, rain());
    api.on('PUT', `WeatherTypes/${RAIN}`, { status: 204 });
    await page.goto(`/display/WeatherType/${RAIN}`);

    const panel = page.getByRole('region', { name: 'Effects', exact: true });
    await expect(panel.getByRole('listitem', { name: 'Effect 1' }).getByRole('combobox', { name: 'Category' })).toHaveValue('Crops');
    await panel.getByRole('button', { name: 'Add effect' }).click();
    const second = panel.getByRole('listitem', { name: 'Effect 2' });
    await expect(panel.getByRole('list', { name: 'Problems' })).toHaveText('A category has the same effect twice.');
    await second.getByRole('combobox', { name: 'Category' }).selectOption('Stone');
    await second.getByRole('spinbutton', { name: 'Value' }).fill('0.8');
    await expect(second).toContainText('× 0.8');
    await panel.getByRole('button', { name: 'Save effects' }).click();

    await expect.poll(() => api.calls('PUT', `WeatherTypes/${RAIN}`).length).toBe(1);
    expect(api.calls('PUT', `WeatherTypes/${RAIN}`)[0].body).toEqual({
      id: RAIN,
      effects: [{ category: 'Crops', effect: 'Multiply', value: 1.2 }, { category: 'Stone', effect: 'Multiply', value: 0.8 }],
    });
  });
});

test.describe('the production structure page', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    const output = storageRow(QUARRY_OUTPUT, 'Quarry - output', 'Output', QUARRY, 'Quarry', 5);
    mockDetailPage(api, productionStructureMetadata, '821');
    api.json<ProductionStructureDto>('GET', `ProductionStructures/${QUARRY}`, { ...quarry(), productionKindId: QUARRY_KIND, productionKind: { id: QUARRY_KIND, name: 'Quarry' } });
    api.json<StructureTerritoryDto>('GET', `Territory/structures/${QUARRY}`, territoryOf(QUARRY, 'Quarry', 'Contested'));
    api.json('GET', /^Towns\/?$/, [{ id: PHOENIX, name: 'Phoenix', allowEntry: true, requiredTitle: 0 }]);
    mockStoragesOf(api, [output]);
    api.json<StorageDto>('GET', `Storages/${QUARRY_OUTPUT}`, storageDetail(output, 5));
    api.json<ProductionKindDto>('GET', `ProductionKinds/${QUARRY_KIND}`, quarryKind());
  });

  test('shows each line\'s rate with its modifiers in order and why the blocked one is not producing (A08, D4)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, ECONOMY));
    api.json<ProductionOverviewDto>('GET', `ProductionStructures/${QUARRY}/production`, quarryProduction());
    await page.goto(`/display/ProductionStructure/${QUARRY}`);

    const panel = page.getByRole('region', { name: 'Production', exact: true });
    await expect(panel.getByTestId('production-kind').getByRole('link', { name: 'Quarry' }))
      .toHaveAttribute('href', new RegExp(`^/display/ProductionKind/${QUARRY_KIND}`));
    await expect(panel.getByTestId('production-level')).toHaveText('1 of 10');
    await expect(panel.getByTestId('production-weather')).toHaveText('Rain');
    await expect(panel.getByRole('list', { name: 'Why it is not producing' })).toHaveCount(0);

    const rate = panel.getByRole('table', { name: 'Rate of Cobblestone' });
    await expect(rate.getByRole('row')).toHaveText([
      /Step\s*Change\s*Rate/,
      /Base rate\s*10\/h\s*10\/h/,
      /Admin: Festival\s*\+2\/h\s*12\/h/,
      /Weather: Rain\s*× 0.5\s*6\/h/,
      /Workers present\s*× 50%\s*3\/h/,
      /Effective rate\s*3\/h/,
    ]);
    await expect(panel.getByTestId(`line-${COAL_LINE}-status`)).toHaveText('Blocked: output storage full, 2/h');
    await expect(panel.getByRole('list', { name: 'Why Coal is not producing' })).toHaveText(FULL_REASON);
    await expect(panel.getByRole('link', { name: 'Cobblestone' }).first()).toHaveAttribute('href', new RegExp(`^/display/ProductionLine/${COBBLE_LINE}`));
  });

  test('the cycle trace lists each applied modifier, the workers and the ledger transaction (A08, #65)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<ProductionOverviewDto>('GET', `ProductionStructures/${QUARRY}/production`, quarryProduction());
    await page.goto(`/display/ProductionStructure/${QUARRY}`);

    const cycles = page.getByRole('region', { name: 'Production', exact: true }).getByRole('table', { name: 'Recent cycles' });
    const coal = cycles.getByTestId('cycle-502');
    await expect(coal).toContainText('0 of 2');
    await expect(coal).toContainText('Blocked: output storage full');
    await expect(coal).toContainText('The output storage refused 2 units (full).');

    const cobble = cycles.getByTestId('cycle-501');
    await expect(cobble).toContainText('1 h 10 min');
    await cobble.getByRole('button', { name: 'Trace' }).click();
    const trace = cycles.getByRole('table', { name: 'Trace of cycle 501' });
    await expect(trace).toContainText('Admin: Festival');
    await expect(trace).toContainText('Weather: Rain');
    await expect(trace.getByRole('row').last()).toContainText('3/h');
    await expect(cycles).toContainText('1 of 2');
    await expect(cycles.getByRole('link', { name: 'Transaction #901' })).toHaveAttribute('href', /^\/display\/StockTransaction\/901/);
  });

  test('the structure-wide reasons when production is off', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<ProductionOverviewDto>('GET', `ProductionStructures/${QUARRY}/production`,
      quarryProduction({ featureEnabled: false, notProducingReasons: [OFF_REASON] }));
    await page.goto(`/display/ProductionStructure/${QUARRY}`);

    await expect(page.getByRole('region', { name: 'Production', exact: true }).getByRole('list', { name: 'Why it is not producing' })).toHaveText(OFF_REASON);
  });

  test('sets the workers present within the structure\'s total', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    let overview = quarryProduction();
    api.on<ProductionOverviewDto>('GET', `ProductionStructures/${QUARRY}/production`, () => ({ body: overview }));
    api.on<ProductionOverviewDto>('PUT', `ProductionStructures/${QUARRY}/workers`, ({ body }) => {
      overview = { ...overview, workersPresent: (body as { workersPresent: number }).workersPresent };
      return { body: overview };
    });
    await page.goto(`/display/ProductionStructure/${QUARRY}`);

    const panel = page.getByRole('region', { name: 'Production', exact: true });
    const workers = panel.getByRole('spinbutton', { name: 'Workers present (of 2)' });
    await expect(workers).toHaveValue('1');
    await workers.fill('3');
    await expect(panel).toContainText('A whole number from 0 to 2.');
    await expect(panel.getByRole('button', { name: 'Save workers' })).toBeDisabled();
    await workers.fill('2');
    await panel.getByRole('button', { name: 'Save workers' }).click();

    await expect.poll(() => api.calls('PUT', `ProductionStructures/${QUARRY}/workers`).length).toBe(1);
    expect(api.calls('PUT', `ProductionStructures/${QUARRY}/workers`)[0].body).toEqual({ workersPresent: 2 });
    await expect(workers).toHaveValue('2');
  });

  test('upgrades with the cost shown first; a refused upgrade shows the API\'s reason (A09)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, ECONOMY));
    let overview = quarryProduction();
    api.on<ProductionOverviewDto>('GET', `ProductionStructures/${QUARRY}/production`, () => ({ body: overview }));
    api.on('POST', `ProductionStructures/${QUARRY}/upgrade`, { status: 409, body: { error: 'Not enough Cobblestone in Quarry - output: 5 of 64.' } });
    await page.goto(`/display/ProductionStructure/${QUARRY}`);

    const panel = page.getByRole('region', { name: 'Production', exact: true });
    const cost = panel.getByTestId('upgrade-cost');
    await expect(cost).toContainText('Level 2 costs 500 coins and 64 × Cobblestone.');
    // The level costs coins: someone has to pay before the button works.
    await expect(cost.getByRole('button', { name: 'Upgrade to level 2' })).toBeDisabled();
    await cost.getByPlaceholder('Search paid by (coins)…').fill('Ste');
    await cost.getByRole('button', { name: 'Steve' }).click();
    await cost.getByRole('button', { name: 'Upgrade to level 2' }).click();
    await cost.getByRole('button', { name: 'Pay and upgrade' }).click();
    await expect(panel.getByRole('alert')).toHaveText('Not enough Cobblestone in Quarry - output: 5 of 64.');
    expect(api.calls('POST', `ProductionStructures/${QUARRY}/upgrade`)[0].body).toEqual({ payerUserId: STEVE, payFromStorageId: null });

    api.on<ProductionUpgradeResultDto>('POST', `ProductionStructures/${QUARRY}/upgrade`, () => {
      overview = { ...overview, level: 2 };
      return { body: { productionStructureId: QUARRY, fromLevel: 1, toLevel: 2, coinsPaid: 500, stockTransactionId: 905, currencyTransactionId: 'c-1' } };
    });
    await cost.getByRole('button', { name: 'Pay and upgrade' }).click();
    await expect(panel.getByTestId('upgrade-result')).toContainText('Upgraded from level 1 to 2, 500 coins paid, resources: transaction #905.');
    await expect(panel.getByTestId('production-level')).toHaveText('2 of 10');
    // Level 2 is the highest in this fixture.
    await expect(panel.getByTestId('upgrade-top')).toHaveText('Level 2 is the highest level.');
  });

  test('staff without knk.economy.admin see the cost but cannot upgrade', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<ProductionOverviewDto>('GET', `ProductionStructures/${QUARRY}/production`, quarryProduction());
    await page.goto(`/display/ProductionStructure/${QUARRY}`);

    const cost = page.getByRole('region', { name: 'Production', exact: true }).getByTestId('upgrade-cost');
    await expect(cost).toContainText('Level 2 costs 500 coins');
    await expect(cost.getByRole('button', { name: 'Upgrade to level 2' })).toBeDisabled();
    await expect(cost).toContainText('Requires knk.economy.admin');
  });
});

test.describe('game settings', () => {
  const stored: GameSettingsDto = {
    ...gameSettings,
    production: { enabled: true, territory: { baseRange: 100, powerFactor: 2, capitalMultiplier: 1.5 }, engine: { baseCycleMinutes: 5, catchUpCapHours: 48, weatherDayMinutes: 20 } },
  };

  test.beforeEach(async ({ api }) => {
    mockSession(api, alex, () => true);
    api.json<GameSettingsDto>('GET', /^GameSettings\/?$/, stored);
    api.on<GameSettingsDto>('PUT', /^GameSettings\/?$/, ({ body }) => ({
      body: { ...stored, ...(body as GameSettingsUpdateDto), settingsVersion: '8' } as GameSettingsDto,
    }));
  });

  test('keeps the engine timing on a save of another section, and saves a changed one', async ({ page, api }) => {
    await page.goto('/admin/game-settings');
    const engine = page.getByRole('region', { name: 'Production engine' });
    await expect(engine.getByRole('spinbutton', { name: 'Base cycle (minutes)' })).toHaveValue('5');
    await expect(engine.getByRole('spinbutton', { name: 'Catch-up cap (hours)' })).toHaveValue('48');

    await page.getByRole('region', { name: 'Production and territory' }).getByRole('spinbutton', { name: 'Blocks per power point' }).fill('3');
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect.poll(() => api.calls('PUT', /^GameSettings\/?$/).length).toBe(1);
    expect((api.calls('PUT', /^GameSettings\/?$/)[0].body as GameSettingsUpdateDto).production?.engine)
      .toEqual({ baseCycleMinutes: 5, catchUpCapHours: 48, weatherDayMinutes: 20 });

    await engine.getByRole('spinbutton', { name: 'Weather day (minutes)' }).fill('0');
    await expect(engine.getByRole('list', { name: 'Production engine problems' }))
      .toHaveText('production.engine.weatherDayMinutes must be a whole number between 1 and 10080.');
    await expect(page.getByRole('button', { name: /^Save/ })).toBeDisabled();
    await engine.getByRole('spinbutton', { name: 'Weather day (minutes)' }).fill('30');
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect.poll(() => api.calls('PUT', /^GameSettings\/?$/).length).toBe(2);
    expect((api.calls('PUT', /^GameSettings\/?$/)[1].body as GameSettingsUpdateDto).production?.engine)
      .toEqual({ baseCycleMinutes: 5, catchUpCapHours: 48, weatherDayMinutes: 30 });
  });

  test('Run production now reports what the sweep did', async ({ page, api }) => {
    api.json<ProductionSweepResultDto>('POST', 'Production/run-now', {
      featureEnabled: true, ranAt: '2026-11-19T14:05:00Z', weatherRolled: 1, linesSettled: 2, unitsEmitted: 6, unitsAccepted: 4, linesFailed: 0,
    });
    await page.goto('/admin/game-settings');
    const engine = page.getByRole('region', { name: 'Production engine' });
    await engine.getByRole('button', { name: 'Run production now' }).click();
    await expect(engine.getByTestId('production-run-result')).toHaveText('2 lines settled, 4 of 6 units accepted, 1 weather rolls.');
  });
});
