import React from 'react';
import { Loader2, RefreshCcw, Save } from 'lucide-react';
import { lootboxConfigurationClient } from '../../apiClients/lootboxConfigurationClient';
import { LootboxConfigurationDto, UpdateLootboxConfigurationDto } from '../../types/dtos/lootbox/LootboxDtos';
import { apiErrorMessage, formatDateTime } from '../../utils/lootbox';

/**
 * The global LootboxConfiguration singleton (docs/specs/lootboxes/DESIGN.md §3.2). A singleton
 * doesn't fit the FormWizard's create/edit-by-id model, so - like SiegeConfigurationPage - it is a
 * small form of its own. The PUT replaces every value, so Save always sends the whole object; the
 * API enforces the ranges and its message is shown on a 400.
 */

type NumberKey = 'globalMaxActive' | 'maxClaimsPerPlayerPerDay' | 'announceMinItemStars' | 'announceSpawnMinBoxStars';
type TextKey = 'dropAnnouncementTemplate' | 'spawnAnnouncementTemplate';

interface NumberSpec {
    key: NumberKey;
    label: string;
    help: string;
    min: number;
    max?: number;
    /** Empty means "no cap" (null). */
    optional?: boolean;
}

const NUMBER_FIELDS: NumberSpec[] = [
    { key: 'globalMaxActive', label: 'Max active boxes (all areas)', help: 'Area limits apply as well.', min: 0 },
    { key: 'maxClaimsPerPlayerPerDay', label: 'Boxes per player per UTC day', help: 'All types together; resets at 00:00 UTC. Empty = no cap. A type can set a lower limit of its own.', min: 1, optional: true },
    { key: 'announceMinItemStars', label: 'Announce drops from item ★', help: 'Specials are always announced. 11 = never. A type can override it.', min: 1, max: 11 },
    { key: 'announceSpawnMinBoxStars', label: 'Announce spawns from box ★', help: '6 or more = off while boxes are ★1-5.', min: 1, max: 11 },
];

const TEXT_FIELDS: { key: TextKey; label: string; help: string }[] = [
    { key: 'dropAnnouncementTemplate', label: 'Drop announcement', help: 'Placeholders {player}, {item}, {box}; & colour codes. Empty = the default.' },
    { key: 'spawnAnnouncementTemplate', label: 'Spawn announcement', help: 'Placeholders {box}, {area}; & colour codes. Empty = the default.' },
];

type Drafts = Record<NumberKey | TextKey, string> & { enabled: boolean };

const toDrafts = (config: LootboxConfigurationDto): Drafts => ({
    enabled: config.enabled,
    globalMaxActive: String(config.globalMaxActive),
    maxClaimsPerPlayerPerDay: config.maxClaimsPerPlayerPerDay == null ? '' : String(config.maxClaimsPerPlayerPerDay),
    announceMinItemStars: String(config.announceMinItemStars),
    announceSpawnMinBoxStars: String(config.announceSpawnMinBoxStars),
    dropAnnouncementTemplate: config.dropAnnouncementTemplate ?? '',
    spawnAnnouncementTemplate: config.spawnAnnouncementTemplate ?? '',
});

const numberError = (spec: NumberSpec, text: string): string | null => {
    const trimmed = text.trim();
    if (trimmed === '') return spec.optional ? null : 'Required.';
    const n = Number(trimmed);
    if (!Number.isInteger(n)) return 'Whole number required.';
    if (n < spec.min) return `At least ${spec.min}.`;
    if (spec.max !== undefined && n > spec.max) return `At most ${spec.max}.`;
    return null;
};

