import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { noStepProgress, noValidationRules, savedProgress, workflowSession } from './fixtures/forms';
import { townDisplay, townMetadata } from './fixtures/towns';
import {
  CONFLICT,
  CONTENT,
  KEEP,
  MARKET,
  PHOENIX,
  WORLD,
  conflictRows,
  crownLandForm,
  crownLandFormMetadata,
  gameSettings,
  generalDisplay,
  keepTerritory,
  kingdomForm,
  kingdomFormMetadata,
  marketDistrict,
  mockConflictSearch,
  mockCrownLandSearch,
  mockKingdomSearch,
  mockProvinceSearch,
  mockTownTerritory,
  openConflict,
  phoenixTerritory,
  phoenixTown,
  worldMetadata,
} from './fixtures/territory';
import { accessMetadata } from './fixtures/dashboardAccess';
import type { DisplayConfigurationDto } from '../src/types/dtos/displayConfig/DisplayModels';
import type { FieldValidationRuleDto } from '../src/types/dtos/forms/FieldValidationRuleDtos';
import type { FormConfigurationDto, FormSubmissionProgressDto } from '../src/types/dtos/forms/FormModels';
import type { GameSettingsDto, GameSettingsUpdateDto } from '../src/types/dtos/gameSettings/GameSettingsModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type {
  CrownLandDto,
  KingdomDto,
  StructureLoyaltyUpdateDto,
  StructureTerritoryDto,
  TerritoryConflictDto,
  TerritoryConflictResolveDto,
  TownTerritoryDto,
} from '../src/types/dtos/territory/TerritoryDtos';
import type { TownDto } from '../src/types/dtos/town/TownDto';
import type { StepProgressReadDto, WorkflowSessionReadDto } from '../src/types/dtos/workflow/WorkflowDtos';

/**
 * Territory V1 in the web app (PandiO/knk-workspace#690; territory DESIGN § 1-4, G10, G11, acceptance A05, A07, A23):
 * the kingdom, province, crown land and conflict dashboards, the kingdom and crown land forms, the town page's power,
 * kingdom, province and ranges with the capital toggle, the conflict page's award / redrawn / reopen, the structure
 * page's flag and loyalty, and the production settings in Game settings. Smoke test: knk-workspace
 * docs/guides/production-storage-transport-smoke-test.md § 1.3.
 */

const nodes = (...held: string[]) => (node: string) => held.includes(node);

test.beforeEach(async ({ page }) => {
  await startLoggedIn(page, 'access-1');
});

