import type { EmailOutboxPageDto } from '../../src/types/dtos/email/EmailOutboxDtos';
import type { InvitationPageDto } from '../../src/types/dtos/invitations/InvitationDtos';
import type {
  LootboxOddsDto,
  LootboxSpawnAreaDto,
  LootboxSpawnDto,
  LootboxSpecialEntryDto,
  LootboxTypeDto,
} from '../../src/types/dtos/lootbox/LootboxDtos';
import type { MinecraftCatalogAuditDto } from '../../src/types/dtos/minecraftCatalog/MinecraftCatalogDtos';
import type { MockApi } from '../support/mockApi';

/**
 * One row for each admin table whose head has a visually hidden "Actions" cell (PandiO/knk-workspace#535): Mail log,
 * Invitations, the Lootboxes tabs and the Minecraft catalogue audit. Enough to draw each table as staff see it.
 */

export function mockMailLog(api: MockApi): void {
  api.json<EmailOutboxPageDto>('GET', /^EmailOutbox\/?$/, {
    items: [{
      id: 1, kind: 'PasswordReset', toMasked: 's***e@example.com', subject: 'Reset your password', status: 'Failed',
      attempts: 3, nextAttemptAt: '2026-11-15T10:00:00Z', lastError: 'SMTP 421: service not available',
      createdAt: '2026-11-15T09:00:00Z', canRetry: true,
    }],
    totalCount: 1, pageNumber: 1, pageSize: 25, transport: 'Smtp', last24Hours: 1, dailyCap: 200,
  });
}

export function mockInvitations(api: MockApi): void {
  api.json<InvitationPageDto>('GET', /^Invitations\/?$/, {
    items: [{
      id: 1, kind: 'Personal', status: 'Active', codeHint: 'K7Q2', email: 'new.player@example.com', groupName: 'Citizen',
      maxUses: 1, useCount: 0, createdAt: '2026-11-15T09:00:00Z', createdByUserId: 1, createdByName: 'Alex',
      expiresAt: '2026-11-29T09:00:00Z', sendCount: 1,
    }],
    totalCount: 1, pageNumber: 1, pageSize: 25,
  });
}

const lootboxType: LootboxTypeDto = {
  id: 1, name: 'Weapons', categoryId: 1, category: { id: 1, name: 'Weapons' }, includeSubcategories: true, enabled: true,
  spawnWeight: 10, minBoxStars: 1, maxBoxStars: 5, itemStarSpread: 1, gradeWeights: [], poolEntries: [], enchantRolls: [],
};

export function mockLootboxTables(api: MockApi): void {
  api.json<LootboxTypeDto[]>('GET', /^LootboxTypes\/?$/, [lootboxType]);
  api.json<LootboxOddsDto[]>('GET', /^LootboxTypes\/odds/, []);
  api.json<LootboxSpecialEntryDto[]>('GET', /^LootboxSpecialEntries\/?$/, [{
    id: 1, lootboxTypeId: 1, lootboxType: { id: 1, name: 'Weapons' }, itemBlueprintId: 7, itemBlueprint: { id: 7, name: 'Dragon Blade' },
    chancePerMillion: 500, minBoxStars: 3, enabled: true, sortOrder: 0,
  }]);
  api.json<LootboxSpawnAreaDto[]>('GET', /^LootboxSpawnAreas\/?$/, [{
    id: 1, name: 'Castle grounds', world: 'world', wgRegionId: 'castle_grounds', enabled: true, maxActive: 3,
    spawnIntervalSeconds: 600, spawnChancePercent: 50, minOnlinePlayers: 1, minDistanceFromPlayers: 16, lifetimeMinutes: 30,
    allowedTypes: [{ lootboxTypeId: 1, lootboxType: { id: 1, name: 'Weapons' } }],
  }]);
  api.json<LootboxSpawnDto[]>('GET', /^LootboxSpawns\/active\/?$/, [{
    id: 1, token: 'tok-1', lootboxTypeId: 1, lootboxTypeName: 'Weapons', boxGradeId: 3, boxGradeName: 'Rare', boxStars: 3,
    boxLabel: 'Rare Weapons box', spawnAreaId: 1, spawnAreaName: 'Castle grounds', world: 'world', x: 120, y: 64, z: -340,
    status: 'Active', spawnedAt: '2026-11-15T09:00:00Z', expiresAt: '2026-11-15T09:30:00Z',
  }]);
}

export function mockCatalogAudit(api: MockApi): void {
  api.json<MinecraftCatalogAuditDto>('GET', /^MinecraftCatalog\/audit\/?$/, {
    readyForConstraints: false, materialCount: 1200, unverifiedCount: 0,
    materialKeyCollisions: [], invalidMaterialKeys: [], notNormalizedMaterialKeys: [],
    missingButReferenced: [{
      id: 9, namespaceKey: 'minecraft:light_blue_glazed_terracotta', normalizedKey: 'minecraft:light_blue_glazed_terracotta',
      displayName: 'Light Blue Glazed Terracotta', catalogStatus: 'Missing',
      references: { 'ItemBlueprint.IconMaterialRefId': 2 }, totalReferences: 2,
    }],
    blockRefCount: 0, duplicateBlockStates: [], invalidBlockStates: [], unlinkedBlockRefs: [], notCanonicalBlockRefs: [],
    enchantmentCount: 0, unverifiedEnchantmentCount: 0, missingEnchantmentsReferenced: [],
  });
}
