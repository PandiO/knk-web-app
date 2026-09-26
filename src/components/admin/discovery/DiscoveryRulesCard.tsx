import React from 'react';
import { Loader2, Pencil, Save, X } from 'lucide-react';
import { discoveryClient } from '../../../apiClients/discoveryClient';
import {
  DiscoveryRewardRuleDto,
  UpdateDiscoveryRewardRuleDto,
  discoveryTypeLabel,
} from '../../../types/dtos/discovery/DiscoveryDtos';
import { RANGES, RangeKey, RuleDraft, parseRuleDraft, ruleToDraft } from './discoveryRuleForm';

// docs/specs/domain-discovery/DESIGN.md §3.1/§3.3/§3.9 (1) - one reward rule per domain type,
// edited inline. XP = units × 1% of the player's title bracket width, coins = salary-hours × the
// title's hourly salary, gems flat; the player's multipliers apply on top when a place is found.

export const numberInputClass = 'w-20 border border-gray-300 rounded-md px-2 py-1 text-sm';

/** "1 – 4" (or just "3" when min and max are equal). */
export const formatRange = (min: number | string, max: number | string): string =>
  String(min) === String(max) ? String(min) : `${min} – ${max}`;

/** A min/max pair of number inputs for one reward range of a draft. */
export const RangeInputs: React.FC<{
  rangeKey: RangeKey;
  label: string;
  min: string;
  max: string;
  onChange: (field: `${RangeKey}Min` | `${RangeKey}Max`, value: string) => void;
  placeholders?: { min?: string; max?: string };
}> = ({ rangeKey, label, min, max, onChange, placeholders }) => (
  <div className="flex items-center gap-1">
    <input
      type="number"
      min={0}
      step="any"
      className={numberInputClass}
      value={min}
      placeholder={placeholders?.min}
      aria-label={`${label} min`}
      onChange={(e) => onChange(`${rangeKey}Min`, e.target.value)}
    />
    <span className="text-gray-400">–</span>
    <input
      type="number"
      min={0}
      step="any"
      className={numberInputClass}
      value={max}
      placeholder={placeholders?.max}
      aria-label={`${label} max`}
      onChange={(e) => onChange(`${rangeKey}Max`, e.target.value)}
    />
  </div>
);

const formatUpdated = (iso?: string | null): string => {
  if (!iso) return '-';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) || date.getFullYear() < 2000 ? '-' : date.toLocaleString();
};

export const DiscoveryRulesCard: React.FC<{
  rules: DiscoveryRewardRuleDto[];
  onSaved: (rule: DiscoveryRewardRuleDto) => void;
  /** The rule as currently typed (null when not editing or not valid) - drives the live preview. */
  onDraftChange: (domainType: string, rule: UpdateDiscoveryRewardRuleDto | null) => void;
}> = ({ rules, onSaved, onDraftChange }) => {
  const [editingType, setEditingType] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<RuleDraft | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  const startEdit = (rule: DiscoveryRewardRuleDto) => {
    if (editingType) onDraftChange(editingType, null);
    const next = ruleToDraft(rule);
    setEditingType(rule.domainType);
    setDraft(next);
    setErrors([]);
    onDraftChange(rule.domainType, parseRuleDraft(next).value ?? null);
  };

  const update = (changes: Partial<RuleDraft>) => {
    if (!draft || !editingType) return;
    const next = { ...draft, ...changes };
    setDraft(next);
    onDraftChange(editingType, parseRuleDraft(next).value ?? null);
  };

  const stopEdit = () => {
    if (editingType) onDraftChange(editingType, null);
    setEditingType(null);
    setDraft(null);
    setErrors([]);
  };

  const save = async () => {
    if (!draft || !editingType) return;
    const parsed = parseRuleDraft(draft);
    if (!parsed.value) {
      setErrors(parsed.errors);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const saved = await discoveryClient.updateRule(editingType, parsed.value);
      stopEdit();
      onSaved(saved);
    } catch (err) {
      console.error('Failed to save discovery rule:', err);
      const status = (err as { status?: number } | null)?.status;
      const message = err instanceof Error ? err.message : null;
      setErrors([status === 400 && message ? message : 'Could not save this rule.']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900">Reward rules</h2>
      <p className="mt-1 mb-4 text-sm text-gray-500">
        What a first discovery pays, per type. XP units are 1% of the player&apos;s title bracket; coin
        salary-hours are multiplied by the title&apos;s hourly salary; gems are flat. Each reward is rolled
        between min and max, then the player&apos;s personal and rank multipliers apply.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200">
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Enabled</th>
              {RANGES.map((range) => <th key={range.key} className="py-2 pr-4">{range.label}</th>)}
              <th className="py-2 pr-4" title="Discovering a district or structure also discovers the places it lies in">Discovers parents</th>
              <th className="py-2 pr-4">Updated</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const editing = editingType === rule.domainType && draft !== null;
              const label = discoveryTypeLabel(rule.domainType);
              const hasParents = rule.domainType !== 'Town';
              return (
                <React.Fragment key={rule.domainType}>
                  <tr className={`border-b border-gray-100 ${editing ? 'bg-amber-50/40' : ''}`}>
                    <td className="py-2 pr-4 font-medium text-gray-900">{label}</td>
                    <td className="py-2 pr-4">
                      {editing ? (
                        <input
                          type="checkbox"
                          checked={draft.isEnabled}
                          aria-label={`${label} enabled`}
                          onChange={(e) => update({ isEnabled: e.target.checked })}
                        />
                      ) : (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          rule.isEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {rule.isEnabled ? 'Yes' : 'No'}
                        </span>
                      )}
                    </td>
                    {RANGES.map((range) => (
                      <td key={range.key} className="py-2 pr-4 text-gray-700">
                        {editing ? (
                          <RangeInputs
                            rangeKey={range.key}
                            label={`${label} ${range.label}`}
                            min={draft[`${range.key}Min`]}
                            max={draft[`${range.key}Max`]}
                            onChange={(field, value) => update({ [field]: value } as Partial<RuleDraft>)}
                          />
                        ) : (
                          formatRange(rule[`${range.key}Min`], rule[`${range.key}Max`])
                        )}
                      </td>
                    ))}
                    <td className="py-2 pr-4 text-gray-700">
                      {!hasParents ? '-' : editing ? (
                        <input
                          type="checkbox"
                          checked={draft.includeAncestors}
                          aria-label={`${label} discovers parents`}
                          onChange={(e) => update({ includeAncestors: e.target.checked })}
                        />
                      ) : (rule.includeAncestors ? 'Yes' : 'No')}
                    </td>
                    <td className="py-2 pr-4 text-gray-500 text-xs whitespace-nowrap">{formatUpdated(rule.updatedAt)}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">
                      {editing ? (
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
                      ) : (
                        <button
                          className="text-gray-500 hover:text-gray-900 inline-flex items-center text-xs disabled:opacity-40"
                          disabled={saving}
                          onClick={() => startEdit(rule)}
                          aria-label={`Edit ${label} rule`}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                  {editing && errors.length > 0 && (
                    <tr>
                      <td colSpan={RANGES.length + 5} className="pb-2">
                        {errors.map((error) => <p key={error} className="text-xs text-red-600">{error}</p>)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
