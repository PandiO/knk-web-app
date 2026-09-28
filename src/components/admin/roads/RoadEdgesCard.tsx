import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Save, X } from 'lucide-react';
import { roadClient } from '../../../apiClients/roadClient';
import { streetClient } from '../../../apiClients/streetClient';
import { SearchableDropdown } from '../../SearchableDropdown';
import { toApiPagedQuery } from '../../../utils/entityApiMapping';
import { StreetDto } from '../../../types/dtos/street/StreetDto';
import {
  ROAD_EDGE_FLAGS,
  RoadEdgeDto,
  RoadEdgeSearchQuery,
  RoadEdgeUpdateDto,
  RoadPagedResultDto,
  RoadProfileDto,
  RoadStreetRefDto,
  RoadTileDto,
  formatRoadFlags,
} from '../../../types/dtos/road/RoadDtos';

// docs/specs/navigation/DESIGN.md §3.6 / §7.1 D-E - the edge table: every road stretch of the
// world, server-paged (POST api/road-edges/search), with the review actions an admin does from
// a desk: the street label (with "continue along the road", which carries it through straight
// junctions - DESIGN §5.11), a class override, the cost multiplier and the static flags. Street
// names live on the Street entity: "Create street…" uses the existing Street API and "Rename"
// opens the existing Street form, so renaming reaches navigation messages within a minute.

/** Rows per page; decision 2 - a small default, the admin can widen it. */
export const EDGE_PAGE_SIZES = [25, 50, 100] as const;
/** Streets listed in the picker; a server with more lists the first ones by name. */
export const STREET_PICKER_LIMIT = 1000;

type SortBy = NonNullable<RoadEdgeSearchQuery['sortBy']>;

type Draft = {
  streetId: number | null;
  propagate: boolean;
  profileId: number | null;
  costMultiplier: string;
  flags: string[];
};

const draftOf = (edge: RoadEdgeDto): Draft => ({
  streetId: edge.streetId,
  propagate: true,
  profileId: edge.profileId,
  costMultiplier: String(edge.costMultiplier),
  flags: [...edge.flags],
});

/** The PUT body for the fields that changed, or what is wrong with the draft. */
export function edgeUpdateFrom(edge: RoadEdgeDto, draft: Draft): { value?: RoadEdgeUpdateDto; errors: string[] } {
  const errors: string[] = [];
  const update: RoadEdgeUpdateDto = {};
  if (draft.streetId !== edge.streetId) {
    if (draft.streetId === null) update.clearStreet = true;
    else {
      update.streetId = draft.streetId;
      update.propagate = draft.propagate;
    }
  }
  if (draft.profileId !== edge.profileId) {
    if (draft.profileId === null) update.clearProfile = true;
    else update.profileId = draft.profileId;
  }
  const costText = draft.costMultiplier.trim();
  const cost = Number(costText);
  if (costText === '' || !Number.isFinite(cost)) errors.push('Cost multiplier must be a number.');
  else if (cost <= 0) errors.push('Cost multiplier must be greater than 0.');
  else if (cost !== edge.costMultiplier) update.costMultiplier = cost;
  const flags = ROAD_EDGE_FLAGS.filter((f) => draft.flags.includes(f));
  const current = ROAD_EDGE_FLAGS.filter((f) => edge.flags.includes(f));
  if (flags.join(',') !== current.join(',')) update.flags = flags;
  if (errors.length > 0) return { errors };
  return { errors, value: update };
}

const saveErrorMessage = (err: unknown, fallback: string): string => {
  const status = (err as { status?: number } | null)?.status;
  const message = err instanceof Error ? err.message : null;
  return status !== undefined && status >= 400 && status < 500 && message ? message : fallback;
};

const formatLength = (length: number): string => `${Math.round(length).toLocaleString('en-US')}`;

const inputClass = 'border border-gray-300 rounded-md px-2 py-1 text-sm';

