import React from 'react';
import { useNavigate } from 'react-router-dom';
import { gameSettingsClient } from '../../apiClients/gameSettingsClient';
import { locationClient } from '../../apiClients/locationClient';
import { townClient } from '../../apiClients/townClient';
import { districtClient } from '../../apiClients/districtClient';
import { structureClient } from '../../apiClients/structureClient';
import { permissionGroupClient } from '../../apiClients/permissionGroupClient';
import { DataRetentionCard } from '../../components/admin/DataRetentionCard';
import { GroupOverridesCard } from '../../components/admin/gameSettings/GroupOverridesCard';
import { HubSettingsCard, defaultHubRules, defaultHubSettings } from '../../components/admin/gameSettings/HubSettingsCard';
import { LocationReferencePicker } from '../../components/admin/gameSettings/LocationReferencePicker';
import { MinecraftLegacyPreview } from '../../components/admin/gameSettings/MinecraftLegacyPreview';
import { UNIT, describeWorldTime, joinHint } from '../../utils/settingsUnits';
import { RespawnPolicyEditor } from '../../components/admin/gameSettings/RespawnPolicyEditor';
import { PREVIEW_SAMPLE, fillMessagePlaceholders } from '../../components/admin/gameSettings/messagePlaceholders';
import { DomainOption, LocationOption, buildDomainOptions, buildLocationOptions } from '../../components/admin/gameSettings/locationReferenceOptions';
import { gameSettingsErrorMessage } from '../../components/admin/gameSettings/gameSettingsErrors';
import { PermissionGroupDto } from '../../types/dtos/userManagement/PermissionGroupDto';
import {
    GameSettingsDto,
    GameSettingsUpdateDto,
    HubDomainDto,
    JoinSpawnMode,
    RespawnPolicyDto,
    WeatherMode,
    WeatherType,
    WorldGameSettingsDto,
} from '../../types/dtos/gameSettings/GameSettingsModels';
import { SettingsPage, SettingsSection } from '../../components/SettingsPage';
import { Field } from '../../components/Field';
import { DataTable } from '../../components/DataTable';
import { formatDateTime, formatNumber } from '../../utils/format';

const WEATHER_TYPES: WeatherType[] = ['CLEAR', 'RAIN', 'THUNDER'];
const WEATHER_MODES: WeatherMode[] = ['Normal', 'Constant', 'Blocked', 'Weighted'];
const JOIN_SPAWN_MODES: JoinSpawnMode[] = ['WorldSpawn', 'CustomReference'];
const JOIN_SPAWN_MODE_LABELS: Record<JoinSpawnMode, string> = {
    WorldSpawn: "The main world's spawn",
    CustomReference: 'A chosen spot (Location, Town, District or Structure)',
};
const GAMEMODES = ['SURVIVAL', 'CREATIVE', 'ADVENTURE', 'SPECTATOR'];

const buildDefaultWorldSettings = (worldName: string, worldFolderName?: string | null): WorldGameSettingsDto => ({
    worldName,
    worldFolderName,
    defaultGameMode: 'SURVIVAL',
    lockTime: false,
    lockedTime: 18000,
    weather: {
        mode: 'Normal',
        forcedWeather: null,
        blockedWeatherTypes: [],
        clearWeight: 34,
        rainWeight: 33,
        thunderWeight: 33,
    },
    worldSpawnReference: null,
    respawnPolicy: {
        mode: 'WorldSpawn',
        useWorldSpawnFallback: true,
        maxNearestTownDistance: null,
        locationReference: null,
    },
});

/** KNG-118 (U5): a world's own spawn point can only be in that world. */
const optionsInWorld = (options: LocationOption[], worldName?: string | null): LocationOption[] =>
    worldName ? options.filter(o => (o.location?.world || '').toLowerCase() === worldName.toLowerCase()) : options;

const buildDefaultSettings = (): GameSettingsDto => ({
    id: 'global',
    settingsVersion: '1',
    joinAnnouncement: '&a{player} joined the server.',
    leaveAnnouncement: '&e{player} left the server.',
    joinSpawnMode: 'WorldSpawn',
    joinSpawnReference: null,
    defaultRespawnPolicy: {
        mode: 'WorldSpawn',
        useWorldSpawnFallback: true,
        maxNearestTownDistance: null,
        locationReference: null,
    },
    worldSettings: [],
    runtimeWorlds: [],
    runtimeWorldsLastUpdatedAt: null,
    motd: null,
    groupOverrides: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
});