test.describe('dashboard', () => {
  test.beforeEach(async ({ api }) => {
    mockContentDefaults(api);
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [
      worldMetadata('Kingdom'), worldMetadata('Province'), worldMetadata('CrownLand'), worldMetadata('TerritoryConflict'),
      accessMetadata('Category', CONTENT),
    ]);
    api.json<FormConfigurationDto[]>('GET', /^FormConfigurations\/(Kingdom|Province|CrownLand|TerritoryConflict|Category)$/i, []);
    mockKingdomSearch(api);
    mockProvinceSearch(api);
    mockCrownLandSearch(api);
    mockConflictSearch(api);
  });

  test('lists the kingdoms with their town and crown land counts', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, CONTENT));
    await page.goto('/dashboard/Kingdom');

    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'Towns' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Crown land' })).toBeVisible();
    await expect(table.getByRole('row').filter({ hasText: 'Aurelia' })).toContainText('2');
    await expect(table.getByRole('row').filter({ hasText: 'Valemont' })).toBeVisible();
  });

  test('lists provinces with their kingdom and crown land with its kingdom and range', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, CONTENT));
    await page.goto('/dashboard/Province');
    await expect(page.getByRole('table').getByRole('row').filter({ hasText: 'North' })).toContainText('Aurelia');

    await page.goto('/dashboard/CrownLand');
    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'Range (blocks)' })).toBeVisible();
    const forest = table.getByRole('row').filter({ hasText: 'Royal forest' });
    await expect(forest).toContainText('Aurelia');
    await expect(forest).toContainText('80');
    await expect(forest).toContainText('world');
  });

  test('lists the conflicts with their state, area size and flagged structures (A05)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, CONTENT));
    await page.goto('/dashboard/TerritoryConflict');

    const table = page.getByRole('table');
    for (const header of ['Status', 'Still overlapping', 'Chunks', 'Flagged structures']) {
      await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
    }
    const row = table.getByRole('row').filter({ hasText: conflictRows[0].name });
    await expect(row).toContainText('Open');
    await expect(row).toContainText('Yes');
  });

  test('content-only staff do not get the territory types', async ({ page, api }) => {
    mockSession(api, alex, nodes(CONTENT));
    await page.goto('/dashboard/Kingdom');

    await expect(page).toHaveURL(/\/dashboard\/Category$/);
    await expect(page.getByRole('button', { name: /^Kingdom/ })).toHaveCount(0);
    expect(api.calls('POST', 'Kingdoms/search')).toHaveLength(0);
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

  test('saves a kingdom through POST api/Kingdoms', async ({ page, api }) => {
    api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/Kingdom', [kingdomForm]);
    api.json<FormConfigurationDto>('GET', `FormConfigurations/${kingdomForm.id}`, kingdomForm);
    api.json<EntityMetadataDto>('GET', 'Metadata/entities/Kingdom', kingdomFormMetadata);
    api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${kingdomForm.id}`, noValidationRules);
    api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, kingdomForm));
    api.on<KingdomDto>('POST', /^Kingdoms\/?$/, ({ body }) => ({ status: 201, body: { ...(body as KingdomDto), id: 3 } }));
    mockKingdomSearch(api);

    await page.goto('/forms/Kingdom');
    await page.getByRole('button', { name: 'Use' }).click();
    await page.getByRole('textbox', { name: 'Name*' }).fill('Aurelia');
    await page.getByRole('textbox', { name: 'Description' }).fill('The northern crown');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect.poll(() => api.calls('POST', /^Kingdoms\/?$/).length).toBe(1);
    expect(api.calls('POST', /^Kingdoms\/?$/)[0].body).toMatchObject({ Name: 'Aurelia', Description: 'The northern crown' });
  });

  test('saves crown land with its kingdom (picked from api/Kingdoms) and range (G10)', async ({ page, api }) => {
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [worldMetadata('Kingdom'), crownLandFormMetadata]);
    api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/CrownLand', [crownLandForm]);
    api.json<FormConfigurationDto>('GET', `FormConfigurations/${crownLandForm.id}`, crownLandForm);
    api.json<EntityMetadataDto>('GET', 'Metadata/entities/CrownLand', crownLandFormMetadata);
    api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${crownLandForm.id}`, noValidationRules);
    api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, crownLandForm));
    api.on('GET', 'DisplayConfigurations/entity/Kingdom', { status: 404, body: { error: 'NotFound' } });
    api.on<CrownLandDto>('POST', /^CrownLands\/?$/, ({ body }) => ({ status: 201, body: { ...(body as CrownLandDto), id: 32 } }));
    mockKingdomSearch(api);

    await page.goto('/forms/CrownLand');
    await page.getByRole('button', { name: 'Use' }).click();
    await page.getByRole('textbox', { name: 'Name*' }).fill('Royal forest');
    await page.getByRole('textbox', { name: 'Description*' }).fill('Hunting grounds');
    await page.getByPlaceholder(/Search Kingdom/).click();
    await page.getByRole('option', { name: /Aurelia/ }).click();
    await page.getByRole('spinbutton', { name: /Range \(blocks\)/ }).fill('80');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect.poll(() => api.calls('POST', /^CrownLands\/?$/).length).toBe(1);
    expect(api.calls('POST', 'Kingdoms/search').length).toBeGreaterThan(0);
    expect(api.calls('POST', /^CrownLands\/?$/)[0].body).toMatchObject({ Name: 'Royal forest', Description: 'Hunting grounds', Range: 80 });
  });
});

