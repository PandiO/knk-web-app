import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { enchantmentDefinitionClient } from '../../apiClients/enchantmentDefinitionClient';
import {
  APPLICATION_LABELS,
  APPLIES_TO_LABELS,
  EnchantmentInfoDto,
  EnchantmentInfoEffectDto,
  EnchantmentInfoLevelDto,
  formatInfoNumber,
  toRoman,
  TRIGGER_LABELS,
} from '../../types/dtos/enchantmentInfo/EnchantmentInfoDtos';
import { usePublicSurface } from '../../theme/surface';

// Guides → custom enchantments and abilities (PandiO/knk-workspace#221), /guides/enchantments. Public (signed out too).
// Every number comes from the live combat values an admin sets (#151/#201/#223), so the page matches the game.

const GROUPS: { trigger: string; title: string; intro: string }[] = [
  { trigger: 'OnHit', title: 'On-hit enchantments', intro: 'On a weapon. A melee hit has a chance to set them off.' },
  { trigger: 'RightClick', title: 'Right-click abilities', intro: 'Right-click with the item to use them. They always go off, then need their cooldown.' },
  { trigger: 'GateHit', title: 'Siege enchantments', intro: 'For attacking gates in a siege.' },
  { trigger: 'Unknown', title: 'Other custom enchantments', intro: 'Custom enchantments without a built-in effect.' },
];

export const formatSeconds = (seconds: number): string => `${formatInfoNumber(seconds)} s`;

export const formatCooldown = (seconds: number): string => {
  if (seconds <= 0) return 'None';
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} min`;
  return formatSeconds(seconds);
};

export const formatEffect = (effect: EnchantmentInfoEffectDto): string => {
  const level = effect.potionLevel ? ` ${toRoman(effect.potionLevel)}` : '';
  const duration = effect.durationSeconds != null ? ` for ${formatSeconds(effect.durationSeconds)}` : '';
  const whom = APPLIES_TO_LABELS[effect.appliesTo] ?? effect.appliesTo;
  return `${effect.name}${level}${duration} (${whom})`;
};

const formatHeal = (amount: number): string => {
  const hearts = amount / 2;
  return `${formatInfoNumber(amount)} health (${formatInfoNumber(hearts)} heart${hearts === 1 ? '' : 's'})`;
};

export const EnchantmentGuidePage: React.FC = () => {
  usePublicSurface();
  const [sheets, setSheets] = React.useState<EnchantmentInfoDto[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    enchantmentDefinitionClient.getPublicInfo()
      .then(result => { if (!cancelled) setSheets(result ?? []); })
      .catch(err => {
        if (cancelled) return;
        console.error('Failed to load the enchantment guide:', err);
        setError('Could not load the enchantments.');
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-surface shadow-sm rounded-lg p-6 border border-line">
        <p className="text-sm"><Link to="/guides" className="text-primary hover:underline">Guides</Link></p>
        <div className="mt-2 flex items-center gap-3">
          <Sparkles className="h-10 w-10 text-muted" />
          <div>
            <h1 className="text-2xl font-semibold text-fg">Custom enchantments and abilities</h1>
            <p className="text-sm text-muted">
              What every Knights and Kings enchantment does, per level. The numbers are the server&apos;s current values.
            </p>
          </div>
        </div>
        <ul className="mt-4 list-disc pl-5 text-sm text-muted space-y-1">
          <li>A cooldown belongs to the player who used the enchantment and counts on any target.</li>
          <li>Enchantments don&apos;t work in combat safezones: a player in a safezone is not hit or affected.</li>
          <li>Damage is in health points: a player has 20 (10 hearts). Armour lowers the area damage of Chaos and Flash Chaos.</li>
        </ul>
        {sheets && sheets.length > 0 && (
          <nav aria-label="Enchantments" className="mt-4 flex flex-wrap gap-2 text-sm">
            {sheets.map(sheet => (
              <a key={sheet.key} href={`#${anchorOf(sheet.key)}`} className="rounded border border-line px-2 py-0.5 text-primary hover:bg-surface-alt">
                {sheet.displayName}
              </a>
            ))}
          </nav>
        )}
      </div>

      {error && <p className="text-danger">{error}</p>}
      {!sheets && !error && (
        <div className="flex items-center text-sm text-muted">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading…
        </div>
      )}
      {sheets && sheets.length === 0 && <p className="text-sm text-muted">No custom enchantments yet.</p>}

      {sheets && GROUPS.map(group => {
        const inGroup = sheets.filter(s => (GROUPS.some(g => g.trigger === s.trigger) ? s.trigger : 'Unknown') === group.trigger);
        if (inGroup.length === 0) return null;
        return (
          <section key={group.trigger} aria-label={group.title} className="space-y-3">
            <div>
              <h2 className="text-xl font-semibold text-fg">{group.title}</h2>
              <p className="text-sm text-muted">{group.intro}</p>
            </div>
            {inGroup.map(sheet => <EnchantmentCard key={sheet.key} sheet={sheet} />)}
          </section>
        );
      })}
    </div>
  );
};

