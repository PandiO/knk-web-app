import React from 'react';
import { Info, Loader2 } from 'lucide-react';
import {
  DomainNavigationDefaultDto,
  NAVIGATION_DESTINATION_MODES,
  NavigationDestinationMode,
  ROAD_ACCESS_RULES,
  RoadAccessRule,
  UpdateDomainNavigationDefaultDto,
} from '../../../types/dtos/road/RoadDtos';

// KNG-73 (docs/specs/navigation/DESIGN.md §6.1) - where `/navigate <town|district|structure>` leads
// when the player names no mode: the domain's spawn Location or the closest point of its region.
// One default per domain type here; a single domain overrides it with "Navigation Default Override"
// on its own form. `spawn` / `region` after the name still pick either. The game server picks up a
// change with its next catalogue refresh (about a minute).
//
// Rev. 7 Part C (KNG-92, docs/specs/navigation/REV7_PROPOSAL.md §4) - "Entry rule on roads": whether a
// domain that won't let a player in also keeps that player's routes off the roads in its region. Off
// ("Ignored") for domains along a public street; the rule still holds at the border and the door.
//
// PandiO/knk-workspace#26: a choice no longer saves at once. The Road network page keeps the choices as a draft,
// counts them and saves them with its SettingsPage header, together with the compass settings.

export const TYPE_LABELS: Record<string, string> = {
  Town: 'Towns',
  District: 'Districts',
  Structure: 'Structures',
  GateStructure: 'Gates',
};

const MODE_HELP: Record<NavigationDestinationMode, string> = {
  Spawn: "the domain's spawn Location",
  Region: 'the nearest edge of its region, along the cheapest road route',
};

const ROAD_ACCESS_HELP: Record<RoadAccessRule, string> = {
  Applies: "routes avoid its roads for players it doesn't let in",
  Ignored: 'routes pass along its roads; the rule still holds at its border',
};

const DESTINATION_OVERRIDES_HELP =
  'Domains of this type with their own "Navigation Default Override" on their form. Changing the default here does not change them.';
const ROAD_OVERRIDES_HELP =
  'Domains of this type with their own "Road Access Override" on their form. Changing the rule here does not change them.';

/** A small (i) whose explanation shows on hover (and is read out by screen readers). */
const InfoTip: React.FC<{ text: string }> = ({ text }) => (
  <span role="img" aria-label={text} title={text} className="inline-flex align-middle ml-1 text-muted cursor-help">
    <Info className="h-3.5 w-3.5" aria-hidden="true" />
  </span>
);

/** One domain type's choices as edited: the default destination and the entry rule on roads. */
export type NavigationDefaultDraft = Pick<DomainNavigationDefaultDto, 'defaultMode' | 'roadAccess'>;

export const toNavigationDefaultDrafts = (defaults: DomainNavigationDefaultDto[]): Record<string, NavigationDefaultDraft> =>
  Object.fromEntries(defaults.map((d) => [d.domainType, { defaultMode: d.defaultMode, roadAccess: d.roadAccess }]));

/** Per domain type, the fields that differ from the saved default: what Save sends (one unsaved change each). */
export function navigationDefaultChanges(
  saved: DomainNavigationDefaultDto[] | null,
  drafts: Record<string, NavigationDefaultDraft>,
): { domainType: string; update: UpdateDomainNavigationDefaultDto; count: number }[] {
  return (saved ?? []).flatMap((d) => {
    const draft = drafts[d.domainType];
    if (!draft) return [];
    const update: UpdateDomainNavigationDefaultDto = {};
    if (draft.defaultMode !== d.defaultMode) update.defaultMode = draft.defaultMode;
    if (draft.roadAccess !== d.roadAccess) update.roadAccess = draft.roadAccess;
    const count = Object.keys(update).length;
    return count > 0 ? [{ domainType: d.domainType, update, count }] : [];
  });
}