test.describe('the town page', () => {
  test.use({ strictApi: true });

  let territory: TownTerritoryDto;

  test.beforeEach(async ({ api }) => {
    territory = structuredClone(phoenixTerritory);
    mockContentDefaults(api);
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', townMetadata);
    api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Town', townDisplay);
    api.json<TownDto>('GET', `Towns/${PHOENIX}`, phoenixTown as unknown as TownDto);
    api.on('POST', 'landmarks/search', { body: { items: [], totalCount: 0, page: 1, pageSize: 100, totalPages: 0 } });
    api.on('POST', 'hubs/web/negotiate', { status: 404 });
    mockTownTerritory(api);
    // The panel re-reads the ranges after a save: answer with the current state.
    api.on<TownTerritoryDto>('GET', `Territory/towns/${PHOENIX}`, () => ({ body: territory }));
  });

  test("shows the town's power, kingdom, province and effective ranges (A05, G11)", async ({ page, api }) => {
    mockSession(api, alex, () => true);
    await page.goto(`/display/Town/${PHOENIX}`);

    const panel = page.getByRole('region', { name: 'Territory' });
    await expect(panel.getByText('50', { exact: true })).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Aurelia' })).toBeVisible();
    await expect(panel.getByRole('link', { name: 'North' })).toBeVisible();
    await expect(panel.getByTestId('town-range')).toHaveText('200 blocks; capital districts 300 blocks');
    const districts = panel.getByRole('list', { name: 'District ranges' });
    await expect(districts.getByRole('listitem').filter({ hasText: 'Old Town' })).toContainText('Capital');
    await expect(districts.getByRole('listitem').filter({ hasText: 'Old Town' })).toContainText('300 blocks');
    await expect(districts.getByRole('listitem').filter({ hasText: 'Market' })).toContainText('200 blocks');
  });

  test('saves power, kingdom and province with every other town setting left alone', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    api.on('PUT', `Towns/${PHOENIX}`, ({ body }) => {
      const sent = body as { power: number };
      territory = { ...territory, power: sent.power, provinceId: null, range: 100 + sent.power * 2, capitalRange: (100 + sent.power * 2) * 1.5 };
      return { status: 204 };
    });
    await page.goto(`/display/Town/${PHOENIX}`);
    const panel = page.getByRole('region', { name: 'Territory' });

    await panel.getByRole('button', { name: 'Edit territory' }).click();
    const form = panel.getByRole('form', { name: 'Territory of Phoenix' });
    await form.getByRole('spinbutton', { name: 'Power' }).fill('20');
    // Another kingdom clears the province; only that kingdom's provinces are offered.
    await form.getByRole('combobox', { name: 'Kingdom' }).selectOption({ label: 'Valemont' });
    await expect(form.getByRole('combobox', { name: 'Province' }).getByRole('option')).toHaveText(['None', 'Lowlands']);
    await form.getByRole('combobox', { name: 'Kingdom' }).selectOption({ label: 'Aurelia' });
    await form.getByRole('button', { name: 'Save territory' }).click();

    await expect(panel.getByTestId('town-range')).toHaveText('140 blocks; capital districts 210 blocks');
    const [put] = api.calls('PUT', `Towns/${PHOENIX}`);
    expect(put.body).toEqual({
      id: PHOENIX, name: 'Phoenix', description: 'Capital of Aurelia', allowEntry: true, allowExit: true, wgRegionId: 'domain_4',
      worldName: 'world', locationId: 40, location: null, teleportEnabled: null, navigationDefaultOverride: null,
      roadAccessOverride: null, power: 20, kingdomId: 1, provinceId: null,
    });
  });

  test('refuses a power out of range before saving', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    await page.goto(`/display/Town/${PHOENIX}`);
    const panel = page.getByRole('region', { name: 'Territory' });

    await panel.getByRole('button', { name: 'Edit territory' }).click();
    await panel.getByRole('spinbutton', { name: 'Power' }).fill('-5');

    await expect(panel.getByRole('button', { name: 'Save territory' })).toBeDisabled();
    expect(api.calls('PUT', `Towns/${PHOENIX}`)).toHaveLength(0);
  });

  test('marks a district as capital through its own save', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    api.json('GET', `Districts/${MARKET}`, marketDistrict);
    api.on('PUT', `Districts/${MARKET}`, () => {
      territory = { ...territory, districts: territory.districts.map(d => d.id === MARKET ? { ...d, isCapital: true, range: 300 } : d) };
      return { status: 204 };
    });
    await page.goto(`/display/Town/${PHOENIX}`);
    const panel = page.getByRole('region', { name: 'Territory' });

    await panel.getByRole('button', { name: 'Make Market a capital' }).click();

    const market = panel.getByRole('list', { name: 'District ranges' }).getByRole('listitem').filter({ hasText: 'Market' });
    await expect(market).toContainText('Capital');
    await expect(market).toContainText('300 blocks');
    const [put] = api.calls('PUT', `Districts/${MARKET}`);
    expect(put.body).toMatchObject({ id: MARKET, townId: PHOENIX, wgRegionId: 'domain_8', isCapital: true, streetIds: null, teleportEnabled: null });
  });

  test('staff without knk.admin.world see the territory but cannot change it', async ({ page, api }) => {
    mockSession(api, alex, node => node !== WORLD);
    await page.goto(`/display/Town/${PHOENIX}`);
    const panel = page.getByRole('region', { name: 'Territory' });

    await expect(panel.getByTestId('town-range')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Edit territory' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Edit territory' })).toHaveAttribute('title', `Requires ${WORLD}`);
    await expect(panel.getByRole('button', { name: 'Make Market a capital' })).toBeDisabled();
  });
});

