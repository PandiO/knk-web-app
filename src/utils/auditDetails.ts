import { AuditLogEntryDto } from '../types/dtos/userManagement/UserProfileSummaryDtos';
import { discoveryTypeLabel } from '../types/dtos/discovery/DiscoveryDtos';

/** Recent Activity heading for an audit entry (PlayerProfilePage). */
export const auditActionLabel = (entry: AuditLogEntryDto): string => {
  switch (entry.action) {
    case 'GroupAssigned': return 'Group assigned';
    case 'GroupRemoved': return 'Group removed';
    case 'GrantAdded': return 'Permission granted';
    case 'GrantUpdated': return 'Permission updated';
    case 'GrantRemoved': return 'Permission removed';
    case 'TitleChanged': return 'Title changed';
    case 'VanishToggled': return 'Mode changed';
    case 'SalaryPayout': return 'Salary paid out';
    case 'BalanceAdjusted': return 'Balances adjusted';
    case 'PlayerFrozen': return 'Player frozen';
    case 'PlayerUnfrozen': return 'Player unfrozen';
    // Written by GiveKitAsync (docs/specs/kits/DESIGN.md §4.1) on every staff kit grant.
    case 'KitGranted': return 'Kit granted';
    // Recorded by the plugin for /tp, /tphere (docs/specs/teleport/DESIGN.md §3.10).
    case 'PlayerTeleported': return 'Teleported by staff';
    // Lootboxes (docs/specs/lootboxes/DESIGN.md §3.2); the spawn entry's Details.event says which change.
    case 'LootboxSpawnedByAdmin': return lootboxSpawnAuditLabel(entry.details);
    case 'LootboxGranted': return 'Lootbox item given';
    // Written by DiscoveryService.ResetAsync (docs/specs/domain-discovery/DESIGN.md §3.5).
    case 'DiscoveryReset': return 'Discovery reset';
    // Currency ledger Phase 4 (docs/specs/currency-payments/IMPLEMENTATION_PLAN.md).
    case 'CurrencyTransactionReversed': return 'Transaction reversed';
    case 'CurrencyTransferLocked': return 'Payments locked';
    case 'CurrencyTransferUnlocked': return 'Payments unlocked';
    case 'CurrencyPolicyChanged': return 'Currency policy changed';
    // Written by PrivateMessageLogService on every read of the PM log (see PrivateMessagesPanel).
    case 'PrivateMessagesViewed': return 'Private messages viewed';
    // KNG-34 link 6: owner diagnostics reads and GDPR deletion requests.
    case 'TelemetryViewed': return 'Diagnostics viewed';
    case 'PrivacyDeletionRequested': return 'Data deletion requested';
    case 'PrivacyDeletionExecuted': return 'Data deleted';
    case 'PrivacyDeletionCancelled': return 'Data deletion cancelled';
    case 'PrivacyDeletionConfirmed': return 'Data deletion confirmed by email';
    default: return entry.action;
  }
};

/**
 * Human-readable lines for an audit entry's Details JSON (knk-web-api AuditLogEntry.Details),
 * shown under each entry in the player profile's Recent Activity. Every action writes its own
 * shape; fields that an older entry doesn't have are simply left out. Unknown actions or
 * unparseable details give no lines rather than an error.
 */
export function describeAuditDetails(entry: AuditLogEntryDto): string[] {
  const details = parse(entry.details);
  if (!details) return [];

  switch (entry.action) {
    case 'BalanceAdjusted': return balanceLines(details);
    case 'SalaryPayout': return salaryLines(details);
    case 'TitleChanged': return titleLines(details);
    case 'GroupAssigned': return groupAssignedLines(details);
    case 'GroupRemoved': return details.groupName ? [`Group: ${details.groupName}`] : [];
    case 'GrantAdded':
    case 'GrantRemoved': return grantLines(details);
    case 'GrantUpdated': return grantUpdatedLines(details);
    case 'VanishToggled': return details.from || details.to ? [`${details.from ?? '?'} → ${details.to ?? '?'}`] : [];
    case 'PlayerFrozen':
    case 'PlayerUnfrozen': return details.reason ? [`Reason: ${details.reason}`] : [];
    case 'KitGranted': return details.kitName ? [`Kit: ${details.kitName}`] : [];
    case 'PlayerTeleported': return teleportLines(details);
    case 'LootboxSpawnedByAdmin': return lootboxSpawnLines(details);
    case 'LootboxGranted': return lootboxGrantedLines(details);
    case 'DiscoveryReset': return discoveryResetLines(details);
    // Currency ledger Phase 4 (docs/specs/currency-payments/IMPLEMENTATION_PLAN.md).
    case 'CurrencyTransactionReversed': return reversalLines(details);
    case 'CurrencyTransferLocked': return details.reason ? [`Reason: ${details.reason}`] : [];
    case 'CurrencyTransferUnlocked': return details.previousReason ? [`Was locked for: ${details.previousReason}`] : [];
    case 'CurrencyPolicyChanged': return policyLines(details);
    case 'PrivateMessagesViewed': return privateMessagesViewedLines(details);
    default: return [];
  }
}

