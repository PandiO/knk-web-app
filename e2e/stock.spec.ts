import { test, expect } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { noStepProgress, noValidationRules, savedProgress, workflowSession } from './fixtures/forms';
import { accessMetadata } from './fixtures/dashboardAccess';
import {
  ADJUST_TX,
  CONTENT,
  ECONOMY,
  MOVE_TX,
  OAK_LOG,
  PHOENIX,
  S1,
  S2,
  STONE,
  SWORD,
  WORLD,
  cleanReport,
  dirtyReport,
  mockStockLookups,
  moveTransaction,
  nameDisplay,
  oakMovesS1,
  oakRollups,
  paged,
  stockTransactionMetadata,
  storageForm,
  storageFormMetadata,
  storageMetadata,
  storageRows,
  storageS1,
  storageS2,
  swordMoves,
  transactionRows,
} from './fixtures/stock';
import type { DisplayConfigurationDto } from '../src/types/dtos/displayConfig/DisplayModels';
import type { FieldValidationRuleDto } from '../src/types/dtos/forms/FieldValidationRuleDtos';
import type { FormConfigurationDto, FormSubmissionProgressDto } from '../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { PagedResultDto } from '../src/types/dtos/common/PagedQuery';
import type { ItemBlueprintListDto } from '../src/types/dtos/itemBlueprint/ItemBlueprintDtos';
import type {
  StockAdjustRequestDto,
  StockMoveDto,
  StockMoveRequestDto,
  StockMoveRollupDto,
  StockPagedQueryDto,
  StockPagedResultDto,
  StockReconciliationReportDto,
  StockResultDto,
  StockReverseRequestDto,
  StockRollupResultDto,
  StockTransactionDto,
  StockTransactionListDto,
  StorageDto,
  StorageListDto,
} from '../src/types/dtos/stock/StockDtos';
import type { WorkflowSessionReadDto, StepProgressReadDto } from '../src/types/dtos/workflow/WorkflowDtos';

/**
 * Stock core P1 in the web app (PandiO/knk-workspace#675; production DESIGN § 4.1-4.5, § 11.1; acceptance A01-A03,
 * A22, A23): the Storage and StockTransaction dashboards, the seeded storage form, the storage page (capacity, lock,
 * lines with the drill-down to their moves, unique items, the adjust and move dialogs with per-line reject reasons),
 * the transaction page with Reverse, the ledger explorer with filters, roll-ups and the reconciler. Results are 200s
 * with a `status`; refusals are shown per line, never as errors. Smoke test: knk-workspace
 * docs/guides/production-storage-transport-smoke-test.md § 2.2.
 */

const nodes = (...held: string[]) => (node: string) => held.includes(node);

test.beforeEach(async ({ page }) => {
  await startLoggedIn(page, 'access-1');
});

