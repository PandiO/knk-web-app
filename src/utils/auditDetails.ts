import { AuditLogEntryDto } from '../types/dtos/userManagement/UserProfileSummaryDtos';

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
