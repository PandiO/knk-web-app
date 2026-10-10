import React from 'react';
import { Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { roadClient } from '../../../apiClients/roadClient';
import { townClient } from '../../../apiClients/townClient';
import { SearchableDropdown } from '../../SearchableDropdown';
import { FeedbackModal } from '../../FeedbackModal';
import { toApiPagedQuery } from '../../../utils/entityApiMapping';
import { TownDto } from '../../../types/dtos/town/TownDto';
import { ROAD_CLASSES, ROAD_MATERIAL_ROLES, RoadClass, RoadMaterialRole, RoadProfileDto } from '../../../types/dtos/road/RoadDtos';
import { MaterialKeyInput } from './MaterialKeyInput';
import {
  MaterialDraft,
  ProfileDraft,
  emptyMaterialDraft,
  emptyProfileDraft,
  formatShare,
  parseProfileDraft,
  profileToDraft,
} from './roadProfileForm';

// docs/specs/navigation/DESIGN.md §3.1/§5.1/§7 - road profiles: what a kind of road is made of
// (materials with a role and an "ambiguous" flag), its class and cost for routing, the width the
// builder expects and where it applies (scope = towns, plan D8). Profiles are learned in game by
// survey walks (created as class Road, cost 1, no scope - Phase 3 decision 16); this editor is
// where an admin changes class, cost, scope, roles and flags. Survey shares and sample counts are
// read-only, and the accumulated statistics are never shown (plan D5).

/** Towns listed in the scope picker; a server with more lists the first ones by name. */
export const TOWN_PICKER_LIMIT = 1000;

type Editing = { id: number | null; name: string };

type ConfirmState = {
  title: string;
  message: string;
  status: 'info' | 'error';
  continueLabel: string;
  onContinue?: () => Promise<void>;
};

const saveErrorMessage = (err: unknown): string => {
  const status = (err as { status?: number } | null)?.status;
  const message = err instanceof Error ? err.message : null;
  return status !== undefined && status >= 400 && status < 500 && message ? message : 'Could not save this profile.';
};

const formatUpdated = (iso?: string | null): string => {
  if (!iso) return '-';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) || date.getFullYear() < 2000 ? '-' : date.toLocaleString();
};

const inputClass = 'border border-gray-300 rounded-md px-2 py-1 text-sm';

