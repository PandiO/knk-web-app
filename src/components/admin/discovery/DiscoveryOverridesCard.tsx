import React from 'react';
import { Eye, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { discoveryClient } from '../../../apiClients/discoveryClient';
import { DomainClient } from '../../../apiClients/domainClient';
import { SearchableDropdown } from '../../SearchableDropdown';
import { toApiPagedQuery } from '../../../utils/entityApiMapping';
import { DomainListDto } from '../../../types/dtos/domain/DomainDtos';
import {
  DISCOVERY_DOMAIN_TYPES,
  DiscoveryRewardRuleDto,
  DomainDiscoveryOverrideDto,
  discoveryTypeLabel,
} from '../../../types/dtos/discovery/DiscoveryDtos';
import { OverrideDraft, RANGES, overrideToDraft, parseOverrideDraft } from './discoveryRuleForm';
import { RangeInputs, formatRange } from './DiscoveryRulesCard';

// docs/specs/domain-discovery/DESIGN.md §3.1/§3.9 (3) - per-domain overrides: any field left blank
// inherits the domain type's rule, so one landmark can pay more or one structure be made
// undiscoverable. Domains are picked from the domain list (SearchableDropdown).

/** Domains listed in the picker; a server with more lists the first ones by name. */
export const DOMAIN_PICKER_LIMIT = 1000;

type Editing = { domainId: number; name: string; domainType: string; isNew: boolean };

const inheritedBool = (own: boolean | null | undefined, inherited: boolean | undefined) =>
  own === null || own === undefined
    ? <span className="text-gray-400" title="Inherited from the type rule">{inherited ? 'Yes' : 'No'}</span>
    : <span className="font-medium text-gray-900">{own ? 'Yes' : 'No'}</span>;

export const DiscoveryOverridesCard: React.FC<{
  overrides: DomainDiscoveryOverrideDto[];
  rules: DiscoveryRewardRuleDto[];
  /** After a save or removal: reload the overrides (and the preview). */
  onChanged: () => Promise<void> | void;
  onPreview: (domainId: number) => void;
}> = ({ overrides, rules, onChanged, onPreview }) => {
  const [domains, setDomains] = React.useState<DomainListDto[] | null>(null);
  const [domainsError, setDomainsError] = React.useState<string | null>(null);
  const [pickedDomainId, setPickedDomainId] = React.useState<number | undefined>(undefined);

  const [editing, setEditing] = React.useState<Editing | null>(null);
  const [draft, setDraft] = React.useState<OverrideDraft | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<number | null>(null);
  const [removeError, setRemoveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    DomainClient.getInstance()
      .searchPaged(toApiPagedQuery({ page: 1, pageSize: DOMAIN_PICKER_LIMIT, sortBy: 'name' }))
      .then((result: { items?: DomainListDto[] } | null) => {
        if (cancelled) return;
        const discoverable = new Set<string>(DISCOVERY_DOMAIN_TYPES);
        setDomains((result?.items ?? []).filter((d) => d.id != null && discoverable.has(d.domainType)));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Failed to load domains:', err);
        setDomainsError('Could not load the domain list.');
      });
    return () => { cancelled = true; };
  }, []);

  const ruleFor = (domainType?: string | null) => rules.find((r) => r.domainType === domainType);

  const overriddenIds = new Set(overrides.map((o) => o.domainId));
  const pickable = (domains ?? [])
    .filter((d) => !overriddenIds.has(d.id!))
    .map((d) => ({ id: d.id!, name: `${d.name} (${discoveryTypeLabel(d.domainType)})` }));

  const startEdit = (next: Editing, domainOverride?: DomainDiscoveryOverrideDto) => {
    setEditing(next);
    setDraft(overrideToDraft(domainOverride));
    setErrors([]);
  };

  const startAdd = () => {
    const domain = domains?.find((d) => d.id === pickedDomainId);
    if (!domain || domain.id == null) return;
    startEdit({ domainId: domain.id, name: domain.name, domainType: domain.domainType, isNew: true });
    setPickedDomainId(undefined);
  };

  const stopEdit = () => {
    setEditing(null);
    setDraft(null);
    setErrors([]);
  };

  const save = async () => {
    if (!editing || !draft) return;
    const parsed = parseOverrideDraft(draft, ruleFor(editing.domainType));
    if (!parsed.value) {
      setErrors(parsed.errors);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      await discoveryClient.upsertOverride(editing.domainId, parsed.value);
      stopEdit();
      await onChanged();
    } catch (err) {
      console.error('Failed to save discovery override:', err);
      const status = (err as { status?: number } | null)?.status;
      const message = err instanceof Error ? err.message : null;
      setErrors([status !== undefined && status >= 400 && status < 500 && message ? message : 'Could not save this override.']);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (domainOverride: DomainDiscoveryOverrideDto) => {
    const name = domainOverride.domainName ?? `domain #${domainOverride.domainId}`;
    if (!window.confirm(`Remove the discovery override of ${name}? It will use the ${discoveryTypeLabel(domainOverride.domainType ?? '')} rule again.`)) {
      return;
    }
    setRemovingId(domainOverride.domainId);
    setRemoveError(null);
    try {
      await discoveryClient.deleteOverride(domainOverride.domainId);
      if (editing?.domainId === domainOverride.domainId) stopEdit();
      await onChanged();
    } catch (err) {
      console.error('Failed to remove discovery override:', err);
      setRemoveError('Could not remove this override.');
    } finally {
      setRemovingId(null);
    }
  };

  const editRow = (key: React.Key) => {
    if (!editing || !draft) return null;
    const rule = ruleFor(editing.domainType);
    const label = editing.name;
    const triSelect = (field: 'isEnabled' | 'includeAncestors', inherited: boolean | undefined, aria: string) => (
      <select
        className="border border-gray-300 rounded-md px-1.5 py-1 text-sm"
        value={draft[field]}
        aria-label={aria}
        onChange={(e) => setDraft({ ...draft, [field]: e.target.value as OverrideDraft[typeof field] })}
      >
        <option value="">Inherit ({inherited ? 'Yes' : 'No'})</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
    return (
      <React.Fragment key={key}>
        <tr className="border-b border-gray-100 bg-amber-50/40">
          <td className="py-2 pr-4">
            <p className="font-medium text-gray-900">{editing.name}</p>
            <p className="text-xs text-gray-500">{discoveryTypeLabel(editing.domainType)}{editing.isNew && ' - new override'}</p>
          </td>
          <td className="py-2 pr-4">{triSelect('isEnabled', rule?.isEnabled, `${label} enabled`)}</td>
          {RANGES.map((range) => (
            <td key={range.key} className="py-2 pr-4">
              <RangeInputs
                rangeKey={range.key}
                label={`${label} ${range.label}`}
                min={draft[`${range.key}Min`]}
                max={draft[`${range.key}Max`]}
                placeholders={{ min: String(rule?.[`${range.key}Min`] ?? ''), max: String(rule?.[`${range.key}Max`] ?? '') }}
                onChange={(field, value) => setDraft({ ...draft, [field]: value })}
              />
            </td>
          ))}
          <td className="py-2 pr-4">
            {editing.domainType === 'Town' ? '-' : triSelect('includeAncestors', rule?.includeAncestors, `${label} discovers parents`)}
          </td>
          <td className="py-2 pr-4 text-right whitespace-nowrap">
            <div className="inline-flex gap-1">
              <button className="btn-primary text-xs px-2 py-1 inline-flex items-center" disabled={saving} onClick={() => void save()}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Save
              </button>
              <button className="btn-secondary text-xs px-2 py-1 inline-flex items-center" disabled={saving} onClick={stopEdit}>
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </button>
            </div>
          </td>
        </tr>
        <tr>
          <td colSpan={RANGES.length + 4} className="pb-2 text-xs">
            <p className="text-gray-500">Leave a field blank to inherit the {discoveryTypeLabel(editing.domainType)} rule (shown greyed out).</p>
            {errors.map((error) => <p key={error} className="text-red-600">{error}</p>)}
          </td>
        </tr>
      </React.Fragment>
    );
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900">Per-domain overrides</h2>
      <p className="mt-1 mb-4 text-sm text-gray-500">
        Change one place&apos;s reward or switch its discovery off. Blank fields follow its type&apos;s rule.
      </p>

      {overrides.length === 0 && !editing ? (
        <p className="text-sm text-gray-500 mb-4">No overrides - every domain uses its type&apos;s rule.</p>
      ) : (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="py-2 pr-4">Domain</th>
                <th className="py-2 pr-4">Enabled</th>
                {RANGES.map((range) => <th key={range.key} className="py-2 pr-4">{range.label}</th>)}
                <th className="py-2 pr-4">Discovers parents</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {overrides.map((o) => {
                if (editing?.domainId === o.domainId) return editRow(o.domainId);
                const rule = ruleFor(o.domainType);
                const name = o.domainName ?? `Domain #${o.domainId}`;
                return (
                  <tr key={o.domainId} className="border-b border-gray-100">
                    <td className="py-2 pr-4">
                      <p className="font-medium text-gray-900">{name}</p>
                      <p className="text-xs text-gray-500">{o.domainType ? discoveryTypeLabel(o.domainType) : '-'}</p>
                    </td>
                    <td className="py-2 pr-4">{inheritedBool(o.isEnabled, rule?.isEnabled)}</td>
                    {RANGES.map((range) => {
                      const min = o[`${range.key}Min`];
                      const max = o[`${range.key}Max`];
                      const inherited = (min === null || min === undefined) && (max === null || max === undefined);
                      return (
                        <td key={range.key} className={`py-2 pr-4 ${inherited ? 'text-gray-400' : 'text-gray-900 font-medium'}`}>
                          {formatRange(min ?? rule?.[`${range.key}Min`] ?? '?', max ?? rule?.[`${range.key}Max`] ?? '?')}
                        </td>
                      );
                    })}
                    <td className="py-2 pr-4">{o.domainType === 'Town' ? '-' : inheritedBool(o.includeAncestors, rule?.includeAncestors)}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">
                      <div className="inline-flex gap-2">
                        <button className="text-gray-500 hover:text-gray-900" title="Preview per title" aria-label={`Preview ${name}`} onClick={() => onPreview(o.domainId)}>
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          className="text-gray-500 hover:text-gray-900 disabled:opacity-40"
                          title="Edit"
                          aria-label={`Edit ${name} override`}
                          disabled={saving || editing !== null}
                          onClick={() => startEdit({ domainId: o.domainId, name, domainType: o.domainType ?? '', isNew: false }, o)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="text-gray-400 hover:text-red-600 disabled:opacity-40"
                          title="Remove override"
                          aria-label={`Remove ${name} override`}
                          disabled={removingId !== null}
                          onClick={() => void remove(o)}
                        >
                          {removingId === o.domainId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {editing?.isNew && editRow('new')}
            </tbody>
          </table>
        </div>
      )}
      {removeError && <p className="mb-3 text-xs text-red-600">{removeError}</p>}

      {/* Add an override: pick a domain, then fill in the fields that differ. */}
      <div className="flex flex-wrap items-end gap-3 pt-4 border-t border-gray-100">
        <div className="w-80 max-w-full">
          <SearchableDropdown
            label="Domain"
            instances={pickable}
            selectedId={pickedDomainId}
            onSelect={(id) => setPickedDomainId(id ?? undefined)}
            loading={domains === null && !domainsError}
            error={domainsError ?? undefined}
          />
        </div>
        <button className="btn-primary text-sm" disabled={pickedDomainId === undefined || editing !== null} onClick={startAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add override
        </button>
      </div>
    </div>
  );
};
