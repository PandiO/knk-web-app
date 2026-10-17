import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { gameSettingsClient } from '../../../apiClients/gameSettingsClient';
import {
    HubDomainDto,
    HubOutageAction,
    HubRulesDto,
    HubSettingsDto,
} from '../../../types/dtos/gameSettings/GameSettingsModels';
import { DomainOption, LocationOption } from './locationReferenceOptions';
import { gameSettingsErrorMessage } from './gameSettingsErrors';
import { LocationReferencePicker } from './LocationReferencePicker';

export const OUTAGE_ACTION_LABELS: Record<HubOutageAction, string> = {
    SendToHub: 'Send to the hub',
    None: 'Do nothing',
    Kick: 'Kick',
    SendToWorldSpawn: "Send to the spawn of the world they are in",
};

/** The confirmed initial rules (hub DESIGN §13) with the 1.21.10 Peaceful heal/feed preset (§16.5). */
export const defaultHubRules = (): HubRulesDto => ({
    damagePlayers: false,
    damageEntities: false,
    takeDamage: false,
    buildBreak: false,
    dropPickup: true,
    useDoors: true,
    useNpcs: true,
    useStorage: false,
    useItemFramesPaintings: false,
    healAmount: 1,
    healIntervalTicks: 20,
    feedAmount: 1,
    feedIntervalTicks: 10,
    saturationAmount: 1,
    saturationIntervalTicks: 20,
});

export const defaultHubSettings = (): HubSettingsDto => ({
    domainId: null,
    spawnReference: null,
    outageAction: 'SendToHub',
    outageDelaySeconds: 0,
    rules: defaultHubRules(),
    portalRegionIds: [],
});

const RULE_TOGGLES: { key: keyof HubRulesDto; label: string }[] = [
    { key: 'damagePlayers', label: 'Players may hurt players' },
    { key: 'damageEntities', label: 'Players may hurt mobs and animals' },
    { key: 'takeDamage', label: 'Players take damage' },
    { key: 'buildBreak', label: 'Building and breaking' },
    { key: 'dropPickup', label: 'Dropping and picking up items' },
    { key: 'useDoors', label: 'Doors, gates and trapdoors' },
    { key: 'useNpcs', label: 'Talking to NPCs' },
    { key: 'useStorage', label: 'Chests, barrels, shulker boxes and other storage' },
    { key: 'useItemFramesPaintings', label: 'Item frames and paintings' },
];

/** The API caps an outage delay at one day. */
export const MAX_OUTAGE_DELAY_SECONDS = 86400;

const NUMBER_RULES: { amount: keyof HubRulesDto; interval: keyof HubRulesDto; label: string; unit: string; whole: boolean }[] = [
    { amount: 'healAmount', interval: 'healIntervalTicks', label: 'Healing', unit: 'health', whole: false },
    { amount: 'feedAmount', interval: 'feedIntervalTicks', label: 'Feeding', unit: 'food', whole: true },
    { amount: 'saturationAmount', interval: 'saturationIntervalTicks', label: 'Saturation', unit: 'saturation', whole: false },
];

/**
 * The hub (hub DESIGN §16 Phase 4): which domains may be the hub, the selected hub and its spawn, what happens to online
 * players when the API is lost, and the rules inside the hub. Flagging a domain is saved at once; the rest is saved
 * with the page.
 */
