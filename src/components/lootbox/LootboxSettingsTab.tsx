import React from 'react';
import { lootboxConfigurationClient } from '../../apiClients/lootboxConfigurationClient';
import { LootboxConfigurationDto, MAX_BOX_STARS, UpdateLootboxConfigurationDto } from '../../types/dtos/lootbox/LootboxDtos';
import { apiErrorMessage } from '../../utils/lootbox';
import { SettingsPage, SettingsSection } from '../SettingsPage';
import { Field } from '../Field';
import { MinecraftLegacyPreview } from '../admin/gameSettings/MinecraftLegacyPreview';
import { UNIT, joinHint } from '../../utils/settingsUnits';
import type { ConfirmOptions } from '../../hooks/useConfirm';

/**
 * The global LootboxConfiguration singleton (docs/specs/lootboxes/DESIGN.md §3.2). A singleton doesn't fit the
 * FormWizard's create/edit-by-id model, so - like SiegeConfigurationPage - it is a small form of its own. The PUT
 * replaces every value, so Save always sends the whole object; the API enforces the ranges and its message is
 * shown on a 400.
 *
 * PandiO/knk-workspace#26: on the SettingsPage shell inside the Lootboxes page's Settings tab (changes counted,
 * "Leave without saving?" also on a tab switch, toast on save, the API's reason in the header); units and one
 * line of help per field; the announcement thresholds as choices ("Never" instead of the magic 11); a preview of
 * both announcements as the game shows them; switching lootboxes off or on asks first.
 */

type NumberKey = 'globalMaxActive' | 'maxClaimsPerPlayerPerDay';
type StarsKey = 'announceMinItemStars' | 'announceSpawnMinBoxStars';
type TextKey = 'dropAnnouncementTemplate' | 'spawnAnnouncementTemplate';

/** The API's "announce nothing" value for both thresholds (1-11; grades go up to ★10). */
export const ANNOUNCE_NEVER = MAX_BOX_STARS + 1;

interface NumberSpec {
    key: NumberKey;
    label: string;
    help: string;
    min: number;
    /** Empty means "no cap" (null). */
    optional?: boolean;
}

const NUMBER_FIELDS: NumberSpec[] = [
    { key: 'globalMaxActive', label: 'Max active boxes (all areas)', help: 'Boxes in the world at once, all areas together; each area\'s own limit applies as well. 0 = none spawn.', min: 0 },
    { key: 'maxClaimsPerPlayerPerDay', label: 'Boxes per player per UTC day', help: 'All types together; the day resets at 00:00 UTC. Empty = no cap. A type can set a lower limit of its own.', min: 1, optional: true },
];

const STARS_FIELDS: { key: StarsKey; label: string; describe: (stars: number) => string }[] = [
    {
        key: 'announceMinItemStars',
        label: 'Announce drops of items from',
        describe: stars => (stars >= ANNOUNCE_NEVER
            ? 'No drop is announced in chat; specials still are. A type can override it.'
            : `Everyone sees a drop of a ★${stars} item or better in chat; specials always. A type can override it.`),
    },
    {
        key: 'announceSpawnMinBoxStars',
        label: 'Announce spawns of boxes from',
        describe: stars => (stars >= ANNOUNCE_NEVER
            ? 'No spawn is announced in chat.'
            : `Everyone sees a ★${stars} box or better appear in chat; nothing while every type's boxes stay below ★${stars}.`),
    },
];

/** The templates' placeholders and the sample values the preview fills in. */
const TEXT_FIELDS: { key: TextKey; label: string; placeholders: string[]; fallback: string }[] = [
    { key: 'dropAnnouncementTemplate', label: 'Drop announcement', placeholders: ['{player}', '{item}', '{box}'], fallback: '&6{player} &efound {item} &ein a {box}!' },
    { key: 'spawnAnnouncementTemplate', label: 'Spawn announcement', placeholders: ['{box}', '{area}'], fallback: '&eA {box} &eappeared in &6{area}&e!' },
];

