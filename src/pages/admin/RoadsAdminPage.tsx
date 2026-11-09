import React from 'react';
import { Compass, Navigation } from 'lucide-react';
import { roadClient } from '../../apiClients/roadClient';
import { DomainNavigationDefaultDto, RoadNetworkMetaDto, RoadProfileDto, RoadTileDto } from '../../types/dtos/road/RoadDtos';
import { RoadProfilesCard } from '../../components/admin/roads/RoadProfilesCard';
import { RoadTilesCard } from '../../components/admin/roads/RoadTilesCard';
import { RoadEdgesCard } from '../../components/admin/roads/RoadEdgesCard';
import {
  DomainNavigationDefaultsCard, NavigationDefaultDraft, NavigationDefaultsDescription, TYPE_LABELS,
  navigationDefaultChanges, toNavigationDefaultDrafts,
} from '../../components/admin/roads/DomainNavigationDefaultsCard';
import {
  CompassDraft, NavigationCompassCard, compassChangedKeys, toCompassDraft,
} from '../../components/admin/roads/NavigationCompassCard';
import { SettingsPage, SettingsSection } from '../../components/SettingsPage';
import { Field } from '../../components/Field';
import { apiRefusalReason } from '../../utils/apiRefusalReason';

// docs/specs/navigation/DESIGN.md §7 / IMPLEMENTATION_PLAN.md Phase 5 - the road network's admin
// page (knk.admin.road, see the /admin/roads route): road profiles (what roads are made of), the
// per-world tile overview (what was built, what is dirty, build warnings) and the edge table
// (street labels, class, cost, flags), plus where /navigate leads per domain type (KNG-73) and which item is the navigation compass (KNG-234). Everything in-world (surveys, builds, the overlay) is the
// plugin's `/knk road` command; this page is for naming, labelling, profiles, tuning and overviews.
// Street names stay on the Street entity: an edge only references a street by id.
//
// PandiO/knk-workspace#26: on the SettingsPage shell. Its header saves the page's settings - the navigation
// defaults per domain type and the compass rule - as one batch: changes counted, "Leave without saving?", Discard,
// Reload (everything, asks first), a toast, a refusal in the header. Profiles and road stretches are records, not
// settings: their row editors keep their own Save and are not counted.

/** localStorage key of the last world looked at (Phase 5 decision 1: a text field, remembered). */
export const ROADS_WORLD_STORAGE_KEY = 'knk.roads.world';
/** The Minecraft default world name - the first value shown until the admin types another. */
export const DEFAULT_ROADS_WORLD = 'world';

const rememberedWorld = (): string => {
  try {
    return window.localStorage.getItem(ROADS_WORLD_STORAGE_KEY) || DEFAULT_ROADS_WORLD;
  } catch {
    return DEFAULT_ROADS_WORLD;
  }
};

const rememberWorld = (world: string) => {
  try {
    window.localStorage.setItem(ROADS_WORLD_STORAGE_KEY, world);
  } catch {
    // Private mode or blocked storage: the world just isn't remembered.
  }
};