export const RoadProfilesCard: React.FC<{
  profiles: RoadProfileDto[];
  /** After a save or removal: reload the profiles. */
  onChanged: () => Promise<void> | void;
}> = ({ profiles, onChanged }) => {
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const [draft, setDraft] = React.useState<ProfileDraft | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<number | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null);

  const [towns, setTowns] = React.useState<TownDto[] | null>(null);
  const [townsError, setTownsError] = React.useState<string | null>(null);
  const [pickedTownId, setPickedTownId] = React.useState<number | undefined>(undefined);

  // Towns are only needed once the editor opens (the scope picker).
  React.useEffect(() => {
    if (!editing || towns !== null || townsError !== null) return;
    let cancelled = false;
    townClient
      .searchPaged(toApiPagedQuery({ page: 1, pageSize: TOWN_PICKER_LIMIT, sortBy: 'name' }))
      .then((result: { items?: TownDto[] } | null) => {
        if (!cancelled) setTowns((result?.items ?? []).filter((t) => t.id != null));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Failed to load towns:', err);
        setTownsError('Could not load the town list.');
      });
    return () => { cancelled = true; };
  }, [editing, towns, townsError]);

  const townName = (id: number) => towns?.find((t) => t.id === id)?.name ?? `Town #${id}`;

  const startEdit = (profile: RoadProfileDto) => {
    setEditing({ id: profile.id, name: profile.name });
    setDraft(profileToDraft(profile));
    setErrors([]);
  };

  const startAdd = () => {
    setEditing({ id: null, name: 'New profile' });
    setDraft(emptyProfileDraft());
    setErrors([]);
  };

  const stopEdit = () => {
    setEditing(null);
    setDraft(null);
    setErrors([]);
    setPickedTownId(undefined);
  };

  const update = (changes: Partial<ProfileDraft>) => {
    setDraft((current) => (current ? { ...current, ...changes } : current));
  };

  const updateMaterial = (index: number, changes: Partial<MaterialDraft>) => {
    setDraft((current) => {
      if (!current) return current;
      const materials = current.materials.map((m, i) => (i === index ? { ...m, ...changes } : m));
      return { ...current, materials };
    });
  };

  const removeMaterial = (index: number) => {
    setDraft((current) => (current ? { ...current, materials: current.materials.filter((_, i) => i !== index) } : current));
  };

  const addScopeTown = () => {
    if (pickedTownId === undefined || !draft) return;
    const scope = draft.scopeTownIds ?? [];
    if (!scope.includes(pickedTownId)) update({ scopeTownIds: [...scope, pickedTownId] });
    setPickedTownId(undefined);
  };

  const removeScopeTown = (id: number) => {
    if (!draft) return;
    const scope = (draft.scopeTownIds ?? []).filter((t) => t !== id);
    update({ scopeTownIds: scope.length > 0 ? scope : null });
  };

  const save = async () => {
    if (!editing || !draft) return;
    const parsed = parseProfileDraft(draft);
    if (!parsed.value) {
      setErrors(parsed.errors);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      if (editing.id === null) await roadClient.createProfile(parsed.value);
      else await roadClient.updateProfile(editing.id, parsed.value);
      stopEdit();
      await onChanged();
    } catch (err) {
      console.error('Failed to save road profile:', err);
      setErrors([saveErrorMessage(err)]);
    } finally {
      setSaving(false);
    }
  };

  const deleteProfile = async (profile: RoadProfileDto) => {
    setRemovingId(profile.id);
    try {
      await roadClient.deleteProfile(profile.id);
      if (editing?.id === profile.id) stopEdit();
      await onChanged();
    } catch (err) {
      console.error('Failed to delete road profile:', err);
      const message = saveErrorMessage(err);
      setConfirm({
        title: 'Delete failed',
        message: message === 'Could not save this profile.' ? 'Could not delete this profile.' : message,
        status: 'error',
        continueLabel: 'Close',
      });
      // FeedbackModal stays open on a thrown error, showing the failure set above.
      throw err;
    } finally {
      setRemovingId(null);
    }
  };

  // Destructive actions confirm through the app's FeedbackModal, like ObjectDashboard's delete.
  const remove = (profile: RoadProfileDto) => {
    setConfirm({
      title: 'Delete road profile',
      message: `Delete the road profile "${profile.name}"? Stretches matched to it lose their class until the next build.`,
      status: 'info',
      continueLabel: 'Delete',
      onContinue: () => deleteProfile(profile),
    });
  };

  const pickableTowns = (towns ?? [])
    .filter((t) => !(draft?.scopeTownIds ?? []).includes(t.id))
    .map((t) => ({ id: t.id, name: t.name }));

  const editor = editing && draft && (
    <div className="mt-4 border border-amber-200 bg-amber-50/40 rounded-lg p-4 space-y-4" data-testid="road-profile-editor">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{editing.id === null ? 'New profile' : `Edit "${editing.name}"`}</h3>
        <span className="text-xs text-gray-500">{draft.sampleCount.toLocaleString('en-US')} survey samples</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Name</span>
          <input type="text" className={`${inputClass} w-full`} value={draft.name} aria-label="Profile name" maxLength={100} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Class</span>
          <select className={`${inputClass} w-full`} value={draft.roadClass} aria-label="Profile class" onChange={(e) => update({ roadClass: e.target.value as RoadClass })}>
            {ROAD_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Cost multiplier</span>
          <input type="number" min={0} step="any" className={`${inputClass} w-full`} value={draft.costMultiplier} aria-label="Profile cost multiplier" onChange={(e) => update({ costMultiplier: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Width min (blocks)</span>
          <input type="number" min={1} step={1} className={`${inputClass} w-full`} value={draft.widthMin} aria-label="Profile width min" onChange={(e) => update({ widthMin: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Width max (blocks)</span>
          <input type="number" min={1} step={1} className={`${inputClass} w-full`} value={draft.widthMax} aria-label="Profile width max" onChange={(e) => update({ widthMax: e.target.value })} />
        </label>
        <label className="flex items-center gap-2 mt-5">
          <input type="checkbox" checked={draft.enabled} aria-label="Profile enabled" onChange={(e) => update({ enabled: e.target.checked })} />
          <span>Enabled (used by builds)</span>
        </label>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-600 mb-1">Scope</p>
        <p className="text-xs text-gray-500 mb-2">
          {draft.scopeTownIds === null
            ? 'Applies everywhere. Limit it to towns when this road block is another kingdom’s wall block.'
            : 'Applies only inside these towns.'}
        </p>
        {draft.scopeTownIds && (
          <div className="flex flex-wrap gap-2 mb-2">
            {draft.scopeTownIds.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-800">
                {townName(id)}
                <button type="button" className="text-gray-400 hover:text-red-600" aria-label={`Remove ${townName(id)} from scope`} onClick={() => removeScopeTown(id)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-72 max-w-full">
            <SearchableDropdown
              label="Town"
              instances={pickableTowns}
              selectedId={pickedTownId}
              onSelect={(id) => setPickedTownId(id ?? undefined)}
              loading={towns === null && !townsError}
              error={townsError ?? undefined}
            />
          </div>
          <button type="button" className="btn-secondary text-xs px-2 py-1" disabled={pickedTownId === undefined} onClick={addScopeTown}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add town
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-gray-600">Materials</p>
          <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={() => update({ materials: [...draft.materials, emptyMaterialDraft()] })}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add material
          </button>
        </div>
        {draft.materials.length === 0 ? (
          <p className="text-xs text-gray-500">No materials yet - a build cannot match this profile. Survey a road in game or add its blocks here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 text-xs text-gray-600">
                  <th className="py-1 pr-3">Material</th>
                  <th className="py-1 pr-3">Role</th>
                  <th className="py-1 pr-3" title="Also used for houses or kerbs; limited by the ambiguity reach">Ambiguous</th>
                  <th className="py-1 pr-3" title="Share of survey samples in the road centre">Centre</th>
                  <th className="py-1 pr-3" title="Share of survey samples at the road sides">Edge</th>
                  <th className="py-1 pr-3">Samples</th>
                  <th className="py-1 pr-3" />
                </tr>
              </thead>
              <tbody>
                {draft.materials.map((m, index) => {
                  const label = m.material || `Material ${index + 1}`;
                  return (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-1 pr-3">
                        <MaterialKeyInput value={m.material} label={`${label} material`} disabled={saving} onChange={(value) => updateMaterial(index, { material: value })} />
                      </td>
                      <td className="py-1 pr-3">
                        <select className={inputClass} value={m.role} aria-label={`${label} role`} onChange={(e) => updateMaterial(index, { role: e.target.value as RoadMaterialRole })}>
                          {ROAD_MATERIAL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="py-1 pr-3">
                        <input type="checkbox" checked={m.ambiguous} aria-label={`${label} ambiguous`} onChange={(e) => updateMaterial(index, { ambiguous: e.target.checked })} />
                      </td>
                      <td className="py-1 pr-3 text-gray-500">{formatShare(m.centreShare)}</td>
                      <td className="py-1 pr-3 text-gray-500">{formatShare(m.edgeShare)}</td>
                      <td className="py-1 pr-3 text-gray-500">{m.samples.toLocaleString('en-US')}</td>
                      <td className="py-1 pr-3 text-right">
                        <button type="button" className="text-gray-400 hover:text-red-600" aria-label={`Remove ${label}`} onClick={() => removeMaterial(index)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div>
          {errors.map((error) => <p key={error} className="text-xs text-red-600">{error}</p>)}
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" className="btn-primary text-sm inline-flex items-center" disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          {editing.id === null ? 'Create profile' : 'Save profile'}
        </button>
        <button type="button" className="btn-secondary text-sm inline-flex items-center" disabled={saving} onClick={stopEdit}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Road profiles</h2>
          <p className="mt-1 text-sm text-gray-500">
            What roads are made of. Survey walks in game (<code className="text-xs bg-gray-100 px-1 rounded">/knk road survey</code>) learn
            materials and widths; set the class, cost, scope, roles and ambiguous flags here.
          </p>
        </div>
        <button type="button" className="btn-primary text-sm" disabled={editing !== null} onClick={startAdd}>
          <Plus className="h-4 w-4 mr-2" />
          New profile
        </button>
      </div>

      {profiles.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No road profiles - builds need at least one enabled profile.</p>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Class</th>
                <th className="py-2 pr-4">Cost</th>
                <th className="py-2 pr-4">Width</th>
                <th className="py-2 pr-4">Materials</th>
                <th className="py-2 pr-4">Samples</th>
                <th className="py-2 pr-4">Scope</th>
                <th className="py-2 pr-4">Enabled</th>
                <th className="py-2 pr-4">Updated</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const materials = profile.materials ?? [];
                const shown = materials.slice(0, 4).map((m) => m.material).join(', ');
                return (
                  <tr key={profile.id} className={`border-b border-gray-100 ${editing?.id === profile.id ? 'bg-amber-50/40' : ''}`}>
                    <td className="py-2 pr-4 font-medium text-gray-900">{profile.name}</td>
                    <td className="py-2 pr-4 text-gray-700">{profile.roadClass}</td>
                    <td className="py-2 pr-4 text-gray-700">{`×${profile.costMultiplier}`}</td>
                    <td className="py-2 pr-4 text-gray-700 whitespace-nowrap">{profile.widthMin === profile.widthMax ? profile.widthMin : `${profile.widthMin} – ${profile.widthMax}`}</td>
                    <td className="py-2 pr-4 text-gray-700 text-xs font-mono" title={materials.map((m) => `${m.material} (${m.role}${m.ambiguous ? ', ambiguous' : ''})`).join('\n')}>
                      {materials.length === 0 ? <span className="text-gray-400 font-sans">none</span> : `${shown}${materials.length > 4 ? ` +${materials.length - 4}` : ''}`}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">{profile.sampleCount.toLocaleString('en-US')}</td>
                    <td className="py-2 pr-4 text-gray-700">
                      {profile.scopeTownIds && profile.scopeTownIds.length > 0
                        ? `${profile.scopeTownIds.length} town${profile.scopeTownIds.length === 1 ? '' : 's'}`
                        : <span className="text-gray-400">Everywhere</span>}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${profile.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                        {profile.enabled ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-500 text-xs whitespace-nowrap">{formatUpdated(profile.updatedAt)}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          className="text-gray-500 hover:text-gray-900 disabled:opacity-40"
                          title="Edit"
                          aria-label={`Edit ${profile.name} profile`}
                          disabled={saving || editing !== null}
                          onClick={() => startEdit(profile)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-red-600 disabled:opacity-40"
                          title="Delete profile"
                          aria-label={`Delete ${profile.name} profile`}
                          disabled={removingId !== null}
                          onClick={() => remove(profile)}
                        >
                          {removingId === profile.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editor}

      <FeedbackModal
        open={confirm !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        status={confirm?.status ?? 'info'}
        continueLabel={confirm?.continueLabel}
        onContinue={confirm?.onContinue}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
};
