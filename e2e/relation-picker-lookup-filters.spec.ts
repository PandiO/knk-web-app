import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import {
  noStepProgress,
  noValidationRules,
  savedProgress,
  SIEGE_MANAGE,
  siegeObjectiveForm,
  siegeObjectiveMetadata,
  siegeTeamMetadata,
  workflowSession,
} from './fixtures/forms';
import type { LookupItemDto, LookupSearchResponseDto } from '../src/apiClients/lookupClient';
import type { FieldValidationRuleDto } from '../src/types/dtos/forms/FieldValidationRuleDtos';
import type { FormConfigurationDto, FormSubmissionProgressDto } from '../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { StepProgressReadDto, WorkflowSessionReadDto } from '../src/types/dtos/workflow/WorkflowDtos';

/**
 * PandiO/knk-workspace#288: a relation field whose pickerFilters narrow the list (a siege objective's holder team,
 * scoped to its scenario) used by staff without the siege read node. The picker searches api/Lookup with the filter
 * and offers the scenario's teams, names only, instead of "This list is narrowed by …, which only the full … search
 * can do". When the API refuses a filter the type's lookup doesn't take, the picker says so.
 */

test.use({ strictApi: true });

type LookupRequest = { searchTerm: string | null; page: number; pageSize: number; filters?: Record<string, string> };

const teams: Array<LookupItemDto & { scenarioId: number }> = [
  { id: 201, label: 'Cinix Garrison', detail: 'Defender', scenarioId: 100 },
  { id: 202, label: 'Raiders', detail: 'Attacker', scenarioId: 100 },
  { id: 203, label: 'Rebels', detail: 'Attacker', scenarioId: 101 },
];

test.beforeEach(async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  // World staff: every node but the siege one, so siege teams are read through the lookup.
  mockSession(api, alex, node => node !== SIEGE_MANAGE);
  mockContentDefaults(api);
  api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [siegeTeamMetadata]);
  api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/siegeobjective', [siegeObjectiveForm]);
  api.json<FormConfigurationDto>('GET', `FormConfigurations/${siegeObjectiveForm.id}`, siegeObjectiveForm);
  api.json<EntityMetadataDto>('GET', 'Metadata/entities/siegeobjective', siegeObjectiveMetadata);
  api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${siegeObjectiveForm.id}`, noValidationRules);
  api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, siegeObjectiveForm));
  api.json<StepProgressReadDto[]>('GET', 'Workflows/501/progress', noStepProgress);
  api.on<FormSubmissionProgressDto>('POST', /^FormSubmissionProgress\/?$/, ({ body }) => ({
    body: savedProgress(body as FormSubmissionProgressDto),
  }));
  // No display configuration for teams (the field's summary falls back to the name).
  api.on('GET', 'DisplayConfigurations/entity/SiegeTeam', { status: 404, body: { error: 'NotFound' } });
  // The full team search refuses a viewer without the siege node, as the API does. The picker may ask it once while
  // the type metadata is still loading (PandiO/knk-workspace#585); its answer must never reach the list.
  api.on('POST', 'SiegeTeams/search', { status: 403, body: { error: 'Forbidden', message: `Requires ${SIEGE_MANAGE}.` } });
  // The lookup applies the scenario filter as the API does: only that scenario's teams, labels only.
  api.on<LookupSearchResponseDto>('POST', 'Lookup/SiegeTeam/search', ({ body }) => {
    const request = body as LookupRequest;
    const scenario = Number(request.filters?.siegeScenarioId ?? 0);
    const items = teams
      .filter(team => !scenario || team.scenarioId === scenario)
      .map(({ id, label, detail }) => ({ id, label, detail }));
    return { body: { items, total: items.length } };
  });

  await page.goto('/forms/siegeobjective');
  await page.getByRole('button', { name: 'Use' }).click();
  await expect(page.getByRole('heading', { name: 'Holder', level: 2 })).toBeVisible();
});

test('a filtered relation field in lookup mode offers only the narrowed list', async ({ page, api }) => {
  await page.getByPlaceholder('Search Initial holder team…').click();

  const results = page.getByRole('listbox', { name: 'Siege team results' });
  await expect(results.getByRole('option')).toHaveCount(2);
  await expect(results.getByRole('option', { name: /Cinix Garrison/ })).toBeVisible();
  await expect(results.getByRole('option', { name: /Raiders/ })).toContainText('Attacker');
  await expect(results.getByRole('option', { name: /Rebels/ })).toHaveCount(0);
  await expect(page.getByText(`Names only: the full Siege team table needs one of: ${SIEGE_MANAGE}.`)).toBeVisible();
  await expect(page.getByText(/This list is narrowed by/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open full table' })).toHaveCount(0);

  const [search] = api.calls('POST', 'Lookup/SiegeTeam/search');
  expect((search.body as LookupRequest).filters).toEqual({ siegeScenarioId: '100' });

  await results.getByRole('option', { name: /Raiders/ }).click();
  await expect(page.getByText('Raiders', { exact: true })).toBeVisible();
});

test('a filter the lookup refuses shows which filter only the full search can apply', async ({ page, api }) => {
  api.on('POST', 'Lookup/SiegeTeam/search', {
    status: 400,
    body: {
      error: 'LookupFilterNotAllowed',
      message: "A SiegeTeam lookup can't be narrowed by siegeScenarioId; only the full SiegeTeam search can.",
      filters: ['siegeScenarioId'],
    },
  });

  await page.getByPlaceholder('Search Initial holder team…').click();

  await expect(page.getByTestId('relation-picker-panel').getByRole('status')).toHaveText(
    `This list is narrowed by siegeScenarioId, which only the full Siege team search can do. Requires one of: ${SIEGE_MANAGE}.`
  );
  await expect(page.getByRole('option')).toHaveCount(0);
});