export const RoadsAdminPage: React.FC = () => {
  const [world, setWorld] = React.useState(rememberedWorld);
  const [worldInput, setWorldInput] = React.useState(world);
  const [profiles, setProfiles] = React.useState<RoadProfileDto[]>([]);
  const [meta, setMeta] = React.useState<RoadNetworkMetaDto | null>(null);
  const [tiles, setTiles] = React.useState<RoadTileDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // The settings the header saves (#26).
  const [defaults, setDefaults] = React.useState<DomainNavigationDefaultDto[] | null>(null);
  const [defaultDrafts, setDefaultDrafts] = React.useState<Record<string, NavigationDefaultDraft>>({});
  const [defaultsError, setDefaultsError] = React.useState<string | null>(null);
  const [compass, setCompass] = React.useState<CompassDraft | null>(null);
  const [compassDraft, setCompassDraft] = React.useState<CompassDraft | null>(null);
  const [compassError, setCompassError] = React.useState<string | null>(null);

  const loadSettings = React.useCallback(async () => {
    setDefaultsError(null);
    setCompassError(null);
    await Promise.all([
      roadClient.getDomainNavigationDefaults()
        .then((result) => {
          setDefaults(result ?? []);
          setDefaultDrafts(toNavigationDefaultDrafts(result ?? []));
        })
        .catch((err: unknown) => {
          console.error('Failed to load the navigation defaults:', err);
          setDefaultsError('Could not load the navigation defaults.');
        }),
      roadClient.getNavigationCompassSettings()
        .then((result) => {
          const loaded = toCompassDraft(result);
          setCompass(loaded);
          setCompassDraft(loaded);
        })
        .catch((err: unknown) => {
          console.error('Failed to load the navigation compass settings:', err);
          setCompassError('Could not load the navigation compass settings.');
        }),
    ]);
  }, []);

  React.useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const defaultChanges = navigationDefaultChanges(defaults, defaultDrafts);
  const compassChanges = compassChangedKeys(compass, compassDraft);
  const dirtyCount = compassChanges.length + defaultChanges.reduce((sum, c) => sum + c.count, 0);

  const saveSettings = async (): Promise<string> => {
    const refusals: string[] = [];
    let saved = 0;
    if (compassDraft && compassChanges.length > 0) {
      try {
        const loaded = toCompassDraft(await roadClient.updateNavigationCompassSettings(compassDraft));
        setCompass(loaded);
        setCompassDraft(loaded);
        saved += compassChanges.length;
      } catch (err) {
        console.error('Failed to save the navigation compass settings:', err);
        refusals.push(`Navigation compass: ${apiRefusalReason(err) ?? 'Could not save the compass settings.'}`);
      }
    }
    for (const change of defaultChanges) {
      try {
        const result = await roadClient.updateDomainNavigationDefault(change.domainType, change.update);
        setDefaults((current) => (current ?? []).map((d) => (d.domainType === result.domainType ? result : d)));
        setDefaultDrafts((current) => ({ ...current, [result.domainType]: { defaultMode: result.defaultMode, roadAccess: result.roadAccess } }));
        saved += change.count;
      } catch (err) {
        console.error('Failed to save the navigation default:', err);
        refusals.push(`${TYPE_LABELS[change.domainType] ?? change.domainType}: ${apiRefusalReason(err) ?? 'Could not save this default.'}`);
      }
    }
    if (refusals.length > 0) {
      throw new Error(`${saved > 0 ? `Saved ${saved} change${saved === 1 ? '' : 's'}; not saved: ` : ''}${refusals.join(' ')}`);
    }
    return `Saved ${saved} change${saved === 1 ? '' : 's'}. The game server picks them up within a minute.`;
  };

  const discardSettings = () => {
    setCompassDraft(compass);
    setDefaultDrafts(toNavigationDefaultDrafts(defaults ?? []));
  };

  const loadProfiles = React.useCallback(async () => {
    setProfiles(await roadClient.getProfiles());
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profilesResult, metaResult, tilesResult] = await Promise.all([
        roadClient.getProfiles(),
        roadClient.getMeta(world),
        roadClient.getTiles(world),
      ]);
      setProfiles(profilesResult);
      setMeta(metaResult);
      setTiles(tilesResult);
    } catch (err) {
      console.error('Failed to load the road network:', err);
      setError(`Could not load the road network of world "${world}".`);
    } finally {
      setLoading(false);
    }
  }, [world]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const applyWorld = (event: React.FormEvent) => {
    event.preventDefault();
    const next = worldInput.trim();
    if (!next) return;
    rememberWorld(next);
    setWorld(next);
  };

  const handleProfilesChanged = async () => {
    try {
      await loadProfiles();
    } catch (err) {
      console.error('Failed to reload the road profiles:', err);
    }
  };

  // A street label changed: the labelled-streets list (the edge filter's choices) follows.
  const handleStreetsChanged = async () => {
    try {
      setMeta(await roadClient.getMeta(world));
    } catch (err) {
      console.error('Failed to reload the road network meta:', err);
    }
  };

  // The tile whose stretches the edge table is limited to (from a tile row's "Edges" button).
  const [edgesTileId, setEdgesTileId] = React.useState<number | null>(null);
  const edgesRef = React.useRef<HTMLDivElement>(null);
  const showTileEdges = (tileId: number) => {
    setEdgesTileId(tileId);
    // jsdom has no scrollIntoView; browsers do.
    if (typeof edgesRef.current?.scrollIntoView === 'function') {
      edgesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const nodeCount = meta?.components.reduce((sum, c) => sum + c.nodeCount, 0) ?? 0;
  const dirtyTiles = tiles.filter((t) => t.dirty).length;

  return (
    <SettingsPage
      title="Road network"
      description={<>
        Road profiles, the built tiles of a world and its road stretches. Surveys, builds and the in-world overlay are{' '}
        <code className="text-xs bg-surface-alt px-1 rounded">/knk road</code>. Save saves the navigation defaults and the
        compass; profiles and stretches save on their own.
      </>}
      width="max-w-7xl"
      dirtyCount={dirtyCount}
      onSave={saveSettings}
      onDiscard={discardSettings}
      onReload={async () => { await Promise.all([load(), loadSettings()]); }}
      saveErrorMessage={(err) => (err instanceof Error && err.message ? err.message : apiRefusalReason(err) ?? 'The changes could not be saved.')}
      loading={loading && meta === null && !error}
      loadingLabel="Loading the road network…"
    >
      <SettingsSection title="Overview">
        <form className="flex flex-wrap items-end gap-2" onSubmit={applyWorld}>
          <Field label="World" hint="The world whose tiles and stretches are shown; remembered in this browser." className="w-full sm:w-auto">
            <input
              type="text"
              className="input px-2 py-1 sm:w-48"
              value={worldInput}
              onChange={(e) => setWorldInput(e.target.value)}
            />
          </Field>
          <button type="submit" className="btn-secondary text-sm sm:mb-5" disabled={loading || worldInput.trim() === '' || worldInput.trim() === world}>
            Switch world
          </button>
        </form>
        {!error && meta !== null && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-fg">
            <span><span className="font-semibold">{world}</span> - world</span>
            <span><span className="font-semibold">{tiles.length}</span> tiles{dirtyTiles > 0 && <span className="text-warning-strong"> ({dirtyTiles} dirty)</span>}</span>
            <span><span className="font-semibold">{meta?.components.length ?? 0}</span> components, <span className="font-semibold">{nodeCount}</span> nodes</span>
            <span><span className="font-semibold">{meta?.streets.length ?? 0}</span> streets labelled</span>
            <span><span className="font-semibold">{profiles.filter((p) => p.enabled).length}</span> of {profiles.length} profiles enabled</span>
          </div>
        )}
      </SettingsSection>

      {error ? (
        <p className="panel border-danger-line p-4 text-sm text-danger" role="alert">{error}</p>
      ) : (
        <>
          <RoadProfilesCard profiles={profiles} onChanged={handleProfilesChanged} />
          <RoadTilesCard tiles={tiles} onShowEdges={showTileEdges} />
          <div ref={edgesRef}>
            <RoadEdgesCard
              world={world}
              tiles={tiles}
              profiles={profiles}
              streets={meta?.streets ?? []}
              tileId={edgesTileId}
              onTileCleared={() => setEdgesTileId(null)}
              onStreetsChanged={handleStreetsChanged}
            />
          </div>
        </>
      )}

      <SettingsSection
        title={<span className="inline-flex items-center"><Navigation className="h-5 w-5 mr-2" aria-hidden="true" />Navigation defaults</span>}
        description={<NavigationDefaultsDescription />}
        changed={defaultChanges.length > 0}
      >
        <DomainNavigationDefaultsCard
          saved={defaults}
          drafts={defaultDrafts}
          loadError={defaultsError}
          onEdit={(domainType, change) => setDefaultDrafts((current) => ({
            ...current,
            [domainType]: { ...(current[domainType] as NavigationDefaultDraft), ...change },
          }))}
        />
      </SettingsSection>

      <SettingsSection
        title={<span className="inline-flex items-center"><Compass className="h-5 w-5 mr-2" aria-hidden="true" />Navigation compass</span>}
        description={<>
          An item players right-click to be guided: in a siege match it cycles through their team&apos;s objectives (the
          ones under attack first, then their own, then the other side&apos;s) and the team spawn; shift-click switches the
          guidance off and on. Any item with the material and display name below works as the compass, so an item handed
          out from an item blueprint with that material and default display name works at once. The game server picks
          changes up within about a minute.
        </>}
        changed={compassChanges.length > 0}
      >
        <NavigationCompassCard
          saved={compass}
          draft={compassDraft}
          loadError={compassError}
          onEdit={(change) => setCompassDraft((current) => (current ? { ...current, ...change } : current))}
        />
      </SettingsSection>
    </SettingsPage>
  );
};
