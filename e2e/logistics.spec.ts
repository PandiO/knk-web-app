import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { accessMetadata } from './fixtures/dashboardAccess';
import { gameSettings, generalDisplay, mockNoTownTerritory, phoenixTown } from './fixtures/territory';
import { MARKET_WAREHOUSE, marketWarehouse, mill, mockStoragesOf, productionStructureMetadata, storageDetail, storageRow, territoryOf, warehouseMetadata } from './fixtures/productionWorld';
import { mockConfiguredYield } from './fixtures/productionYield';
import { mockNoTransport } from './fixtures/transport';
import {
  BAKERY,
  BAKERY_INPUTS,
  COAL,
  COLLECTION_ORDER,
  GARRISON,
  IRON_ORE,
  MARKET,
  NORTH,
  PHOENIX,
  POLICY_V1,
  POLICY_V2,
  RESERVATION,
  RUN,
  SOUTH,
  TEMPLATE,
  WORLD,
  bakeryConsumer,
  bakerySettings,
  farmingTemplate,
  lastRun,
  logisticsPolicyMetadata,
  logisticsReservationMetadata,
  logisticsRunMetadata,
  mockLogisticsLookups,
  mockPaged,
  openReservation,
  phoenixDryRun,
  phoenixPolicy,
  phoenixServiceAreas,
  phoenixSupply,
  policyVersions,
  reservationDetail,
  storedRun,
  templateRow,
} from './fixtures/logistics';
import { mockNoTownAccount } from './fixtures/shops';
import type { DisplayConfigurationDto } from '../src/types/dtos/displayConfig/DisplayModels';
import type { GameSettingsDto, GameSettingsUpdateDto } from '../src/types/dtos/gameSettings/GameSettingsModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { StorageDto } from '../src/types/dtos/stock/StockDtos';
import type { ProductionOverviewDto } from '../src/types/dtos/production/ProductionEngineDtos';
import type { ProductionStructureDto, WarehouseDto } from '../src/types/dtos/structure/ProductionWorldDtos';
import type { StructureTerritoryDto } from '../src/types/dtos/territory/TerritoryDtos';
import type {
  ConsumerReplenishmentDto,
  ConsumerReplenishmentListDto,
  ConsumerViewDto,
  LogisticsPlanDto,
  LogisticsPlannerRunDto,
  LogisticsPlannerRunListDto,
  LogisticsPolicyDto,
  LogisticsPolicyListDto,
  LogisticsPolicyUpdateDto,
  LogisticsReservationDto,
  LogisticsReservationListDto,
  TownServiceAreasDto,
  TownSupplyDto,
} from '../src/types/dtos/production/LogisticsDtos';

