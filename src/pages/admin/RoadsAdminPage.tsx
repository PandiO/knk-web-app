import React from 'react';
import { Loader2, RefreshCcw, Route } from 'lucide-react';
import { roadClient } from '../../apiClients/roadClient';
import { RoadNetworkMetaDto, RoadProfileDto, RoadTileDto } from '../../types/dtos/road/RoadDtos';

// docs/specs/navigation/DESIGN.md §7 / IMPLEMENTATION_PLAN.md Phase 5 - the road network's admin
// page (knk.admin.road, see the /admin/roads route): road profiles (what roads are made of), the
// per-world tile overview (what was built, what is dirty, build warnings) and the edge table
// (street labels, class, cost, flags). Everything in-world (surveys, builds, the overlay) is the
// plugin's `/knk road` command; this page is for naming, labelling, profiles, tuning and overviews.
// Street names stay on the Street entity: an edge only references a street by id.

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

  const nodeCount = meta?.components.reduce((sum, c) => sum + c.nodeCount, 0) ?? 0;
  const dirtyTiles = tiles.filter((t) => t.dirty).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Route className="h-6 w-6 mr-2" />
              Road network
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Road profiles, the built tiles of a world and its road stretches. Surveys, builds and the
              in-world overlay are <code className="text-xs bg-gray-100 px-1 rounded">/knk road</code>.
            </p>
          </div>
          <form className="flex flex-wrap items-end gap-2" onSubmit={applyWorld}>
            <label className="text-sm text-gray-700">
              <span className="block text-xs font-medium text-gray-500 mb-1">World</span>
              <input
                type="text"
                className="border border-gray-300 rounded-md px-2 py-1 text-sm w-40"
                value={worldInput}
                aria-label="World"
                onChange={(e) => setWorldInput(e.target.value)}
              />
            </label>
            <button type="submit" className="btn-secondary text-sm" disabled={loading || worldInput.trim() === '' || worldInput.trim() === world}>
              Switch world
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => void load()} disabled={loading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Reload
            </button>
          </form>
        </div>

        {loading && meta === null ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 bg-white border border-red-200 rounded-lg p-4">{error}</p>
        ) : (
          <>
            <div className="bg-white shadow-sm rounded-lg p-4 border border-gray-200 flex flex-wrap gap-6 text-sm text-gray-700">
              <span><span className="font-semibold text-gray-900">{world}</span> - world</span>
              <span><span className="font-semibold text-gray-900">{tiles.length}</span> tiles{dirtyTiles > 0 && <span className="text-amber-700"> ({dirtyTiles} dirty)</span>}</span>
              <span><span className="font-semibold text-gray-900">{meta?.components.length ?? 0}</span> components, <span className="font-semibold text-gray-900">{nodeCount}</span> nodes</span>
              <span><span className="font-semibold text-gray-900">{meta?.streets.length ?? 0}</span> streets labelled</span>
              <span><span className="font-semibold text-gray-900">{profiles.filter((p) => p.enabled).length}</span> of {profiles.length} profiles enabled</span>
            </div>
            {/* ROADS_CARDS */}
          </>
        )}
      </div>
    </div>
  );
};