const normalizeSettings = (settings: GameSettingsDto): GameSettingsDto => {
    const next = { ...settings };
    const byWorld = new Map<string, WorldGameSettingsDto>();

    (next.worldSettings || []).forEach(world => {
        if (!world.worldName) {
            return;
        }
        byWorld.set(world.worldName.toLowerCase(), {
            ...buildDefaultWorldSettings(world.worldName, world.worldFolderName),
            ...world,
            weather: {
                ...buildDefaultWorldSettings(world.worldName).weather,
                ...world.weather,
                blockedWeatherTypes: [...(world.weather?.blockedWeatherTypes || [])],
            },
            respawnPolicy: {
                ...buildDefaultWorldSettings(world.worldName).respawnPolicy,
                ...world.respawnPolicy,
            },
        });
    });

    (next.runtimeWorlds || []).forEach(runtime => {
        const key = runtime.worldName?.toLowerCase();
        if (!key || byWorld.has(key)) {
            return;
        }
        byWorld.set(key, buildDefaultWorldSettings(runtime.worldName, runtime.folderName));
    });

    next.worldSettings = Array.from(byWorld.values()).sort((a, b) => a.worldName.localeCompare(b.worldName));
    next.groupOverrides = next.groupOverrides || [];
    next.hub = { ...defaultHubSettings(), ...(next.hub || {}), rules: { ...defaultHubRules(), ...(next.hub?.rules || {}) } };

    if (!next.defaultRespawnPolicy) {
        next.defaultRespawnPolicy = {
            mode: 'WorldSpawn',
            useWorldSpawnFallback: true,
            maxNearestTownDistance: null,
            locationReference: null,
        };
    }

    return next;
};

/**
 * #187 (SET-4): what one Save writes, in groups an admin recognises; the shell counts the groups that differ
 * from the saved settings ("3 unsaved changes"). `worldSettings` counts per world.
 */
const CHANGE_GROUPS: Array<{ key: string; pick: (s: GameSettingsDto) => unknown }> = [
    { key: 'joinAnnouncement', pick: s => s.joinAnnouncement },
    { key: 'leaveAnnouncement', pick: s => s.leaveAnnouncement },
    { key: 'motd', pick: s => s.motd ?? '' },
    { key: 'joinSpawn', pick: s => [s.joinSpawnMode, s.joinSpawnReference ?? null] },
    { key: 'defaultRespawnPolicy', pick: s => s.defaultRespawnPolicy ?? null },
    { key: 'hub', pick: s => s.hub ?? null },
    { key: 'groupOverrides', pick: s => s.groupOverrides ?? [] },
];

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The keys of the changed groups (`world:<name>` per changed world). */
export const changedGameSettings = (saved: GameSettingsDto | null, current: GameSettingsDto | null): string[] => {
    if (!saved || !current) return [];
    const changed = CHANGE_GROUPS.filter(group => !same(group.pick(saved), group.pick(current))).map(group => group.key);
    const savedWorlds = new Map(saved.worldSettings.map(world => [world.worldName.toLowerCase(), world]));
    current.worldSettings.forEach(world => {
        if (!same(savedWorlds.get(world.worldName.toLowerCase()), world)) changed.push(`world:${world.worldName}`);
    });
    return changed;
};

