import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { townBuilderState, townForm, townMetadata } from './fixtures/forms';
import type {
  FormConfigurationBuilderState,
  FormConfigurationDto,
  FormStepDto,
  FormFieldDto,
} from '../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { ValidationIssueDto } from '../src/types/dtos/forms/FieldValidationRuleDtos';

/**
 * PandiO/knk-workspace#291: field validation rules are part of the form builder's draft. A field that only exists in
 * the draft can get a rule; the rule is saved with the draft (keyed by field GUID) and sent on Publish. Until then
 * nothing is written to the published rules the form wizard reads (api/field-validation-rules).
 */

test.use({ strictApi: true });

const ruleWrites = /^field-validation-rules(\/\d+)?\/?$/;
const spawnGuid = '00000000-0000-0000-0000-000000000099';

test.beforeEach(async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex, () => true);
  mockContentDefaults(api);
  api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [townMetadata]);
  api.json<EntityMetadataDto>('GET', 'Metadata/entities/Town', townMetadata);
  api.json<FormStepDto[]>('GET', 'FormConfigurations/reusable-steps', []);
  api.json<FormFieldDto[]>('GET', 'FormConfigurations/reusable-fields', []);
  api.json<FormConfigurationDto[]>('GET', /^FormConfigurations\/?$/, [townForm]);
  api.json<FormConfigurationBuilderState>('GET', `FormConfigurations/${townForm.id}/builder`, townBuilderState);
  // The health panel checks the working copy and the published version; nothing to report here.
  api.json<ValidationIssueDto[]>('POST', 'field-validation-rules/health-check/configuration/draft', []);
  api.json<ValidationIssueDto[]>('GET', `field-validation-rules/health-check/configuration/${townForm.id}`, []);
  api.on<FormConfigurationBuilderState>('PUT', `FormConfigurations/${townForm.id}/draft`, ({ body }) => ({
    body: { ...townBuilderState, configuration: body as FormConfigurationDto },
  }));
  api.json<FormConfigurationDto>('POST', `FormConfigurations/${townForm.id}/publish`, townForm);

  await page.goto(`/admin/form-configurations/edit/${townForm.id}`);
  await expect(page.getByTestId('builder-toolbar')).toBeVisible();
});

async function addRuleToSpawnPoint(page: import('@playwright/test').Page) {
  await page.getByText('1. Basics').click();
  await page.getByRole('button', { name: 'Edit field Spawn point' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Field' });
  await expect(editor.getByText('Cross-Field Validation Rules')).toBeVisible();
  await editor.getByRole('button', { name: '+ Add Rule' }).click();
  await editor.getByLabel(/Error Message/).fill('The spawn point must be inside the town.');
  await editor.getByRole('button', { name: 'Add Rule', exact: true }).click();
  const rule = editor.getByTestId('validation-rule');
  await expect(rule).toHaveCount(1);
  await expect(rule).toContainText('Not published');
  await expect(rule).toContainText('The spawn point must be inside the town.');
  await editor.getByRole('button', { name: 'Save Field' }).click();
  await expect(editor).toBeHidden();
}

test('a field that only exists in the draft gets a rule, saved with the draft', async ({ page, api }) => {
  await addRuleToSpawnPoint(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect.poll(() => api.calls('PUT', `FormConfigurations/${townForm.id}/draft`).length).toBe(1);
  const [saved] = api.calls('PUT', `FormConfigurations/${townForm.id}/draft`);
  const body = saved.body as FormConfigurationDto;
  expect(body.validationRules).toEqual([
    expect.objectContaining({
      fieldGuid: spawnGuid,
      validationType: 'LocationInsideRegion',
      errorMessage: 'The spawn point must be inside the town.',
      isBlocking: true,
    }),
  ]);
  expect(body.validationRules?.[0]).not.toHaveProperty('id');
  // The wizard reads the published rules: nothing was written to them.
  for (const method of ['POST', 'PUT', 'DELETE'] as const) {
    expect(api.calls(method, ruleWrites)).toHaveLength(0);
  }
  expect(api.calls('POST', `FormConfigurations/${townForm.id}/publish`)).toHaveLength(0);
});

test('Publish names the new rule and publishes the saved draft', async ({ page, api }) => {
  await addRuleToSpawnPoint(page);
  await page.getByRole('button', { name: /Publish/ }).first().click();

  const dialog = page.getByRole('alertdialog', { name: /Publish the changes/ });
  await expect(dialog).toContainText('Validation rules: 1 added.');
  // Unsaved changes are saved first; the rule goes with the draft.
  const [saved] = api.calls('PUT', `FormConfigurations/${townForm.id}/draft`);
  expect((saved.body as FormConfigurationDto).validationRules).toHaveLength(1);
  expect(api.calls('POST', ruleWrites)).toHaveLength(0);

  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();

  await expect.poll(() => api.calls('POST', `FormConfigurations/${townForm.id}/publish`).length).toBe(1);
  expect(api.calls('POST', ruleWrites)).toHaveLength(0);
});

// P2 (PandiO/knk-workspace#676, production DESIGN § 3.4): the rule builder offers InsideTerritory (placement rules P-2
// and P-3), filled with the town holder config and as a warning, the default for every placement rule.
test('the rule builder offers InsideTerritory as a warning with the town holder config', async ({ page, api }) => {
  await page.getByText('1. Basics').click();
  await page.getByRole('button', { name: 'Edit field Spawn point' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Field' });
  await editor.getByRole('button', { name: '+ Add Rule' }).click();
  await editor.getByLabel('Validation Type *').selectOption('InsideTerritory');
  await expect(editor.getByTestId('rule-type-help')).toContainText("territory of the town the dependency field names");
  await expect(editor.getByRole('checkbox', { name: 'Block step progression on validation failure' })).not.toBeChecked();
  await editor.getByRole('button', { name: 'Add Rule', exact: true }).click();
  await expect(editor.getByTestId('validation-rule')).toHaveCount(1);
  await editor.getByRole('button', { name: 'Save Field' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect.poll(() => api.calls('PUT', `FormConfigurations/${townForm.id}/draft`).length).toBe(1);
  const body = api.calls('PUT', `FormConfigurations/${townForm.id}/draft`)[0].body as FormConfigurationDto;
  expect(body.validationRules).toEqual([
    expect.objectContaining({ fieldGuid: spawnGuid, validationType: 'InsideTerritory', isBlocking: false }),
  ]);
  expect(JSON.parse(body.validationRules?.[0].configJson ?? '{}')).toEqual({ holderKind: 'Town', holderIdPath: 'Id' });
});