/** Sample values for the preview; the box carries its grade colour, as the game server's label does. */
export const ANNOUNCEMENT_SAMPLE: Record<string, string> = {
    '{player}': 'Steve',
    '{item}': '[Golemheart Sword]',
    '{box}': '&dWeapons Lootbox ★★★★★',
    '{area}': 'Market Square',
};

/** The template as the game shows it: empty = the default, then the placeholders filled in (DESIGN.md §3.7). */
export function fillAnnouncement(template: string, fallback: string, sample: Record<string, string> = ANNOUNCEMENT_SAMPLE): string {
    let text = template.trim() === '' ? fallback : template;
    Object.entries(sample).forEach(([placeholder, value]) => {
        text = text.split(placeholder).join(value);
    });
    return text;
}

/** `{word}` tokens the game doesn't fill in for this template: they show as written. */
export function unknownPlaceholders(template: string, known: string[]): string[] {
    const found = template.match(/\{[A-Za-z_]+\}/g) ?? [];
    return Array.from(new Set(found.filter(token => !known.includes(token))));
}

type Drafts = Record<NumberKey | StarsKey | TextKey, string> & { enabled: boolean };
type DraftKey = keyof Drafts;

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
    return null;
};

/** The question before a save that switches lootboxes off or on (#26 SET-6), or null. */
export function lootboxSwitchQuestion(saved: boolean, draft: boolean): ConfirmOptions | null {
    if (saved === draft) return null;
    return draft
        ? {
            title: 'Switch lootboxes on?',
            message: 'Boxes start spawning in every enabled area and players can claim them again, from the game server\'s next runtime refresh.',
            confirmLabel: 'Switch on and save',
            danger: false,
        }
        : {
            title: 'Switch lootboxes off?',
            message: 'Nothing spawns and no box can be claimed until they are switched on again, from the game server\'s next runtime refresh.',
            confirmLabel: 'Switch off and save',
            danger: true,
        };
}

const STAR_CHOICES = Array.from({ length: MAX_BOX_STARS }, (_, i) => i + 1);

