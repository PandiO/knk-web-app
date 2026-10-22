import React from 'react';
import { Compass, Loader2 } from 'lucide-react';
import { roadClient } from '../../../apiClients/roadClient';
import {
  NAVIGATION_COMPASS_NAME_MATCHES,
  NavigationCompassNameMatch,
  NavigationCompassSettingsDto,
} from '../../../types/dtos/road/RoadDtos';
import { apiRefusalReason } from '../../../utils/apiRefusalReason';

// KNG-234 (docs/specs/navigation-compass/DESIGN.md) - the navigation compass item. In game, right-clicking it
// cycles through the places that matter (in a siege: the team's objectives, the ones under attack first) and
// navigates there; shift-clicking switches navigation off and on. The game server does not hard-code the item:
// any item whose material and display name match the rule below is a compass, so handing one out from an item
// blueprint with that material and default display name works at once. The server picks up a change within
// about a minute.

const NAME_MATCH_HELP: Record<NavigationCompassNameMatch, string> = {
  Exact: 'the whole name, ignoring colour codes and capitals',
  Contains: 'part of the name, ignoring colour codes and capitals',
};

const saveErrorMessage = (err: unknown): string => apiRefusalReason(err) ?? 'Could not save the compass settings.';

type Draft = Omit<NavigationCompassSettingsDto, 'updatedAt'>;

const toDraft = (s: NavigationCompassSettingsDto): Draft => ({
  enabled: s.enabled,
  material: s.material,
  displayName: s.displayName,
  nameMatch: s.nameMatch,
  siegeEnabled: s.siegeEnabled,
  generalEnabled: s.generalEnabled,
  generalTargets: s.generalTargets,
});

const sameDraft = (a: Draft, b: Draft): boolean =>
  a.enabled === b.enabled && a.material === b.material && a.displayName === b.displayName
  && a.nameMatch === b.nameMatch && a.siegeEnabled === b.siegeEnabled
  && a.generalEnabled === b.generalEnabled && a.generalTargets === b.generalTargets;

/** What the rule matches, in words, for the admin to check against the item blueprint. */
export const describeCompassRule = (draft: Draft): string => {
  const name = draft.displayName.trim();
  if (!name) return `any ${draft.material.trim() || 'COMPASS'} (whatever its name)`;
  return `a ${draft.material.trim() || 'COMPASS'} whose name ${draft.nameMatch === 'Contains' ? 'contains' : 'is'} “${name}”`;
};

export const NavigationCompassCard: React.FC = () => {
  const [saved, setSaved] = React.useState<Draft | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [justSaved, setJustSaved] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    roadClient
      .getNavigationCompassSettings()
      .then((result) => {
        if (cancelled) return;
        const loaded = toDraft(result);
        setSaved(loaded);
        setDraft(loaded);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Failed to load the navigation compass settings:', err);
        setLoadError('Could not load the navigation compass settings.');
      });
    return () => { cancelled = true; };
  }, []);

  const edit = (change: Partial<Draft>) => {
    setDraft((current) => (current ? { ...current, ...change } : current));
    setJustSaved(false);
  };

  const dirty = saved !== null && draft !== null && !sameDraft(saved, draft);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await roadClient.updateNavigationCompassSettings(draft);
      const loaded = toDraft(result);
      setSaved(loaded);
      setDraft(loaded);
      setJustSaved(true);
    } catch (err) {
      console.error('Failed to save the navigation compass settings:', err);
      setSaveError(saveErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center">
        <Compass className="h-5 w-5 mr-2" />
        Navigation compass
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        An item players right-click to be guided: in a siege match it cycles through their team&apos;s objectives
        (the ones under attack first, then their own, then the other side&apos;s) and the team spawn; shift-click
        switches the guidance off and on. Any item with the material and display name below works as the compass, so
        an item handed out from an item blueprint with that material and default display name works at once.
      </p>

      {loadError ? (
        <p className="mt-4 text-sm text-red-600">{loadError}</p>
      ) : draft === null ? (
        <div className="flex items-center mt-4 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading…
        </div>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => { e.preventDefault(); void save(); }}
        >
          <label className="flex items-center gap-2 text-sm text-gray-900">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => edit({ enabled: e.target.checked })}
              disabled={saving}
            />
            Compass item enabled
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="font-medium text-gray-900">Material</span>
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                value={draft.material}
                onChange={(e) => edit({ material: e.target.value })}
                maxLength={100}
                disabled={saving}
                placeholder="COMPASS"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-900">Display name</span>
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                value={draft.displayName}
                onChange={(e) => edit({ displayName: e.target.value })}
                maxLength={100}
                disabled={saving}
                placeholder="Navigation Compass"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-900">Name match</span>
              <select
                className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                value={draft.nameMatch}
                onChange={(e) => edit({ nameMatch: e.target.value as NavigationCompassNameMatch })}
                disabled={saving}
              >
                {NAVIGATION_COMPASS_NAME_MATCHES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <span className="text-xs text-gray-500">{NAME_MATCH_HELP[draft.nameMatch] ?? ''}</span>
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Matches {describeCompassRule(draft)}. Leave the display name empty to match on the material alone.
          </p>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input
                type="checkbox"
                checked={draft.siegeEnabled}
                onChange={(e) => edit({ siegeEnabled: e.target.checked })}
                disabled={saving}
              />
              Works in siege matches
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input
                type="checkbox"
                checked={draft.generalEnabled}
                onChange={(e) => edit({ generalEnabled: e.target.checked })}
                disabled={saving}
              />
              Works outside sieges
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-gray-900">Destinations outside sieges</span>
            <textarea
              className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1 text-sm font-mono"
              rows={5}
              value={draft.generalTargets}
              onChange={(e) => edit({ generalTargets: e.target.value })}
              disabled={saving || !draft.generalEnabled}
              placeholder={'town:Kardenna\nMarket Square spawn'}
              aria-label="Destinations outside sieges"
            />
            <span className="text-xs text-gray-500">
              One per line, in the order the compass cycles them, written as after{' '}
              <code className="bg-gray-100 px-1 rounded">/navigate</code>, such as{' '}
              <code className="bg-gray-100 px-1 rounded">town:Kardenna</code> or{' '}
              <code className="bg-gray-100 px-1 rounded">Market Square spawn</code>. A line the game cannot find is skipped.
            </span>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="px-3 py-1.5 text-sm rounded-md bg-slate-800 text-white disabled:opacity-50"
              disabled={!dirty || saving}
            >
              {saving ? 'Saving…' : 'Save compass settings'}
            </button>
            {saving && <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />}
            {justSaved && !dirty && <span className="text-sm text-green-700">Saved. The game server picks it up within a minute.</span>}
          </div>
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        </form>
      )}
    </div>
  );
};
