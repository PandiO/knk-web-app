import React from 'react';
import { Loader2, RefreshCcw, Save } from 'lucide-react';
import { siegeConfigurationClient } from '../../apiClients/siegeConfigurationClient';
import { SiegeConfigurationDto, UpdateSiegeConfigurationDto } from '../../types/dtos/siege/SiegeDtos';

/**
 * Siege Phase 3: the global SiegeConfiguration singleton (docs/specs/siege-minigame/DESIGN.md §3.8).
 * DESIGN §4 asked for a form "like SalaryConfiguration", but SalaryConfiguration has no web UI, and
 * a singleton doesn't fit the FormWizard's create/edit-by-id model - so this is a small dedicated
 * page in the GameSettingsPage mould. GET seeds the legacy defaults on first use; Save sends only
 * the changed values (the PUT is partial). Range rules are enforced by the API, whose message is
 * shown on a 400.
 */

type FieldKind = 'int' | 'decimal' | 'intList' | 'stringList' | 'gateView';

interface FieldSpec {
    key: keyof UpdateSiegeConfigurationDto;
    label: string;
    kind: FieldKind;
    help?: string;
}

const SECTIONS: Array<{ title: string; description: string; fields: FieldSpec[] }> = [
    {
        title: 'Capture',
        description: 'Points per second while standing on an objective (DESIGN §7.2). "Extra" is per additional player; instant-victory objectives use their own per-extra value.',
        fields: [
            { key: 'captureAttackBase', label: 'Attack base', kind: 'int' },
            { key: 'captureAttackPerExtra', label: 'Attack per extra player', kind: 'int' },
            { key: 'captureAttackPerExtraInstantVictory', label: 'Attack per extra player (instant victory)', kind: 'int' },
            { key: 'captureDefendBase', label: 'Defend base', kind: 'int' },
            { key: 'captureDefendPerExtra', label: 'Defend per extra player', kind: 'int' },
            { key: 'captureDefendPerExtraInstantVictory', label: 'Defend per extra player (instant victory)', kind: 'int' },
            { key: 'sideCaptureReduction', label: 'Side-capture reduction', kind: 'decimal', help: 'Fraction, e.g. 0.4 (§7.4).' },
        ],
    },
    {
        title: 'Matchmaking timeline',
        description: 'Seconds before match start. Must satisfy vote close ≥ draw ≥ hub ≥ team split ≥ 1.',
        fields: [
            { key: 'voteCloseSecondsBeforeStart', label: 'Vote closes', kind: 'int' },
            { key: 'drawSecondsBeforeStart', label: 'Scenario draw', kind: 'int' },
            { key: 'hubSecondsBeforeStart', label: 'Teleport to hub', kind: 'int' },
            { key: 'teamSplitSecondsBeforeStart', label: 'Team split', kind: 'int' },
            { key: 'matchmakingAnnouncementMarks', label: 'Announcement marks', kind: 'intList', help: 'Comma-separated seconds, e.g. 290,60,30,15.' },
        ],
    },
    {
        title: 'Combat and chat',
        description: 'Kill announcements, headshots, respawn and the command filter.',
        fields: [
            { key: 'killAnnouncementThresholds', label: 'Kill announcement thresholds', kind: 'intList', help: 'Comma-separated kill counts, e.g. 5,10,15.' },
            { key: 'killStreakAnnounceAbove', label: 'Announce kill streaks above', kind: 'int' },
            { key: 'headshotMultiplier', label: 'Headshot multiplier', kind: 'decimal', help: '1.0 disables headshots (1–10).' },
            { key: 'spawnPickerDelayTicks', label: 'Spawn picker / respawn delay (ticks)', kind: 'int' },
            { key: 'allowedCommands', label: 'Allowed commands', kind: 'stringList', help: 'One per line, e.g. /siege.' },
        ],
    },
    {
        title: 'Enchant-book drops',
        description: 'DESIGN §9.4. Scenarios can switch drops off individually.',
        fields: [
            { key: 'enchantDropChancePerMille', label: 'Drop chance per second (‰)', kind: 'int' },
            { key: 'allowedEnchantmentKeys', label: 'Allowed enchantment keys', kind: 'stringList', help: 'One per line, e.g. minecraft:sharpness.' },
            { key: 'enchantLevelMin', label: 'Minimum level', kind: 'int' },
            { key: 'enchantLevelMax', label: 'Maximum level', kind: 'int' },
            { key: 'maxBooksAlive', label: 'Max books alive per match', kind: 'int' },
        ],
    },
    {
        title: 'Gates',
        description: 'How non-members see siege gates (§8.5).',
        fields: [
            { key: 'nonMemberGateView', label: 'Non-member gate view', kind: 'gateView' },
        ],
    },
];

const toText = (value: unknown, kind: FieldKind): string => {
    if (value === null || value === undefined) return '';
    if (kind === 'intList' && Array.isArray(value)) return value.join(',');
    if (kind === 'stringList' && Array.isArray(value)) return value.join('\n');
    return String(value);
};