test.describe('dashboard', () => {
  test.beforeEach(async ({ api }) => {
    mockContentDefaults(api);
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [storageMetadata, stockTransactionMetadata, accessMetadata('ItemBlueprint', CONTENT), accessMetadata('Category', CONTENT)]);
    api.json<FormConfigurationDto[]>('GET', /^FormConfigurations\/(Storage|StockTransaction|ItemBlueprint|Category)$/i, []);
    api.json<PagedResultDto<StorageListDto>>('POST', 'Storages/search', { items: storageRows, totalCount: storageRows.length, page: 1, pageSize: 10, totalPages: 1 });
    api.json<PagedResultDto<StockTransactionListDto>>('POST', 'StockTransactions/search', { items: transactionRows, totalCount: 2, page: 1, pageSize: 10, totalPages: 1 });
  });

  test('lists the storages with their kind, holder, fill against the cap and lock', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, CONTENT));
    await page.goto('/dashboard/Storage');

    const table = page.getByRole('table');
    for (const header of ['Kind', 'Purpose', 'Holder', 'Total units', 'Distinct items', 'Locked']) {
      await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
    }
    const s1 = table.getByRole('row', { name: /^Select S1 / });
    await expect(s1).toContainText('Phoenix');
    await expect(s1).toContainText('35 / 100');
    await expect(table.getByRole('row').filter({ hasText: 'S2' }).first()).toContainText('Until');
    await expect(table.getByRole('row').filter({ hasText: 'SYS_ADJUSTMENT' }).first()).toContainText('Virtual');
  });

  test('lists the ledger transactions with reason, actor, moves and amount', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, CONTENT));
    await page.goto('/dashboard/StockTransaction');

    const table = page.getByRole('table');
    const adjust = table.getByRole('row').filter({ hasText: 'smoke 2.1.3' });
    await expect(adjust).toContainText('AdminAdjust');
    await expect(adjust).toContainText('User #2');
    await expect(adjust).toContainText('64');
  });

  test('the blueprint list shows each blueprint\'s storage weight (DESIGN § 4.4)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, CONTENT));
    const rows: ItemBlueprintListDto[] = [
      { id: OAK_LOG, name: 'Oak log', description: '', defaultDisplayName: 'Oak log', storageWeight: 1 },
      { id: STONE, name: 'Stone', description: '', defaultDisplayName: 'Stone', storageWeight: 2 },
    ];
    api.json<PagedResultDto<ItemBlueprintListDto>>('POST', 'ItemBlueprints/search', { items: rows, totalCount: 2, page: 1, pageSize: 10, totalPages: 1 });
    await page.goto('/dashboard/ItemBlueprint');

    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'Storage weight' })).toBeVisible();
    // Columns: select, ID, icon, Name, Storage weight, Category.
    await expect(table.getByRole('row').filter({ hasText: 'Stone' }).getByRole('cell').nth(4)).toHaveText('2');
    await expect(table.getByRole('row').filter({ hasText: 'Oak log' }).getByRole('cell').nth(4)).toHaveText('1');
  });
});

test.describe('the storage form', () => {
  test('saves a storage from the seeded form through POST api/Storages (A23)', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    mockContentDefaults(api);
    api.json<StepProgressReadDto[]>('GET', 'Workflows/501/progress', noStepProgress);
    for (const method of ['POST', 'PUT'] as const) {
      api.on<FormSubmissionProgressDto>(method, /^FormSubmissionProgress(\/.*)?$/, ({ body }) => ({ body: savedProgress(body as FormSubmissionProgressDto) }));
    }
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [accessMetadata('Domain', WORLD), storageFormMetadata]);
    api.json<FormConfigurationDto[]>('GET', 'FormConfigurations/Storage', [storageForm]);
    api.json<FormConfigurationDto>('GET', `FormConfigurations/${storageForm.id}`, storageForm);
    api.json<EntityMetadataDto>('GET', 'Metadata/entities/Storage', storageFormMetadata);
    api.json<FieldValidationRuleDto[]>('GET', `field-validation-rules/by-configuration/${storageForm.id}`, noValidationRules);
    api.json<WorkflowSessionReadDto>('POST', /^Workflows\/?$/, workflowSession(alex.id, storageForm));
    api.on('GET', 'DisplayConfigurations/entity/Domain', { status: 404, body: { error: 'NotFound' } });
    api.on('POST', 'Domains/search', { body: { items: [{ id: PHOENIX, name: 'Phoenix' }], totalCount: 1, pageNumber: 1, pageSize: 10 } });
    api.on('POST', 'Lookup/Domain/search', { body: { items: [{ id: PHOENIX, label: 'Phoenix' }], total: 1 } });
    api.on<StorageDto>('POST', /^Storages\/?$/, ({ body }) => ({ status: 201, body: { ...(body as StorageDto), id: S1 } }));

    await page.goto('/forms/Storage');
    await page.getByRole('button', { name: 'Use' }).click();
    await page.getByRole('textbox', { name: 'Name*' }).fill('S1');
    await page.getByRole('combobox', { name: /^Kind/ }).selectOption('Domain');
    await page.getByRole('combobox', { name: /^Purpose/ }).selectOption('General');
    await page.getByPlaceholder(/Search Domain/).click();
    await page.getByRole('option', { name: /Phoenix/ }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('spinbutton', { name: /Max units/ }).fill('100');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect.poll(() => api.calls('POST', /^Storages\/?$/).length).toBe(1);
    expect(api.calls('POST', /^Storages\/?$/)[0].body).toMatchObject({ Name: 'S1', Kind: 'Domain', Purpose: 'General', MaxUnits: 100 });
  });
});