test.describe('the conflict page', () => {
  test.use({ strictApi: true });

  let conflict: TerritoryConflictDto;

  test.beforeEach(async ({ api }) => {
    conflict = structuredClone(openConflict);
    mockContentDefaults(api);
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [worldMetadata('TerritoryConflict')]);
    api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/TerritoryConflict', generalDisplay('TerritoryConflict', '801'));
    api.on<TerritoryConflictDto>('GET', `TerritoryConflicts/${CONFLICT}`, () => ({ body: conflict }));
    api.on('POST', 'hubs/web/negotiate', { status: 404 });
    api.on<TerritoryConflictDto>('POST', `TerritoryConflicts/${CONFLICT}/resolve`, ({ body }) => {
      const sent = body as TerritoryConflictResolveDto;
      const awarded = sent.resolution === 'Awarded' ? [conflict.holderA, conflict.holderB].find(h => h.id === sent.awardedHolder?.id) : null;
      conflict = {
        ...conflict, status: 'Resolved', resolution: sent.resolution, awardedHolder: awarded ?? null,
        resolvedAt: '2026-11-19T11:00:00Z', resolutionNote: sent.note ?? null,
      };
      return { body: conflict };
    });
    api.on<TerritoryConflictDto>('POST', `TerritoryConflicts/${CONFLICT}/reopen`, () => {
      conflict = { ...conflict, status: 'Open', resolution: 'None', awardedHolder: null, resolvedAt: null, resolutionNote: null };
      return { body: conflict };
    });
  });

  test('shows the holders, the area and the flagged structures (A05)', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    await page.goto(`/display/TerritoryConflict/${CONFLICT}`);

    const panel = page.getByRole('region', { name: 'Contested zone' });
    await expect(panel.getByRole('link', { name: 'Phoenix (town)' })).toHaveAttribute('href', new RegExp(`^/display/Town/${PHOENIX}`));
    await expect(panel.getByRole('link', { name: 'Rivertown (town)' })).toBeVisible();
    await expect(panel.getByTestId('conflict-state')).toHaveText('Open');
    await expect(panel.getByText('3 chunks: chunks x 4..6, z 2..2 · blocks x 64..111, z 32..47')).toBeVisible();
    await expect(panel.getByRole('list', { name: 'Flagged structures' }).getByRole('link', { name: 'Market keep' }))
      .toHaveAttribute('href', new RegExp(`^/display/Structure/${KEEP}`));
  });

  test('awards the area to one holder with a note, then reopens it', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    await page.goto(`/display/TerritoryConflict/${CONFLICT}`);
    const panel = page.getByRole('region', { name: 'Contested zone' });

    await panel.getByRole('textbox', { name: 'Note (optional)' }).fill('Phoenix was there first');
    await panel.getByRole('button', { name: 'Award to Phoenix' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Award to Phoenix' }).click();

    await expect(panel.getByTestId('conflict-state')).toHaveText('Resolved: awarded to Phoenix (town)');
    expect(api.calls('POST', `TerritoryConflicts/${CONFLICT}/resolve`)[0].body).toEqual({
      resolution: 'Awarded', awardedHolder: { kind: 'Town', id: PHOENIX }, note: 'Phoenix was there first',
    });

    await panel.getByRole('button', { name: 'Reopen' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reopen' }).click();
    await expect(panel.getByTestId('conflict-state')).toHaveText('Open');
    expect(api.calls('POST', `TerritoryConflicts/${CONFLICT}/reopen`)).toHaveLength(1);
  });

  test('marks the lines redrawn without an award', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    await page.goto(`/display/TerritoryConflict/${CONFLICT}`);
    const panel = page.getByRole('region', { name: 'Contested zone' });

    await panel.getByRole('button', { name: 'Mark the lines redrawn' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Mark the lines redrawn' }).click();

    await expect(panel.getByTestId('conflict-state')).toHaveText('Resolved: lines redrawn');
    expect(api.calls('POST', `TerritoryConflicts/${CONFLICT}/resolve`)[0].body).toEqual({ resolution: 'Redrawn', note: null });
  });

  test('cancelling the question resolves nothing', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    await page.goto(`/display/TerritoryConflict/${CONFLICT}`);
    const panel = page.getByRole('region', { name: 'Contested zone' });

    await panel.getByRole('button', { name: 'Award to Rivertown' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();

    await expect(panel.getByTestId('conflict-state')).toHaveText('Open');
    expect(api.calls('POST', `TerritoryConflicts/${CONFLICT}/resolve`)).toHaveLength(0);
  });

  test('staff without knk.admin.world cannot resolve', async ({ page, api }) => {
    mockSession(api, alex, node => node !== WORLD);
    await page.goto(`/display/TerritoryConflict/${CONFLICT}`);
    const panel = page.getByRole('region', { name: 'Contested zone' });

    await expect(panel.getByTestId('conflict-state')).toHaveText('Open');
    for (const name of ['Award to Phoenix', 'Award to Rivertown', 'Mark the lines redrawn']) {
      await expect(panel.getByRole('button', { name })).toBeDisabled();
    }
    await expect(panel.getByText(`Requires ${WORLD}`)).toBeVisible();
  });
});

test.describe('the structure page', () => {
  test.use({ strictApi: true });

  let territory: StructureTerritoryDto;

  test.beforeEach(async ({ api }) => {
    territory = { ...keepTerritory };
    mockContentDefaults(api);
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [worldMetadata('Structure')]);
    api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Structure', generalDisplay('Structure', '802'));
    api.json('GET', `Structures/${KEEP}`, { id: KEEP, name: 'Market keep', districtId: MARKET, streetId: 11, streetNumber: 1, allowEntry: true });
    api.json<TownDto[]>('GET', /^Towns\/?$/, [
      { id: PHOENIX, name: 'Phoenix', allowEntry: true, requiredTitle: 0 },
      { id: 5, name: 'Rivertown', allowEntry: true, requiredTitle: 0 },
    ]);
    api.on('POST', 'landmarks/search', { body: { items: [], totalCount: 0, page: 1, pageSize: 100, totalPages: 0 } });
    api.on('POST', 'hubs/web/negotiate', { status: 404 });
    api.on<StructureTerritoryDto>('GET', `Territory/structures/${KEEP}`, () => ({ body: territory }));
    api.on<StructureTerritoryDto>('PUT', `Territory/structures/${KEEP}/loyalty`, ({ body }) => {
      const sent = body as StructureLoyaltyUpdateDto;
      territory = { ...territory, loyaltyTownId: sent.loyaltyTownId, loyaltyTownName: sent.loyaltyTownId === 5 ? 'Rivertown' : null };
      return { body: territory };
    });
    api.on<StructureTerritoryDto>('DELETE', `Territory/structures/${KEEP}/flag`, () => {
      territory = { ...territory, territoryFlag: 'None', territoryFlaggedAt: null, territoryConflictId: null };
      return { body: territory };
    });
  });

  test('shows the flag with its conflict and the own town (A07)', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    await page.goto(`/display/Structure/${KEEP}`);

    const panel = page.getByRole('region', { name: 'Territory and loyalty' });
    await expect(panel.getByTestId('structure-territory-flag')).toContainText('In a contested zone');
    await expect(panel.getByRole('link', { name: `Conflict #${CONFLICT}` }))
      .toHaveAttribute('href', new RegExp(`^/display/TerritoryConflict/${CONFLICT}`));
    await expect(panel.getByRole('link', { name: 'Phoenix' })).toBeVisible();
    await expect(panel.getByTestId('structure-loyalty')).toHaveText('Its own town');
  });

  test('sets and clears the loyalty (stored only)', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    await page.goto(`/display/Structure/${KEEP}`);
    const panel = page.getByRole('region', { name: 'Territory and loyalty' });

    // Its own town is not offered as a loyalty: that is "Its own town".
    await expect(panel.getByRole('combobox', { name: 'Loyalty' }).getByRole('option')).toHaveText(['Its own town', 'Rivertown']);
    await panel.getByRole('combobox', { name: 'Loyalty' }).selectOption({ label: 'Rivertown' });
    await panel.getByRole('button', { name: 'Save loyalty' }).click();
    await expect(panel.getByTestId('structure-loyalty')).toHaveText('Rivertown');

    await panel.getByRole('combobox', { name: 'Loyalty' }).selectOption({ label: 'Its own town' });
    await panel.getByRole('button', { name: 'Save loyalty' }).click();
    await expect(panel.getByTestId('structure-loyalty')).toHaveText('Its own town');

    expect(api.calls('PUT', `Territory/structures/${KEEP}/loyalty`).map(r => r.body)).toEqual([{ loyaltyTownId: 5 }, { loyaltyTownId: null }]);
  });

  test('clears the flag by hand', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    await page.goto(`/display/Structure/${KEEP}`);
    const panel = page.getByRole('region', { name: 'Territory and loyalty' });

    await panel.getByRole('button', { name: 'Clear flag' }).click();

    await expect(panel.getByTestId('structure-territory-flag')).toHaveText("Inside its town's territory");
    await expect(panel.getByRole('button', { name: 'Clear flag' })).toHaveCount(0);
    expect(api.calls('DELETE', `Territory/structures/${KEEP}/flag`)).toHaveLength(1);
  });

  test('staff without knk.admin.world see the flag but cannot change the loyalty', async ({ page, api }) => {
    mockSession(api, alex, node => node !== WORLD);
    await page.goto(`/display/Structure/${KEEP}`);
    const panel = page.getByRole('region', { name: 'Territory and loyalty' });

    await expect(panel.getByTestId('structure-territory-flag')).toContainText('In a contested zone');
    await expect(panel.getByRole('combobox', { name: 'Loyalty' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Clear flag' })).toBeDisabled();
  });
});

test.describe('game settings', () => {
  test.beforeEach(async ({ api }) => {
    mockSession(api, alex, () => true);
    api.json<GameSettingsDto>('GET', /^GameSettings\/?$/, gameSettings);
    api.on<GameSettingsDto>('PUT', /^GameSettings\/?$/, ({ body }) => ({
      body: { ...gameSettings, ...(body as GameSettingsUpdateDto), settingsVersion: '8' } as GameSettingsDto,
    }));
  });

  test('shows the production flag and the range settings with an example (G11)', async ({ page }) => {
    await page.goto('/admin/game-settings');

    const card = page.getByRole('region', { name: 'Production and territory' });
    await expect(card.getByRole('checkbox', { name: /Production enabled/ })).not.toBeChecked();
    await expect(card.getByRole('spinbutton', { name: 'Base range (blocks)' })).toHaveValue('100');
    await expect(card.getByRole('spinbutton', { name: 'Blocks per power point' })).toHaveValue('2');
    await expect(card.getByRole('spinbutton', { name: 'Capital multiplier' })).toHaveValue('1.5');
    await expect(card.getByTestId('territory-range-example'))
      .toHaveText('A town of power 50: (100 + 50 × 2) = 200 blocks; its capital (100 + 50 × 2) × 1.5 = 300 blocks.');
  });

  test('saves the flag and the ranges in the production section', async ({ page, api }) => {
    await page.goto('/admin/game-settings');
    const card = page.getByRole('region', { name: 'Production and territory' });

    await card.getByRole('checkbox', { name: /Production enabled/ }).check();
    await card.getByRole('spinbutton', { name: 'Blocks per power point' }).fill('3');
    await page.getByRole('button', { name: /^Save/ }).click();

    await expect.poll(() => api.calls('PUT', /^GameSettings\/?$/).length).toBe(1);
    expect((api.calls('PUT', /^GameSettings\/?$/)[0].body as GameSettingsUpdateDto).production)
      // P3 (#678), P5c (#682): the engine timing and transport go back with the section, so a save never resets them.
      .toEqual({
        enabled: true,
        territory: { baseRange: 100, powerFactor: 3, capitalMultiplier: 1.5 },
        engine: { baseCycleMinutes: 10, catchUpCapHours: 24, weatherDayMinutes: 20 },
        // P5c (#682): the transport section too (the defaults here).
        transport: {
          walkingSpeedBlocksPerSecond: 4.317, defaultCarrierCapacity: 64, defaultThresholdPercent: 75, defaultThresholdUnits: 64,
          unmeasuredRouteFactor: 1.4, fallbackDistanceBlocks: 200, awaitingSpaceMinutes: 30, maxReroutes: 2, laneMaxAgeHours: 24,
        },
      });
  });

  test('says which value the API would refuse', async ({ page }) => {
    await page.goto('/admin/game-settings');
    const card = page.getByRole('region', { name: 'Production and territory' });

    await card.getByRole('spinbutton', { name: 'Capital multiplier' }).fill('0.5');

    await expect(card.getByRole('list', { name: 'Territory settings problems' }))
      .toHaveText('production.territory.capitalMultiplier must be between 1 and 10.');
    await expect(page.getByRole('button', { name: /^Save/ })).toBeDisabled();
  });
});