interface DomainNavigationDefaultsCardProps {
  saved: DomainNavigationDefaultDto[] | null;
  drafts: Record<string, NavigationDefaultDraft>;
  loadError?: string | null;
  disabled?: boolean;
  onEdit: (domainType: string, change: Partial<NavigationDefaultDraft>) => void;
}

/** The table of defaults per domain type; inside the page's "Navigation defaults" section. */
export const DomainNavigationDefaultsCard: React.FC<DomainNavigationDefaultsCardProps> = ({ saved, drafts, loadError, disabled = false, onEdit }) => {
  if (loadError) return <p className="text-sm text-danger" role="alert">{loadError}</p>;
  if (saved === null) {
    return (
      <div className="flex items-center text-sm text-muted" role="status">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
        Loading…
      </div>
    );
  }
  const selectClass = (changed: boolean) => `rounded-md border px-2 py-1 text-sm bg-surface ${changed ? 'border-warning' : 'border-field'}`;
  return (
    <div className="overflow-x-auto relative">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-line">
            <th className="py-2 pr-4">Domain type</th>
            <th className="py-2 pr-4">Default destination</th>
            <th className="py-2 pr-4 text-right whitespace-nowrap">
              Overrides
              <InfoTip text={DESTINATION_OVERRIDES_HELP} />
            </th>
            <th className="py-2 pr-4">Entry rule on roads</th>
            <th className="py-2 pr-4 text-right whitespace-nowrap">
              Overrides
              <InfoTip text={ROAD_OVERRIDES_HELP} />
            </th>
          </tr>
        </thead>
        <tbody>
          {saved.map((d) => {
            const label = TYPE_LABELS[d.domainType] ?? d.domainType;
            const draft = drafts[d.domainType] ?? { defaultMode: d.defaultMode, roadAccess: d.roadAccess };
            return (
              <tr key={d.domainType} className="border-b border-line">
                <td className="py-2 pr-4 font-medium text-fg whitespace-nowrap">{label}</td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className={selectClass(draft.defaultMode !== d.defaultMode)}
                      value={draft.defaultMode}
                      aria-label={`${label} navigation default`}
                      disabled={disabled}
                      onChange={(e) => onEdit(d.domainType, { defaultMode: e.target.value as NavigationDestinationMode })}
                    >
                      {NAVIGATION_DESTINATION_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                    </select>
                    <span className="text-xs text-muted">{MODE_HELP[draft.defaultMode] ?? ''}</span>
                  </div>
                </td>
                <td className="py-2 pr-4 text-fg text-right">{d.overrideCount}</td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className={selectClass(draft.roadAccess !== d.roadAccess)}
                      value={draft.roadAccess}
                      aria-label={`${label} entry rule on roads`}
                      disabled={disabled}
                      onChange={(e) => onEdit(d.domainType, { roadAccess: e.target.value as RoadAccessRule })}
                    >
                      {ROAD_ACCESS_RULES.map((rule) => <option key={rule} value={rule}>{rule}</option>)}
                    </select>
                    <span className="text-xs text-muted">{ROAD_ACCESS_HELP[draft.roadAccess] ?? ''}</span>
                  </div>
                </td>
                <td className="py-2 pr-4 text-fg text-right">{d.roadAccessOverrideCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/** The section's explanation (kept with the table it explains). */
export const NavigationDefaultsDescription: React.FC = () => (
  <>
    Where <code className="text-xs bg-surface-alt px-1 rounded">/navigate &lt;name&gt;</code> leads when the player
    doesn&apos;t add <code className="text-xs bg-surface-alt px-1 rounded">spawn</code> or{' '}
    <code className="text-xs bg-surface-alt px-1 rounded">region</code>. A domain can override its type with
    &quot;Navigation Default Override&quot; on its own form. A player already inside the domain is told so either way.{' '}
    <span className="font-medium">Entry rule on roads</span> says whether a domain that won&apos;t let a player in also
    keeps their routes off the roads in its region; turn it off for domains along a public street. The rule still holds
    at the domain&apos;s border. The game server picks changes up within about a minute.
  </>
);