test.describe('the storage page', () => {
  test.use({ strictApi: true });

  let s1: StorageDto;

  test.beforeEach(async ({ api }) => {
    s1 = storageS1();
    mockContentDefaults(api);
    mockStockLookups(api);
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [storageMetadata, stockTransactionMetadata]);
    api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Storage', nameDisplay('Storage', '811'));
    api.on<StorageDto>('GET', `Storages/${S1}`, () => ({ body: s1 }));
  });

  test('shows capacity in raw units × storage weight, the lock, the lines and the unique items (A02, A03)', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    await page.goto(`/display/Storage/${S1}`);

    const panel = page.getByRole('region', { name: 'Stock' });
    await expect(panel.getByTestId('storage-holder')).toHaveText('Phoenix (Domain, General)');
    await expect(panel.getByTestId('storage-capacity')).toHaveText('45 of 100 raw units (45 %)');
    await expect(panel.getByTestId('storage-total')).toHaveText('35');
    await expect(panel.getByTestId('storage-lock')).toHaveText('Not locked');
    const lines = panel.getByRole('table', { name: 'Stock lines' });
    const stone = lines.getByRole('row').filter({ hasText: 'Stone' });
    await expect(stone).toContainText('5');
    await expect(stone.getByRole('cell').nth(3)).toHaveText('10');
    await expect(lines.getByRole('link', { name: '34 Oak log: show the moves' }))
      .toHaveAttribute('href', `/admin/stock/ledger?view=moves&storageId=${S1}&itemBlueprintId=${OAK_LOG}`);
    const units = panel.getByRole('table', { name: 'Unique items' });
    await expect(units.getByRole('row').filter({ hasText: 'Dawnbreaker' })).toContainText('Iron sword');
    await expect(units.getByRole('link', { name: `Item #${SWORD}: show its moves` }))
      .toHaveAttribute('href', `/admin/stock/ledger?view=moves&itemInstanceId=${SWORD}`);
  });

  test('a locked storage over its cap says so', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Storage', nameDisplay('Storage', '811'));
    api.json<StorageDto>('GET', `Storages/${S2}`, storageS2());
    await page.goto(`/display/Storage/${S2}`);

    const panel = page.getByRole('region', { name: 'Stock' });
    await expect(panel.getByTestId('storage-capacity')).toHaveText('60 of 50 raw units (120 %) (over its cap: removals only)');
    await expect(panel.getByTestId('storage-lock')).toContainText('Locked until');
    await expect(panel.getByTestId('storage-lock')).toContainText(': smoke');
  });

  test('adjusts a line with a required note and re-reads the storage (A01)', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    api.on<StockResultDto>('POST', 'StockTransactions/adjust', ({ body }) => {
      const sent = body as StockAdjustRequestDto;
      s1 = { ...s1, totalUnits: 45, lines: s1.lines!.map(l => l.itemBlueprintId === sent.itemBlueprintId ? { ...l, amount: l.amount + sent.delta } : l) };
      return { body: { status: 'Applied', transactionId: 42, replayed: false, accepted: sent.delta, lines: [
        { lineNo: 1, fromStorageId: 4, toStorageId: S1, itemBlueprintId: sent.itemBlueprintId, requested: sent.delta, accepted: sent.delta, rejected: 0, rejectReason: 'None' },
      ] } };
    });
    await page.goto(`/display/Storage/${S1}`);
    const panel = page.getByRole('region', { name: 'Stock' });

    await panel.getByRole('button', { name: 'Adjust Oak log' }).click();
    const dialog = page.getByRole('dialog', { name: 'Adjust stock of S1' });
    await expect(dialog.getByText('Oak log (#3)')).toBeVisible();
    await dialog.getByLabel('Change (raw units) *').fill('10');
    await expect(dialog.getByRole('button', { name: 'Adjust' })).toBeDisabled();
    await dialog.getByLabel('Note *').fill('smoke 2.2.4');
    await dialog.getByRole('button', { name: 'Adjust' }).click();

    await expect(dialog.getByTestId('stock-result-status')).toHaveText('Applied (transaction #42): 10 moved.');
    const [call] = api.calls('POST', 'StockTransactions/adjust');
    expect(call.body).toMatchObject({ storageId: S1, itemBlueprintId: OAK_LOG, itemInstanceId: null, delta: 10, note: 'smoke 2.2.4' });
    expect((call.body as StockAdjustRequestDto).idempotencyKey).toMatch(/^adjust-/);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(panel.getByRole('link', { name: '44 Oak log: show the moves' })).toBeVisible();
  });

  test('sends the same idempotency key again when the first answer was lost (A01)', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    let calls = 0;
    api.on<StockResultDto | { error: string }>('POST', 'StockTransactions/adjust', () => {
      calls += 1;
      if (calls === 1) return { status: 503, body: { error: 'Unavailable' } };
      return { body: { status: 'Applied', transactionId: 42, replayed: true, accepted: 5, lines: [] } };
    });
    await page.goto(`/display/Storage/${S1}`);

    await page.getByRole('region', { name: 'Stock' }).getByRole('button', { name: 'Adjust stock' }).click();
    const dialog = page.getByRole('dialog', { name: 'Adjust stock of S1' });
    await dialog.getByRole('searchbox', { name: /Blueprint/ }).fill('oak');
    await dialog.getByRole('button', { name: /^Oak log/ }).click();
    await dialog.getByLabel('Change (raw units) *').fill('+5');
    await dialog.getByLabel('Note *').fill('retry');
    await dialog.getByRole('button', { name: 'Adjust' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('The adjustment could not be sent.');
    await dialog.getByRole('button', { name: 'Adjust' }).click();

    await expect(dialog.getByTestId('stock-result-status')).toContainText('This key was used before');
    const [first, second] = api.calls('POST', 'StockTransactions/adjust').map(c => (c.body as StockAdjustRequestDto).idempotencyKey);
    expect(second).toBe(first);
  });

  test('takes a unique item out by its item instance id (A03)', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    api.on<StockResultDto>('POST', 'StockTransactions/adjust', () => ({ body: { status: 'Applied', transactionId: 43, replayed: false, accepted: 1, lines: [] } }));
    await page.goto(`/display/Storage/${S1}`);

    await page.getByRole('region', { name: 'Stock' }).getByRole('button', { name: `Take out item #${SWORD}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Adjust stock of S1' });
    await expect(dialog.getByLabel('Item instance id *')).toHaveValue(String(SWORD));
    await expect(dialog.getByLabel('Change (raw units) *')).toHaveValue('-1');
    await dialog.getByLabel('Note *').fill('returned to the player');
    await dialog.getByRole('button', { name: 'Adjust' }).click();

    await expect(dialog.getByTestId('stock-result-status')).toHaveText('Applied (transaction #43): 1 moved.');
    expect(api.calls('POST', 'StockTransactions/adjust')[0].body).toMatchObject({ itemBlueprintId: null, itemInstanceId: SWORD, delta: -1 });
  });

  test('a partial move over capacity accepts what fits and gives the reason per line (A02)', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    api.on<StockResultDto>('POST', /^StockTransactions\/?$/, ({ body }) => {
      const sent = body as StockMoveRequestDto;
      return { body: sent.mode === 'Partial'
        ? { status: 'PartiallyApplied', transactionId: 44, replayed: false, accepted: 18, lines: [
          { lineNo: 1, fromStorageId: S1, toStorageId: S2, itemBlueprintId: OAK_LOG, requested: 40, accepted: 18, rejected: 22, rejectReason: 'CapacityFull' },
        ] }
        : { status: 'Rejected', transactionId: null, replayed: false, accepted: 0, lines: [
          { lineNo: 1, fromStorageId: S1, toStorageId: S2, itemBlueprintId: OAK_LOG, requested: 40, accepted: 0, rejected: 40, rejectReason: 'CapacityFull' },
        ] } };
    });
    await page.goto(`/display/Storage/${S1}`);

    await page.getByRole('region', { name: 'Stock' }).getByRole('button', { name: 'Move Oak log' }).click();
    const dialog = page.getByRole('dialog', { name: 'Move stock' });
    const line = dialog.getByRole('listitem', { name: 'Line 1' });
    await expect(line.getByText('S1 (#12)')).toBeVisible();
    await line.getByRole('searchbox', { name: 'To storage' }).fill('S2');
    await line.getByRole('button', { name: /^S2/ }).click();
    await line.getByLabel('Amount (raw units)').fill('40');
    await dialog.getByRole('button', { name: 'Move', exact: true }).click();

    await expect(dialog.getByTestId('stock-result-status')).toHaveText('Rejected: nothing moved and no transaction was written.');
    await expect(dialog.getByTestId('stock-reject-reason')).toContainText('Capacity full');

    await dialog.getByLabel('Mode').selectOption('Partial');
    await dialog.getByRole('button', { name: 'Move', exact: true }).click();
    await expect(dialog.getByTestId('stock-result-status')).toHaveText('Partially applied (transaction #44): 18 moved, the rest refused.');
    await expect(dialog.getByRole('list', { name: 'Result per line' })).toContainText('S1 → S2: requested 40, accepted 18, refused 22');
    await expect(dialog.getByTestId('stock-reject-reason')).toContainText('Capacity full');

    const [first, second] = api.calls('POST', /^StockTransactions\/?$/).map(c => c.body as StockMoveRequestDto);
    expect(first).toMatchObject({ reason: 'Distribution', mode: 'AllOrNothing', lines: [{ fromStorageId: S1, toStorageId: S2, itemBlueprintId: OAK_LOG, itemInstanceId: null, amount: 40 }] });
    expect(second.mode).toBe('Partial');
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  test('a move into a locked storage is refused with the reason Locked', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    api.json<StockResultDto>('POST', /^StockTransactions\/?$/, { status: 'Rejected', transactionId: null, replayed: false, accepted: 0, lines: [
      { lineNo: 1, fromStorageId: S1, toStorageId: S2, itemBlueprintId: OAK_LOG, requested: 1, accepted: 0, rejected: 1, rejectReason: 'Locked' },
      { lineNo: 2, fromStorageId: S1, toStorageId: S2, itemBlueprintId: STONE, requested: 1, accepted: 0, rejected: 1, rejectReason: 'OtherLineRejected' },
    ] });
    await page.goto(`/display/Storage/${S1}`);

    await page.getByRole('region', { name: 'Stock' }).getByRole('button', { name: 'Move stock' }).click();
    const dialog = page.getByRole('dialog', { name: 'Move stock' });
    await dialog.getByLabel('Reason').selectOption('Trade');
    for (const [index, item] of [[1, 'Oak log'], [2, 'Stone']] as const) {
      if (index === 2) await dialog.getByRole('button', { name: 'Add line' }).click();
      const line = dialog.getByRole('listitem', { name: `Line ${index}` });
      await line.getByRole('searchbox', { name: 'To storage' }).fill('S2');
      await line.getByRole('button', { name: /^S2/ }).click();
      await line.getByRole('searchbox', { name: 'Blueprint' }).fill(item);
      await line.getByRole('button', { name: new RegExp(`^${item}`) }).click();
      await line.getByLabel('Amount (raw units)').fill('1');
    }
    await dialog.getByRole('button', { name: 'Move', exact: true }).click();

    const reasons = dialog.getByTestId('stock-reject-reason');
    await expect(reasons.nth(0)).toHaveText('Locked: a storage is locked');
    await expect(reasons.nth(1)).toContainText('Other line rejected');
    expect((api.calls('POST', /^StockTransactions\/?$/)[0].body as StockMoveRequestDto).lines).toHaveLength(2);
    expect((api.calls('POST', /^StockTransactions\/?$/)[0].body as StockMoveRequestDto).reason).toBe('Trade');
  });

  test('a reused idempotency key is explained, not shown as a bare 409', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    api.on('POST', 'StockTransactions/adjust', { status: 409, body: { code: 'IdempotencyKeyReuse', error: 'The key was used for another request.' } });
    await page.goto(`/display/Storage/${S1}`);

    await page.getByRole('region', { name: 'Stock' }).getByRole('button', { name: 'Adjust Stone' }).click();
    const dialog = page.getByRole('dialog', { name: 'Adjust stock of S1' });
    await dialog.getByLabel('Change (raw units) *').fill('-2');
    await dialog.getByLabel('Note *').fill('x');
    await dialog.getByRole('button', { name: 'Adjust' }).click();

    await expect(dialog.getByRole('alert')).toContainText('already used for a different request');
  });

  test('staff without knk.economy.admin see the stock but cannot adjust or move it', async ({ page, api }) => {
    mockSession(api, alex, node => node !== ECONOMY);
    await page.goto(`/display/Storage/${S1}`);
    const panel = page.getByRole('region', { name: 'Stock' });

    await expect(panel.getByTestId('storage-capacity')).toBeVisible();
    for (const name of ['Adjust stock', 'Move stock', 'Adjust Oak log', 'Move Oak log', `Take out item #${SWORD}`]) {
      await expect(panel.getByRole('button', { name })).toBeDisabled();
    }
    await expect(panel.getByRole('button', { name: 'Adjust stock' })).toHaveAttribute('title', `Requires ${ECONOMY}`);
  });
});

