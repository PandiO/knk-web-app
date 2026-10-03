import { auditActionLabel, describeAuditDetails, formatAmount, lootboxSpawnAuditLabel } from './auditDetails';
import { AuditLogEntryDto } from '../types/dtos/userManagement/UserProfileSummaryDtos';

const entry = (action: AuditLogEntryDto['action'], details: object | string | null): AuditLogEntryDto => ({
  id: 1,
  timestamp: '2026-09-26T12:00:00Z',
  targetUserId: 7,
  action,
  details: details === null ? null : typeof details === 'string' ? details : JSON.stringify(details),
});

describe('describeAuditDetails', () => {
  it('describes a staff lootbox spawn and the in-game area changes recorded under the same action', () => {
    expect(describeAuditDetails(entry('LootboxSpawnedByAdmin', {
      event: 'Spawned', spawnId: 12, lootboxTypeId: 3, lootboxTypeName: 'Weapons Lootbox', boxStars: 5, world: 'world', x: 10, y: 64, z: -20,
    }))).toEqual(['Weapons Lootbox ★5', 'At world 10 64 -20']);
    expect(describeAuditDetails(entry('LootboxSpawnedByAdmin', {
      event: 'AreaCreated', areaId: 4, name: 'spawn', world: 'world', wgRegionId: 'lootbox_spawn',
    }))).toEqual(['Area: spawn (region lootbox_spawn in world)']);
    expect(describeAuditDetails(entry('LootboxSpawnedByAdmin', {
      event: 'AreaDeleted', areaId: 4, name: 'spawn', world: 'world', wgRegionId: 'lootbox_spawn', removedSpawnIds: [7, 8],
    }))).toEqual(['Area: spawn (region lootbox_spawn in world)', '2 active boxes removed']);
  });

  it('titles a LootboxSpawnedByAdmin entry by its Details.event', () => {
    expect(lootboxSpawnAuditLabel(JSON.stringify({ event: 'Spawned' }))).toBe('Lootbox spawned');
    expect(lootboxSpawnAuditLabel(JSON.stringify({ event: 'AreaCreated' }))).toBe('Lootbox area created');
    expect(lootboxSpawnAuditLabel(JSON.stringify({ event: 'AreaDeleted' }))).toBe('Lootbox area deleted');
    expect(lootboxSpawnAuditLabel(null)).toBe('Lootbox spawned');
  });

  it('describes a staff lootbox give: the item, the box and the minted instance', () => {
    expect(describeAuditDetails(entry('LootboxGranted', {
      claimId: 31, lootboxTypeId: 3, lootboxTypeName: 'Weapons Lootbox', boxStars: 5, itemBlueprintId: 9,
      itemName: 'Flaming Samurai', itemStars: 5, isSpecial: true, itemInstanceId: 1001,
    }))).toEqual(['Flaming Samurai ★5 (special)', 'From a Weapons Lootbox ★5 box', 'claim #31, item instance #1001']);
    expect(describeAuditDetails(entry('LootboxGranted', {
      claimId: 32, lootboxTypeName: 'Food Lootbox', boxStars: 2, itemName: 'Bread', itemStars: 1, isSpecial: false, itemInstanceId: null,
    }))).toEqual(['Bread ★1', 'From a Food Lootbox ★2 box', 'claim #32']);
  });

  it('describes a discovery reset: the place and what its discovery paid (kept)', () => {
    const at = '2026-09-20T18:30:00Z';
    expect(describeAuditDetails(entry('DiscoveryReset', {
      domainId: 42, domainName: 'Rivia', domainType: 'Town', discoveredAt: at,
      coinsAwarded: 2600, gemsAwarded: 7, expAwarded: 0,
    }))).toEqual([
      'Town Rivia',
      `Discovered ${new Date(at).toLocaleString()}, paid 2,600 coins, 7 gems (kept)`,
    ]);
    expect(describeAuditDetails(entry('DiscoveryReset', { domainId: 9, domainName: null, domainType: 'GateStructure' })))
      .toEqual(['Gate domain #9']);
  });

  it('shows each balance change with its before/after, the title bonus and the reason', () => {
    expect(describeAuditDetails(entry('BalanceAdjusted', {
      coinsDelta: 0, gemsDelta: -3, experienceDelta: 2500, reason: 'event prize',
      titleBonusCoins: 32400, titleBonusGems: 0, titleBonusExp: 192,
      coinsBefore: 100, coinsAfter: 32500, gemsBefore: 10, gemsAfter: 7, experienceBefore: 0, experienceAfter: 2692,
    }))).toEqual([
      'coins: title bonus +32,400 (100 → 32,500)',
      '-3 gems (10 → 7)',
      '+2,500 XP, title bonus +192 (0 → 2,692)',
      'Reason: event prize',
    ]);
  });

  it('handles older balance entries without before/after', () => {
    expect(describeAuditDetails(entry('BalanceAdjusted', { coinsDelta: 500, gemsDelta: 0, experienceDelta: 0, reason: 'x' })))
      .toEqual(['+500 coins', 'Reason: x']);
  });

  it('describes a generic profile edit including multiplier changes', () => {
    expect(describeAuditDetails(entry('BalanceAdjusted', {
      source: 'GenericProfileEdit', coinsDelta: 0, gemsDelta: 0, experienceDelta: 0,
      previousPersonalSalaryMultiplier: 1, newPersonalSalaryMultiplier: 2,
    }))).toEqual(['Via the generic user edit form', 'Personal salary multiplier: ×1 → ×2']);
  });

  it('explains a salary payout: amount, balances, rate, hours and non-neutral multipliers', () => {
    expect(describeAuditDetails(entry('SalaryPayout', {
      amountPaid: 2340, hoursCovered: 2, paidHours: 1.5, titleSalary: 650,
      globalMultiplier: 1, personalMultiplier: 2, rankMultiplier: 1.2, coinsBefore: 1000, coinsAfter: 3340,
    }))).toEqual([
      '+2,340 coins (1,000 → 3,340)',
      '650/h title salary · 2.0h away, paid as 1.5h · ×2 personal · ×1.2 rank',
    ]);
  });

  it('describes title, mode, freeze and group entries', () => {
    expect(describeAuditDetails(entry('TitleChanged', { fromTitleName: 'Serf', toTitleName: 'Peasant', direction: 'promotion' })))
      .toEqual(['Serf → Peasant (promotion)']);
    expect(describeAuditDetails(entry('VanishToggled', '{"from":"None","to":"Staff"}'))).toEqual(['None → Staff']);
    expect(describeAuditDetails(entry('PlayerFrozen', { reason: 'griefing' }))).toEqual(['Reason: griefing']);
    expect(describeAuditDetails(entry('GroupAssigned', { groupName: 'Royal', expiresAt: null, updatedExisting: false })))
      .toEqual(['Group: Royal, permanent']);
    expect(describeAuditDetails(entry('GrantRemoved', { node: 'knk.gate.open', value: true }))).toEqual(['knk.gate.open = allow']);
  });

  it('describes a staff teleport to a player: who, where from/to, silent', () => {
    expect(describeAuditDetails(entry('PlayerTeleported', {
      kind: 'STAFF', subjectUserId: 1, subjectUsername: 'Alice', visitedUserId: 2, visitedUsername: 'Bob',
      from: { world: 'world', x: 0.5, y: 64, z: -3.5 }, to: { world: 'world_nether', x: 100.5, y: 70, z: 20.5, domainId: null },
      silent: true, reason: null, via: 'command',
    }))).toEqual([
      'Alice → Bob',
      'From world 0, 64, -4 to world_nether 100, 70, 20',
      'Silent',
    ]);
  });

  it('describes a staff teleport to coordinates from the console, with a reason', () => {
    expect(describeAuditDetails(entry('PlayerTeleported', {
      kind: 'STAFF', subjectUserId: 3, subjectUsername: 'Carol', visitedUserId: null, visitedUsername: null,
      from: { world: 'world', x: 1, y: 64, z: 1 }, to: { world: 'world', x: 50, y: 70, z: 50 },
      silent: false, reason: 'stuck in a wall', via: 'console',
    }))).toEqual([
      'Carol → world 50, 70, 50',
      'From world 1, 64, 1 to world 50, 70, 50',
      'From the console',
      'Reason: stuck in a wall',
    ]);
  });

  it('describes a private message log read: conversation, dates and what was shown', () => {
    const from = '2026-09-20T00:00:00Z';
    const to = '2026-09-26T00:00:00Z';
    expect(describeAuditDetails(entry('PrivateMessagesViewed', {
      otherUserId: 12, from, to, pageNumber: 2, pageSize: 25, shown: 1,
    }))).toEqual([
      'Conversation with user #12',
      `Sent from ${new Date(from).toLocaleString()}, before ${new Date(to).toLocaleString()}`,
      'Page 2, 1 message shown',
    ]);
    expect(describeAuditDetails(entry('PrivateMessagesViewed', {
      otherUserId: null, from: null, to: null, pageNumber: 1, pageSize: 25, shown: 0,
    }))).toEqual(['Page 1, 0 messages shown']);
  });

  it('gives no lines for missing or broken details', () => {
    expect(describeAuditDetails(entry('BalanceAdjusted', null))).toEqual([]);
    expect(describeAuditDetails(entry('BalanceAdjusted', 'not json'))).toEqual([]);
  });

  it('formats amounts with separators and signs', () => {
    expect(formatAmount(32400)).toBe('32,400');
    expect(formatAmount(500, true)).toBe('+500');
    expect(formatAmount(-3, true)).toBe('-3');
  });

  it('describes currency reversals and policy changes (currency Phase 4)', () => {
    const reversal = entry('CurrencyTransactionReversed', {
      reversedPublicId: '01M3', reversedReasonCode: 'SALARY', reversalPublicId: '01M4', reason: 'Paid twice by a bug',
      changes: [{ currency: 'Coins', amount: -650, before: 750, after: 100 }]
    });
    expect(describeAuditDetails(reversal)).toEqual([
      'Reversed SALARY 01M3 (as 01M4)', '-650 coins (750 → 100)', 'Reason: Paid twice by a bug'
    ]);
    const policy = entry('CurrencyPolicyChanged', { currency: 'Gems', changes: { transferable: { from: false, to: true } } });
    expect(describeAuditDetails(policy)).toEqual(['Gems transferable: false → true']);
  });
});

describe('auditActionLabel', () => {
  it('labels staff teleports and falls back to the raw action name', () => {
    expect(auditActionLabel(entry('PlayerTeleported', null))).toBe('Teleported by staff');
    expect(auditActionLabel(entry('KitGranted', null))).toBe('Kit granted');
    expect(auditActionLabel(entry('LootboxSpawnedByAdmin', JSON.stringify({ event: 'AreaCreated' })))).toBe('Lootbox area created');
    expect(auditActionLabel(entry('PrivateMessagesViewed', null))).toBe('Private messages viewed');
    expect(auditActionLabel(entry('TelemetryViewed', null))).toBe('Diagnostics viewed');
    expect(auditActionLabel(entry('PrivacyDeletionRequested', null))).toBe('Data deletion requested');
    expect(auditActionLabel(entry('PrivacyDeletionExecuted', null))).toBe('Data deleted');
    expect(auditActionLabel(entry('PrivacyDeletionCancelled', null))).toBe('Data deletion cancelled');
    expect(auditActionLabel(entry('SomethingNew' as AuditLogEntryDto['action'], null))).toBe('SomethingNew');
  });
});