type Details = Record<string, any>;

function parse(json?: string | null): Details | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

/** 1500 -> "1,500"; with sign: "+1,500" / "-1,500". */
export function formatAmount(value: number, signed = false): string {
  const text = Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (!signed) return value < 0 ? `-${text}` : text;
  return `${value < 0 ? '-' : '+'}${text}`;
}

const formatMultiplier = (value: number): string => `×${Number(value.toFixed(2))}`;

const CURRENCIES: { key: string; label: string; bonus: string; before: string; after: string }[] = [
  { key: 'coinsDelta', label: 'coins', bonus: 'titleBonusCoins', before: 'coinsBefore', after: 'coinsAfter' },
  { key: 'gemsDelta', label: 'gems', bonus: 'titleBonusGems', before: 'gemsBefore', after: 'gemsAfter' },
  { key: 'experienceDelta', label: 'XP', bonus: 'titleBonusExp', before: 'experienceBefore', after: 'experienceAfter' },
];

function balanceLines(d: Details): string[] {
  const lines: string[] = [];
  for (const c of CURRENCIES) {
    const delta = num(d[c.key]) ?? 0;
    const bonus = num(d[c.bonus]) ?? 0;
    if (delta === 0 && bonus === 0) continue;
    let line = delta !== 0 ? `${formatAmount(delta, true)} ${c.label}` : `${c.label}:`;
    if (bonus !== 0) line += `${delta !== 0 ? ',' : ''} title bonus ${formatAmount(bonus, true)}`;
    const before = num(d[c.before]);
    const after = num(d[c.after]);
    if (before !== undefined && after !== undefined) line += ` (${formatAmount(before)} → ${formatAmount(after)})`;
    lines.push(line);
  }
  if (d.source === 'GenericProfileEdit') lines.push('Via the generic user edit form');
  multiplierChange(lines, d, 'PersonalSalaryMultiplier', 'Personal salary multiplier');
  multiplierChange(lines, d, 'PersonalGemBonusMultiplier', 'Personal gem bonus multiplier');
  multiplierChange(lines, d, 'PersonalExpBonusMultiplier', 'Personal XP bonus multiplier');
  if (d.reason) lines.push(`Reason: ${d.reason}`);
  return lines;
}

function multiplierChange(lines: string[], d: Details, field: string, label: string) {
  const from = num(d[`previous${field}`]);
  const to = num(d[`new${field}`]);
  if (from !== undefined && to !== undefined && from !== to) {
    lines.push(`${label}: ${formatMultiplier(from)} → ${formatMultiplier(to)}`);
  }
}

function salaryLines(d: Details): string[] {
  const lines: string[] = [];
  const paid = num(d.amountPaid);
  if (paid !== undefined) {
    let line = `${formatAmount(paid, true)} coins`;
    const before = num(d.coinsBefore);
    const after = num(d.coinsAfter);
    if (before !== undefined && after !== undefined) line += ` (${formatAmount(before)} → ${formatAmount(after)})`;
    lines.push(line);
  }

  const parts: string[] = [];
  const titleSalary = num(d.titleSalary);
  if (titleSalary !== undefined) parts.push(`${formatAmount(titleSalary)}/h title salary`);
  const hours = num(d.hoursCovered);
  const paidHours = num(d.paidHours);
  if (hours !== undefined) {
    parts.push(paidHours !== undefined && Math.abs(paidHours - hours) > 0.05
      ? `${hours.toFixed(1)}h away, paid as ${paidHours.toFixed(1)}h`
      : `${hours.toFixed(1)}h`);
  }
  const multipliers = [
    ['server', num(d.globalMultiplier)],
    ['personal', num(d.personalMultiplier)],
    ['rank', num(d.rankMultiplier)],
  ] as const;
  for (const [label, value] of multipliers) {
    if (value !== undefined && Math.abs(value - 1) > 0.0005) parts.push(`${formatMultiplier(value)} ${label}`);
  }
  if (parts.length > 0) lines.push(parts.join(' · '));
  return lines;
}

