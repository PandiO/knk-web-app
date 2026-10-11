import React from 'react';
import { Loader2 } from 'lucide-react';
import { statisticsClient } from '../../apiClients/statisticsClient';
import {
  contextLabel,
  FRIENDS_NOTE,
  STATISTIC_VISIBILITIES,
  StatisticsVisibilityChangeDto,
  StatisticsVisibilityConflictDto,
  StatisticsVisibilityDto,
  StatisticVisibility,
} from '../../types/dtos/statistics/StatisticsDtos';

// Who may see each of the player's statistics (KNG-34, DESIGN.md §F.4, D8) - the web twin of the
// in-game statistics.visibility menu. Per setting and per game context; a group action sets every
// listed setting of the shown group (metric level only - context overrides stay) after a preview
// "current → proposed" and a confirmation. Every write carries the values shown as "expected", so
// a change made elsewhere meanwhile (in-game) answers 409: nothing is written and the settings are
// replaced by the current ones. Staff may read them (readOnly).

const GROUP_LABELS: Record<string, string> = {
  activity: 'Activity',
  combat: 'Combat',
  minigames: 'Minigames',
  exploration: 'Exploration',
  progression: 'Progression',
};

const groupLabel = (group: string) => GROUP_LABELS[group] ?? group.charAt(0).toUpperCase() + group.slice(1);

interface PendingGroupAction {
  value: StatisticVisibility;
  changes: StatisticsVisibilityChangeDto[];
  preview: string[];
}

/** Metric-level changes of a group action: every setting of the group not already at `value`. */
export const groupChanges = (settings: StatisticsVisibilityDto, group: string, value: StatisticVisibility): StatisticsVisibilityChangeDto[] =>
  settings.settings
    .filter(s => s.group === group && s.visibility !== value)
    .map(s => ({ settingKey: s.settingKey, context: '', expected: s.visibility, visibility: value }));

/** "Logins: Nobody → Everyone" per change, then the context overrides that stay as they are. */
export const groupPreview = (settings: StatisticsVisibilityDto, group: string, value: StatisticVisibility): string[] => {
  const lines: string[] = [];
  const untouched: string[] = [];
  for (const s of settings.settings.filter(x => x.group === group)) {
    if (s.visibility !== value) lines.push(`${s.label}: ${s.visibility} → ${value}`);
    for (const c of s.contexts) {
      if (c.isOverride) untouched.push(`${s.label} — ${contextLabel(c.context)} stays ${c.visibility}`);
    }
  }
  return [...lines, ...untouched];
};