test.describe('the transaction page', () => {
  test.use({ strictApi: true });

  let tx: StockTransactionDto;

  test.beforeEach(async ({ api }) => {
    tx = moveTransaction();
    mockContentDefaults(api);
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [storageMetadata, stockTransactionMetadata]);
    api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/StockTransaction', nameDisplay('StockTransaction', '821', 'reason'));
    api.on<StockTransactionDto>('GET', `StockTransactions/${MOVE_TX}`, () => ({ body: tx }));
  });

  test('shows the moves with both storages and reverses it with a correction', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    api.on<StockResultDto>('POST', `StockTransactions/${MOVE_TX}/reverse`, () => {
      tx = { ...tx, reversedByTransactionId: 45 };
      return { body: { status: 'Applied', transactionId: 45, replayed: false, accepted: 30, lines: [] } };
    });
    await page.goto(`/display/StockTransaction/${MOVE_TX}`);

    const panel = page.getByRole('region', { name: 'Ledger entry' });
    await expect(panel.getByTestId('stock-transaction-reason')).toHaveText('Distribution');
    const move = panel.getByRole('table', { name: 'Moves' }).getByRole('row').filter({ hasText: 'Oak log' });
    await expect(move.getByRole('link', { name: 'S1' })).toHaveAttribute('href', new RegExp(`^/display/Storage/${S1}`));
    await expect(move.getByRole('link', { name: 'S2' })).toHaveAttribute('href', new RegExp(`^/display/Storage/${S2}`));
    await expect(move).toContainText('30');
    await expect(panel.getByTestId('stock-transaction-reversed-by')).toHaveText('Not reversed');

    await panel.getByRole('button', { name: 'Reverse' }).click();
    await panel.getByLabel('Note').fill('smoke undo');
    await panel.getByRole('button', { name: 'Write the correction' }).click();

    await expect(panel.getByTestId('stock-transaction-reversed-by')).toHaveText('Transaction #45');
    await expect(panel.getByRole('button', { name: 'Reverse' })).toHaveCount(0);
    expect(api.calls('POST', `StockTransactions/${MOVE_TX}/reverse`)[0].body).toMatchObject({ note: 'smoke undo' });
  });

  test('a correction that finds the stock gone is rejected and changes nothing', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    api.json<StockResultDto>('POST', `StockTransactions/${MOVE_TX}/reverse`, { status: 'Rejected', transactionId: null, replayed: false, accepted: 0, lines: [
      { lineNo: 1, fromStorageId: S2, toStorageId: S1, itemBlueprintId: OAK_LOG, requested: 30, accepted: 0, rejected: 30, rejectReason: 'NotEnoughStock' },
    ] });
    await page.goto(`/display/StockTransaction/${MOVE_TX}`);
    const panel = page.getByRole('region', { name: 'Ledger entry' });

    await panel.getByRole('button', { name: 'Reverse' }).click();
    await panel.getByRole('button', { name: 'Write the correction' }).click();

    await expect(panel.getByTestId('stock-reject-reason')).toHaveText('Not enough stock: not enough stock in the source');
    await expect(panel.getByTestId('stock-transaction-reversed-by')).toHaveText('Not reversed');
  });

  test('staff without knk.economy.admin cannot reverse', async ({ page, api }) => {
    mockSession(api, alex, node => node !== ECONOMY);
    await page.goto(`/display/StockTransaction/${MOVE_TX}`);

    const reverse = page.getByRole('region', { name: 'Ledger entry' }).getByRole('button', { name: 'Reverse' });
    await expect(reverse).toBeDisabled();
    await expect(reverse).toHaveAttribute('title', `Requires ${ECONOMY}`);
  });
});