function titleLines(d: Details): string[] {
  if (!d.fromTitleName && !d.toTitleName) return [];
  let line = `${d.fromTitleName ?? '?'} → ${d.toTitleName ?? '?'}`;
  if (d.direction) line += ` (${d.direction})`;
  const lines = [line];
  if (Array.isArray(d.crossedTitles) && d.crossedTitles.length > 1) lines.push(`Crossed: ${d.crossedTitles.join(', ')}`);
  return lines;
}

function groupAssignedLines(d: Details): string[] {
  if (!d.groupName) return [];
  let line = `Group: ${d.groupName}`;
  line += d.expiresAt ? `, until ${new Date(d.expiresAt).toLocaleString()}` : ', permanent';
  if (d.updatedExisting) line += ' (expiry updated)';
  return [line];
}

function grantLines(d: Details): string[] {
  if (!d.node) return [];
  let line = `${d.node} = ${d.value === false ? 'deny' : 'allow'}`;
  if (d.expiresAt) line += `, until ${new Date(d.expiresAt).toLocaleString()}`;
  return [line];
}

function grantUpdatedLines(d: Details): string[] {
  const from = d.from ?? {};
  const to = d.to ?? {};
  if (!to.node) return [];
  const describe = (g: Details) => `${g.node} = ${g.value === false ? 'deny' : 'allow'}${g.expiresAt ? ` until ${new Date(g.expiresAt).toLocaleString()}` : ''}`;
  return [`${describe(from)} → ${describe(to)}`];
}

/** "world 12, 64, -3" - block coordinates, as players see them in game. */
function describePoint(point: unknown): string | undefined {
  if (!point || typeof point !== 'object') return undefined;
  const p = point as Details;
  const [x, y, z] = [num(p.x), num(p.y), num(p.z)];
  if (x === undefined || y === undefined || z === undefined) return undefined;
  return `${p.world ?? '?'} ${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)}`;
}

