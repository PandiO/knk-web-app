import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import {
  noStepProgress,
  noValidationRules,
  savedProgress,
  townForm,
  townMetadata,
  workflowSession,
} from './fixtures/forms';
import type { FieldValidationRuleDto } from '../src/types/dtos/forms/FieldValidationRuleDtos';
import type { FormConfigurationDto, FormSubmissionProgressDto } from '../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { StepProgressReadDto, WorkflowSessionReadDto } from '../src/types/dtos/workflow/WorkflowDtos';

/**
 * The form wizard's first step (entity setup, /forms/town): a required field blocks "Next", a filled
 * step saves the draft (POST FormSubmissionProgress) and opens the next step, and "Previous" keeps
 * what was entered.
 */

test.beforeEach(async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex, () => true);
  mockContentDefaults(api);
  api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/town', [townForm]);
  api.json<FormConfigurationDto>('GET', `FormConfigurations/${townForm.id}`, townForm);
  api.json<EntityMetadataDto>('GET', 'Metadata/entities/town', townMetadata);
  api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${townForm.id}`, noValidationRules);
  api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, townForm));
  api.json<StepProgressReadDto[]>('GET', 'Workflows/501/progress', noStepProgress);
  api.on<FormSubmissionProgressDto>('POST', /^FormSubmissionProgress\/?$/, ({ body }) => ({
    body: savedProgress(body as FormSubmissionProgressDto),
  }));

  await page.goto('/forms/town');
  await page.getByRole('button', { name: 'Use' }).click();
  await expect(page.getByRole('heading', { name: 'Basics', level: 2 })).toBeVisible();
});

test('a required field blocks the next step', async ({ page, api }) => {
  await page.getByRole('button', { name: 'Next' }).click();

  const summary = page.getByRole('alert').filter({ hasText: 'Fix this field to continue' });
  await expect(summary).toBeVisible();
  // The summary links to the field, and the field shows the same message under it.
  await expect(summary.getByRole('link', { name: 'Name is required' })).toHaveAttribute('href', '#wizard-field-Name');
  await expect(page.getByRole('group').filter({ hasText: 'Name is required' }).getByRole('paragraph')).toHaveText('Name is required');
  await expect(page.getByRole('textbox', { name: 'Name*' })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('heading', { name: 'Basics', level: 2 })).toBeVisible();
  expect(api.calls('POST', /^FormSubmissionProgress\/?$/)).toHaveLength(0);
});

test('a filled step saves the draft and opens the next step', async ({ page, api }) => {
  await page.getByRole('textbox', { name: 'Name*' }).fill('Eldoria');
  await page.getByRole('textbox', { name: 'Description' }).fill('A town by the lake');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('heading', { name: 'Access', level: 2 })).toBeVisible();
  const [saved] = api.calls('POST', /^FormSubmissionProgress\/?$/);
  const draft = saved.body as FormSubmissionProgressDto;
  expect(draft).toMatchObject({ formConfigurationId: townForm.id, entityTypeName: 'town', workflowSessionId: 501 });
  expect(JSON.parse(draft.currentStepDataJson ?? '{}')).toEqual({ Name: 'Eldoria', Description: 'A town by the lake' });

  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.getByRole('heading', { name: 'Basics', level: 2 })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Name*' })).toHaveValue('Eldoria');
});