export const HubSettingsCard: React.FC<{
    hub: HubSettingsDto;
    hubDomains: HubDomainDto[];
    /** Towns, districts and structures, for flagging a domain hub-eligible. */
    domainOptions: DomainOption[];
    /** Set when the flagged domains could not be loaded: the list below is then unknown, not empty. */
    hubDomainsError?: string | null;
    options: LocationOption[];
    onChange: (hub: HubSettingsDto) => void;
    onHubDomainsChange: (domains: HubDomainDto[]) => void;
    onCreateLocation?: () => void;
}> = ({ hub, hubDomains, hubDomainsError, domainOptions, options, onChange, onHubDomainsChange, onCreateLocation }) => {
    const [toFlag, setToFlag] = React.useState('');
    // The portal list is typed as free text and parsed on blur, so commas and spaces can be edited normally.
    const portalText = (hub.portalRegionIds ?? []).join(', ');
    const [portalDraft, setPortalDraft] = React.useState(portalText);
    React.useEffect(() => setPortalDraft(portalText), [portalText]);
    const commitPortals = () => onChange({
        ...hub,
        portalRegionIds: portalDraft.split(',').map(id => id.trim()).filter(id => id.length > 0),
    });
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const rules = hub.rules ?? defaultHubRules();
    const selected = hubDomains.find(d => d.id === hub.domainId) ?? null;
    const spawnWorld = hub.spawnReference?.location?.world;
    const hubWorld = selected?.worldName ?? hub.worldName;
    const unflagged = domainOptions
        .filter(o => !hubDomains.some(d => d.id === o.sourceId))
        .sort((a, b) => a.name.localeCompare(b.name));

    const setEligible = async (domainId: number, isHub: boolean) => {
        setBusy(true);
        setError(null);
        try {
            await gameSettingsClient.setHubEligible(domainId, isHub);
            onHubDomainsChange(await gameSettingsClient.getHubDomains());
        } catch (err) {
            setError(gameSettingsErrorMessage(err, isHub ? 'Could not flag the domain as a hub.' : 'Could not remove the hub flag.'));
        } finally {
            setBusy(false);
        }
    };

    const setRule = (key: keyof HubRulesDto, value: boolean | number) => onChange({ ...hub, rules: { ...rules, [key]: value } });

    return (
        <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-5" data-testid="hub-settings">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Hub</h2>
                <p className="mt-1 text-sm text-gray-600">
                    With a hub selected, every joining player arrives at the hub spawn, also while the API is down. The hub's
                    rules apply inside its region. Without a hub, players join as before.
                </p>
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">Hub-eligible domains</h3>
                <p className="text-xs text-gray-500">
                    Only a flagged domain can be selected as the hub. A flagged domain may not contain or sit inside another
                    flagged domain. Changes here are saved immediately.
                </p>
                {hubDomainsError && <p className="text-sm text-red-600" role="alert">{hubDomainsError}</p>}
                {!hubDomainsError && hubDomains.length === 0 && <p className="text-sm text-gray-500">No domain is flagged yet.</p>}
                <ul className="space-y-1">
                    {hubDomains.map(d => (
                        <li key={d.id} className="flex items-center justify-between rounded border border-gray-200 px-3 py-1.5 text-sm">
                            <span>
                                {d.name} <span className="text-gray-500">({d.domainType} #{d.id}, world {d.worldName || 'not set'})</span>
                                {d.selected && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">selected</span>}
                            </span>
                            <button
                                type="button"
                                className="btn-secondary text-xs"
                                aria-label={`Remove the hub flag of ${d.name}`}
                                disabled={busy}
                                title={d.selected ? 'Select another hub (or none) and save first' : undefined}
                                onClick={() => d.selected
                                    // Said rather than only disabled: a disabled button gave no feedback (smoke test 2026-10-17).
                                    ? setError(`${d.name} is the selected hub. Select another hub (or No hub) below and save the page before removing its flag.`)
                                    : void setEligible(d.id, false)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="flex flex-wrap items-end gap-2">
                    <select
                        aria-label="Domain to flag as hub"
                        value={toFlag}
                        onChange={e => setToFlag(e.target.value)}
                        className="block rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                    >
                        <option value="">Select a town, district or structure...</option>
                        {unflagged.map(o => (
                            <option key={o.key} value={String(o.sourceId)}>
                                {o.sourceType}: {o.name}{o.parents.length > 0 ? ` (${o.parents.join(' › ')})` : ''}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="btn-secondary text-sm"
                        disabled={!toFlag || busy || !!hubDomainsError}
                        onClick={() => {
                            const id = Number(toFlag);
                            setToFlag('');
                            void setEligible(id, true);
                        }}
                    >
                        <Plus className="h-4 w-4 mr-1" /> Flag as hub
                    </button>
                </div>
                {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hub-domain">Selected hub</label>
                    <select
                        id="hub-domain"
                        value={hub.domainId ?? ''}
                        disabled={!!hubDomainsError}
                        onChange={e => onChange({ ...hub, domainId: e.target.value ? Number(e.target.value) : null })}
                        className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                    >
                        <option value="">No hub</option>
                        {hubDomains.map(d => (
                            <option key={d.id} value={d.id}>{d.name} ({d.domainType}, {d.worldName || 'no world'})</option>
                        ))}
                    </select>
                </div>
            </div>

            {hub.domainId != null && (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Hub spawn (where joining players arrive)</label>
                    <LocationReferencePicker
                        value={hub.spawnReference ?? null}
                        options={options}
                        onChange={reference => onChange({ ...hub, spawnReference: reference })}
                        onCreateLocation={onCreateLocation}
                    />
                    {hub.spawnReference == null && <p className="text-xs text-red-600">A hub needs a spawn.</p>}
                    {spawnWorld && hubWorld && spawnWorld.toLowerCase() !== hubWorld.toLowerCase() && (
                        <p className="text-xs text-red-600">
                            The spawn is in world '{spawnWorld}', but the hub is in world '{hubWorld}'. Saving will be refused.
                        </p>
                    )}
                    <label className="block text-sm font-medium text-gray-700 pt-2" htmlFor="hub-portals">Portal regions</label>
                    <input
                        id="hub-portals"
                        type="text"
                        value={portalDraft}
                        onChange={e => setPortalDraft(e.target.value)}
                        onBlur={commitPortals}
                        placeholder="portal_north, portal_east"
                        className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                    />
                    <p className="text-xs text-gray-500">
                        WorldGuard region ids in the hub's world, separated by commas. Walking into one takes the player into
                        the game: to their group's join spawn, else the default join spawn. It works only while the API is up
                        and the player's account has loaded.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hub-outage-action">When the API is lost</label>
                    <select
                        id="hub-outage-action"
                        value={hub.outageAction}
                        onChange={e => onChange({ ...hub, outageAction: e.target.value as HubOutageAction })}
                        className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                    >
                        {(Object.keys(OUTAGE_ACTION_LABELS) as HubOutageAction[]).map(a => (
                            <option key={a} value={a}>{OUTAGE_ACTION_LABELS[a]}</option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">Applies to players outside the hub while the API is down; joins during an outage go to the hub. Players in staff or owner mode are never moved, kicked or sent to the hub.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="hub-outage-delay">Delay (seconds)</label>
                    <input
                        id="hub-outage-delay"
                        type="number"
                        min={0}
                        max={MAX_OUTAGE_DELAY_SECONDS}
                        value={hub.outageDelaySeconds}
                        onChange={e => onChange({ ...hub, outageDelaySeconds: Math.min(MAX_OUTAGE_DELAY_SECONDS, Math.max(0, Math.round(Number(e.target.value)) || 0)) })}
                        className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                    />
                    <p className="mt-1 text-xs text-gray-500">Counted from the first failed health check. The server confirms an outage after a few failed checks (about 20-30 s by default), so even 0 (Uit) acts only then.</p>
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">Rules inside the hub</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {RULE_TOGGLES.map(t => (
                        <label key={t.key} className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={Boolean(rules[t.key])}
                                onChange={e => setRule(t.key, e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            {t.label}
                        </label>
                    ))}
                </div>
                <p className="text-xs text-gray-500">Players always keep and use their own inventory.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {NUMBER_RULES.map(r => (
                        <div key={r.amount}>
                            <span className="block text-sm font-medium text-gray-700">{r.label}</span>
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                                <input
                                    type="number"
                                    min={0}
                                    step={r.whole ? 1 : 'any'}
                                    aria-label={`${r.label} amount`}
                                    value={rules[r.amount] as number}
                                    onChange={e => {
                                        const value = Math.max(0, Number(e.target.value) || 0);
                                        setRule(r.amount, r.whole ? Math.round(value) : value);
                                    }}
                                    className="w-20 rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                                />
                                {r.unit} every
                                <input
                                    type="number"
                                    min={1}
                                    aria-label={`${r.label} interval`}
                                    value={rules[r.interval] as number}
                                    onChange={e => setRule(r.interval, Math.max(1, Math.round(Number(e.target.value)) || 1))}
                                    className="w-20 rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                                />
                                ticks
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-500">
                    The defaults match vanilla Peaceful (1 health and 1 saturation every 20 ticks, 1 food every 10 ticks). Set an
                    amount to 0 to turn it off. It is skipped in a world that is already Peaceful.
                </p>
            </div>
        </div>
    );
};
