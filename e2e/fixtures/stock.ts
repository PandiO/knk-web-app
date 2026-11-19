import type { LookupItemDto, LookupSearchResponseDto } from '../../src/apiClients/lookupClient';
import type { DisplayConfigurationDto } from '../../src/types/dtos/displayConfig/DisplayModels';
import type { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type {
  StockMoveDto,
  StockMoveRollupDto,
  StockPagedResultDto,
  StockReconciliationReportDto,
  StockTransactionDto,
  StockTransactionListDto,
  StorageDto,
  StorageListDto,
} from '../../src/types/dtos/stock/StockDtos';
import { FieldType } from '../../src/utils/enums';
import type { MockApi } from '../support/mockApi';
import { accessMetadata } from './dashboardAccess';

/**
 * Stock core P1 in the web app (PandiO/knk-workspace#675) for e2e/stock.spec.ts, typed with the app's DTOs (which
 * mirror knk-web-api `Dtos/StockDtos.cs`): the smoke guide § 2 data. Storages S1 (cap 100) and S2 (cap 50) of the town
 * Phoenix, the system storages, Oak log (weight 1) and Stone (weight 2), the enchanted sword as a unique item, and the
 * ledger after steps 3-4 (adjust +64 into S1, move 30 S1 → S2).
 */

export const WORLD = 'knk.admin.world';
export const CONTENT = 'knk.admin.content';
export const ECONOMY = 'knk.economy.admin';

export const PHOENIX = 4;
export const SYS_PRODUCTION = 1;
export const SYS_ADJUSTMENT = 4;
export const SYS_WORLD = 5;
export const S1 = 12;
export const S2 = 13;
export const OAK_LOG = 3;
export const STONE = 6;
export const SWORD = 9001;
export const ADJUST_TX = 40;
export const MOVE_TX = 41;

export const storageRows: StorageListDto[] = [
  { id: S1, name: 'S1', kind: 'Domain', purpose: 'General', holderName: 'Phoenix', domainId: PHOENIX, totalUnits: 35, distinctItems: 2, maxUnits: 100, maxDistinct: null, lockedUntil: null },
  { id: S2, name: 'S2', kind: 'Domain', purpose: 'Output', holderName: 'Phoenix', domainId: PHOENIX, totalUnits: 30, distinctItems: 1, maxUnits: 50, maxDistinct: 4, lockedUntil: '2099-01-01T00:00:00Z' },
  { id: SYS_ADJUSTMENT, name: 'SYS_ADJUSTMENT', kind: 'Virtual', purpose: 'General', holderName: 'SYS_ADJUSTMENT', systemKey: 'SYS_ADJUSTMENT', totalUnits: 0, distinctItems: 0 },
];

/** S1 after smoke steps 3-4 and the sword's deposit: 34 oak logs, one Stone line, the sword. */
export function storageS1(): StorageDto {
  return {
    id: S1, name: 'S1', kind: 'Domain', purpose: 'General', domainId: PHOENIX, domain: { id: PHOENIX, name: 'Phoenix' }, holderName: 'Phoenix',
    maxUnits: 100, maxDistinct: null, unitsPerSlot: null, totalUnits: 35, distinctItems: 3, capacityUsed: 45, rowVersion: 7,
    lockedUntil: null, lockReason: null, isLocked: false, createdAt: '2026-11-19T08:00:00Z',
    lines: [
      { id: 101, storageId: S1, itemBlueprintId: OAK_LOG, itemBlueprintName: 'Oak log', amount: 34, storageWeight: 1, updatedAt: '2026-11-19T10:05:00Z' },
      { id: 102, storageId: S1, itemBlueprintId: STONE, itemBlueprintName: 'Stone', amount: 5, storageWeight: 2, updatedAt: '2026-11-19T10:06:00Z' },
    ],
    units: [
      { id: 201, storageId: S1, itemInstanceId: SWORD, itemBlueprintId: 7, itemBlueprintName: 'Iron sword', customDisplayName: 'Dawnbreaker', addedAt: '2026-11-19T10:07:00Z' },
    ],
  };
}

/** S2: full-ish and locked by staff (a lock stops moves in and out). */
export function storageS2(): StorageDto {
  return {
    id: S2, name: 'S2', kind: 'Domain', purpose: 'Output', domainId: PHOENIX, domain: { id: PHOENIX, name: 'Phoenix' }, holderName: 'Phoenix',
    maxUnits: 50, maxDistinct: 4, totalUnits: 30, distinctItems: 1, capacityUsed: 60, rowVersion: 3,
    lockedUntil: '2099-01-01T00:00:00Z', lockReason: 'smoke', isLocked: true, createdAt: '2026-11-19T08:00:00Z',
    lines: [{ id: 103, storageId: S2, itemBlueprintId: OAK_LOG, itemBlueprintName: 'Oak log', amount: 30, storageWeight: 1, updatedAt: '2026-11-19T10:05:00Z' }],
    units: [],
  };
}

export const transactionRows: StockTransactionListDto[] = [
  {
    id: MOVE_TX, reason: 'Distribution', mode: 'AllOrNothing', actorKind: 'User', actorUserId: 2, actorComponent: 'web', note: null,
    createdAt: '2026-11-19T10:05:00Z', moveCount: 1, totalAmount: 30,
  },
  {
    id: ADJUST_TX, reason: 'AdminAdjust', mode: 'AllOrNothing', actorKind: 'User', actorUserId: 2, actorComponent: 'web', note: 'smoke 2.1.3',
    createdAt: '2026-11-19T10:00:00Z', moveCount: 1, totalAmount: 64,
  },
];

export const oakMovesS1: StockMoveDto[] = [
  {
    id: 502, transactionId: MOVE_TX, lineNo: 1, fromStorageId: S1, fromStorageName: 'S1', toStorageId: S2, toStorageName: 'S2',
    itemBlueprintId: OAK_LOG, itemBlueprintName: 'Oak log', amount: 30, reason: 'Distribution', createdAt: '2026-11-19T10:05:00Z',
  },
  {
    id: 501, transactionId: ADJUST_TX, lineNo: 1, fromStorageId: SYS_ADJUSTMENT, fromStorageName: 'SYS_ADJUSTMENT', toStorageId: S1, toStorageName: 'S1',
    itemBlueprintId: OAK_LOG, itemBlueprintName: 'Oak log', amount: 64, reason: 'AdminAdjust', createdAt: '2026-11-19T10:00:00Z',
  },
];

export const swordMoves: StockMoveDto[] = [
  {
    id: 601, transactionId: 50, lineNo: 1, fromStorageId: SYS_WORLD, fromStorageName: 'SYS_WORLD', toStorageId: S1, toStorageName: 'S1',
    itemBlueprintId: 7, itemBlueprintName: 'Iron sword', itemInstanceId: SWORD, amount: 1, reason: 'Deposit', createdAt: '2026-11-19T10:07:00Z',
  },
];

/** The move transaction of smoke step 4 with its one move (not reversed yet). */
export function moveTransaction(): StockTransactionDto {
  return { ...transactionRows[0], actorUsername: 'Alex', idempotencyKey: null, reversedByTransactionId: null, moves: [oakMovesS1[0]] };
}

/** Three Production moves of 5 oak logs, rolled up into one row for the day (smoke step 13, A22). */
export const oakRollups: StockMoveRollupDto[] = [
  {
    id: 701, day: '2026-10-18T00:00:00Z', reason: 'Production', fromStorageId: SYS_PRODUCTION, fromStorageName: 'SYS_PRODUCTION', toStorageId: S1,
    toStorageName: 'S1', itemBlueprintId: OAK_LOG, itemBlueprintName: 'Oak log', amount: 15, moveCount: 3, rolledUpAt: '2026-11-19T03:00:00Z',
  },
];

export const cleanReport: StockReconciliationReportDto = {
  checkedAt: '2026-11-19T11:00:00Z', clean: true, linesChecked: 9, unitsChecked: 1,
  blueprintImbalanceCount: 0, lineDifferenceCount: 0, unitDifferenceCount: 0, totalDifferenceCount: 0,
  blueprintImbalances: [], lineDifferences: [], unitDifferences: [], totalDifferences: [],
};

export const dirtyReport: StockReconciliationReportDto = {
  ...cleanReport, clean: false, lineDifferenceCount: 1,
  lineDifferences: [{ storageId: S1, itemBlueprintId: OAK_LOG, lineAmount: 40, ledgerNet: 34 }],
};

export const paged = <T,>(items: T[], pageNumber = 1, pageSize = 50): StockPagedResultDto<T> =>
  ({ items, totalCount: items.length, pageNumber, pageSize });

export const storageLookups: LookupItemDto[] = [
  { id: S1, label: 'S1', detail: 'Domain · Phoenix' },
  { id: S2, label: 'S2', detail: 'Domain · Phoenix' },
];

export const blueprintLookups: LookupItemDto[] = [
  { id: OAK_LOG, label: 'Oak log', detail: 'Uncurated' },
  { id: STONE, label: 'Stone', detail: 'Uncurated' },
];

/** `api/Lookup/{Storage,ItemBlueprint}/search`, filtered by the typed term. */
export function mockStockLookups(api: MockApi): void {
  for (const [type, items] of [['Storage', storageLookups], ['ItemBlueprint', blueprintLookups]] as const) {
    api.on<LookupSearchResponseDto>('POST', `Lookup/${type}/search`, ({ body }) => {
      const term = ((body as { searchTerm?: string | null }).searchTerm ?? '').toLowerCase();
      const matches = items.filter(i => !term || i.label.toLowerCase().includes(term));
      return { body: { items: matches, total: matches.length } };
    });
  }
}

/** The metadata of the World-area types Storage and StockTransaction (the ledger is view-only). */
export const storageMetadata: EntityMetadataDto = accessMetadata('Storage', WORLD);
export const stockTransactionMetadata: EntityMetadataDto = {
  ...accessMetadata('StockTransaction', WORLD, false),
  deletable: false,
  readNodes: [WORLD, ECONOMY],
  actionNodes: { view: [WORLD] },
};

/** A detail page configuration with one General section showing the name (the seeds' first fields). */
export function nameDisplay(entityTypeName: string, id: string, fieldName = 'name'): DisplayConfigurationDto {
  return {
    id,
    name: `${entityTypeName} (e2e)`,
    entityTypeName,
    isDefault: true,
    isDraft: false,
    sections: [{
      sectionGuid: 'general',
      sectionName: 'General',
      isCollection: false,
      isReusable: false,
      isLinkedToSource: false,
      fields: [{ fieldGuid: `${id}-name`, label: fieldName === 'name' ? 'Name' : 'Reason', fieldName, isReusable: false, isLinkedToSource: false }],
      subSections: [],
    }],
  };
}

function field(values: Pick<FormFieldDto, 'id' | 'fieldName' | 'label' | 'fieldType' | 'order'> & Partial<FormFieldDto>): FormFieldDto {
  return { isRequired: false, isReadOnly: false, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, validations: [], ...values };
}

function step(values: Pick<FormStepDto, 'id' | 'stepName' | 'order' | 'fields'> & Partial<FormStepDto>): FormStepDto {
  return {
    isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, isManyToManyRelationship: false,
    childFormSteps: [], conditions: [], ...values,
  };
}

/** The Storage seed's form (knk-web-api `Data/FormConfigurationSeeds/Storage.json`): the two steps, same fields. */
export const storageForm: FormConfigurationDto = {
  id: '731',
  entityTypeName: 'Storage',
  configurationName: 'Storage (e2e)',
  isDefault: true,
  steps: [
    step({
      id: '732',
      stepName: 'Storage',
      order: 0,
      fields: [
        field({ id: '733', fieldName: 'Name', label: 'Name', fieldType: FieldType.String, isRequired: true, order: 0 }),
        field({ id: '734', fieldName: 'Kind', label: 'Kind', fieldType: FieldType.Enum, isRequired: true, order: 1, settingsJson: '{"enumValues": ["Domain", "Player", "Clan", "Transit"]}' }),
        field({ id: '735', fieldName: 'Purpose', label: 'Purpose', fieldType: FieldType.Enum, isRequired: true, order: 2, settingsJson: '{"enumValues": ["General", "Output", "Input", "Delivery", "Merchandise", "Inbox", "Stash", "Vault"]}' }),
        field({ id: '736', fieldName: 'DomainId', label: 'Domain', fieldType: FieldType.Object, objectType: 'Domain', order: 3 }),
        field({ id: '737', fieldName: 'UserId', label: 'Player', fieldType: FieldType.Object, objectType: 'User', order: 4 }),
        field({ id: '738', fieldName: 'ClanId', label: 'Clan', fieldType: FieldType.Object, objectType: 'Clan', order: 5 }),
      ],
    }),
    step({
      id: '739',
      stepName: 'Capacity and lock',
      order: 1,
      fields: [
        field({ id: '740', fieldName: 'MaxUnits', label: 'Max units', fieldType: FieldType.Integer, order: 0 }),
        field({ id: '741', fieldName: 'MaxDistinct', label: 'Max distinct items', fieldType: FieldType.Integer, order: 1 }),
        field({ id: '742', fieldName: 'UnitsPerSlot', label: 'Units per container slot', fieldType: FieldType.Integer, order: 2 }),
        field({ id: '743', fieldName: 'LockedUntil', label: 'Locked until', fieldType: FieldType.DateTime, order: 3 }),
        field({ id: '744', fieldName: 'LockReason', label: 'Lock reason', fieldType: FieldType.String, order: 4 }),
      ],
    }),
  ],
};

export const storageFormMetadata: EntityMetadataDto = {
  ...storageMetadata,
  fields: [
    { fieldName: 'Name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'Kind', fieldType: 'StorageKind', isNullable: false, isRelatedEntity: false, hasDefaultValue: false, enumValues: ['Domain', 'Player', 'Clan', 'Transit', 'Virtual'] },
    { fieldName: 'Purpose', fieldType: 'StoragePurpose', isNullable: false, isRelatedEntity: false, hasDefaultValue: false, enumValues: ['General', 'Output', 'Input', 'Delivery', 'Merchandise', 'Inbox', 'Stash', 'Vault'] },
    { fieldName: 'DomainId', fieldType: 'Int32', isNullable: true, isRelatedEntity: true, relatedEntityType: 'Domain', hasDefaultValue: false },
    { fieldName: 'UserId', fieldType: 'Int32', isNullable: true, isRelatedEntity: true, relatedEntityType: 'User', hasDefaultValue: false },
    { fieldName: 'ClanId', fieldType: 'Int32', isNullable: true, isRelatedEntity: true, relatedEntityType: 'Clan', hasDefaultValue: false },
    { fieldName: 'MaxUnits', fieldType: 'Int64', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'MaxDistinct', fieldType: 'Int32', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'UnitsPerSlot', fieldType: 'Int32', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'LockedUntil', fieldType: 'DateTime', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'LockReason', fieldType: 'String', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
  ],
};
