import { test, expect } from './support/mockApi';
import type { Locator, Page } from '@playwright/test';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import {
  noStepProgress,
  noValidationRules,
  savedProgress,
  structureForm,
  structureMetadata,
  workflowSession,
} from './fixtures/forms';
import { expectNoSidewaysScroll } from './support/layout';
import type { PagedQueryDto, PagedResultDto } from '../src/types/dtos/common/PagedQuery';
import type { DistrictDto } from '../src/types/dtos/district/DistrictDto';
import type { FieldValidationRuleDto } from '../src/types/dtos/forms/FieldValidationRuleDtos';
import type { FormConfigurationDto, FormSubmissionProgressDto } from '../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { StepProgressReadDto, WorkflowSessionReadDto } from '../src/types/dtos/workflow/WorkflowDtos';

/**
 * PandiO/knk-workspace#290: the "Selected (n):" cards of a form wizard Object List field. At 390 px
 * the name was cut to one letter beside "Edit instance" and ×; now the buttons move to their own
 * line, the name keeps the card's width and nothing scrolls sideways. At desktop width the card
 * stays one row: initial, name, ×, Edit instance.
 */

const LONG_NAME = 'Old Harbour Market Quarter';
const districts: DistrictDto[] = [
  { id: 41, name: LONG_NAME, allowEntry: true, townId: 7 },
  { id: 42, name: 'North', allowEntry: true, townId: 7 },
];

function pageOf(items: DistrictDto[], query: PagedQueryDto): PagedResultDto<DistrictDto> {
  return { items, totalCount: items.length, page: query.page, pageSize: query.pageSize, totalPages: 1 };
}

test.beforeEach(async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex, () => true);
  mockContentDefaults(api);
  api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/structure', [structureForm]);
  api.json<FormConfigurationDto>('GET', `FormConfigurations/${structureForm.id}`, structureForm);
  api.json<EntityMetadataDto>('GET', 'Metadata/entities/structure', structureMetadata);
  api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${structureForm.id}`, noValidationRules);
  api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, structureForm));
  api.json<StepProgressReadDto[]>('GET', 'Workflows/501/progress', noStepProgress);
  api.on<FormSubmissionProgressDto>('POST', /^FormSubmissionProgress\/?$/, ({ body }) => ({
    body: savedProgress(body as FormSubmissionProgressDto),
  }));
  api.on<PagedResultDto<DistrictDto>>('POST', 'Districts/search', ({ body }) => {
    const query = body as PagedQueryDto;
    const term = (query.searchTerm ?? '').toLowerCase();
    return { body: pageOf(districts.filter(d => d.name.toLowerCase().includes(term)), query) };
  });
});

/** Opens the structure form and picks the district with the long name in the Districts field. */
async function selectLongDistrict(page: Page): Promise<Locator> {
  await page.goto('/forms/structure');
  await page.getByRole('button', { name: 'Use' }).click();
  await expect(page.getByRole('heading', { name: 'Districts', level: 2 })).toBeVisible();

  await page.getByPlaceholder('Search Districts to add…').fill('harbour');
  await page.getByRole('option', { name: new RegExp(LONG_NAME) }).click();
  // Close the result list first: it sits in the page flow, so closing it on the first outside tap moves the page
  // under the pointer and that tap misses (picker behaviour, PandiO/knk-workspace#570).
  await page.getByPlaceholder('Search Districts to add…').press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);

  const selected = page.getByRole('list', { name: 'Selected Districts' });
  await expect(selected.getByRole('listitem')).toHaveCount(1);
  return selected.getByRole('listitem').first();
}

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no box');
  return box;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** The name is shown in full: not cut off (no hidden overflow) and wider than a couple of letters. */
async function expectNameFullyVisible(name: Locator): Promise<void> {
  await expect(name).toBeVisible();
  const { scrollWidth, clientWidth, width } = await name.evaluate(el => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    width: el.getBoundingClientRect().width,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  expect(width).toBeGreaterThan(120);
}

test.describe('at 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the selected card keeps the name readable and both buttons reachable', async ({ page }) => {
    const card = await selectLongDistrict(page);
    const name = card.getByText(LONG_NAME, { exact: true });
    const edit = card.getByRole('button', { name: 'Edit instance' });
    const remove = card.getByRole('button', { name: 'Remove from selection' });

    await expectNameFullyVisible(name);
    for (const button of [edit, remove]) {
      await expect(button).toBeVisible();
      await expect(button).toBeInViewport({ ratio: 1 });
      expect(overlaps(await boxOf(button), await boxOf(name))).toBe(false);
    }
    // The buttons wrapped to their own line under the name.
    const nameBox = await boxOf(name);
    expect((await boxOf(edit)).y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height - 1);
    await expectNoSidewaysScroll(page);

    // Still working: × removes the district from the selection.
    await remove.click();
    await expect(page.getByRole('list', { name: 'Selected Districts' })).toHaveCount(0);
  });
});

test.describe('at desktop width', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the selected card stays one row: name, ×, Edit instance', async ({ page }) => {
    const card = await selectLongDistrict(page);
    const name = card.getByText(LONG_NAME, { exact: true });
    const edit = card.getByRole('button', { name: 'Edit instance' });
    const remove = card.getByRole('button', { name: 'Remove from selection' });

    await expectNameFullyVisible(name);
    const nameBox = await boxOf(name);
    const removeBox = await boxOf(remove);
    const editBox = await boxOf(edit);
    const middle = (b: Box) => b.y + b.height / 2;
    const cardBox = await boxOf(card);
    // One row: both buttons are vertically centred in the card, to the right of the name, × first.
    for (const box of [removeBox, editBox]) {
      expect(Math.abs(middle(box) - middle(cardBox))).toBeLessThanOrEqual(4);
      expect(box.x).toBeGreaterThanOrEqual(nameBox.x + nameBox.width);
    }
    expect(removeBox.x).toBeLessThan(editBox.x);
    await expect(card.getByText('ID: 41')).toBeVisible();
    await expectNoSidewaysScroll(page);
  });
});