// knk-web-api UserService.RecordTeleportAuditAsync: kind, subject/visited ids + usernames,
// from/to {world,x,y,z}, silent, reason, via ("command" | "console").
function teleportLines(d: Details): string[] {
  const lines: string[] = [];
  const from = describePoint(d.from);
  const to = describePoint(d.to);
  const subject = d.subjectUsername ?? (d.subjectUserId ? `user #${d.subjectUserId}` : '?');
  if (d.visitedUsername || d.visitedUserId) {
    lines.push(`${subject} → ${d.visitedUsername ?? `user #${d.visitedUserId}`}`);
  } else if (to) {
    lines.push(`${subject} → ${to}`);
  }
  if (from && to) lines.push(`From ${from} to ${to}`);
  const flags: string[] = [];
  if (d.silent === true) flags.push('silent');
  if (d.via === 'console') flags.push('from the console');
  if (flags.length > 0) lines.push(flags.map((f, i) => (i === 0 ? f[0].toUpperCase() + f.slice(1) : f)).join(', '));
  if (d.reason) lines.push(`Reason: ${d.reason}`);
  return lines;
}

// ===== Lootboxes (docs/specs/lootboxes/DESIGN.md §3.2) =====
// knk-web-api's AuditAction has only two lootbox values (13-14), so LootboxSpawnedByAdmin covers every
// staff change to where boxes spawn; Details.event tells them apart.

const stars = (value: unknown): string => (num(value) !== undefined ? ` ★${value}` : '');

/** The Recent-activity title of a LootboxSpawnedByAdmin entry, from its Details.event. */
export function lootboxSpawnAuditLabel(detailsJson?: string | null): string {
  switch (parse(detailsJson)?.event) {
    case 'AreaCreated': return 'Lootbox area created';
    case 'AreaDeleted': return 'Lootbox area deleted';
    default: return 'Lootbox spawned';
  }
}

// LootboxRuntimeService.AdminSpawnAsync (event Spawned) and LootboxSpawnAreaService's in-game
// create/delete (AreaCreated / AreaDeleted).
function lootboxSpawnLines(d: Details): string[] {
  switch (d.event) {
    case 'AreaCreated':
    case 'AreaDeleted': {
      const lines: string[] = [];
      if (d.name) lines.push(`Area: ${d.name}${d.wgRegionId ? ` (region ${d.wgRegionId}${d.world ? ` in ${d.world}` : ''})` : ''}`);
      const removed = Array.isArray(d.removedSpawnIds) ? d.removedSpawnIds.length : 0;
      if (d.event === 'AreaDeleted' && removed > 0) lines.push(`${removed} active box${removed === 1 ? '' : 'es'} removed`);
      return lines;
    }
    default: {
      const lines: string[] = [];
      if (d.lootboxTypeName) lines.push(`${d.lootboxTypeName}${stars(d.boxStars)}`);
      if (d.world && num(d.x) !== undefined) lines.push(`At ${d.world} ${d.x} ${d.y} ${d.z}`);
      return lines;
    }
  }
}

// LootboxRuntimeService.AdminGiveAsync: the rolled item and the minted instance, if any.
function lootboxGrantedLines(d: Details): string[] {
  const lines: string[] = [];
  if (d.itemName) {
    let line = `${d.itemName}${stars(d.itemStars)}`;
    if (d.isSpecial) line += ' (special)';
    lines.push(line);
  }
  if (d.lootboxTypeName) lines.push(`From a ${d.lootboxTypeName}${stars(d.boxStars)} box`);
  const refs: string[] = [];
  if (num(d.claimId) !== undefined) refs.push(`claim #${d.claimId}`);
  if (num(d.itemInstanceId) !== undefined) refs.push(`item instance #${d.itemInstanceId}`);
  if (refs.length > 0) lines.push(refs.join(', '));
  return lines;
}

// knk-web-api DiscoveryService.ResetAsync: the place whose discovery was forgotten and what that
// discovery had paid (not taken back - docs/specs/domain-discovery/DESIGN.md D8).
function discoveryResetLines(d: Details): string[] {
  const lines: string[] = [];
  const domainId = num(d.domainId);
  const name = d.domainName ?? (domainId !== undefined ? `domain #${domainId}` : null);
  if (name) lines.push(`${d.domainType ? `${discoveryTypeLabel(d.domainType)} ` : ''}${name}`);
  const paid: string[] = [];
  const coins = num(d.coinsAwarded) ?? 0;
  const gems = num(d.gemsAwarded) ?? 0;
  const exp = num(d.expAwarded) ?? 0;
  if (coins) paid.push(`${formatAmount(coins)} coins`);
  if (gems) paid.push(`${formatAmount(gems)} gems`);
  if (exp) paid.push(`${formatAmount(exp)} XP`);
  const when = d.discoveredAt ? `Discovered ${new Date(d.discoveredAt).toLocaleString()}` : null;
  if (when || paid.length > 0) {
    lines.push([when, paid.length > 0 ? `paid ${paid.join(', ')} (kept)` : null].filter(Boolean).join(', '));
  }
  return lines;
}

function reversalLines(d: Details): string[] {
  const lines: string[] = [];
  if (d.reversedPublicId) {
    lines.push(`Reversed ${d.reversedReasonCode ?? 'transaction'} ${d.reversedPublicId}${d.reversalPublicId ? ` (as ${d.reversalPublicId})` : ''}`);
  }
  if (Array.isArray(d.changes)) {
    for (const change of d.changes) {
      const amount = num(change?.amount);
      if (amount === undefined) continue;
      const label = change.currency === 'Experience' ? 'XP' : String(change.currency ?? '').toLowerCase();
      const before = num(change.before);
      const after = num(change.after);
      lines.push(`${formatAmount(amount, true)} ${label}${before !== undefined && after !== undefined ? ` (${formatAmount(before)} → ${formatAmount(after)})` : ''}`);
    }
  }
  if (d.reason) lines.push(`Reason: ${d.reason}`);
  return lines;
}

function policyLines(d: Details): string[] {
  const changes = d.changes && typeof d.changes === 'object' ? Object.entries(d.changes as Record<string, any>) : [];
  return changes.map(([field, value]) => `${d.currency ?? ''} ${field}: ${value?.from ?? '-'} → ${value?.to ?? '-'}`.trim());
}

// knk-web-api PrivateMessageLogService.SearchAsync: the filters of the read and how many
// messages it showed (docs/specs/private-messages/DESIGN.md §3.2).
function privateMessagesViewedLines(d: Details): string[] {
  const lines: string[] = [];
  const otherUserId = num(d.otherUserId);
  if (otherUserId !== undefined) lines.push(`Conversation with user #${otherUserId}`);
  const range: string[] = [];
  if (d.from) range.push(`from ${new Date(d.from).toLocaleString()}`);
  if (d.to) range.push(`before ${new Date(d.to).toLocaleString()}`);
  if (range.length > 0) lines.push(`Sent ${range.join(', ')}`);
  const shown = num(d.shown);
  const page = num(d.pageNumber);
  if (shown !== undefined) {
    lines.push(`${page !== undefined ? `Page ${page}, ` : ''}${shown} message${shown === 1 ? '' : 's'} shown`);
  }
  return lines;
}
