import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { noStepProgress, noValidationRules, townForm, townMetadata, workflowSession } from './fixtures/forms';
import type { FieldValidationRuleDto } from '../src/types/dtos/forms/FieldValidationRuleDtos';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { StepProgressReadDto, WorkflowSessionReadDto, WorldTaskReadDto } from '../src/types/dtos/workflow/WorkflowDtos';
import type { EntityReferenceRowsDto } from '../src/apiClients/entityReferenceClient';
import type {
  EntityReferencesDto,
  FormConfigurationDto,
  FormSubmissionProgressDto,
  FormSubmissionProgressSummaryDto,
} from '../src/types/dtos/forms/FormModels';
import type { DisplayConfigurationDto } from '../src/types/dtos/displayConfig/DisplayModels';
import { FormSubmissionStatus } from '../src/utils/enums';

/**
 * "Show what uses it" on Entity setup (PandiO/knk-workspace#289): a form configuration whose delete is refused because
 * another form opens it as a sub-form, and a draft deleted together with the entities its child forms created, where
 * one entity is skipped as in use, and the same for a cancelled form (KNG-162). Smoke test: knk-workspace docs/guides/relation-picker-and-delete-details-smoke-test.md § 4.
 */

test.use({ strictApi: true });

const RECORDED = JSON.stringify([
  { entityTypeName: 'District', id: 501, display: { name: 'Oostwijk' }, origin: { formPath: ['town', 'Street'], fieldName: 'Districts' }, sequence: 1 },
  { entityTypeName: 'Street', id: 77, display: { name: 'Gatestraat' }, origin: { formPath: ['town'], fieldName: 'StreetId' }, sequence: 2 },
]);

const draft: FormSubmissionProgressSummaryDto = {
  id: '9',
  formConfigurationId: townForm.id!,
  formConfigurationName: townForm.configurationName,
  entityTypeName: 'Town',
  currentStepIndex: 0,
  status: FormSubmissionStatus.Paused,
  createdAt: '2026-11-14T08:00:00Z',
  updatedAt: '2026-11-14T08:00:00Z',
  createdEntitiesJson: RECORDED,
};

const notInUse = (entityTypeName: string, id: string): EntityReferencesDto => ({ entityTypeName, id, inUse: false, references: [] });

test.beforeEach(async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex, () => true);
  mockContentDefaults(api);
  api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/town', [townForm]);
});