/**
 * Town logistics P9b in the web app (PandiO/knk-workspace#686; TOWN_LOGISTICS § 2-5, decisions D-L1-D-L3, G17,
 * acceptance A17, A23, insight #65 town logistics): a town's supply, reservations, planner dry run and Run now with the
 * explanation per consumer line, service areas, runs and Apply a template; the policy editor (rules of the V1 types,
 * versions, templates); a consumer's demand and replenishment settings; a warehouse's service area and policy; a planner
 * run and a reservation with Release; the Town logistics page; the settings card. Smoke test: knk-workspace
 * docs/guides/production-storage-transport-smoke-test.md § 10.2.
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

test.describe("a town's logistics", () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    mockDetailPage(api, accessMetadata('Town', WORLD), '840');
    api.json('GET', `Towns/${PHOENIX}`, phoenixTown);
    api.on('POST', 'landmarks/search', { body: { items: [], totalCount: 0, page: 1, pageSize: 100, totalPages: 0 } });
    mockNoTownTerritory(api, PHOENIX);
    api.json<TownSupplyDto>('GET', `Logistics/towns/${PHOENIX}/supply`, phoenixSupply());
    api.json<TownServiceAreasDto>('GET', `Logistics/towns/${PHOENIX}/service-areas`, phoenixServiceAreas);
    mockPaged<LogisticsPlannerRunListDto>(api, 'LogisticsPlannerRuns/search', [lastRun]);
    mockNoTownAccount(api, PHOENIX);
  });

  test('shows the supply per item across the warehouses, the reservations, the policy and the runs (A17, #65)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    await page.goto(`/display/Town/${PHOENIX}`);

    const panel = page.getByRole('region', { name: 'Town logistics' });
    await expect(panel.getByTestId('town-logistics-policy').getByRole('link', { name: `the town's policy (#${POLICY_V2})` }))
      .toHaveAttribute('href', new RegExp(`^/display/LogisticsPolicy/${POLICY_V2}`));
    await expect(panel.getByTestId('town-logistics-warehouses')).toHaveText('North, South');
    await expect(panel.getByTestId('town-logistics-last-run')).toContainText('(Scheduled): 1 reserved (30 units) in 1 collection order(s); 1 short');
    await expect(panel.getByTestId('town-logistics-next-run')).not.toHaveText('Never');
    await expect(panel.getByTestId('town-logistics-low')).toHaveText(/Coal \(nothing available\), Iron ore \(2\.5 days\)/);

    const supply = panel.getByRole('table', { name: 'Town supply' });
    await expect(supply.getByRole('row').nth(1)).toHaveText(/Coal\s*100\s*70\s*30\s*0\s*24\s*10\s*10 days\s*North: 100 \(available 0\); South: 0 \(available 0\)/);
    await expect(supply.getByRole('row').nth(2)).toHaveText(/Iron ore\s*20\s*0\s*0\s*20\s*0\s*8\s*2\.5 days/);

    const reservations = panel.getByRole('table', { name: 'Open reservations' });
    const row = reservations.getByRole('row').filter({ hasText: `#${RESERVATION}` });
    await expect(row).toContainText('Garrison');
    await expect(row).toContainText('0 of 30');
    await expect(row).toContainText('Open (waiting for its worker) · Critical');
    await expect(row.getByRole('link', { name: `#${COLLECTION_ORDER}` })).toHaveAttribute('href', new RegExp(`^/display/TransportOrder/${COLLECTION_ORDER}`));

    const areas = panel.getByRole('table', { name: 'Service areas' });
    await expect(areas.getByRole('row').nth(1)).toHaveText(/District Market\s*South\s*Service area rule #403/);
    await expect(areas.getByRole('row').nth(2)).toHaveText(/The rural territory\s*North\s*Nearest by road/);
    await expect(areas.getByRole('row').nth(3).getByRole('link', { name: 'Bakery' })).toHaveAttribute('href', new RegExp(`^/display/Structure/${BAKERY}`));

    await expect(panel.getByRole('table', { name: 'Recent planner runs' }).getByRole('link', { name: `#${RUN}` }))
      .toHaveAttribute('href', new RegExp(`^/display/LogisticsPlannerRun/${RUN}`));
    expect(api.calls('POST', 'LogisticsPlannerRuns/search')[0].body).toEqual({ pageNumber: 1, pageSize: 5, filters: { townId: String(PHOENIX) } });
  });

  test('a dry run explains every consumer line, why the bakery got nothing, and writes nothing (A17)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<LogisticsPlanDto>('POST', `Logistics/towns/${PHOENIX}/dry-run`, phoenixDryRun());
    await page.goto(`/display/Town/${PHOENIX}`);

    const panel = page.getByRole('region', { name: 'Town logistics' });
    await panel.getByRole('button', { name: 'Dry run' }).click();
    const plan = panel.getByRole('region', { name: 'Dry run' });
    await expect(panel.getByTestId('logistics-plan-meta')).toContainText('Dry run: nothing was written. Policy: Phoenix logistics v2 (the town\'s policy).');
    await expect(plan.getByTestId('logistics-plan-summary')).toHaveText('1 reserved (30 units) in 1 collection order(s); 1 held');
    await expect(plan.getByRole('list', { name: 'Plan warnings' })).toHaveText('Production is off: this is a dry run only.');

    const lines = plan.getByRole('list', { name: 'Consumer lines' }).getByRole('listitem');
    await expect(lines).toHaveCount(2);
    await expect(lines.nth(0)).toHaveAccessibleName('Garrison: Coal');
    await expect(lines.nth(0).getByTestId('plan-entry-outcome')).toHaveText('Partly reserved');
    await expect(lines.nth(0).getByTestId('plan-entry-numbers')).toContainText('Critical priority');
    await expect(lines.nth(0).getByTestId('plan-entry-numbers')).toContainText('reserved 30 at North');
    const bakery = plan.getByRole('listitem', { name: 'Bakery: Coal' });
    await expect(bakery.getByTestId('plan-entry-outcome')).toHaveText('Held by a reserve');
    await expect(bakery.getByTestId('plan-entry-numbers')).toContainText('min 20, max 60 from its replenishment setting · short 60 · reserved 0 · rules #401');
    await expect(bakery.getByTestId('plan-entry-explanation')).toContainText('Nothing reserved: town reserve 70 (rule #401) and 30 already reserved.');

    const orders = plan.getByRole('list', { name: 'Collection orders' }).getByRole('listitem');
    await expect(orders).toHaveCount(1);
    await expect(orders.first()).toContainText('Garrison collects from North with its own worker (2 of 2 present, carries up to 64 units)');
    await expect(orders.first()).toContainText('30 × Coal');

    await plan.getByLabel("Only the lines that didn't get everything").check();
    await expect(lines).toHaveCount(2);
    expect(api.calls('POST', `Logistics/towns/${PHOENIX}/run-now`)).toHaveLength(0);
  });

  test('Run the planner now stores a run and reads the town again; the API\'s refusal is shown', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<LogisticsPlanDto>('POST', `Logistics/towns/${PHOENIX}/run-now`, phoenixDryRun({ dryRun: false, featureEnabled: true, runId: RUN + 1, warnings: [] }));
    await page.goto(`/display/Town/${PHOENIX}`);

    const panel = page.getByRole('region', { name: 'Town logistics' });
    await panel.getByRole('button', { name: 'Run the planner now' }).click();
    await expect(panel.getByTestId('logistics-plan-meta').getByRole('link', { name: `#${RUN + 1}` }))
      .toHaveAttribute('href', new RegExp(`^/display/LogisticsPlannerRun/${RUN + 1}`));
    await expect(panel.getByRole('region', { name: 'Planner run' })).toBeVisible();
    await expect.poll(() => api.calls('GET', `Logistics/towns/${PHOENIX}/supply`).length).toBe(2);

    api.on('POST', `Logistics/towns/${PHOENIX}/run-now`, { status: 409, body: { code: 'ProductionDisabled', error: 'Production is turned off (Production:Enabled).' } });
    await panel.getByRole('button', { name: 'Run the planner now' }).click();
    await expect(panel.getByRole('alert')).toHaveText('Production is turned off (Production:Enabled).');
  });

  test('while production is off Run now is off and no run is scheduled', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<TownSupplyDto>('GET', `Logistics/towns/${PHOENIX}/supply`, phoenixSupply({ featureEnabled: false, nextRunAt: null }));
    await page.goto(`/display/Town/${PHOENIX}`);
    const panel = page.getByRole('region', { name: 'Town logistics' });
    await expect(panel.getByTestId('town-logistics-next-run')).toHaveText('Production is off: no scheduled runs (a dry run still works)');
    await expect(panel.getByRole('button', { name: 'Run the planner now' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Dry run' })).toBeEnabled();
  });

  test('Apply a template copies its rules into the town policy (D-L3)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    mockPaged<LogisticsPolicyListDto>(api, 'LogisticsPolicies/search', [templateRow]);
    api.json<LogisticsPolicyDto>('POST', `LogisticsPolicies/${TEMPLATE}/apply`, phoenixPolicy({ id: POLICY_V2 + 1, version: 3 }));
    await page.goto(`/display/Town/${PHOENIX}`);

    const panel = page.getByRole('region', { name: 'Town logistics' });
    await panel.getByRole('button', { name: 'Apply a template' }).click();
    const group = panel.getByRole('group', { name: 'Apply a template' });
    expect(api.calls('POST', 'LogisticsPolicies/search')[0].body).toEqual({ pageNumber: 1, pageSize: 50, filters: { scope: 'Template' } });
    await expect(group.getByRole('button', { name: 'Apply to this town' })).toBeDisabled();
    await group.getByLabel('Template').selectOption(String(TEMPLATE));
    await expect(group.getByLabel('Template')).toContainText('Farming village (Crops, Village, default; 1 rules)');
    await group.getByLabel('Reason (optional)').fill('Phoenix farms');
    await group.getByRole('button', { name: 'Apply to this town' }).click();

    await expect(panel.getByRole('status').filter({ hasText: 'Template applied' })).toHaveText('Template applied: Phoenix logistics is now v3.');
    expect(api.calls('POST', `LogisticsPolicies/${TEMPLATE}/apply`)[0].body).toEqual({ townId: PHOENIX, reason: 'Phoenix farms' });
  });

  test('Release ends an open reservation with a reason; the API\'s 409 once loaded is shown', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.on('POST', `LogisticsReservations/${RESERVATION}/release`, { status: 409, body: { error: 'The collection order has already loaded the goods.' } });
    await page.goto(`/display/Town/${PHOENIX}`);

    const panel = page.getByRole('region', { name: 'Town logistics' });
    await panel.getByRole('button', { name: `Release reservation #${RESERVATION}` }).click();
    const form = panel.getByRole('group', { name: `Release reservation #${RESERVATION}` });
    await expect(form).toContainText('ends it Cancelled with its collection order');
    await form.getByLabel('Reason (optional)').fill('test');
    await form.getByRole('button', { name: 'Release now' }).click();
    await expect(form.getByRole('alert')).toHaveText('The collection order has already loaded the goods.');
    expect(api.calls('POST', `LogisticsReservations/${RESERVATION}/release`)[0].body).toEqual({ reason: 'test' });

    api.json<LogisticsReservationDto>('POST', `LogisticsReservations/${RESERVATION}/release`, reservationDetail({ status: 'Cancelled', statusReason: 'Released by Alex: test' }));
    await form.getByRole('button', { name: 'Release now' }).click();
    await expect(panel.getByRole('status').filter({ hasText: 'released' })).toHaveText(`Reservation #${RESERVATION} released.`);
  });

  test('without knk.admin.world the panel is not shown and nothing is read', async ({ page, api }) => {
    // A road manager reads towns (knk.admin.road) but not logistics.
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [accessMetadata('Town', 'knk.admin.road')]);
    mockSession(api, alex, nodes('knk.admin.road'));
    await page.goto(`/display/Town/${PHOENIX}`);
    await expect(page.getByRole('region', { name: 'Territory' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Town logistics' })).toHaveCount(0);
    expect(api.calls('GET', `Logistics/towns/${PHOENIX}/supply`)).toHaveLength(0);
  });
});

test.describe('a policy', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    mockDetailPage(api, logisticsPolicyMetadata, '841');
    mockLogisticsLookups(api);
    api.json<LogisticsPolicyDto>('GET', `LogisticsPolicies/${POLICY_V2}`, phoenixPolicy());
    api.json<LogisticsPolicyListDto[]>('GET', `LogisticsPolicies/${POLICY_V2}/versions`, policyVersions);
  });

  test('shows its rules, its version and every version (A23)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    await page.goto(`/display/LogisticsPolicy/${POLICY_V2}`);

    const panel = page.getByRole('region', { name: 'Policy rules' });
    await expect(panel.getByTestId('logistics-policy-scope').getByRole('link', { name: 'Town: Phoenix' })).toHaveAttribute('href', new RegExp(`^/display/Town/${PHOENIX}`));
    await expect(panel.getByTestId('logistics-policy-version')).toHaveText(`v2 (current) · based on #${POLICY_V1}`);
    await expect(panel.getByTestId('logistics-policy-reason')).toHaveText('Bread reserve 14 days');

    const rules = panel.getByRole('list', { name: 'Rules' }).getByRole('listitem', { name: /^Rule \d/ });
    await expect(rules).toHaveCount(2);
    await expect(panel.getByTestId('rule-1-summary')).toHaveText('Saved as: Town reserve: 70 × Coal');
    await expect(rules.nth(0).getByLabel('Rule 1 type')).toHaveValue('Reserve');
    await expect(rules.nth(0).getByLabel('Rule 1 units')).toHaveValue('70');
    await expect(rules.nth(0).getByTestId(/picked$/)).toHaveText(`Coal (#${COAL})`);
    await expect(rules.nth(1).getByLabel('Rule 2 priority class')).toHaveValue('Critical');

    const versions = panel.getByRole('table', { name: 'Versions' });
    await expect(versions.getByRole('row').nth(1)).toHaveText(/v2 \(current\) \(this page\)\s*.+\s*2\s*Bread reserve 14 days/);
    await expect(versions.getByRole('link', { name: 'v1 (superseded)' })).toHaveAttribute('href', new RegExp(`^/display/LogisticsPolicy/${POLICY_V1}`));
    await expect(panel.getByRole('button', { name: 'Save as a new version' })).toBeDisabled();
  });

  test('a save sends the whole rule list with its reason and opens the new version (A23)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<LogisticsPolicyDto>('PUT', `LogisticsPolicies/${POLICY_V2}`, phoenixPolicy({ id: POLICY_V2 + 1, version: 3, basedOnPolicyId: POLICY_V2, reason: 'Iron ore reserve' }));
    api.json<LogisticsPolicyDto>('GET', `LogisticsPolicies/${POLICY_V2 + 1}`, phoenixPolicy({ id: POLICY_V2 + 1, version: 3, basedOnPolicyId: POLICY_V2, reason: 'Iron ore reserve' }));
    api.json<LogisticsPolicyListDto[]>('GET', `LogisticsPolicies/${POLICY_V2 + 1}/versions`, policyVersions);
    await page.goto(`/display/LogisticsPolicy/${POLICY_V2}`);

    const panel = page.getByRole('region', { name: 'Policy rules' });
    await panel.getByLabel('New rule').selectOption('Reserve');
    await panel.getByRole('button', { name: 'Add the rule' }).click();
    const rule = panel.getByRole('listitem', { name: 'Rule 3: Reserve (saving rule)' });
    await expect(panel.getByRole('list', { name: 'Rule problems' })).toHaveText('Rule 3: pick the blueprint.');
    await expect(panel.getByRole('button', { name: 'Save as a new version' })).toBeDisabled();
    await rule.getByLabel('Rule 3 blueprint').fill('Iron');
    await rule.getByRole('button', { name: 'Iron ore' }).click();
    await rule.getByLabel('Keep').selectOption('days');
    await rule.getByLabel('Rule 3 days of cover').fill('14');
    await rule.getByLabel('Rule 3 reason').fill('Bread for two weeks');
    await panel.getByRole('button', { name: 'Move rule 3 up' }).click();
    await expect(panel.getByRole('list', { name: 'Rule problems' })).toHaveCount(0);
    await panel.getByLabel('Reason for this version').fill('Iron ore reserve');
    await panel.getByRole('button', { name: 'Save as a new version' }).click();

    await expect(page).toHaveURL(new RegExp(`/display/LogisticsPolicy/${POLICY_V2 + 1}`));
    await expect(page.getByRole('region', { name: 'Policy rules' }).getByRole('status')).toHaveText('Saved as version 3.');
    const body = api.calls('PUT', `LogisticsPolicies/${POLICY_V2}`)[0].body as LogisticsPolicyUpdateDto;
    expect(body.reason).toBe('Iron ore reserve');
    expect(body.rules).toEqual([
      { sequence: 1, type: 'Reserve', scope: 'Town', targetKind: 'Blueprint', itemBlueprintId: COAL, units: 70, activeFrom: null, activeUntil: null, reason: 'Keep some back' },
      { sequence: 2, type: 'Reserve', scope: 'Town', targetKind: 'Blueprint', itemBlueprintId: IRON_ORE, daysOfCover: 14, activeFrom: null, activeUntil: null, reason: 'Bread for two weeks' },
      { sequence: 3, type: 'PriorityClass', targetKind: 'Any', consumerKind: 'Structure', structureId: GARRISON, priorityClass: 'Critical', activeFrom: null, activeUntil: null, reason: null },
    ]);
  });

  test('a service area and a refused save: the API\'s sentence is shown', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.on('PUT', `LogisticsPolicies/${POLICY_V2}`, { status: 400, body: { error: 'Rule 3: warehouse 52 is not a warehouse of this town.' } });
    await page.goto(`/display/LogisticsPolicy/${POLICY_V2}`);

    const panel = page.getByRole('region', { name: 'Policy rules' });
    await panel.getByLabel('New rule').selectOption('ServiceArea');
    await panel.getByRole('button', { name: 'Add the rule' }).click();
    const rule = panel.getByRole('listitem', { name: 'Rule 3: Service area' });
    await expect(panel.getByRole('list', { name: 'Rule problems' }).getByRole('listitem')).toHaveText(['Rule 3: pick the district.', 'Rule 3: pick the warehouse that serves it.']);
    await rule.getByLabel('Rule 3 district').fill('Mar');
    await rule.getByRole('button', { name: 'Market' }).click();
    await rule.getByLabel('Rule 3 served by warehouse').fill('South');
    await rule.getByRole('button', { name: 'South' }).click();
    await panel.getByRole('button', { name: 'Save as a new version' }).click();
    await expect(panel.getByRole('alert')).toHaveText('Rule 3: warehouse 52 is not a warehouse of this town.');
    expect((api.calls('PUT', `LogisticsPolicies/${POLICY_V2}`)[0].body as LogisticsPolicyUpdateDto).rules[2])
      .toEqual({ sequence: 3, type: 'ServiceArea', areaKind: 'District', districtId: MARKET, warehouseId: SOUTH, activeFrom: null, activeUntil: null, reason: null });
  });

  test('a superseded version is read only and links to the next one', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<LogisticsPolicyDto>('GET', `LogisticsPolicies/${POLICY_V1}`, phoenixPolicy({
      id: POLICY_V1, version: 1, isCurrent: false, basedOnPolicyId: null, supersededByPolicyId: POLICY_V2, supersededAt: '2026-11-21T10:00:00Z',
      reason: 'From template "Farming village" v1.', rules: [phoenixPolicy().rules![0]],
    }));
    api.json<LogisticsPolicyListDto[]>('GET', `LogisticsPolicies/${POLICY_V1}/versions`, policyVersions);
    await page.goto(`/display/LogisticsPolicy/${POLICY_V1}`);

    const panel = page.getByRole('region', { name: 'Policy rules' });
    await expect(panel.getByTestId('logistics-policy-superseded').getByRole('link', { name: `#${POLICY_V2}` }))
      .toHaveAttribute('href', new RegExp(`^/display/LogisticsPolicy/${POLICY_V2}`));
    await expect(panel.getByRole('list', { name: 'Rules' })).toHaveText('Reserve (saving rule): Town reserve: 70 × Coal (Keep some back)');
    await expect(panel.getByRole('button', { name: 'Save as a new version' })).toHaveCount(0);
    await expect(panel.getByLabel('New rule')).toHaveCount(0);
  });

  test('a template sends its specialization, size and default flag, and applies to a town (D-L3)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<LogisticsPolicyDto>('GET', `LogisticsPolicies/${TEMPLATE}`, farmingTemplate());
    api.json<LogisticsPolicyListDto[]>('GET', `LogisticsPolicies/${TEMPLATE}/versions`, [templateRow]);
    api.json<LogisticsPolicyDto>('POST', `LogisticsPolicies/${TEMPLATE}/apply`, phoenixPolicy({ id: POLICY_V2 + 1, version: 3 }));
    api.json<LogisticsPolicyDto>('PUT', `LogisticsPolicies/${TEMPLATE}`, farmingTemplate({ id: TEMPLATE + 1, version: 2 }));
    api.json<LogisticsPolicyDto>('GET', `LogisticsPolicies/${TEMPLATE + 1}`, farmingTemplate({ id: TEMPLATE + 1, version: 2 }));
    api.json<LogisticsPolicyListDto[]>('GET', `LogisticsPolicies/${TEMPLATE + 1}/versions`, [templateRow]);
    await page.goto(`/display/LogisticsPolicy/${TEMPLATE}`);

    const panel = page.getByRole('region', { name: 'Policy rules' });
    await expect(panel.getByTestId('logistics-policy-scope')).toHaveText('Template: Crops, Village (default)');
    await expect(panel.getByLabel('New rule').locator('option')).toHaveText(['Reserve (saving rule)', 'Priority class', 'Replenishment defaults']);

    const apply = panel.getByRole('group', { name: 'Apply to a town' });
    await apply.getByLabel('Town').fill('Pho');
    await apply.getByRole('button', { name: 'Phoenix' }).click();
    await apply.getByRole('button', { name: 'Apply the template' }).click();
    await expect(apply.getByRole('status').getByRole('link', { name: 'Phoenix logistics v3' })).toHaveAttribute('href', new RegExp(`^/display/LogisticsPolicy/${POLICY_V2 + 1}`));
    expect(api.calls('POST', `LogisticsPolicies/${TEMPLATE}/apply`)[0].body).toEqual({ townId: PHOENIX, reason: null });

    await panel.getByLabel('Town size').selectOption('Town');
    await panel.getByRole('button', { name: 'Save as a new version' }).click();
    await expect(page).toHaveURL(new RegExp(`/display/LogisticsPolicy/${TEMPLATE + 1}`));
    expect(api.calls('PUT', `LogisticsPolicies/${TEMPLATE}`)[0].body).toMatchObject({ specialization: 'Crops', townSize: 'Town', isDefaultTemplate: true });
  });
});

test.describe("a consumer's supply", () => {
  test.use({ strictApi: true });

  const inputs = storageRow(BAKERY_INPUTS, 'Bakery inputs', 'Input', BAKERY, 'Bakery', 10);
  const bakery = (): ProductionStructureDto => ({ ...mill(), id: BAKERY, name: 'Bakery', storages: [{ id: BAKERY_INPUTS, name: 'Bakery inputs', purpose: 'Input' }] });

  test.beforeEach(async ({ api }) => {
    mockDetailPage(api, productionStructureMetadata, '842');
    mockLogisticsLookups(api);
    api.json<ProductionStructureDto>('GET', `ProductionStructures/${BAKERY}`, bakery());
    api.json<StructureTerritoryDto>('GET', `Territory/structures/${BAKERY}`, territoryOf(BAKERY, 'Bakery'));
    api.json('GET', /^Towns\/?$/, [{ id: PHOENIX, name: 'Phoenix', allowEntry: true, requiredTitle: 0 }]);
    mockStoragesOf(api, [inputs]);
    api.json<StorageDto>('GET', `Storages/${BAKERY_INPUTS}`, storageDetail(inputs, 10));
    api.json<ProductionOverviewDto>('GET', `ProductionStructures/${BAKERY}/production`, {
      productionStructureId: BAKERY, featureEnabled: true, productionEnabled: true, productionKind: null, level: 1, workersPresent: 1, workersTotal: 2,
      outputStorageId: null, inputStorageId: BAKERY_INPUTS, climateZone: null, weatherToday: null, notProducingReasons: ['It has no production kind.'],
      lines: [], recentCycles: [],
    });
    mockConfiguredYield(api);
    mockNoTransport(api);
    api.json<ConsumerViewDto>('GET', `Logistics/consumers/${BAKERY}`, bakeryConsumer());
    mockPaged<ConsumerReplenishmentListDto>(api, 'ConsumerReplenishments/search', bakerySettings);
  });

  test('shows its demand with where each min and max came from, its workers and its warehouse (A17)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    await page.goto(`/display/ProductionStructure/${BAKERY}`);

    const panel = page.getByRole('region', { name: 'Supply (as a consumer)' });
    await expect(panel.getByRole('list', { name: 'Supply warnings' })).toHaveText('One of 2 workers is away: output is lowered while it is (DESIGN § 7.7).');
    await expect(panel.getByTestId('structure-logistics-workers')).toHaveText('Its own workers: 1 of 2 present, each carries up to 64 units');
    await expect(panel.getByTestId('structure-logistics-warehouse')).toHaveText('South (a Replenishment rule)');
    const demand = panel.getByRole('table', { name: 'Demand of Bakery inputs' });
    await expect(demand.getByRole('row').nth(1)).toHaveText(/Coal\s*10\s*0\s*20\s*60\s*Normal\s*its replenishment setting/);
    await expect(demand.getByRole('row').nth(2)).toHaveText(/Iron ore\s*40\s*0\s*10\s*30\s*Normal\s*its line inputs \(4 h \/ 12 h\)/);
    await expect(panel.getByRole('table', { name: 'Replenishment settings' }).getByRole('row').nth(1)).toHaveText(/Bakery inputs\s*Coal\s*20\s*60\s*From the policy\s*Yes/);
    expect(api.calls('POST', 'ConsumerReplenishments/search')[0].body).toEqual({ pageNumber: 1, pageSize: 100, filters: { structureId: String(BAKERY) } });
  });

  test('adds a setting after checking it, edits one and deletes one', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, 'knk.admin.delete'));
    api.json<ConsumerReplenishmentDto>('POST', /^ConsumerReplenishments\/?$/, { id: 4, storageId: BAKERY_INPUTS, itemBlueprintId: IRON_ORE, reorderPoint: 5, targetLevel: 25 });
    api.json<ConsumerReplenishmentDto>('GET', 'ConsumerReplenishments/3', {
      id: 3, storageId: BAKERY_INPUTS, structureId: BAKERY, itemBlueprintId: COAL, reorderPoint: 20, targetLevel: 60, priorityClass: null, enabled: true, note: null,
    });
    api.json<ConsumerReplenishmentDto>('PUT', 'ConsumerReplenishments/3', { id: 3, storageId: BAKERY_INPUTS, itemBlueprintId: COAL, reorderPoint: 30, targetLevel: 60 });
    api.on('DELETE', 'ConsumerReplenishments/3', { status: 204 });
    await page.goto(`/display/ProductionStructure/${BAKERY}`);

    const panel = page.getByRole('region', { name: 'Supply (as a consumer)' });
    await panel.getByRole('button', { name: 'Add a setting' }).click();
    const form = panel.getByRole('group', { name: 'New setting' });
    await expect(form.getByLabel('Storage')).toHaveValue(String(BAKERY_INPUTS));
    await form.getByLabel('Item').fill('Iron');
    await form.getByRole('button', { name: 'Iron ore' }).click();
    await form.getByLabel('Min (reorder point)').fill('30');
    await form.getByLabel('Max (target level)').fill('25');
    await expect(form.getByRole('list', { name: 'Setting problems' })).toHaveText('The min is above the max.');
    await expect(form.getByRole('button', { name: 'Save the setting' })).toBeDisabled();
    await form.getByLabel('Min (reorder point)').fill('5');
    await form.getByLabel('Priority class').selectOption('High');
    await form.getByRole('button', { name: 'Save the setting' }).click();
    await expect(panel.getByRole('status')).toHaveText('Setting for Iron ore saved.');
    expect(api.calls('POST', /^ConsumerReplenishments\/?$/)[0].body).toEqual({
      id: null, storageId: BAKERY_INPUTS, itemBlueprintId: IRON_ORE, reorderPoint: 5, targetLevel: 25, priorityClass: 'High', enabled: true, note: null,
    });

    await panel.getByRole('button', { name: 'Edit the setting for Coal' }).click();
    const edit = panel.getByRole('group', { name: 'Edit the setting' });
    await expect(edit.getByLabel('Min (reorder point)')).toHaveValue('20');
    await edit.getByLabel('Min (reorder point)').fill('30');
    await edit.getByRole('button', { name: 'Save the setting' }).click();
    await expect.poll(() => api.calls('PUT', 'ConsumerReplenishments/3').length).toBe(1);
    expect(api.calls('PUT', 'ConsumerReplenishments/3')[0].body).toMatchObject({ id: 3, storageId: BAKERY_INPUTS, itemBlueprintId: COAL, reorderPoint: 30, targetLevel: 60 });

    await panel.getByRole('button', { name: 'Delete the setting for Coal' }).click();
    await expect(panel.getByRole('status')).toContainText('Setting for Coal deleted');
  });

  test('a structure without an Input or Merchandise storage is not a consumer', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<ConsumerViewDto>('GET', `Logistics/consumers/${BAKERY}`, bakeryConsumer({ isConsumer: false, storages: [], warnings: [] }));
    mockPaged<ConsumerReplenishmentListDto>(api, 'ConsumerReplenishments/search', []);
    await page.goto(`/display/ProductionStructure/${BAKERY}`);
    await expect(page.getByTestId('structure-logistics-not-consumer')).toContainText('Not a consumer');
  });
});

test.describe("a warehouse's logistics", () => {
  test.use({ strictApi: true });

  test('lists what it serves, its warehouse policy and its open reservations', async ({ page, api }) => {
    mockDetailPage(api, warehouseMetadata, '843');
    mockSession(api, alex, nodes(WORLD));
    api.json<WarehouseDto>('GET', `Warehouses/${MARKET_WAREHOUSE}`, marketWarehouse());
    api.json<StructureTerritoryDto>('GET', `Territory/structures/${MARKET_WAREHOUSE}`, territoryOf(MARKET_WAREHOUSE, 'Market warehouse'));
    api.json('GET', /^Towns\/?$/, [{ id: PHOENIX, name: 'Phoenix', allowEntry: true, requiredTitle: 0 }]);
    const delivery = storageRow(33, 'Market warehouse - deliveries', 'Delivery', MARKET_WAREHOUSE, 'Market warehouse');
    mockStoragesOf(api, [delivery]);
    api.json<StorageDto>('GET', 'Storages/33', storageDetail(delivery, 0));
    api.json<TownServiceAreasDto>('GET', `Logistics/towns/${PHOENIX}/service-areas`, {
      townId: PHOENIX, entries: phoenixServiceAreas.entries.map(e => ({ ...e, warehouseId: e.warehouseId === SOUTH ? MARKET_WAREHOUSE : e.warehouseId, warehouseName: e.warehouseId === SOUTH ? 'Market warehouse' : e.warehouseName })),
    });
    mockPaged<LogisticsPolicyListDto>(api, 'LogisticsPolicies/search', [{ ...policyVersions[0], id: 45, name: 'Market warehouse reserves', scope: 'Warehouse', townId: null, warehouseId: MARKET_WAREHOUSE, ruleCount: 1, version: 1 }]);
    mockPaged<LogisticsReservationListDto>(api, 'LogisticsReservations/search', [{ ...openReservation, warehouseId: MARKET_WAREHOUSE, warehouseName: 'Market warehouse' }]);
    await page.goto(`/display/Warehouse/${MARKET_WAREHOUSE}`);

    const panel = page.getByRole('region', { name: 'Logistics', exact: true });
    await expect(panel.getByTestId('warehouse-logistics-policy').getByRole('link', { name: 'Market warehouse reserves v1 (1 rules)' }))
      .toHaveAttribute('href', /^\/display\/LogisticsPolicy\/45/);
    const served = panel.getByRole('table', { name: 'Served areas' }).getByRole('row');
    await expect(served).toHaveCount(3);
    await expect(served.nth(1)).toContainText('District Market');
    await expect(served.nth(2)).toContainText('Bakery');
    await expect(panel.getByRole('table', { name: 'Open reservations at this warehouse' })).toContainText(`#${RESERVATION}`);
    expect(api.calls('POST', 'LogisticsPolicies/search')[0].body).toEqual({ pageNumber: 1, pageSize: 1, filters: { scope: 'Warehouse', warehouseId: String(MARKET_WAREHOUSE) } });
    expect(api.calls('POST', 'LogisticsReservations/search')[0].body).toEqual({ pageNumber: 1, pageSize: 50, filters: { warehouseId: String(MARKET_WAREHOUSE), open: 'true' } });
  });
});

test.describe('a planner run and a reservation', () => {
  test.use({ strictApi: true });

  test("a run's page lists its counts and the explanation of every line, with the reservation and order it made (A17)", async ({ page, api }) => {
    mockDetailPage(api, logisticsRunMetadata, '844');
    mockSession(api, alex, nodes(WORLD));
    api.json<LogisticsPlannerRunDto>('GET', `LogisticsPlannerRuns/${RUN}`, storedRun());
    await page.goto(`/display/LogisticsPlannerRun/${RUN}`);

    const panel = page.getByRole('region', { name: 'Plan explanation', exact: true }).first();
    await expect(panel.getByTestId('planner-run-counts')).toHaveText('2 lines at or below their min, 1 reserved, 1 orders, 0 released, 0 collected, 1 short');
    await expect(panel.getByTestId('planner-run-when')).toContainText('(Manual)');
    const garrison = panel.getByRole('listitem', { name: 'Garrison: Coal' });
    await expect(garrison.getByRole('link', { name: `Reservation #${RESERVATION}` })).toHaveAttribute('href', new RegExp(`^/display/LogisticsReservation/${RESERVATION}`));
    await expect(garrison.getByRole('link', { name: `Collection order #${COLLECTION_ORDER}` })).toHaveAttribute('href', new RegExp(`^/display/TransportOrder/${COLLECTION_ORDER}`));
    await expect(panel.getByRole('listitem', { name: 'Bakery: Coal' }).getByTestId('plan-entry-outcome')).toHaveText('Held by a reserve');
  });

  test("a reservation's page says what is held for whom and releases it", async ({ page, api }) => {
    mockDetailPage(api, logisticsReservationMetadata, '845');
    mockSession(api, alex, nodes(WORLD));
    let current = reservationDetail();
    api.on<LogisticsReservationDto>('GET', `LogisticsReservations/${RESERVATION}`, () => ({ body: current }));
    api.on<LogisticsReservationDto>('POST', `LogisticsReservations/${RESERVATION}/release`, () => {
      current = reservationDetail({ status: 'Cancelled', statusReason: 'Released by Alex: not needed', closedAt: '2026-11-21T10:10:00Z', transportOrderStatus: 'Cancelled' });
      return { body: current };
    });
    await page.goto(`/display/LogisticsReservation/${RESERVATION}`);

    const panel = page.getByRole('region', { name: 'Reservation' });
    await expect(panel.getByTestId('reservation-status')).toHaveText('Open (waiting for its worker)');
    await expect(panel.getByTestId('reservation-amount')).toHaveText('0 of 30 Coal collected');
    await expect(panel.getByTestId('reservation-order')).toHaveText(`#${COLLECTION_ORDER} (Planned)`);
    await expect(panel.getByTestId('reservation-explanation')).toContainText('Reserved 30 of 60 at North');
    await panel.getByRole('button', { name: 'Release the reservation' }).click();
    await panel.getByLabel('Reason (optional)').fill('not needed');
    await panel.getByRole('button', { name: 'Release now' }).click();
    await expect(panel.getByTestId('reservation-status')).toHaveText('Cancelled: Released by Alex: not needed');
    await expect(panel.getByTestId('reservation-order')).toHaveText(`#${COLLECTION_ORDER} (Cancelled)`);
    await expect(panel.getByRole('button', { name: 'Release the reservation' })).toHaveCount(0);
  });
});

test.describe('the Town logistics page', () => {
  test.use({ strictApi: true });

  test('lists the policies and templates, filters them, and opens a town (A23)', async ({ page, api }) => {
    mockContentDefaults(api);
    mockSession(api, alex, nodes(WORLD));
    mockLogisticsLookups(api);
    mockPaged<LogisticsPolicyListDto>(api, 'LogisticsPolicies/search', [policyVersions[0], templateRow]);
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [accessMetadata('Town', WORLD)]);
    api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Town', generalDisplay('Town', '840'));
    api.json('GET', `Towns/${PHOENIX}`, phoenixTown);
    api.on('POST', 'landmarks/search', { body: { items: [], totalCount: 0, page: 1, pageSize: 100, totalPages: 0 } });
    mockNoTownTerritory(api, PHOENIX);
    api.json<TownSupplyDto>('GET', `Logistics/towns/${PHOENIX}/supply`, phoenixSupply());
    api.json<TownServiceAreasDto>('GET', `Logistics/towns/${PHOENIX}/service-areas`, phoenixServiceAreas);
    mockPaged<LogisticsPlannerRunListDto>(api, 'LogisticsPlannerRuns/search', [lastRun]);
    mockNoTownAccount(api, PHOENIX);
    await page.goto('/admin/logistics');

    const table = page.getByRole('table', { name: 'Logistics policies' });
    await expect(table.getByRole('row').nth(1)).toHaveText(/Phoenix logistics\s*Town: Phoenix\s*v2\s*2/);
    await expect(table.getByRole('row').nth(2)).toHaveText(/Farming village\s*Template: Crops, Village \(default\)\s*v1\s*1/);
    await expect(table.getByRole('link', { name: 'Farming village' })).toHaveAttribute('href', new RegExp(`^/display/LogisticsPolicy/${TEMPLATE}`));
    await expect(page.getByRole('link', { name: 'New policy or template' })).toHaveAttribute('href', /^\/forms\/LogisticsPolicy/);
    expect(api.calls('POST', 'LogisticsPolicies/search')[0].body).toEqual({ pageNumber: 1, pageSize: 50, filters: { current: 'true' } });

    const filters = page.getByRole('form', { name: 'Policy filters' });
    await filters.getByLabel('For').selectOption('Template');
    await filters.getByLabel('Versions').selectOption('all');
    await expect.poll(() => api.calls('POST', 'LogisticsPolicies/search').length).toBe(3);
    expect(api.calls('POST', 'LogisticsPolicies/search')[2].body).toEqual({ pageNumber: 1, pageSize: 50, filters: { current: 'all', scope: 'Template' } });

    await page.getByLabel('Town', { exact: true }).fill('Pho');
    await page.getByRole('button', { name: 'Phoenix' }).click();
    await page.getByRole('button', { name: 'Open the town' }).click();
    await expect(page).toHaveURL(new RegExp(`/display/Town/${PHOENIX}`));
    await expect(page.getByRole('region', { name: 'Town logistics' })).toBeVisible();
  });
});

test.describe('game settings', () => {
  const logistics = { plannerIntervalMinutes: 15, reservationMinutes: 30, consumptionWindowDays: 7, defaultReorderHours: 4, defaultTargetHours: 12, runRetentionDays: 14 };
  const stored: GameSettingsDto = {
    ...gameSettings,
    production: { enabled: true, territory: { baseRange: 100, powerFactor: 2, capitalMultiplier: 1.5 }, engine: { baseCycleMinutes: 10, catchUpCapHours: 24, weatherDayMinutes: 20 }, logistics },
  };

  test('shows and keeps the logistics section on a save of another section, and checks a changed one', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    api.json<GameSettingsDto>('GET', /^GameSettings\/?$/, stored);
    api.on<GameSettingsDto>('PUT', /^GameSettings\/?$/, ({ body }) => ({ body: { ...stored, ...(body as GameSettingsUpdateDto), settingsVersion: '8' } as GameSettingsDto }));
    await page.goto('/admin/game-settings');

    const card = page.getByRole('region', { name: 'Town logistics' });
    await expect(card.getByRole('spinbutton', { name: 'Planner interval (minutes)' })).toHaveValue('15');
    await page.getByRole('region', { name: 'Production engine' }).getByRole('spinbutton', { name: 'Base cycle (minutes)' }).fill('5');
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect.poll(() => api.calls('PUT', /^GameSettings\/?$/).length).toBe(1);
    expect((api.calls('PUT', /^GameSettings\/?$/)[0].body as GameSettingsUpdateDto).production?.logistics).toEqual(logistics);

    const changed = page.getByRole('region', { name: /^Town logistics/ });
    await changed.getByRole('spinbutton', { name: 'Default min (hours of input)' }).fill('20');
    await expect(changed.getByRole('list', { name: 'Logistics problems' })).toHaveText('production.logistics.defaultReorderHours must be at most defaultTargetHours.');
    await expect(page.getByRole('button', { name: /^Save/ })).toBeDisabled();
    await changed.getByRole('spinbutton', { name: 'Default min (hours of input)' }).fill('6');
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect.poll(() => api.calls('PUT', /^GameSettings\/?$/).length).toBe(2);
    expect((api.calls('PUT', /^GameSettings\/?$/)[1].body as GameSettingsUpdateDto).production?.logistics).toEqual({ ...logistics, defaultReorderHours: 6 });
  });
});
