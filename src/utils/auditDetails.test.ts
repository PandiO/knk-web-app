import { auditActionLabel, describeAuditDetails, formatAmount } from './auditDetails';
import { AuditLogEntryDto } from '../types/dtos/userManagement/UserProfileSummaryDtos';

const entry = (action: AuditLogEntryDto['action'], details: object | string | null): AuditLogEntryDto => ({
  id: 1,
  timestamp: '2026-09-26T12:00:00Z',
  targetUserId: 7,
  action,
  details: details === null ? null : typeof details === 'string' ? details : JSON.stringify(details),
});

describe('describeAuditDetails', () => {
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

  it('gives no lines for missing or broken details', () => {
    expect(describeAuditDetails(entry('BalanceAdjusted', null))).toEqual([]);
    expect(describeAuditDetails(entry('BalanceAdjusted', 'not json'))).toEqual([]);
  });

  it('formats amounts with separators and signs', () => {
    expect(formatAmount(32400)).toBe('32,400');
    expect(formatAmount(500, true)).toBe('+500');
    expect(formatAmount(-3, true)).toBe('-3');
  });
});

describe('auditActionLabel', () => {
  it('labels staff teleports and falls back to the raw action name', () => {
    expect(auditActionLabel(entry('PlayerTeleported', null))).toBe('Teleported by staff');
    expect(auditActionLabel(entry('KitGranted', null))).toBe('Kit granted');
    expect(auditActionLabel(entry('SomethingNew' as AuditLogEntryDto['action'], null))).toBe('SomethingNew');
  });
});
