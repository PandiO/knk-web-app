import React from 'react';
import { siegeConfigurationClient } from '../../apiClients/siegeConfigurationClient';
import { SiegeConfigurationDto, UpdateSiegeConfigurationDto } from '../../types/dtos/siege/SiegeDtos';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { SettingsPage, SettingsSection } from '../../components/SettingsPage';
import { Field } from '../../components/Field';

/**
 * Siege Phase 3: the global SiegeConfiguration singleton (docs/specs/siege-minigame/DESIGN.md §3.8).
 * DESIGN §4 asked for a form "like SalaryConfiguration", but SalaryConfiguration has no web UI, and
 * a singleton doesn't fit the FormWizard's create/edit-by-id model - so this is a small dedicated
 * page in the GameSettingsPage mould. GET seeds the legacy defaults on first use; Save sends only
 * the changed values (the PUT is partial). Range rules are enforced by the API, whose message is
 * shown on a 400. #187: on the SettingsPage shell (leave/discard questions, toast on save).
 */

type FieldKind = 'int' | 'decimal' | 'intList' | 'stringList' | 'gateView' | 'boolean';

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
        title: 'Skipping matchmaking',
        description: 'How much matchmaking is left after /siege skip. Skipping a cooldown always starts matchmaking at once. The plugin never shortens matchmaking to less than one second before voting closes, whatever is set here.',
        fields: [
            { key: 'playerSkipMatchmakingSeconds', label: 'Player skip leaves (seconds)', kind: 'int', help: '/siege skip for players with knk.siege.skip (default 60).' },
            { key: 'adminSkipMatchmakingSeconds', label: 'Admin skip leaves (seconds)', kind: 'int', help: '/siege admin skip (default 31: one second before voting closes).' },
        ],
    },
    {
        title: 'After the match',
        description: 'When a match ends, its players are taken back to the scenario hub, where they see the result. After this time they return to where they were, with their own inventory; /siege leave returns them earlier. Rewards are granted at the end of the match either way.',
        fields: [
            { key: 'postMatchSeconds', label: 'Time at the hub after the match (seconds)', kind: 'int', help: '0–600 (default 30). 0 sends players back at once.' },
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
        title: 'Navigation compass',
        description: 'KNG-234. The item itself (material and display name) is set on the roads / navigation admin page. A lobby or a scenario can override this with its own "Navigation compass" choice (lobby first, then scenario, then this).',
        fields: [
            { key: 'giveNavigationItem', label: 'Give the navigation compass at the hub', kind: 'boolean', help: 'Players get it when they are teleported to the hub (the warm-up) and lose it with the inventory restore after the match.' },
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
        case 'boolean':
            return trimmed === 'true' || trimmed === 'false' ? { value: trimmed === 'true' } : { error: 'Yes or no required.' };
    }
};

export const SiegeConfigurationPage: React.FC = () => {
    const [config, setConfig] = React.useState<SiegeConfigurationDto | null>(null);
    const [drafts, setDrafts] = React.useState<Record<string, string>>({});
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);

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
        setLoadError(null);
        try {
            applyLoaded(await siegeConfigurationClient.get());
        } catch (err) {
            setLoadError(apiRefusalReason(err) ?? 'Could not load the siege configuration.');
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
        if (!config) return;
        const update: UpdateSiegeConfigurationDto = {};
        changedKeys.forEach(key => {
            (update as Record<string, unknown>)[key] = parsed[key].value;
        });
        applyLoaded(await siegeConfigurationClient.update(update));
        return `Saved ${changedKeys.length} setting${changedKeys.length === 1 ? '' : 's'}.`;
    };

    return (
        <SettingsPage
            title="Siege settings"
            description="Global tunables for every siege lobby. Scenarios and lobbies are edited in their own forms."
            lastSaved={{ at: config?.updatedAt }}
            dirtyCount={changedKeys.length}
            canSave={!hasErrors}
            onSave={handleSave}
            onDiscard={() => config && applyLoaded(config)}
            onReload={load}
            saveErrorMessage={err => apiRefusalReason(err) ?? 'Could not save the siege configuration.'}
            loading={loading && !config}
            loadingLabel="Loading siege configuration…"
            loadError={!config && loadError ? 'Siege configuration could not be loaded' : undefined}
            onRetry={() => void load()}
        >
            {config && SECTIONS.map(section => (
                <SettingsSection
                    key={section.title}
                    title={section.title}
                    description={section.description}
                    changed={section.fields.some(field => parsed[field.key]?.changed)}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {section.fields.map(field => {
                            const state = parsed[field.key];
                            const text = drafts[field.key] ?? '';
                            // Siege's pattern (SET-4): a changed field has a warning border, an invalid one a danger border.
                            const inputClass = `input px-3 py-2 ${state?.error ? 'border-danger' : state?.changed ? 'border-warning' : ''}`;
                            const onChange = (value: string) => setDrafts(prev => ({ ...prev, [field.key]: value }));
                            const wide = field.kind === 'stringList' ? 'md:col-span-2' : '';
                            if (field.kind === 'boolean') {
                                return (
                                    <Field key={field.key} label={field.label} hint={field.help} error={state?.error} inline className={wide}>
                                        <input
                                            type="checkbox"
                                            checked={text === 'true'}
                                            onChange={e => onChange(e.target.checked ? 'true' : 'false')}
                                            className="h-4 w-4 rounded border-field text-primary focus:ring-primary"
                                        />
                                    </Field>
                                );
                            }
                            return (
                                <Field key={field.key} label={field.label} hint={field.help} error={state?.error} className={wide}>
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
                                </Field>
                            );
                        })}
                    </div>
                </SettingsSection>
            ))}
        </SettingsPage>
    );
};

export default SiegeConfigurationPage;
