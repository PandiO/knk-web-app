import React from 'react';
import { Loader2, Navigation } from 'lucide-react';
import { roadClient } from '../../../apiClients/roadClient';
import {
  DomainNavigationDefaultDto,
  NAVIGATION_DESTINATION_MODES,
  NavigationDestinationMode,
} from '../../../types/dtos/road/RoadDtos';

// KNG-73 (docs/specs/navigation/DESIGN.md §6.1) - where `/navigate <town|district|structure>` leads
// when the player names no mode: the domain's spawn Location or the closest point of its region.
// One default per domain type here; a single domain overrides it with "Navigation Default Override"
// on its own form. `spawn` / `region` after the name still pick either. The game server picks up a
// change with its next catalogue refresh (about a minute).

const TYPE_LABELS: Record<string, string> = {
  Town: 'Towns',
  District: 'Districts',
  Structure: 'Structures',
  GateStructure: 'Gates',
};

const MODE_HELP: Record<NavigationDestinationMode, string> = {
  Spawn: "the domain's spawn Location",
  Region: 'the nearest edge of its region, along the cheapest road route',
};

const saveErrorMessage = (err: unknown): string => {
  const status = (err as { status?: number } | null)?.status;
  const message = err instanceof Error ? err.message : null;
  return status !== undefined && status >= 400 && status < 500 && message ? message : 'Could not save this default.';
};

export const DomainNavigationDefaultsCard: React.FC = () => {
  const [defaults, setDefaults] = React.useState<DomainNavigationDefaultDto[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [savingType, setSavingType] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    roadClient
      .getDomainNavigationDefaults()
      .then((result) => {
        if (!cancelled) setDefaults(result ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Failed to load the navigation defaults:', err);
        setLoadError('Could not load the navigation defaults.');
      });
    return () => { cancelled = true; };
  }, []);

  const change = async (domainType: string, defaultMode: NavigationDestinationMode) => {
    setSavingType(domainType);
    setSaveError(null);
    try {
      const saved = await roadClient.updateDomainNavigationDefault(domainType, defaultMode);
      setDefaults((current) => (current ?? []).map((d) => (d.domainType === saved.domainType ? saved : d)));
    } catch (err) {
      console.error('Failed to save the navigation default:', err);
      setSaveError(`${TYPE_LABELS[domainType] ?? domainType}: ${saveErrorMessage(err)}`);
    } finally {
      setSavingType(null);
    }
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center">
        <Navigation className="h-5 w-5 mr-2" />
        Navigation defaults
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Where <code className="text-xs bg-gray-100 px-1 rounded">/navigate &lt;name&gt;</code> leads when the player
        doesn&apos;t add <code className="text-xs bg-gray-100 px-1 rounded">spawn</code> or{' '}
        <code className="text-xs bg-gray-100 px-1 rounded">region</code>. A domain can override its type with
        &quot;Navigation Default Override&quot; on its own form. A player already inside the domain is told so
        either way.
      </p>

      {loadError ? (
        <p className="mt-4 text-sm text-red-600">{loadError}</p>
      ) : defaults === null ? (
        <div className="flex items-center mt-4 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="py-2 pr-4">Domain type</th>
                <th className="py-2 pr-4">Default destination</th>
                <th className="py-2 pr-4 text-right" title="Domains of this type with their own choice">Overrides</th>
              </tr>
            </thead>
            <tbody>
              {defaults.map((d) => {
                const label = TYPE_LABELS[d.domainType] ?? d.domainType;
                return (
                  <tr key={d.domainType} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-medium text-gray-900 whitespace-nowrap">{label}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                          value={d.defaultMode}
                          aria-label={`${label} navigation default`}
                          disabled={savingType !== null}
                          onChange={(e) => void change(d.domainType, e.target.value as NavigationDestinationMode)}
                        >
                          {NAVIGATION_DESTINATION_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                        </select>
                        {savingType === d.domainType ? (
                          <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                        ) : (
                          <span className="text-xs text-gray-500">{MODE_HELP[d.defaultMode] ?? ''}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-gray-700 text-right">{d.overrideCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {saveError && <p className="mt-3 text-sm text-red-600">{saveError}</p>}
    </div>
  );
};