// Parses an edited text back to the DTO value; returns an error message for bad input.
const parseText = (text: string, kind: FieldKind): { value?: unknown; error?: string } => {
    const trimmed = text.trim();
    switch (kind) {
        case 'int': {
            const n = Number(trimmed);
            return trimmed !== '' && Number.isInteger(n) ? { value: n } : { error: 'Whole number required.' };
        }
        case 'decimal': {
            const n = Number(trimmed.replace(',', '.'));
            return trimmed !== '' && Number.isFinite(n) ? { value: n } : { error: 'Number required.' };
        }
        case 'intList': {
            const parts = trimmed === '' ? [] : trimmed.split(',').map(p => p.trim());
            const numbers = parts.map(Number);
            return numbers.every(Number.isInteger) ? { value: numbers } : { error: 'Comma-separated whole numbers required.' };
        }
        case 'stringList':
            return { value: trimmed === '' ? [] : trimmed.split('\n').map(l => l.trim()).filter(Boolean) };
        case 'gateView':
            return { value: trimmed };
    }
};

export const SiegeConfigurationPage: React.FC = () => {
    const [config, setConfig] = React.useState<SiegeConfigurationDto | null>(null);
    const [drafts, setDrafts] = React.useState<Record<string, string>>({});
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [message, setMessage] = React.useState<{ tone: 'success' | 'error'; text: string } | null>(null);

    const allFields = React.useMemo(() => SECTIONS.flatMap(section => section.fields), []);

    const applyLoaded = React.useCallback((loaded: SiegeConfigurationDto) => {
        setConfig(loaded);
        const texts: Record<string, string> = {};
        allFields.forEach(field => {
            texts[field.key] = toText(loaded[field.key], field.kind);
        });
        setDrafts(texts);
    }, [allFields]);

    const load = React.useCallback(async () => {
        setLoading(true);
        setMessage(null);
        try {
            applyLoaded(await siegeConfigurationClient.get());
        } catch (err: any) {
            setMessage({ tone: 'error', text: err?.message || 'Could not load the siege configuration.' });
        } finally {
            setLoading(false);
        }
    }, [applyLoaded]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const parsed = React.useMemo(() => {
        const result: Record<string, { value?: unknown; error?: string; changed: boolean }> = {};
        if (!config) return result;
        allFields.forEach(field => {
            const text = drafts[field.key] ?? '';
            const outcome = parseText(text, field.kind);
            result[field.key] = {
                ...outcome,
                changed: outcome.error === undefined && text !== toText(config[field.key], field.kind)
            };
        });
        return result;
    }, [allFields, config, drafts]);

    const changedKeys = Object.keys(parsed).filter(key => parsed[key].changed);
    const hasErrors = Object.values(parsed).some(p => p.error);

    const handleSave = async () => {
        if (!config || changedKeys.length === 0 || hasErrors) return;
        setSaving(true);
        setMessage(null);
        try {
            const update: UpdateSiegeConfigurationDto = {};
            changedKeys.forEach(key => {
                (update as Record<string, unknown>)[key] = parsed[key].value;
            });
            applyLoaded(await siegeConfigurationClient.update(update));
            setMessage({ tone: 'success', text: `Saved ${changedKeys.length} setting${changedKeys.length === 1 ? '' : 's'}.` });
        } catch (err: any) {
            setMessage({ tone: 'error', text: err?.message || 'Could not save the siege configuration.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading && !config) {
        return (
            <div className="flex items-center justify-center py-16 text-gray-500">
                <Loader2 className="h-6 w-6 mr-2 animate-spin" /> Loading siege configuration…
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Siege configuration</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Global tunables for every siege lobby. Scenarios and lobbies are edited in their own forms.
                        {config?.updatedAt && <> Last saved {new Date(config.updatedAt).toLocaleString()}.</>}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => void load()} disabled={loading || saving} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-50">
                        <RefreshCcw className="h-4 w-4" /> Reload
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving || changedKeys.length === 0 || hasErrors}
                        className="btn-primary inline-flex items-center gap-1 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save{changedKeys.length > 0 ? ` (${changedKeys.length})` : ''}
                    </button>
                </div>
            </div>

            {message && (
                <div className={`rounded-md border p-3 text-sm ${message.tone === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            {config && SECTIONS.map(section => (
                <section key={section.title} className="bg-white rounded-lg shadow p-4 md:p-6 space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                        <p className="text-xs text-gray-500">{section.description}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {section.fields.map(field => {
                            const state = parsed[field.key];
                            const text = drafts[field.key] ?? '';
                            const inputClass = `block w-full rounded-md shadow-sm sm:text-sm ${state?.error ? 'border-red-300' : state?.changed ? 'border-amber-400' : 'border-gray-300'}`;
                            const onChange = (value: string) => setDrafts(prev => ({ ...prev, [field.key]: value }));
                            return (
                                <label key={field.key} className={`block ${field.kind === 'stringList' ? 'md:col-span-2' : ''}`}>
                                    <span className="block text-sm font-medium text-gray-700 mb-1">{field.label}</span>
                                    {field.kind === 'stringList' ? (
                                        <textarea rows={4} value={text} onChange={e => onChange(e.target.value)} className={inputClass} />
                                    ) : field.kind === 'gateView' ? (
                                        <select value={text} onChange={e => onChange(e.target.value)} className={inputClass}>
                                            <option value="PreLockdownView">Pre-lockdown view (default)</option>
                                            <option value="PassThroughOnly">Pass-through only</option>
                                        </select>
                                    ) : (
                                        <input type="text" inputMode="decimal" value={text} onChange={e => onChange(e.target.value)} className={inputClass} />
                                    )}
                                    {field.help && <span className="block text-xs text-gray-500 mt-1">{field.help}</span>}
                                    {state?.error && <span className="block text-xs text-red-600 mt-1">{state.error}</span>}
                                </label>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
};

export default SiegeConfigurationPage;