export const LootboxSettingsTab: React.FC = () => {
    const [config, setConfig] = React.useState<LootboxConfigurationDto | null>(null);
    const [drafts, setDrafts] = React.useState<Drafts | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [message, setMessage] = React.useState<{ tone: 'success' | 'error'; text: string } | null>(null);

    const load = React.useCallback(async () => {
        setLoading(true);
        setMessage(null);
        try {
            const loaded = await lootboxConfigurationClient.get();
            setConfig(loaded);
            setDrafts(toDrafts(loaded));
        } catch (err) {
            setMessage({ tone: 'error', text: apiErrorMessage(err, 'Could not load the lootbox settings.') });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void load();
    }, [load]);

    const errors = React.useMemo(() => {
        const result: Partial<Record<NumberKey, string>> = {};
        if (!drafts) return result;
        NUMBER_FIELDS.forEach(spec => {
            const error = numberError(spec, drafts[spec.key]);
            if (error) result[spec.key] = error;
        });
        return result;
    }, [drafts]);

    const original = config ? toDrafts(config) : null;
    const changed = !!drafts && !!original && (Object.keys(drafts) as (keyof Drafts)[]).some(k => drafts[k] !== original[k]);
    const hasErrors = Object.keys(errors).length > 0;

    const handleSave = async () => {
        if (!drafts || !changed || hasErrors) return;
        setSaving(true);
        setMessage(null);
        try {
            const update: UpdateLootboxConfigurationDto = {
                enabled: drafts.enabled,
                globalMaxActive: Number(drafts.globalMaxActive),
                maxClaimsPerPlayerPerDay: drafts.maxClaimsPerPlayerPerDay.trim() === '' ? null : Number(drafts.maxClaimsPerPlayerPerDay),
                announceMinItemStars: Number(drafts.announceMinItemStars),
                announceSpawnMinBoxStars: Number(drafts.announceSpawnMinBoxStars),
                dropAnnouncementTemplate: drafts.dropAnnouncementTemplate,
                spawnAnnouncementTemplate: drafts.spawnAnnouncementTemplate,
            };
            const saved = await lootboxConfigurationClient.update(update);
            setConfig(saved);
            setDrafts(toDrafts(saved));
            setMessage({ tone: 'success', text: 'Lootbox settings saved.' });
        } catch (err) {
            setMessage({ tone: 'error', text: apiErrorMessage(err, 'Could not save the lootbox settings.') });
        } finally {
            setSaving(false);
        }
    };

    if (loading && !drafts) {
        return (
            <div className="flex items-center justify-center py-16 text-gray-500">
                <Loader2 className="h-6 w-6 mr-2 animate-spin" /> Loading lootbox settings…
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <p className="text-sm text-gray-600">
                    Applies to every box type and area. The game server picks changes up on its next runtime refresh.
                    {config?.updatedAt && <> Last saved {formatDateTime(config.updatedAt)}.</>}
                </p>
                <div className="flex gap-2">
                    <button type="button" onClick={() => void load()} disabled={loading || saving} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-50">
                        <RefreshCcw className="h-4 w-4" /> Reload
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving || !changed || hasErrors}
                        className="btn-primary inline-flex items-center gap-1 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save
                    </button>
                </div>
            </div>

            {message && (
                <div className={`rounded-md border p-3 text-sm ${message.tone === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            {drafts && (
                <section className="bg-white rounded-lg shadow p-4 md:p-6 space-y-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                            type="checkbox"
                            checked={drafts.enabled}
                            onChange={e => setDrafts(prev => prev && { ...prev, enabled: e.target.checked })}
                        />
                        Lootboxes enabled
                        <span className="font-normal text-xs text-gray-500">(off: nothing spawns and no box can be claimed)</span>
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {NUMBER_FIELDS.map(spec => (
                            <label key={spec.key} className="block">
                                <span className="block text-sm font-medium text-gray-700 mb-1">{spec.label}</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    aria-label={spec.label}
                                    value={drafts[spec.key]}
                                    placeholder={spec.optional ? 'No cap' : undefined}
                                    onChange={e => setDrafts(prev => prev && { ...prev, [spec.key]: e.target.value })}
                                    className={`block w-full rounded-md shadow-sm sm:text-sm ${errors[spec.key] ? 'border-red-300' : 'border-gray-300'}`}
                                />
                                <span className="block text-xs text-gray-500 mt-1">{spec.help}</span>
                                {errors[spec.key] && <span className="block text-xs text-red-600 mt-1">{errors[spec.key]}</span>}
                            </label>
                        ))}
                        {TEXT_FIELDS.map(spec => (
                            <label key={spec.key} className="block md:col-span-2">
                                <span className="block text-sm font-medium text-gray-700 mb-1">{spec.label}</span>
                                <input
                                    type="text"
                                    aria-label={spec.label}
                                    value={drafts[spec.key]}
                                    onChange={e => setDrafts(prev => prev && { ...prev, [spec.key]: e.target.value })}
                                    className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm font-mono"
                                />
                                <span className="block text-xs text-gray-500 mt-1">{spec.help}</span>
                            </label>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default LootboxSettingsTab;