export const LootboxSettingsTab: React.FC = () => {
    const [config, setConfig] = React.useState<LootboxConfigurationDto | null>(null);
    const [drafts, setDrafts] = React.useState<Drafts | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const loaded = await lootboxConfigurationClient.get();
            setConfig(loaded);
            setDrafts(toDrafts(loaded));
        } catch (err) {
            setLoadError(apiErrorMessage(err, 'Could not load the lootbox settings.'));
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

    const original = React.useMemo(() => (config ? toDrafts(config) : null), [config]);
    const changedKeys = drafts && original
        ? (Object.keys(drafts) as DraftKey[]).filter(k => drafts[k] !== original[k])
        : [];
    const isChanged = (...keys: DraftKey[]) => keys.some(k => changedKeys.includes(k));
    const hasErrors = Object.keys(errors).length > 0;

    const set = (key: DraftKey, value: string | boolean) => setDrafts(prev => prev && { ...prev, [key]: value });

    const handleSave = async () => {
        if (!drafts) return;
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
        return 'Lootbox settings saved.';
    };

    const fieldClass = (key: DraftKey, extra = '') =>
        `input px-3 py-2 ${extra} ${key in errors ? 'border-danger' : isChanged(key) ? 'border-warning' : ''}`;

    return (
        <SettingsPage
            embedded
            title="Lootbox settings"
            description="Applies to every box type and area. The game server picks changes up on its next runtime refresh."
            lastSaved={{ at: config?.updatedAt }}
            dirtyCount={changedKeys.length}
            canSave={!hasErrors}
            onSave={handleSave}
            onDiscard={() => original && setDrafts(original)}
            onReload={load}
            saveErrorMessage={err => apiErrorMessage(err, 'Could not save the lootbox settings.')}
            confirmSave={() => (config && drafts ? lootboxSwitchQuestion(config.enabled, drafts.enabled) : null)}
            loading={loading && !drafts}
            loadingLabel="Loading lootbox settings…"
            loadError={!drafts && loadError ? loadError : undefined}
            onRetry={() => void load()}
        >
            {drafts && (
                <>
                    <SettingsSection title="Lootboxes" changed={isChanged('enabled')}>
                        <Field
                            label="Lootboxes enabled"
                            inline
                            hint="Off: nothing spawns and no box can be claimed. Saving a switch asks first."
                        >
                            <input
                                type="checkbox"
                                checked={drafts.enabled}
                                onChange={e => set('enabled', e.target.checked)}
                                className="h-4 w-4 rounded border-field text-primary focus:ring-primary"
                            />
                        </Field>
                    </SettingsSection>

                    <SettingsSection title="Limits" changed={isChanged('globalMaxActive', 'maxClaimsPerPlayerPerDay')}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {NUMBER_FIELDS.map(spec => (
                                <Field key={spec.key} label={spec.label} unit={UNIT.boxes} hint={spec.help} error={errors[spec.key]}>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={drafts[spec.key]}
                                        placeholder={spec.optional ? 'No cap' : undefined}
                                        onChange={e => set(spec.key, e.target.value)}
                                        className={fieldClass(spec.key)}
                                    />
                                </Field>
                            ))}
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="Announcements"
                        description="Chat lines everyone on the server sees. & colour codes; empty text = the default."
                        changed={isChanged('announceMinItemStars', 'announceSpawnMinBoxStars', 'dropAnnouncementTemplate', 'spawnAnnouncementTemplate')}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {STARS_FIELDS.map(spec => (
                                <Field key={spec.key} label={spec.label} hint={spec.describe(Number(drafts[spec.key]))}>
                                    <select value={drafts[spec.key]} onChange={e => set(spec.key, e.target.value)} className={fieldClass(spec.key)}>
                                        {STAR_CHOICES.map(stars => (
                                            <option key={stars} value={String(stars)}>★{stars} and better</option>
                                        ))}
                                        <option value={String(ANNOUNCE_NEVER)}>Never</option>
                                    </select>
                                </Field>
                            ))}
                        </div>
                        {TEXT_FIELDS.map(spec => {
                            const text = drafts[spec.key];
                            const unknown = unknownPlaceholders(text, spec.placeholders);
                            return (
                                <div key={spec.key} className="space-y-2">
                                    <Field
                                        label={spec.label}
                                        hint={joinHint(
                                            `Placeholders ${spec.placeholders.join(', ')}.`,
                                            unknown.length > 0 && `Not filled in by the game: ${unknown.join(', ')} (shown as written).`,
                                        )}
                                    >
                                        <input
                                            type="text"
                                            value={text}
                                            placeholder={spec.fallback}
                                            onChange={e => set(spec.key, e.target.value)}
                                            className={fieldClass(spec.key, 'font-mono')}
                                        />
                                    </Field>
                                    <div aria-label={`${spec.label} preview`} role="group">
                                        <p className="text-xs font-medium text-muted mb-1">
                                            Preview{text.trim() === '' ? ' (the default)' : ''}
                                        </p>
                                        <MinecraftLegacyPreview dark text={fillAnnouncement(text, spec.fallback)} />
                                    </div>
                                </div>
                            );
                        })}
                        <p className="text-xs text-muted">
                            Sample values: {Object.entries(ANNOUNCEMENT_SAMPLE).map(([k, v]) => `${k} = ${v.replace(/&[0-9a-fk-or]/gi, '')}`).join(', ')}.
                            In game the item keeps its own name colour and hover, and the box&apos;s colour is its grade&apos;s.
                        </p>
                    </SettingsSection>
                </>
            )}
        </SettingsPage>
    );
};

export default LootboxSettingsTab;
