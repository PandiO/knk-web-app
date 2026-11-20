import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { noStepProgress, noValidationRules, savedProgress, workflowSession } from './fixtures/forms';
import { permissionGroupMetadata } from './fixtures/groupGrants';
import { groupForm, groupFormMetadata, mockGroupSearch, staff, STAFF_ID } from './fixtures/groupRouteMode';
import type { Page } from '@playwright/test';
import type { MockApi } from './support/mockApi';
import type { FieldValidationRuleDto } from '../src/types/dtos/forms/FieldValidationRuleDtos';
import type { FormConfigurationDto, FormSubmissionProgressDto } from '../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { PermissionGroupDto } from '../src/types/dtos/userManagement/PermissionGroupDto';
import type { StepProgressReadDto, WorkflowSessionReadDto } from '../src/types/dtos/workflow/WorkflowDtos';

/**
 * A permission group's default /navigate route mode in the web app (PandiO/knk-workspace#852, step A): the dashboard
 * shows it per group, and the group form offers "None (default: preferred)" plus the three modes, shows the stored
 * one, and saves the pick (or "" for None, which the API reads as "no default") through the group endpoints.
 * Smoke test: knk-workspace docs/guides/navigation-offroad-smoke-test.md "L7b".
 */

test.use({ strictApi: true });

test.beforeEach(async ({ page }) => {
  await startLoggedIn(page, 'access-1');
});

test('the dashboard shows each group\'s default route mode', async ({ page, api }) => {
  mockSession(api, alex, () => true);
  mockContentDefaults(api);
  api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [permissionGroupMetadata]);
  api.json<FormConfigurationDto[]>('GET', /^FormConfigurations\/PermissionGroup$/i, []);
  mockGroupSearch(api);
  await page.goto('/dashboard/PermissionGroup');

  const table = page.getByRole('table');
  await expect(table.getByRole('columnheader', { name: 'Default route' })).toBeVisible();
  await expect(table.getByRole('row').filter({ hasText: 'Staff' })).toContainText('efficient');
  await expect(table.getByRole('row').filter({ hasText: 'Noble' })).toContainText('preferred');
  // The Default group sets none: its cell shows "-" (Noble's row also says Default, as its parent).
  const defaultRow = table.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Default', exact: true }) }).filter({ hasNotText: 'Noble' });
  await expect(defaultRow).toHaveCount(1);
  await expect(defaultRow).not.toContainText(/shortest|efficient|preferred/);
});

function mockGroupForm(api: MockApi) {
  mockSession(api, alex, () => true);
  mockContentDefaults(api);
  api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/PermissionGroup', [groupForm]);
  api.json<FormConfigurationDto>('GET', `FormConfigurations/${groupForm.id}`, groupForm);
  api.json<EntityMetadataDto>('GET', 'Metadata/entities/PermissionGroup', groupFormMetadata);
  api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${groupForm.id}`, noValidationRules);
  api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, groupForm));
  api.json<StepProgressReadDto[]>('GET', 'Workflows/501/progress', noStepProgress);
  api.json<StepProgressReadDto>('POST', 'Workflows/501/steps/Group/complete', {
    id: 601, workflowSessionId: 501, stepKey: 'Group', stepIndex: 0, status: 'Completed', createdAt: '2026-11-20T10:00:00Z',
  });
  for (const method of ['POST', 'PUT'] as const) {
    api.on<FormSubmissionProgressDto>(method, /^FormSubmissionProgress(\/.*)?$/, ({ body }) => ({
      body: savedProgress(body as FormSubmissionProgressDto),
    }));
  }
  mockGroupSearch(api);
}

const routeMode = (page: Page) => page.getByRole('combobox', { name: 'Default route mode' });

test('a new group saves the picked mode through POST api/PermissionGroups', async ({ page, api }) => {
  mockGroupForm(api);
  api.on<PermissionGroupDto>('POST', /^PermissionGroups\/?$/, ({ body }) => ({ status: 201, body: { ...(body as PermissionGroupDto), id: 41 } }));

  await page.goto('/forms/PermissionGroup');
  await page.getByRole('button', { name: 'Use' }).click();
  await page.getByRole('textbox', { name: 'Name*' }).fill('Builders');
  await expect(routeMode(page)).toHaveValue('');
  await expect(routeMode(page).locator('option')).toHaveText(['None (default: preferred)', 'shortest', 'efficient', 'preferred']);
  await routeMode(page).selectOption('shortest');
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect.poll(() => api.calls('POST', /^PermissionGroups\/?$/).length).toBe(1);
  const [create] = api.calls('POST', /^PermissionGroups\/?$/);
  expect(create.body).toMatchObject({ Name: 'Builders', DefaultRouteMode: 'shortest' });
});

test('editing a group shows its stored mode, and None clears it', async ({ page, api }) => {
  mockGroupForm(api);
  api.json<PermissionGroupDto>('GET', `PermissionGroups/${STAFF_ID}`, staff);
  api.on('PUT', `PermissionGroups/${STAFF_ID}`, () => ({ status: 204 }));

  await page.goto(`/forms/PermissionGroup/edit/${STAFF_ID}`);
  await expect(routeMode(page)).toHaveValue('efficient');
  await routeMode(page).selectOption({ label: 'None (default: preferred)' });
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect.poll(() => api.calls('PUT', `PermissionGroups/${STAFF_ID}`).length).toBe(1);
  const [update] = api.calls('PUT', `PermissionGroups/${STAFF_ID}`);
  // Only the form's field is sent (no second, camel-cased copy of the stored value the API would also bind).
  const sent = Object.entries(update.body as Record<string, unknown>).filter(([key]) => key.toLowerCase() === 'defaultroutemode');
  expect(sent).toEqual([['DefaultRouteMode', '']]);
  expect(update.body).toMatchObject({ Name: 'Staff', Weight: 40 });
});