test.describe('the ledger explorer', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    mockContentDefaults(api);
    api.on<StockPagedResultDto<StockTransactionListDto>>('POST', 'StockTransactions/search', ({ body }) => {
      const reason = (body as StockPagedQueryDto).filters?.reason;
      return { body: paged(transactionRows.filter(t => !reason || t.reason === reason)) };
    });
    api.on<StockPagedResultDto<StockMoveDto>>('POST', 'StockTransactions/moves/search', ({ body }) => {
      const f = (body as StockPagedQueryDto).filters ?? {};
      return { body: paged(f.itemInstanceId ? swordMoves : oakMovesS1) };
    });
    api.on<StockPagedResultDto<StockMoveRollupDto>>('POST', 'StockTransactions/rollups/search', () => ({ body: paged<StockMoveRollupDto>([]) }));
    api.json<StorageDto>('GET', `Storages/${S1}`, storageS1());
  });

  test('drills down from a line to the moves that made it, with the net next to the line (A01)', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    await page.goto(`/admin/stock/ledger?view=moves&storageId=${S1}&itemBlueprintId=${OAK_LOG}`);

    const sum = page.getByRole('region', { name: 'Line and its moves' });
    await expect(sum.getByTestId('ledger-line-amount')).toHaveText('34');
    await expect(sum.getByTestId('ledger-line-net')).toHaveText('Moves in 64 − moves out 30 = 34 (matches the line)');
    const table = page.getByRole('table', { name: 'Stock moves' });
    await expect(table.getByRole('row').filter({ hasText: 'Admin adjust' })).toContainText('+64');
    await expect(table.getByRole('row').filter({ hasText: 'Distribution' })).toContainText('-30');
    await expect(table.getByRole('link', { name: `#${ADJUST_TX}` })).toHaveAttribute('href', new RegExp(`^/display/StockTransaction/${ADJUST_TX}`));
    const [moves] = api.calls('POST', 'StockTransactions/moves/search');
    expect((moves.body as StockPagedQueryDto).filters).toEqual({ storageId: String(S1), itemBlueprintId: String(OAK_LOG) });
  });

  test('filters the transactions by reason and keeps the filter in the address', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    await page.goto('/admin/stock/ledger');

    const table = page.getByRole('table', { name: 'Stock transactions' });
    await expect(table.getByRole('row')).toHaveCount(3);
    await page.getByLabel('Reason').selectOption('AdminAdjust');
    await page.getByRole('button', { name: 'Apply filters' }).click();

    await expect(page).toHaveURL(/\/admin\/stock\/ledger\?reason=AdminAdjust$/);
    await expect(table.getByRole('row')).toHaveCount(2);
    await expect(table.getByRole('row').filter({ hasText: 'smoke 2.1.3' })).toContainText('User #2 (web)');
    const searches = api.calls('POST', 'StockTransactions/search');
    const last = searches[searches.length - 1];
    expect((last.body as StockPagedQueryDto).filters).toEqual({ reason: 'AdminAdjust' });
  });

  test('shows a unique item\'s moves by its item instance id (A03)', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    await page.goto(`/admin/stock/ledger?view=moves&itemInstanceId=${SWORD}`);

    const row = page.getByRole('table', { name: 'Stock moves' }).getByRole('row').filter({ hasText: 'Deposit' });
    await expect(row).toContainText(`Item #${SWORD} (Iron sword)`);
    await expect(row.getByRole('link', { name: 'SYS_WORLD' })).toBeVisible();
  });

  test('lists the roll-ups of old production moves with the same filters (A22)', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    api.on<StockPagedResultDto<StockMoveRollupDto>>('POST', 'StockTransactions/rollups/search', () => ({ body: paged(oakRollups) }));
    await page.goto(`/admin/stock/ledger?view=rollups&storageId=${S1}&itemBlueprintId=${OAK_LOG}`);

    const row = page.getByRole('table', { name: 'Roll-ups' }).getByRole('row').filter({ hasText: 'Production' });
    await expect(row).toContainText('Oct 18, 2026');
    await expect(row).toContainText('15');
    await expect(row.getByRole('cell').nth(6)).toHaveText('3');
    const sum = page.getByRole('region', { name: 'Line and its moves' });
    await expect(sum.getByTestId('ledger-line-net')).toHaveText('Moves in 64 − moves out 30 + roll-ups 15 = 49 (does not match the line: run the reconciler)');
  });

  test('runs the reconciler and the roll-up (#65 health)', async ({ page, api }) => {
    mockSession(api, alex, () => true);
    let report = cleanReport;
    api.on<StockReconciliationReportDto>('GET', 'StockTransactions/reconcile', () => ({ body: report }));
    api.json<StockRollupResultDto>('POST', 'StockTransactions/rollup', { cutoff: '2026-10-20T00:00:00Z', transactionsRolledUp: 3, movesRolledUp: 3, rollupRowsWritten: 1 });
    await page.goto('/admin/stock/ledger');
    const card = page.getByRole('region', { name: 'Ledger health' });

    await card.getByRole('button', { name: 'Run the reconciler' }).click();
    await expect(card.getByTestId('stock-reconcile-status')).toHaveText('Clean: 9 lines and 1 unique items match the ledger.');
    report = dirtyReport;
    await card.getByRole('button', { name: 'Run the reconciler' }).click();
    await expect(card.getByTestId('stock-reconcile-status')).toHaveText('Differences found: the ledger and the stock disagree.');
    await expect(card.getByRole('list', { name: 'Differences' })).toContainText(`storage #${S1}, blueprint #${OAK_LOG}: line 40, ledger 34`);

    await card.getByRole('button', { name: 'Roll up old production moves now' }).click();
    await expect(card.getByTestId('stock-rollup-result')).toContainText('3 transactions and 3 moves');
    await expect(card.getByTestId('stock-rollup-result')).toContainText('became 1 roll-up rows');
  });

  test('World staff without the economy node read the ledger but cannot roll up', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    await page.goto('/admin/stock/ledger');

    await expect(page.getByRole('table', { name: 'Stock transactions' })).toBeVisible();
    const rollup = page.getByRole('region', { name: 'Ledger health' }).getByRole('button', { name: 'Roll up old production moves now' });
    await expect(rollup).toBeDisabled();
    await expect(rollup).toHaveAttribute('title', `Requires ${ECONOMY}`);
  });

  test('economy staff without an area node open it from the admin sidebar', async ({ page, api }) => {
    mockSession(api, alex, nodes(ECONOMY));
    await page.goto('/admin');

    await page.getByRole('link', { name: /Stock ledger/ }).first().click();
    await expect(page).toHaveURL(/\/admin\/stock\/ledger$/);
    await expect(page.getByRole('heading', { name: 'Stock ledger' })).toBeVisible();
  });
});