export const GameSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const [settings, setSettings] = React.useState<GameSettingsDto | null>(null);
    /** #187: the settings as last loaded or saved; Discard goes back to them, changes are counted against them. */
    const [saved, setSaved] = React.useState<GameSettingsDto | null>(null);
    const [locationOptions, setLocationOptions] = React.useState<LocationOption[]>([]);
    const [groups, setGroups] = React.useState<PermissionGroupDto[]>([]);
    const [hubDomains, setHubDomains] = React.useState<HubDomainDto[]>([]);
    /** Set when the flagged domains could not be loaded: never shown as "no domain is flagged". */
    const [hubDomainsError, setHubDomainsError] = React.useState<string | null>(null);
    const [domainOptions, setDomainOptions] = React.useState<DomainOption[]>([]);
    const [loading, setLoading] = React.useState(true);
    // SET-1 (KNG-141): a failed load must not become an editable page of defaults that one Save
    // would write over the real MOTD, spawns and group overrides.
    const [loadFailed, setLoadFailed] = React.useState(false);

    React.useEffect(() => {
        void loadAll();
    // Loads once on open; Reload and Retry call it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const applyLoaded = (loaded: GameSettingsDto) => {
        const normalized = normalizeSettings(loaded);
        setSettings(normalized);
        setSaved(normalized);
    };

    const loadAll = async () => {
        try {
            setLoading(true);
            setLoadFailed(false);
            const [settingsData, locations, towns, districts, structures, permissionGroups, hubs] = await Promise.all([
                gameSettingsClient.get(),
                locationClient.getAll().catch(() => []),
                townClient.getAll().catch(() => []),
                districtClient.getAll().catch(() => []),
                structureClient.getAll().catch(() => []),
                permissionGroupClient.getAll().catch(() => [] as PermissionGroupDto[]),
                gameSettingsClient.getHubDomains().catch(error => {
                    console.error('Failed to load the hub-eligible domains:', error);
                    return null;
                }),
            ]);
            setGroups(permissionGroups as PermissionGroupDto[]);
            setHubDomains(hubs ?? []);
            setHubDomainsError(hubs == null
                ? 'The hub-eligible domains could not be loaded, so the hub cannot be changed now. Reload the page to try again.'
                : null);

            applyLoaded(settingsData);
            setLocationOptions(buildLocationOptions(locations as any[], towns as any[], districts as any[], structures as any[]));
            setDomainOptions(buildDomainOptions(towns as any[], districts as any[], structures as any[]));
        } catch (error) {
            console.error('Failed to load game settings:', error);
            setSettings(null);
            setSaved(null);
            setLoadFailed(true);
        } finally {
            setLoading(false);
        }
    };

    const updateSettings = (updater: (prev: GameSettingsDto) => GameSettingsDto) => {
        setSettings(prev => {
            const current = prev || normalizeSettings(buildDefaultSettings());
            return updater(current);
        });
    };

    const updateWorldSetting = (worldName: string, updater: (world: WorldGameSettingsDto) => WorldGameSettingsDto) => {
        updateSettings(prev => {
            const worldSettings = prev.worldSettings.map(world => {
                if (world.worldName.toLowerCase() !== worldName.toLowerCase()) {
                    return world;
                }
                return updater(world);
            });
            return { ...prev, worldSettings };
        });
    };

    const changed = React.useMemo(() => changedGameSettings(saved, settings), [saved, settings]);
    const isChanged = (...keys: string[]) => keys.some(key => changed.includes(key));

    // The shell catches a refusal and shows gameSettingsErrorMessage in its header (it was also an error toast).
    const handleSave = async () => {
        if (!settings) {
            return;
        }

        const payload: GameSettingsUpdateDto = {
            settingsVersion: settings.settingsVersion,
            joinAnnouncement: settings.joinAnnouncement,
            leaveAnnouncement: settings.leaveAnnouncement,
            joinSpawnMode: settings.joinSpawnMode,
            joinSpawnReference: settings.joinSpawnReference ?? null,
            defaultRespawnPolicy: settings.defaultRespawnPolicy ?? null,
            worldSettings: settings.worldSettings,
            motd: settings.motd ?? '',
            groupOverrides: settings.groupOverrides ?? [],
            hub: settings.hub ?? defaultHubSettings(),
        };

        try {
            applyLoaded(await gameSettingsClient.update(payload));
        } catch (error) {
            console.error('Failed to save game settings:', error);
            throw error;
        }
        setHubDomains(await gameSettingsClient.getHubDomains().catch(() => hubDomains));
        return 'Game settings saved.';
    };

    const runtimeWorlds = settings?.runtimeWorlds || [];

    return (
        <SettingsPage
            title="Game settings"
            description="Configure global gameplay behavior, per-world defaults, and announcements."
            width="max-w-7xl"
            lastSaved={{ at: saved?.updatedAt }}
            dirtyCount={changed.length}
            onSave={handleSave}
            onDiscard={() => saved && setSettings(saved)}
            onReload={loadAll}
            saveErrorMessage={error => gameSettingsErrorMessage(error, 'The settings could not be saved.')}
            loading={loading || (!settings && !loadFailed)}
            loadingLabel="Loading game settings…"
            loadError={loadFailed && !loading ? 'Game settings could not be loaded' : undefined}
            onRetry={() => void loadAll()}
        >
            {settings && (
            <>
                <SettingsSection
                    title="Minecraft Worlds Overview"
                    description={<>Loaded worlds reported by the plugin: <strong>{runtimeWorlds.length}</strong>
                        {settings.runtimeWorldsLastUpdatedAt && <> · Last plugin sync: {formatDateTime(settings.runtimeWorldsLastUpdatedAt)}</>}</>}
                >
                    {runtimeWorlds.length === 0 ? (
                        <p className="text-sm text-muted">
                            No runtime worlds reported yet. Start the plugin and wait for the periodic sync.
                        </p>
                    ) : (
                        <DataTable
                            caption="Loaded worlds"
                            density="compact"
                            className="border border-line rounded-md"
                            rows={runtimeWorlds}
                            rowKey={world => world.worldName}
                            columns={[
                                { key: 'worldName', header: 'World Name' },
                                { key: 'folderName', header: 'Folder Name' },
                                { key: 'environment', header: 'Environment' },
                                { key: 'playerCount', header: 'Players', align: 'right', cell: world => formatNumber(world.playerCount) },
                                { key: 'loaded', header: 'Loaded', cell: world => (world.loaded ? 'Yes' : 'No') },
                            ]}
                        />
                    )}
                </SettingsSection>

                <SettingsSection
                    title="Join/Leave Announcements"
                    changed={isChanged('joinAnnouncement', 'leaveAnnouncement')}
                    description={<>
                        Minecraft colour codes such as <code>&amp;a</code> and <code>&amp;c</code> (several per line), styles like
                        {' '}<code>&amp;l</code>, and hex as <code>&amp;x&amp;f&amp;f&amp;a&amp;a&amp;0&amp;0</code>.
                        Placeholders: <code>{'{player}'}</code>, <code>{'{title}'}</code> (the player's title, e.g. Knight; empty if
                        none; <code>{'{titlename}'}</code> also works) and <code>{'{group}'}</code> (the player's group). Leave a text
                        empty for no message. A permission group can have its own join and leave message (Permission Group
                        Overrides below). Previews use {PREVIEW_SAMPLE.player}, title {PREVIEW_SAMPLE.title}, group {PREVIEW_SAMPLE.group}.
                    </>}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                            <Field label="Join Announcement">
                                <textarea
                                    value={settings.joinAnnouncement}
                                    onChange={e => updateSettings(prev => ({ ...prev, joinAnnouncement: e.target.value }))}
                                    rows={3}
                                    className="input px-3 py-2"
                                />
                            </Field>
                            <div className="mt-2 rounded-md border border-line bg-surface-alt p-2">
                                <p className="text-xs text-muted mb-1">Preview</p>
                                <MinecraftLegacyPreview dark text={fillMessagePlaceholders(settings.joinAnnouncement, PREVIEW_SAMPLE)} />
                            </div>
                        </div>
                        <div>
                            <Field label="Leave Announcement">
                                <textarea
                                    value={settings.leaveAnnouncement}
                                    onChange={e => updateSettings(prev => ({ ...prev, leaveAnnouncement: e.target.value }))}
                                    rows={3}
                                    className="input px-3 py-2"
                                />
                            </Field>
                            <div className="mt-2 rounded-md border border-line bg-surface-alt p-2">
                                <p className="text-xs text-muted mb-1">Preview</p>
                                <MinecraftLegacyPreview dark text={fillMessagePlaceholders(settings.leaveAnnouncement, PREVIEW_SAMPLE)} />
                            </div>
                        </div>
                    </div>
                </SettingsSection>

                <SettingsSection
                    title="Server List MOTD"
                    changed={isChanged('motd')}
                    description={<>
                        The message under the server's name in the Minecraft server list: two lines, colour codes as above,
                        {' '}<code>{'{online}'}</code> and <code>{'{max}'}</code> for the player counts. Empty = the server's own
                        {' '}<code>server.properties</code> motd.
                    </>}
                >
                    <Field label="MOTD">
                        <textarea
                            value={settings.motd || ''}
                            onChange={e => updateSettings(prev => ({ ...prev, motd: e.target.value.split('\n').slice(0, 2).join('\n') }))}
                            rows={2}
                            className="input px-3 py-2 font-mono"
                        />
                    </Field>
                    <div className="rounded-md border border-line bg-surface-alt p-2">
                        <p className="text-xs text-muted mb-1">Preview</p>
                        <MinecraftLegacyPreview dark text={fillMessagePlaceholders(settings.motd || '', PREVIEW_SAMPLE)} />
                    </div>
                </SettingsSection>

                <SettingsSection
                    title="Join Spawn Settings"
                    changed={isChanged('joinSpawn')}
                    description={<>
                        Where players arrive on join; also where <code>/spawn</code> goes. Respawn can be synced with it per world
                        ("Same as the join spawn") or set separately. A permission group can have its own spawn.
                    </>}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Join Spawn Mode">
                            <select
                                value={settings.joinSpawnMode}
                                onChange={e => updateSettings(prev => ({ ...prev, joinSpawnMode: e.target.value as JoinSpawnMode }))}
                                className="input px-3 py-2"
                            >
                                {JOIN_SPAWN_MODES.map(mode => (
                                    <option key={mode} value={mode}>{JOIN_SPAWN_MODE_LABELS[mode]}</option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    {settings.joinSpawnMode === 'CustomReference' && (
                        <LocationReferencePicker
                            value={settings.joinSpawnReference || null}
                            options={locationOptions}
                            onChange={reference => updateSettings(prev => ({ ...prev, joinSpawnReference: reference }))}
                            onCreateLocation={() => navigate('/forms/location?autoOpen=true')}
                        />
                    )}
                </SettingsSection>

                <HubSettingsCard
                    hub={settings.hub ?? defaultHubSettings()}
                    hubDomains={hubDomains}
                    hubDomainsError={hubDomainsError}
                    domainOptions={domainOptions}
                    options={optionsInWorld(locationOptions,
                        hubDomains.find(d => d.id === settings.hub?.domainId)?.worldName ?? settings.hub?.worldName)}
                    onChange={hub => updateSettings(prev => ({ ...prev, hub }))}
                    onHubDomainsChange={setHubDomains}
                    onCreateLocation={() => navigate('/forms/location?autoOpen=true')}
                />

                <GroupOverridesCard
                    overrides={settings.groupOverrides || []}
                    groups={groups}
                    options={locationOptions}
                    onChange={groupOverrides => updateSettings(prev => ({ ...prev, groupOverrides }))}
                    onCreateLocation={() => navigate('/forms/location?autoOpen=true')}
                />

                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-fg">Per-World Minecraft Settings</h2>
                    {settings.worldSettings.length === 0 ? (
                        <div className="panel p-6 text-sm text-muted">
                            No world settings yet. They are auto-generated from plugin world runtime sync.
                        </div>
                    ) : (
                        settings.worldSettings.map(world => {
                            const weather = world.weather;
                            const respawn = world.respawnPolicy || ({ mode: 'WorldSpawn', useWorldSpawnFallback: true } as RespawnPolicyDto);
                            const weight = (label: string, value: number, key: 'clearWeight' | 'rainWeight' | 'thunderWeight') => (
                                <Field label={label}>
                                    <input
                                        type="number"
                                        min={0}
                                        value={value}
                                        onChange={e => updateWorldSetting(world.worldName, current => ({
                                            ...current,
                                            weather: { ...current.weather, [key]: Math.max(0, Number(e.target.value) || 0) },
                                        }))}
                                        className="input px-3 py-2"
                                    />
                                </Field>
                            );
                            return (
                                <SettingsSection
                                    key={world.worldName}
                                    title={world.worldName}
                                    description={`Folder: ${world.worldFolderName || world.worldName}`}
                                    changed={isChanged(`world:${world.worldName}`)}
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Field label="Default GameMode">
                                            <select
                                                value={world.defaultGameMode}
                                                onChange={e => updateWorldSetting(world.worldName, current => ({ ...current, defaultGameMode: e.target.value }))}
                                                className="input px-3 py-2"
                                            >
                                                {GAMEMODES.map(mode => (
                                                    <option key={mode} value={mode}>{mode}</option>
                                                ))}
                                            </select>
                                        </Field>
                                        <fieldset>
                                            <legend className="block text-sm font-medium text-fg mb-1">Lock Time</legend>
                                            <Field label="Keep fixed world time" inline>
                                                <input
                                                    type="checkbox"
                                                    checked={world.lockTime}
                                                    onChange={e => updateWorldSetting(world.worldName, current => ({ ...current, lockTime: e.target.checked }))}
                                                    className="rounded border-field text-primary focus:ring-primary"
                                                />
                                            </Field>
                                        </fieldset>
                                        <Field
                                            label="Locked Time"
                                            unit={UNIT.ticks}
                                            hint={joinHint('World time kept while Lock Time is on; 0 = sunrise, 6000 = noon, 18000 = midnight.', describeWorldTime(world.lockedTime))}
                                        >
                                            <input
                                                type="number"
                                                value={world.lockedTime}
                                                onChange={e => updateWorldSetting(world.worldName, current => ({ ...current, lockedTime: Number(e.target.value) || 0 }))}
                                                className="input px-3 py-2"
                                            />
                                        </Field>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Field label="Weather Behavior">
                                            <select
                                                value={weather.mode}
                                                onChange={e => updateWorldSetting(world.worldName, current => ({
                                                    ...current,
                                                    weather: { ...current.weather, mode: e.target.value as WeatherMode },
                                                }))}
                                                className="input px-3 py-2"
                                            >
                                                {WEATHER_MODES.map(mode => (
                                                    <option key={mode} value={mode}>{mode}</option>
                                                ))}
                                            </select>
                                        </Field>
                                        {weather.mode === 'Constant' && (
                                            <Field label="Forced Weather">
                                                <select
                                                    value={weather.forcedWeather || 'CLEAR'}
                                                    onChange={e => updateWorldSetting(world.worldName, current => ({
                                                        ...current,
                                                        weather: { ...current.weather, forcedWeather: e.target.value as WeatherType },
                                                    }))}
                                                    className="input px-3 py-2"
                                                >
                                                    {WEATHER_TYPES.map(type => (
                                                        <option key={type} value={type}>{type}</option>
                                                    ))}
                                                </select>
                                            </Field>
                                        )}
                                    </div>

                                    {weather.mode === 'Blocked' && (
                                        <fieldset>
                                            <legend className="text-sm font-medium text-fg mb-2">Blocked Weather Types</legend>
                                            <div className="flex gap-4">
                                                {WEATHER_TYPES.map(type => {
                                                    const checked = weather.blockedWeatherTypes.includes(type);
                                                    return (
                                                        <Field key={type} label={type} inline>
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={e => {
                                                                    const blocked = new Set(weather.blockedWeatherTypes);
                                                                    if (e.target.checked) {
                                                                        blocked.add(type);
                                                                    } else {
                                                                        blocked.delete(type);
                                                                    }
                                                                    updateWorldSetting(world.worldName, current => ({
                                                                        ...current,
                                                                        weather: { ...current.weather, blockedWeatherTypes: Array.from(blocked) as WeatherType[] },
                                                                    }));
                                                                }}
                                                                className="rounded border-field text-primary focus:ring-primary"
                                                            />
                                                        </Field>
                                                    );
                                                })}
                                            </div>
                                        </fieldset>
                                    )}

                                    {weather.mode === 'Weighted' && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {weight('Clear Weight', weather.clearWeight, 'clearWeight')}
                                            {weight('Rain Weight', weather.rainWeight, 'rainWeight')}
                                            {weight('Thunder Weight', weather.thunderWeight, 'thunderWeight')}
                                        </div>
                                    )}

                                    <div className="border-t border-line pt-4">
                                        <p className="text-sm font-semibold text-fg mb-2">World Spawn Point</p>
                                        <LocationReferencePicker
                                            value={world.worldSpawnReference || null}
                                            options={optionsInWorld(locationOptions, world.worldName)}
                                            onChange={reference => updateWorldSetting(world.worldName, current => ({ ...current, worldSpawnReference: reference }))}
                                            onCreateLocation={() => navigate('/forms/location?autoOpen=true')}
                                        />
                                    </div>

                                    <div className="border-t border-line pt-4 space-y-3">
                                        <p className="text-sm font-semibold text-fg">Respawn after dying in this world</p>
                                        <RespawnPolicyEditor
                                            value={respawn}
                                            options={locationOptions}
                                            onChange={policy => updateWorldSetting(world.worldName, current => ({ ...current, respawnPolicy: policy }))}
                                            onCreateLocation={() => navigate('/forms/location?autoOpen=true')}
                                        />
                                    </div>
                                </SettingsSection>
                            );
                        })
                    )}
                </div>

                {/* Audit log / private message log retention - saved on its own (knk.admin.config), not by the page's Save. */}
                <DataRetentionCard />
            </>
            )}
        </SettingsPage>
    );
};