test('a form configuration used as a sub-form: the refusal offers "Show what uses it" with the fields and steps, named by their form', async ({ page, api }) => {
  api.json<EntityReferencesDto>('GET', `FormSubmissionProgress/entity-references/FormConfiguration/${townForm.id}`, notInUse('FormConfiguration', townForm.id!));
  api.on('DELETE', `FormConfigurations/${townForm.id}`, {
    status: 409,
    body: {
      code: 'DbConstraint',
      message: "This form configuration can't be deleted: it is still used by 1 form field that opens it as a sub-form and 1 form step that uses it as a sub-form. Remove or change those first.",
    },
  });
  api.json<EntityReferenceRowsDto>('GET', `EntityReferences/FormConfiguration/${townForm.id}/rows`, {
    entityTypeName: 'FormConfiguration',
    id: Number(townForm.id),
    groups: [
      { referencedBy: 'FormField.SubConfigurationId', entityType: 'FormField', count: 1, listed: true, readable: false, nodes: [], rows: [{ id: 31, label: 'Capital', detail: 'Field of the form "Kingdom form" (Kingdom), step "Towns"' }], more: false },
      { referencedBy: 'FormStep.SubConfigurationId', entityType: 'FormStep', count: 1, listed: true, readable: false, nodes: [], rows: [{ id: 8, label: 'Founding town', detail: 'Reusable step template' }], more: false },
    ],
  });
  await page.goto('/forms/town');

  await page.getByRole('button', { name: `More actions for ${townForm.configurationName}` }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('alertdialog', { name: 'Delete this form configuration?' }).getByRole('button', { name: 'Delete' }).click();

  const failed = page.getByRole('alertdialog', { name: 'Delete failed' });
  await expect(failed).toContainText('it is still used by 1 form field that opens it as a sub-form');
  expect(api.calls('GET', /^EntityReferences\//)).toHaveLength(0);

  await failed.getByRole('button', { name: 'Show what uses it' }).click();
  await expect(failed.getByRole('heading', { name: '1 form field that opens it as a sub-form' })).toBeVisible();
  await expect(failed.getByText('Capital')).toBeVisible();
  await expect(failed.getByText('Field of the form "Kingdom form" (Kingdom), step "Towns"')).toBeVisible();
  await expect(failed.getByRole('heading', { name: '1 form step that uses it as a sub-form' })).toBeVisible();
  await expect(failed.getByText('Reusable step template')).toBeVisible();
  // Form fields and steps have no page of their own: named, never linked.
  await expect(failed.getByRole('link')).toHaveCount(0);
  await expect(page.getByRole('button', { name: `More actions for ${townForm.configurationName}` })).toBeVisible();
});

test('a form configuration delete that fails for another reason has no "Show what uses it"', async ({ page, api }) => {
  api.json<EntityReferencesDto>('GET', `FormSubmissionProgress/entity-references/FormConfiguration/${townForm.id}`, notInUse('FormConfiguration', townForm.id!));
  api.on('DELETE', `FormConfigurations/${townForm.id}`, { status: 500, body: { error: 'ServerError' } });
  await page.goto('/forms/town');

  await page.getByRole('button', { name: `More actions for ${townForm.configurationName}` }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('alertdialog', { name: 'Delete this form configuration?' }).getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('alertdialog', { name: 'Delete failed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show what uses it' })).toHaveCount(0);
});

test('deleting a draft and its entities: a skipped entity offers "Show what uses it" with every reference, and a row opens', async ({ page, api }) => {
  api.json<FormSubmissionProgressSummaryDto[]>('GET', 'FormSubmissionProgress/entity', [draft]);
  // The Street goes; the District stays: a structure was built in it since.
  mockSkippedDistrict(api);
  api.on('DELETE', 'FormSubmissionProgress/9', { status: 204 });
  api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Structure', { name: 'Structure display', entityTypeName: 'Structure', isDefault: true, isDraft: false, sections: [] });
  api.json('GET', 'Structures/3', { id: 3, name: 'Smithy' });
  await page.goto('/forms/town');

  await page.getByRole('button', { name: 'Delete saved progress' }).click();
  const prompt = page.getByRole('alertdialog', { name: 'Delete this saved progress?' });
  await prompt.getByRole('button', { name: 'Delete draft and them' }).click();

  const results = prompt.getByRole('list', { name: 'Delete results' });
  await expect(prompt.getByText('Deleted 1 of 2.')).toBeVisible();
  const street = results.getByRole('listitem').filter({ hasText: "Street 'Gatestraat'" });
  const district = results.getByRole('listitem').filter({ hasText: "District 'Oostwijk'" });
  await expect(street.getByRole('button')).toHaveCount(0);
  await expect(district).toContainText('skipped: in use');
  expect(api.calls('GET', /^EntityReferences\//)).toHaveLength(0);

  await district.getByRole('button', { name: 'Show what uses it' }).click();
  await expect(district.getByRole('heading', { name: '1 structure' })).toBeVisible();
  expect(api.calls('GET', 'EntityReferences/District/501/rows')[0].query.get('all')).toBe('true');

  await district.getByRole('link', { name: 'Smithy' }).click();
  await expect(page).toHaveURL(/\/display\/Structure\/3/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

/** The District skipped as in use (a structure was built in it), the Street deleted, and the District's rows. */
function mockSkippedDistrict(api: import('./support/mockApi').MockApi): void {
  api.json<EntityReferencesDto>('GET', 'FormSubmissionProgress/entity-references/Street/77', notInUse('Street', '77'));
  api.on('DELETE', 'Streets/77', { status: 204 });
  api.json<EntityReferencesDto>('GET', 'FormSubmissionProgress/entity-references/District/501', {
    entityTypeName: 'District', id: '501', inUse: true, references: [{ referencedBy: 'Structure.DistrictId', count: 1 }],
  });
  api.json<EntityReferenceRowsDto>('GET', 'EntityReferences/District/501/rows', {
    entityTypeName: 'District',
    id: 501,
    groups: [{ referencedBy: 'Structure.DistrictId', entityType: 'Structure', count: 1, listed: true, readable: true, nodes: ['knk.admin.world'], rows: [{ id: 3, label: 'Smithy' }], more: false }],
  });
}

test('cancelling a form and deleting what it created: a skipped entity offers "Show what uses it" with every reference', async ({ page, api }) => {
  api.json<FormSubmissionProgressSummaryDto[]>('GET', 'FormSubmissionProgress/entity', [draft]);
  // A resumed draft pins the entities its child forms created, so Cancel lists them as for a form filled now.
  api.json<FormSubmissionProgressDto>('GET', 'FormSubmissionProgress/9', {
    id: '9',
    formConfigurationId: townForm.id!,
    userId: String(alex.id),
    entityTypeName: 'Town',
    currentStepIndex: 0,
    currentStepDataJson: JSON.stringify({ Name: 'Eldoria' }),
    allStepsDataJson: JSON.stringify({ 0: { Name: 'Eldoria' } }),
    status: FormSubmissionStatus.Paused,
    createdEntitiesJson: RECORDED,
  });
  api.json<FormConfigurationDto>('GET', `FormConfigurations/${townForm.id}`, townForm);
  api.json<EntityMetadataDto>('GET', 'Metadata/entities/town', townMetadata);
  api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${townForm.id}`, noValidationRules);
  api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, townForm));
  api.json<StepProgressReadDto[]>('GET', 'Workflows/501/progress', noStepProgress);
  api.json<WorldTaskReadDto[]>('GET', 'FormSubmissionProgress/9/world-tasks', []);
  mockSkippedDistrict(api);
  await page.goto('/forms/town');

  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('heading', { name: 'Basics', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel form' }).click();
  const prompt = page.getByRole('alertdialog', { name: 'Cancel this form?' });
  await prompt.getByRole('button', { name: 'Delete them' }).click();

  const results = prompt.getByRole('list', { name: 'Delete results' });
  await expect(prompt.getByText('Deleted 1 of 2.')).toBeVisible();
  const district = results.getByRole('listitem').filter({ hasText: "District 'Oostwijk'" });
  await expect(district).toContainText('skipped: in use');
  await expect(results.getByRole('listitem').filter({ hasText: "Street 'Gatestraat'" }).getByRole('button')).toHaveCount(0);

  await district.getByRole('button', { name: 'Show what uses it' }).click();
  await expect(district.getByRole('link', { name: 'Smithy' })).toBeVisible();
  expect(api.calls('GET', 'EntityReferences/District/501/rows')[0].query.get('all')).toBe('true');
  // Done still leaves the form as before.
  await prompt.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Basics', level: 2 })).toHaveCount(0);
});
