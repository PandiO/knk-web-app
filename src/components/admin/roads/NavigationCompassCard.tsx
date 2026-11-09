import React from 'react';
import { Loader2 } from 'lucide-react';
import { Field } from '../../Field';
import {
  NAVIGATION_COMPASS_NAME_MATCHES,
  NavigationCompassNameMatch,
  NavigationCompassSettingsDto,
} from '../../../types/dtos/road/RoadDtos';

// KNG-234 (docs/specs/navigation-compass/DESIGN.md) - the navigation compass item. In game, right-clicking it
// cycles through the places that matter (in a siege: the team's objectives, the ones under attack first) and
// navigates there; shift-clicking switches navigation off and on. The game server does not hard-code the item:
// any item whose material and display name match the rule below is a compass, so handing one out from an item
// blueprint with that material and default display name works at once. The server picks up a change within
// about a minute.
//
// PandiO/knk-workspace#26: the card only edits; the Road network page holds the saved values and the draft and
// saves them with its SettingsPage header (changes counted, "Leave without saving?", toast, refusal in the header).

const NAME_MATCH_HELP: Record<NavigationCompassNameMatch, string> = {
  Exact: 'the whole name, ignoring colour codes and capitals',
  Contains: 'part of the name, ignoring colour codes and capitals',
};

export type CompassDraft = Omit<NavigationCompassSettingsDto, 'updatedAt'>;

export const toCompassDraft = (s: NavigationCompassSettingsDto): CompassDraft => ({
  enabled: s.enabled,
  material: s.material,
  displayName: s.displayName,
  nameMatch: s.nameMatch,
  siegeEnabled: s.siegeEnabled,
  generalEnabled: s.generalEnabled,
  generalTargets: s.generalTargets,
});

/** The settings that differ from the saved ones (one unsaved change each). */
export const compassChangedKeys = (saved: CompassDraft | null, draft: CompassDraft | null): (keyof CompassDraft)[] =>
  saved && draft ? (Object.keys(draft) as (keyof CompassDraft)[]).filter((k) => draft[k] !== saved[k]) : [];

/** What the rule matches, in words, for the admin to check against the item blueprint. */
export const describeCompassRule = (draft: CompassDraft): string => {
  const name = draft.displayName.trim();
  if (!name) return `any ${draft.material.trim() || 'COMPASS'} (whatever its name)`;
  return `a ${draft.material.trim() || 'COMPASS'} whose name ${draft.nameMatch === 'Contains' ? 'contains' : 'is'} “${name}”`;
};


interface NavigationCompassCardProps {
  saved: CompassDraft | null;
  draft: CompassDraft | null;
  loadError?: string | null;
  disabled?: boolean;
  onEdit: (change: Partial<CompassDraft>) => void;
}

/** The compass rule's fields; a changed one has a warning border. Inside the page's "Navigation compass" section. */
export const NavigationCompassCard: React.FC<NavigationCompassCardProps> = ({ saved, draft, loadError, disabled = false, onEdit }) => {
  if (loadError) return <p className="text-sm text-danger" role="alert">{loadError}</p>;
  if (draft === null) {
    return (
      <div className="flex items-center text-sm text-muted" role="status">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
        Loading…
      </div>
    );
  }
  const changed = compassChangedKeys(saved, draft);
  const inputClass = (key: keyof CompassDraft, extra = '') => `input px-3 py-2 ${extra} ${changed.includes(key) ? 'border-warning' : ''}`;
  const checkbox = 'h-4 w-4 rounded border-field text-primary focus:ring-primary';

  return (
    <div className="space-y-4">
      <Field label="Compass item enabled" inline hint="Off: no item works as the compass, also in sieges.">
        <input type="checkbox" className={checkbox} checked={draft.enabled} onChange={(e) => onEdit({ enabled: e.target.checked })} disabled={disabled} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Material" hint="A Minecraft material key, such as COMPASS.">
          <input type="text" className={inputClass('material')} value={draft.material} maxLength={100} placeholder="COMPASS"
            onChange={(e) => onEdit({ material: e.target.value })} disabled={disabled} />
        </Field>
        <Field label="Display name" hint="Empty: the material alone decides.">
          <input type="text" className={inputClass('displayName')} value={draft.displayName} maxLength={100} placeholder="Navigation Compass"
            onChange={(e) => onEdit({ displayName: e.target.value })} disabled={disabled} />
        </Field>
        <Field label="Name match" hint={`Matches ${NAME_MATCH_HELP[draft.nameMatch] ?? ''}.`}>
          <select className={inputClass('nameMatch')} value={draft.nameMatch}
            onChange={(e) => onEdit({ nameMatch: e.target.value as NavigationCompassNameMatch })} disabled={disabled}>
            {NAVIGATION_COMPASS_NAME_MATCHES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      <p className="text-xs text-muted">
        Matches {describeCompassRule(draft)}. Leave the display name empty to match on the material alone.
      </p>

      <div className="space-y-2">
        <Field label="Works in siege matches" inline hint="Cycles the team's objectives and the team spawn.">
          <input type="checkbox" className={checkbox} checked={draft.siegeEnabled} onChange={(e) => onEdit({ siegeEnabled: e.target.checked })} disabled={disabled} />
        </Field>
        <Field label="Works outside sieges" inline hint="Cycles the destinations below.">
          <input type="checkbox" className={checkbox} checked={draft.generalEnabled} onChange={(e) => onEdit({ generalEnabled: e.target.checked })} disabled={disabled} />
        </Field>
      </div>

      <Field
        label="Destinations outside sieges"
        hint={<>
          One per line, in the order the compass cycles them, written as after{' '}
          <code className="bg-surface-alt px-1 rounded">/navigate</code>, such as{' '}
          <code className="bg-surface-alt px-1 rounded">town:Kardenna</code> or{' '}
          <code className="bg-surface-alt px-1 rounded">Market Square spawn</code>. A line the game cannot find is skipped.
        </>}
      >
        <textarea className={inputClass('generalTargets', 'font-mono')} rows={5} value={draft.generalTargets}
          onChange={(e) => onEdit({ generalTargets: e.target.value })}
          disabled={disabled || !draft.generalEnabled} placeholder={'town:Kardenna\nMarket Square spawn'} />
      </Field>
    </div>
  );
};