const anchorOf = (key: string): string => `enchantment-${key.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

const EnchantmentCard: React.FC<{ sheet: EnchantmentInfoDto }> = ({ sheet }) => {
  const showChance = sheet.levels.some(l => l.chancePercent != null);
  const showEffects = sheet.levels.some(l => l.effects.length > 0);
  const showDamage = sheet.levels.some(l => l.areaDamage != null);
  const showHeal = sheet.levels.some(l => l.healAmount != null);
  const showDetail = sheet.levels.some(l => !!l.detail);
  // Cleaving's cooldown is its charged strike's, in the "Gate hits" text; it has no ability cooldown of its own.
  const showCooldown = sheet.trigger !== 'GateHit';
  const levelWord = sheet.maxLevel > 1 ? `levels I-${toRoman(sheet.maxLevel)}` : 'level I only';

  return (
    <article id={anchorOf(sheet.key)} aria-label={sheet.displayName} className="bg-surface shadow-sm rounded-lg p-6 border border-line space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-fg">{sheet.displayName}</h3>
        <span className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-info-soft text-info-strong px-2 py-0.5">{TRIGGER_LABELS[sheet.trigger] ?? sheet.trigger}</span>
          <span className="rounded-full bg-surface-alt text-fg px-2 py-0.5">Affects: {APPLICATION_LABELS[sheet.application] ?? sheet.application}</span>
          <span className="rounded-full bg-surface-alt text-fg px-2 py-0.5">{levelWord}</span>
        </span>
      </div>
      <p className="text-sm text-fg">{sheet.summary}</p>
      {sheet.damageRadiusBlocks != null && (
        <p className="text-sm text-fg">
          Damage within <strong>{formatInfoNumber(sheet.damageRadiusBlocks)} blocks</strong>
          {sheet.knockbackRadiusBlocks != null && <>, knockback within <strong>{formatInfoNumber(sheet.knockbackRadiusBlocks)} blocks</strong></>}
          {sheet.armourReducesDamage && '; armour lowers the damage'}.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm" aria-label={`${sheet.displayName} per level`}>
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th scope="col" className="py-1 pr-4 font-medium">Level</th>
              {showChance && <th scope="col" className="py-1 pr-4 font-medium">Chance per hit</th>}
              {showCooldown && <th scope="col" className="py-1 pr-4 font-medium">Cooldown</th>}
              {showEffects && <th scope="col" className="py-1 pr-4 font-medium">Effects</th>}
              {showDamage && <th scope="col" className="py-1 pr-4 font-medium">Damage</th>}
              {showDamage && <th scope="col" className="py-1 pr-4 font-medium">Gate damage</th>}
              {showHeal && <th scope="col" className="py-1 pr-4 font-medium">Heals</th>}
              {showDetail && <th scope="col" className="py-1 pr-4 font-medium">Gate hits</th>}
            </tr>
          </thead>
          <tbody>
            {sheet.levels.map(level => (
              <LevelRow key={level.level} level={level} showChance={showChance} showCooldown={showCooldown} showEffects={showEffects}
                showDamage={showDamage} showHeal={showHeal} showDetail={showDetail} />
            ))}
          </tbody>
        </table>
      </div>
      {sheet.levels.some(l => l.effects.some(e => e.note)) && (
        <ul className="text-sm text-muted list-disc pl-5">
          {Array.from(new Set(sheet.levels.flatMap(l => l.effects.map(e => e.note).filter((n): n is string => !!n))))
            .map(note => <li key={note}>{note}</li>)}
        </ul>
      )}
      {sheet.notes.length > 0 && (
        <ul className="text-xs text-muted list-disc pl-5" aria-label={`${sheet.displayName} notes`}>
          {sheet.notes.map(note => <li key={note}>{note}</li>)}
        </ul>
      )}
    </article>
  );
};

const LevelRow: React.FC<{
  level: EnchantmentInfoLevelDto; showChance: boolean; showCooldown: boolean; showEffects: boolean; showDamage: boolean;
  showHeal: boolean; showDetail: boolean;
}> = ({ level, showChance, showCooldown, showEffects, showDamage, showHeal, showDetail }) => (
  <tr className="border-b border-line last:border-0 align-top">
    <td className="py-1 pr-4 font-medium text-fg">{toRoman(level.level)}</td>
    {showChance && <td className="py-1 pr-4 text-fg">{level.chancePercent != null ? `${formatInfoNumber(level.chancePercent)} %` : 'Always'}</td>}
    {showCooldown && <td className="py-1 pr-4 text-fg">{formatCooldown(level.cooldownSeconds)}</td>}
    {showEffects && (
      <td className="py-1 pr-4 text-fg">
        {level.effects.length === 0 ? '-' : level.effects.map(e => <div key={e.name}>{formatEffect(e)}</div>)}
      </td>
    )}
    {showDamage && <td className="py-1 pr-4 text-fg">{level.areaDamage != null ? formatInfoNumber(level.areaDamage) : '-'}</td>}
    {showDamage && <td className="py-1 pr-4 text-fg">{level.gateDamage != null ? formatInfoNumber(level.gateDamage) : '-'}</td>}
    {showHeal && <td className="py-1 pr-4 text-fg">{level.healAmount != null ? formatHeal(level.healAmount) : '-'}</td>}
    {showDetail && <td className="py-1 pr-4 text-fg">{level.detail ?? '-'}</td>}
  </tr>
);