export const RoadEdgesCard: React.FC<{
  world: string;
  tiles: RoadTileDto[];
  profiles: RoadProfileDto[];
  /** The streets some edge of this world is labelled with (meta) - the filter's choices. */
  streets: RoadStreetRefDto[];
  /** Limit the table to one tile (from the tile overview); null = every tile. */
  tileId: number | null;
  onTileCleared: () => void;
  /** A street label changed: the page reloads the labelled-streets list. */
  onStreetsChanged?: () => Promise<void> | void;
}> = ({ world, tiles, profiles, streets, tileId, onTileCleared, onStreetsChanged }) => {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(EDGE_PAGE_SIZES[0]);
  const [sortBy, setSortBy] = React.useState<SortBy>('id');
  const [sortDescending, setSortDescending] = React.useState(false);
  const [unlabelledOnly, setUnlabelledOnly] = React.useState(false);
  const [staleOnly, setStaleOnly] = React.useState(false);
  const [streetFilter, setStreetFilter] = React.useState<number | null>(null);

  const [result, setResult] = React.useState<RoadPagedResultDto<RoadEdgeDto> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Every street, for the picker (loaded when the first edit starts) - the filter only needs
  // the labelled ones.
  const [allStreets, setAllStreets] = React.useState<StreetDto[] | null>(null);
  const [streetsError, setStreetsError] = React.useState<string | null>(null);
  const [creatingStreet, setCreatingStreet] = React.useState(false);
  const [newStreetName, setNewStreetName] = React.useState('');
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [createSaving, setCreateSaving] = React.useState(false);

  // A new world or tile starts at page 1 (the filter controls below reset it themselves).
  React.useEffect(() => {
    setPage(1);
  }, [world, tileId]);

  const query = React.useMemo<RoadEdgeSearchQuery>(() => {
    const filters: NonNullable<RoadEdgeSearchQuery['filters']> = { world };
    if (tileId !== null) filters.tileId = String(tileId);
    if (streetFilter !== null) filters.streetId = String(streetFilter);
    if (unlabelledOnly) filters.unlabelled = 'true';
    if (staleOnly) filters.stale = 'true';
    return { pageNumber: page, pageSize, sortBy, sortDescending, filters };
  }, [world, tileId, streetFilter, unlabelledOnly, staleOnly, page, pageSize, sortBy, sortDescending]);

  const [refresh, setRefresh] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    roadClient
      .searchEdges(query)
      .then((found) => {
        if (cancelled) return;
        setResult(found);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Failed to search road edges:', err);
        setError('Could not load the road stretches.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [query, refresh]);

  React.useEffect(() => {
    if (editingId === null || allStreets !== null || streetsError !== null) return;
    let cancelled = false;
    streetClient
      .searchPaged(toApiPagedQuery({ page: 1, pageSize: STREET_PICKER_LIMIT, sortBy: 'name' }))
      .then((found: { items?: StreetDto[] } | null) => {
        if (!cancelled) setAllStreets((found?.items ?? []).filter((s) => s.id != null));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Failed to load streets:', err);
        setStreetsError('Could not load the street list.');
      });
    return () => { cancelled = true; };
  }, [editingId, allStreets, streetsError]);

  const streetNames = React.useMemo(() => {
    const names = new Map<number, string>();
    streets.forEach((s) => names.set(s.id, s.name));
    (allStreets ?? []).forEach((s) => names.set(s.id, s.name));
    return names;
  }, [streets, allStreets]);
  const streetName = (id: number | null): string | null => (id === null ? null : streetNames.get(id) ?? `Street #${id}`);

  const tileLabels = React.useMemo(() => new Map(tiles.map((t) => [t.id, `${t.tileX}, ${t.tileZ}`])), [tiles]);
  const tileLabel = (id: number) => tileLabels.get(id) ?? `#${id}`;

  const profileById = React.useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const startEdit = (edge: RoadEdgeDto) => {
    setEditingId(edge.id);
    setDraft(draftOf(edge));
    setErrors([]);
    setNotice(null);
    setCreatingStreet(false);
  };

  const stopEdit = () => {
    setEditingId(null);
    setDraft(null);
    setErrors([]);
    setCreatingStreet(false);
    setNewStreetName('');
    setCreateError(null);
  };

  const save = async (edge: RoadEdgeDto) => {
    if (!draft) return;
    const parsed = edgeUpdateFrom(edge, draft);
    if (!parsed.value) {
      setErrors(parsed.errors);
      return;
    }
    if (Object.keys(parsed.value).length === 0) {
      stopEdit();
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const saved = await roadClient.updateEdge(edge.id, parsed.value);
      const others = saved.changedEdgeIds.filter((id) => id !== edge.id).length;
      const street = parsed.value.streetId !== undefined ? streetName(parsed.value.streetId) : null;
      setNotice(
        others > 0
          ? `Stretch #${edge.id} saved; "${street}" continued along the road onto ${others} more stretch${others === 1 ? '' : 'es'}.`
          : `Stretch #${edge.id} saved.`,
      );
      stopEdit();
      // Propagated labels may sit on this page too: search again rather than patch one row.
      setRefresh((n) => n + 1);
      if (parsed.value.streetId !== undefined || parsed.value.clearStreet) await onStreetsChanged?.();
    } catch (err) {
      console.error('Failed to save road edge:', err);
      setErrors([saveErrorMessage(err, 'Could not save this stretch.')]);
    } finally {
      setSaving(false);
    }
  };

  const createStreet = async () => {
    const name = newStreetName.trim();
    if (!name) {
      setCreateError('Street name is required.');
      return;
    }
    setCreateSaving(true);
    setCreateError(null);
    try {
      const created = await streetClient.create({ name });
      setAllStreets((current) => [...(current ?? []), created]);
      setDraft((current) => (current ? { ...current, streetId: created.id } : current));
      setCreatingStreet(false);
      setNewStreetName('');
    } catch (err) {
      console.error('Failed to create street:', err);
      setCreateError(saveErrorMessage(err, 'Could not create the street.'));
    } finally {
      setCreateSaving(false);
    }
  };

  const total = result?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  const editRow = (edge: RoadEdgeDto) => {
    if (!draft) return null;
    const pickable = (allStreets ?? []).map((s) => ({ id: s.id, name: s.name }));
    const streetChanged = draft.streetId !== edge.streetId && draft.streetId !== null;
    return (
      <React.Fragment key={edge.id}>
        <tr className="border-b border-gray-100 bg-amber-50/40 align-top">
          <td className="py-2 pr-4 text-gray-900 font-medium">#{edge.id}</td>
          <td className="py-2 pr-4 text-gray-700 whitespace-nowrap">{tileLabel(edge.tileId)}</td>
          <td className="py-2 pr-4" colSpan={2}>
            <div className="w-72 max-w-full">
              <SearchableDropdown
                label="Street"
                instances={pickable}
                selectedId={draft.streetId ?? undefined}
                onSelect={(id) => setDraft({ ...draft, streetId: id })}
                onCreateNew={() => { setCreatingStreet(true); setCreateError(null); }}
                loading={allStreets === null && !streetsError}
                error={streetsError ?? undefined}
              />
            </div>
            {creatingStreet && (
              <div className="mt-2 flex flex-wrap items-end gap-2" data-testid="create-street-form">
                <label className="block text-xs text-gray-600">
                  New street name
                  <input
                    type="text"
                    className={`${inputClass} block w-56 mt-1`}
                    value={newStreetName}
                    aria-label="New street name"
                    disabled={createSaving}
                    onChange={(e) => setNewStreetName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void createStreet(); } }}
                  />
                </label>
                <button type="button" className="btn-primary text-xs px-2 py-1 inline-flex items-center" disabled={createSaving} onClick={() => void createStreet()}>
                  {createSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                  Create street
                </button>
                <button type="button" className="btn-secondary text-xs px-2 py-1" disabled={createSaving} onClick={() => { setCreatingStreet(false); setCreateError(null); }}>
                  Cancel
                </button>
                {createError && <p className="w-full text-xs text-red-600">{createError}</p>}
              </div>
            )}
            <label className={`mt-2 flex items-center gap-2 text-xs ${streetChanged ? 'text-gray-700' : 'text-gray-400'}`} title="Also label the stretches that continue this one through straight junctions, until a stretch with another admin-set street">
              <input type="checkbox" checked={draft.propagate} disabled={!streetChanged} aria-label="Continue along the road" onChange={(e) => setDraft({ ...draft, propagate: e.target.checked })} />
              Continue along the road
            </label>
          </td>
          <td className="py-2 pr-4">
            <select className={inputClass} value={draft.profileId ?? ''} aria-label={`Stretch ${edge.id} profile`} onChange={(e) => setDraft({ ...draft, profileId: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">None</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.roadClass})</option>)}
            </select>
          </td>
          <td className="py-2 pr-4 text-gray-700 text-right">{formatLength(edge.length)}</td>
          <td className="py-2 pr-4 text-gray-700 text-right">{edge.avgWidth.toFixed(1)}</td>
          <td className="py-2 pr-4">
            <input type="number" min={0} step="any" className={`${inputClass} w-20`} value={draft.costMultiplier} aria-label={`Stretch ${edge.id} cost multiplier`} onChange={(e) => setDraft({ ...draft, costMultiplier: e.target.value })} />
          </td>
          <td className="py-2 pr-4">
            <div className="flex flex-col gap-1 text-xs text-gray-700">
              {ROAD_EDGE_FLAGS.map((flag) => (
                <label key={flag} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={draft.flags.includes(flag)}
                    aria-label={`Stretch ${edge.id} ${flag}`}
                    onChange={(e) => setDraft({ ...draft, flags: e.target.checked ? [...draft.flags, flag] : draft.flags.filter((f) => f !== flag) })}
                  />
                  {flag}
                </label>
              ))}
            </div>
          </td>
          <td className="py-2 pr-4 text-gray-500 text-xs">{edge.source}{edge.status === 'Stale' ? ' · stale' : ''}</td>
          <td className="py-2 pr-4 text-right whitespace-nowrap">
            <div className="inline-flex gap-1">
              <button type="button" className="btn-primary text-xs px-2 py-1 inline-flex items-center" disabled={saving} onClick={() => void save(edge)}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Save
              </button>
              <button type="button" className="btn-secondary text-xs px-2 py-1 inline-flex items-center" disabled={saving} onClick={stopEdit}>
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </button>
            </div>
          </td>
        </tr>
        {errors.length > 0 && (
          <tr>
            <td colSpan={11} className="pb-2">
              {errors.map((e) => <p key={e} className="text-xs text-red-600">{e}</p>)}
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Stretches</h2>
          <p className="mt-1 text-sm text-gray-500">
            The road network&apos;s edges. Name the ones the build could not label from their buildings, override a
            class, tune a cost, close a road or hide it from guidance. Names are the Street entity&apos;s - rename there.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-700">
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={unlabelledOnly} aria-label="Unlabelled stretches only" onChange={(e) => { setUnlabelledOnly(e.target.checked); setPage(1); }} />
          Unlabelled only
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={staleOnly} aria-label="Stale stretches only" onChange={(e) => { setStaleOnly(e.target.checked); setPage(1); }} />
          Stale only
        </label>
        <label className="inline-flex items-center gap-1.5">
          Street
          <select className={inputClass} value={streetFilter ?? ''} aria-label="Street filter" onChange={(e) => { setStreetFilter(e.target.value === '' ? null : Number(e.target.value)); setPage(1); }}>
            <option value="">Any</option>
            {streets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        {tileId !== null && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-800">
            Tile {tileLabel(tileId)}
            <button type="button" className="text-gray-400 hover:text-red-600" aria-label="Show every tile" onClick={onTileCleared}>
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
        <label className="inline-flex items-center gap-1.5 ml-auto">
          Sort by
          <select className={inputClass} value={sortBy} aria-label="Sort stretches by" onChange={(e) => { setSortBy(e.target.value as SortBy); setPage(1); }}>
            <option value="id">Id</option>
            <option value="length">Length</option>
            <option value="streetId">Street</option>
            <option value="tileId">Tile</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={sortDescending} aria-label="Sort descending" onChange={(e) => { setSortDescending(e.target.checked); setPage(1); }} />
          Descending
        </label>
        <label className="inline-flex items-center gap-1.5">
          Per page
          <select className={inputClass} value={pageSize} aria-label="Stretches per page" onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {EDGE_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>

      {notice && <p className="mt-3 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">{notice}</p>}

      {error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : loading && result === null ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : (result?.items.length ?? 0) === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No stretches match.</p>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="py-2 pr-4">Id</th>
                <th className="py-2 pr-4">Tile</th>
                <th className="py-2 pr-4">Street</th>
                <th className="py-2 pr-4" title="Inferred from the buildings along it, or set by an admin">Label</th>
                <th className="py-2 pr-4">Profile</th>
                <th className="py-2 pr-4 text-right" title="Walked length in blocks">Length</th>
                <th className="py-2 pr-4 text-right">Width</th>
                <th className="py-2 pr-4">Cost</th>
                <th className="py-2 pr-4">Flags</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {result?.items.map((edge) => {
                if (editingId === edge.id) return editRow(edge);
                const name = streetName(edge.streetId);
                const profile = edge.profileId === null ? null : profileById.get(edge.profileId);
                return (
                  <tr key={edge.id} className={`border-b border-gray-100 ${edge.status === 'Stale' ? 'text-gray-500' : ''}`}>
                    <td className="py-2 pr-4 text-gray-900 font-medium">#{edge.id}</td>
                    <td className="py-2 pr-4 text-gray-700 whitespace-nowrap">{tileLabel(edge.tileId)}</td>
                    <td className="py-2 pr-4">
                      {name === null ? (
                        <span className="text-gray-400 italic">unlabelled</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-gray-900">{name}</span>
                          <Link to={`/forms/street/edit/${edge.streetId}`} className="text-xs text-primary hover:underline" title="Rename in the Street form">Rename</Link>
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {edge.streetSource === 'Manual' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Manual</span>
                      ) : edge.streetSource === 'Inferred' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Inferred</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {profile ? `${profile.name} (${profile.roadClass})` : edge.profileId !== null ? `Profile #${edge.profileId}` : <span className="text-gray-400">none</span>}
                    </td>
                    <td className="py-2 pr-4 text-gray-700 text-right">{formatLength(edge.length)}</td>
                    <td className="py-2 pr-4 text-gray-700 text-right">{edge.avgWidth.toFixed(1)}</td>
                    <td className="py-2 pr-4 text-gray-700">{edge.costMultiplier === 1 ? <span className="text-gray-400">×1</span> : `×${edge.costMultiplier}`}</td>
                    <td className="py-2 pr-4 text-gray-700">
                      {edge.flags.includes('Closed') ? <span className="text-red-700 font-medium">{formatRoadFlags(edge.flags)}</span> : formatRoadFlags(edge.flags)}
                    </td>
                    <td className="py-2 pr-4 text-gray-500 text-xs whitespace-nowrap">
                      {edge.source}
                      {edge.status === 'Stale' && <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">stale</span>}
                      {edge.gateDoorIds.length > 0 && <span className="ml-1" title={`Gate doors ${edge.gateDoorIds.join(', ')}`}>· gate</span>}
                    </td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="text-gray-500 hover:text-gray-900 inline-flex items-center text-xs disabled:opacity-40"
                        disabled={saving || editingId !== null}
                        onClick={() => startEdit(edge)}
                        aria-label={`Edit stretch ${edge.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!error && total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>{first.toLocaleString('en-US')} – {last.toLocaleString('en-US')} of {total.toLocaleString('en-US')} stretches{loading ? ' …' : ''}</span>
          <div className="inline-flex items-center gap-2">
            <button type="button" className="btn-secondary text-xs px-2 py-1 inline-flex items-center" disabled={page <= 1 || loading} aria-label="Previous page" onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span>Page {page} of {pageCount}</span>
            <button type="button" className="btn-secondary text-xs px-2 py-1 inline-flex items-center" disabled={page >= pageCount || loading} aria-label="Next page" onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