export const StatisticsVisibilitySettings: React.FC<{ userId: number; readOnly?: boolean }> = ({ userId, readOnly = false }) => {
  const [settings, setSettings] = React.useState<StatisticsVisibilityDto | null>(null);
  const [group, setGroup] = React.useState('activity');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<PendingGroupAction | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    statisticsClient.getVisibility(userId)
      .then(result => { if (!cancelled) setSettings(result); })
      .catch(err => {
        if (cancelled) return;
        console.error('Failed to load statistics visibility:', err);
        setError('Could not load the visibility settings.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  const groups = React.useMemo(() => {
    const seen: string[] = [];
    for (const s of settings?.settings ?? []) {
      if (!seen.includes(s.group)) seen.push(s.group);
    }
    return seen;
  }, [settings]);

  const save = async (changes: StatisticsVisibilityChangeDto[], success: string) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await statisticsClient.updateVisibility(userId, changes);
      setSettings(updated);
      setNotice(success);
    } catch (err) {
      const failure = err as { status?: number; response?: StatisticsVisibilityConflictDto };
      if (failure?.status === 409 && failure.response?.current) {
        setSettings(failure.response.current);
        setError('Your settings were changed elsewhere meanwhile, so nothing was changed. They are shown as they are now - try again.');
      } else {
        console.error('Failed to save statistics visibility:', err);
        setError('Could not save your settings right now - try again later.');
      }
    } finally {
      setSaving(false);
      setPending(null);
    }
  };

  const change = (settingKey: string, context: string, label: string, expected: StatisticVisibility, visibility: StatisticVisibility) => {
    if (expected === visibility) return;
    void save([{ settingKey, context, expected, visibility }], `${label}: now visible to ${visibility}.`);
  };

  const requestGroup = (value: StatisticVisibility) => {
    if (!settings) return;
    const changes = groupChanges(settings, group, value);
    setNotice(null);
    if (changes.length === 0) {
      setPending(null);
      setNotice(`Every ${groupLabel(group)} setting is already visible to ${value}.`);
      return;
    }
    setPending({ value, changes, preview: groupPreview(settings, group, value) });
  };

  if (loading) {
    return (
      <div className="flex items-center text-sm text-gray-500">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading…
      </div>
    );
  }
  if (!settings) {
    return <p className="text-sm text-red-600">{error ?? 'Could not load the visibility settings.'}</p>;
  }

  const listed = settings.settings.filter(s => s.group === group);

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Active and AFK time, XP and your title are always public. Everything else is hidden until you choose otherwise;
        &ldquo;Everyone&rdquo; means every signed-in player (and you appear on that statistic&apos;s leaderboards).
      </p>
      <div role="tablist" aria-label="Statistics group" className="flex flex-wrap gap-2">
        {groups.map(g => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={g === group}
            onClick={() => { setGroup(g); setPending(null); }}
            className={`rounded-full px-3 py-1 text-sm border ${g === group
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            {groupLabel(g)}
          </button>
        ))}
      </div>

      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          {listed.flatMap(s => [
            <SettingRow
              key={s.settingKey}
              label={s.label}
              value={s.visibility}
              readOnly={readOnly}
              disabled={saving}
              onChange={v => change(s.settingKey, '', s.label, s.visibility, v)}
            />,
            ...(s.contextual ? s.contexts.map(c => (
              <SettingRow
                key={`${s.settingKey}@${c.context}`}
                label={`${s.label} — ${contextLabel(c.context)}`}
                hint={c.isOverride ? `Set for ${contextLabel(c.context)} only` : `Same as ${s.label} (inherited)`}
                value={c.visibility}
                indent
                readOnly={readOnly}
                disabled={saving}
                onChange={v => change(s.settingKey, c.context, `${s.label} (${contextLabel(c.context)})`, c.visibility, v)}
              />
            )) : []),
          ])}
        </tbody>
      </table>

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {STATISTIC_VISIBILITIES.map(v => (
            <button
              key={v}
              type="button"
              disabled={saving}
              onClick={() => requestGroup(v)}
              className="px-3 py-1.5 text-sm border rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Set all listed to {v}
            </button>
          ))}
        </div>
      )}

      {pending && (
        <div role="dialog" aria-label="Confirm group change" className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
          <p className="text-sm font-medium text-amber-900">
            Set {pending.changes.length} {groupLabel(group)} setting(s) to {pending.value}?
          </p>
          <ul className="text-xs text-amber-900 list-disc pl-5">
            {pending.preview.map(line => <li key={line}>{line}</li>)}
            {pending.value === 'Friends' && !settings.friendsAvailable && <li>{FRIENDS_NOTE}</li>}
          </ul>
          <div className="flex gap-2">
            <button type="button" disabled={saving} className="px-3 py-1 text-sm rounded-md bg-primary text-white disabled:opacity-50"
              onClick={() => void save(pending.changes, `Set ${pending.changes.length} ${groupLabel(group)} setting(s) to ${pending.value}.`)}>
              Confirm
            </button>
            <button type="button" className="px-3 py-1 text-sm rounded-md border" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      )}

      {listed.some(s => s.visibility === 'Friends' || s.contexts.some(c => c.visibility === 'Friends')) && !settings.friendsAvailable && (
        <p className="text-xs text-gray-500">{FRIENDS_NOTE}</p>
      )}
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
};

const SettingRow: React.FC<{
  label: string;
  value: StatisticVisibility;
  hint?: string;
  indent?: boolean;
  readOnly: boolean;
  disabled: boolean;
  onChange: (value: StatisticVisibility) => void;
}> = ({ label, value, hint, indent, readOnly, disabled, onChange }) => (
  <tr>
    <td className={`py-2 ${indent ? 'pl-6 text-gray-600' : 'text-gray-900'}`}>
      {label}
      {hint && <span className="block text-xs text-gray-400">{hint}</span>}
    </td>
    <td className="py-2 text-right">
      {readOnly ? (
        <span className="text-gray-700">{value}</span>
      ) : (
        <select
          aria-label={label}
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value as StatisticVisibility)}
          className="border border-gray-300 rounded-md px-2 py-1 text-sm"
        >
          {STATISTIC_VISIBILITIES.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      )}
    </td>
  </tr>
);
