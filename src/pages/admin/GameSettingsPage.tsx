import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCcw, Save } from 'lucide-react';
import { logging } from '../../utils';
import { gameSettingsClient } from '../../apiClients/gameSettingsClient';
import { locationClient } from '../../apiClients/locationClient';
import { townClient } from '../../apiClients/townClient';
import { districtClient } from '../../apiClients/districtClient';
import { structureClient } from '../../apiClients/structureClient';
import { permissionGroupClient } from '../../apiClients/permissionGroupClient';
import { DataRetentionCard } from '../../components/admin/DataRetentionCard';
import { GroupOverridesCard } from '../../components/admin/gameSettings/GroupOverridesCard';
import { LocationReferencePicker } from '../../components/admin/gameSettings/LocationReferencePicker';
import { MinecraftLegacyPreview } from '../../components/admin/gameSettings/MinecraftLegacyPreview';
import { RespawnPolicyEditor } from '../../components/admin/gameSettings/RespawnPolicyEditor';
import { PREVIEW_SAMPLE, fillMessagePlaceholders } from '../../components/admin/gameSettings/messagePlaceholders';
import { LocationOption, buildLocationOptions } from '../../components/admin/gameSettings/locationReferenceOptions';
import { PermissionGroupDto } from '../../types/dtos/userManagement/PermissionGroupDto';
import {
    GameSettingsDto,
    GameSettingsUpdateDto,
    JoinSpawnMode,
    RespawnPolicyDto,
    WeatherMode,
    WeatherType,
    WorldGameSettingsDto,
} from '../../types/dtos/gameSettings/GameSettingsModels';

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

export const GameSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const [settings, setSettings] = React.useState<GameSettingsDto | null>(null);
    const [locationOptions, setLocationOptions] = React.useState<LocationOption[]>([]);
    const [groups, setGroups] = React.useState<PermissionGroupDto[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        void loadAll();
    }, []);

    const loadAll = async () => {
        try {
            setLoading(true);
            const [settingsData, locations, towns, districts, structures, permissionGroups] = await Promise.all([
                gameSettingsClient.get(),
                locationClient.getAll().catch(() => []),
                townClient.getAll().catch(() => []),
                districtClient.getAll().catch(() => []),
                structureClient.getAll().catch(() => []),
                permissionGroupClient.getAll().catch(() => [] as PermissionGroupDto[]),
            ]);
            setGroups(permissionGroups as PermissionGroupDto[]);

            setSettings(normalizeSettings(settingsData));
            setLocationOptions(buildLocationOptions(locations as any[], towns as any[], districts as any[], structures as any[]));
        } catch (error) {
            console.error('Failed to load game settings:', error);
            logging.errorHandler.next('ErrorMessage.GameSettings.LoadFailed');
            setSettings(normalizeSettings(buildDefaultSettings()));
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
        };

        try {
            setSaving(true);
            const updated = await gameSettingsClient.update(payload);
            setSettings(normalizeSettings(updated));
        } catch (error) {
            console.error('Failed to save game settings:', error);
            logging.errorHandler.next('ErrorMessage.GameSettings.SaveFailed');
        } finally {
            setSaving(false);
        }
    };

    const runtimeWorlds = settings?.runtimeWorlds || [];

    if (loading || !settings) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Game Manager Settings</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Configure global gameplay behavior, per-world defaults, and announcements.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="btn-secondary text-sm" onClick={() => void loadAll()}>
                                <RefreshCcw className="h-4 w-4 mr-2" />
                                Reload
                            </button>
                            <button className="btn-primary text-sm" onClick={() => void handleSave()} disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                Save Settings
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Minecraft Worlds Overview</h2>
                    <p className="text-sm text-gray-600 mb-4">
                        Loaded worlds reported by the plugin: <strong>{runtimeWorlds.length}</strong>
                    </p>
                    {settings.runtimeWorldsLastUpdatedAt && (
                        <p className="text-xs text-gray-500 mb-4">
                            Last plugin sync: {new Date(settings.runtimeWorldsLastUpdatedAt).toLocaleString()}
                        </p>
                    )}
                    {runtimeWorlds.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            No runtime worlds reported yet. Start the plugin and wait for the periodic sync.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b border-gray-200">
                                        <th className="py-2 pr-4">World Name</th>
                                        <th className="py-2 pr-4">Folder Name</th>
                                        <th className="py-2 pr-4">Environment</th>
                                        <th className="py-2 pr-4">Players</th>
                                        <th className="py-2 pr-4">Loaded</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {runtimeWorlds.map(world => (
                                        <tr key={world.worldName} className="border-b border-gray-100">
                                            <td className="py-2 pr-4 font-medium text-gray-900">{world.worldName}</td>
                                            <td className="py-2 pr-4 text-gray-700">{world.folderName}</td>
                                            <td className="py-2 pr-4 text-gray-700">{world.environment}</td>
                                            <td className="py-2 pr-4 text-gray-700">{world.playerCount}</td>
                                            <td className="py-2 pr-4 text-gray-700">{world.loaded ? 'Yes' : 'No'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900">Join/Leave Announcements</h2>
                    <p className="text-sm text-gray-600">
                        Minecraft colour codes such as <code>&amp;a</code> and <code>&amp;c</code> (several per line), styles like
                        {' '}<code>&amp;l</code>, and hex as <code>&amp;x&amp;f&amp;f&amp;a&amp;a&amp;0&amp;0</code>.
                        Placeholders: <code>{'{player}'}</code>, <code>{'{title}'}</code> (the player's title, e.g. Knight; empty if
                        none; <code>{'{titlename}'}</code> also works) and <code>{'{group}'}</code> (the player's group). Leave a text
                        empty for no message. A permission group can have its own join and leave message (Permission Group
                        Overrides below). Previews use {PREVIEW_SAMPLE.player}, title {PREVIEW_SAMPLE.title}, group {PREVIEW_SAMPLE.group}.
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Join Announcement</label>
                            <textarea
                                value={settings.joinAnnouncement}
                                onChange={e => updateSettings(prev => ({ ...prev, joinAnnouncement: e.target.value }))}
                                rows={3}
                                className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                            />
                            <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2">
                                <p className="text-xs text-gray-500 mb-1">Preview</p>
                                <MinecraftLegacyPreview dark text={fillMessagePlaceholders(settings.joinAnnouncement, PREVIEW_SAMPLE)} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Leave Announcement</label>
                            <textarea
                                value={settings.leaveAnnouncement}
                                onChange={e => updateSettings(prev => ({ ...prev, leaveAnnouncement: e.target.value }))}
                                rows={3}
                                className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                            />
                            <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2">
                                <p className="text-xs text-gray-500 mb-1">Preview</p>
                                <MinecraftLegacyPreview dark text={fillMessagePlaceholders(settings.leaveAnnouncement, PREVIEW_SAMPLE)} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-3">
                    <h2 className="text-lg font-semibold text-gray-900">Server List MOTD</h2>
                    <p className="text-sm text-gray-600">
                        The message under the server's name in the Minecraft server list: two lines, colour codes as above,
                        {' '}<code>{'{online}'}</code> and <code>{'{max}'}</code> for the player counts. Empty = the server's own
                        {' '}<code>server.properties</code> motd.
                    </p>
                    <textarea
                        aria-label="MOTD"
                        value={settings.motd || ''}
                        onChange={e => updateSettings(prev => ({ ...prev, motd: e.target.value.split('\n').slice(0, 2).join('\n') }))}
                        rows={2}
                        className="block w-full rounded-md border-gray-300 font-mono focus:border-primary focus:ring-primary"
                    />
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
                        <p className="text-xs text-gray-500 mb-1">Preview</p>
                        <MinecraftLegacyPreview dark text={fillMessagePlaceholders(settings.motd || '', PREVIEW_SAMPLE)} />
                    </div>
                </div>

                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900">Join Spawn Settings</h2>
                    <p className="text-sm text-gray-600">
                        Where players arrive on join; also where <code>/spawn</code> goes. Respawn can be synced with it per world
                        ("Same as the join spawn") or set separately. A permission group can have its own spawn.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Join Spawn Mode</label>
                            <select
                                value={settings.joinSpawnMode}
                                onChange={e => updateSettings(prev => ({ ...prev, joinSpawnMode: e.target.value as JoinSpawnMode }))}
                                className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                            >
                                {JOIN_SPAWN_MODES.map(mode => (
                                    <option key={mode} value={mode}>{JOIN_SPAWN_MODE_LABELS[mode]}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {settings.joinSpawnMode === 'CustomReference' && (
                        <LocationReferencePicker
                            value={settings.joinSpawnReference || null}
                            options={locationOptions}
                            onChange={reference => updateSettings(prev => ({ ...prev, joinSpawnReference: reference }))}
                            onCreateLocation={() => navigate('/forms/location?autoOpen=true')}
                        />
                    )}
                </div>

                <GroupOverridesCard
                    overrides={settings.groupOverrides || []}
                    groups={groups}
                    options={locationOptions}
                    onChange={groupOverrides => updateSettings(prev => ({ ...prev, groupOverrides }))}
                    onCreateLocation={() => navigate('/forms/location?autoOpen=true')}
                />

                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900">Per-World Minecraft Settings</h2>
                    {settings.worldSettings.length === 0 ? (
                        <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 text-sm text-gray-500">
                            No world settings yet. They are auto-generated from plugin world runtime sync.
                        </div>
                    ) : (
                        settings.worldSettings.map(world => {
                            const weather = world.weather;
                            const respawn = world.respawnPolicy || ({ mode: 'WorldSpawn', useWorldSpawnFallback: true } as RespawnPolicyDto);
                            return (
                                <div key={world.worldName} className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-4">
                                    <div>
                                        <h3 className="text-base font-semibold text-gray-900">{world.worldName}</h3>
                                        <p className="text-sm text-gray-500">Folder: {world.worldFolderName || world.worldName}</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Default GameMode</label>
                                            <select
                                                value={world.defaultGameMode}
                                                onChange={e => updateWorldSetting(world.worldName, current => ({ ...current, defaultGameMode: e.target.value }))}
                                                className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                                            >
                                                {GAMEMODES.map(mode => (
                                                    <option key={mode} value={mode}>{mode}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Lock Time</label>
                                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                                <input
                                                    type="checkbox"
                                                    checked={world.lockTime}
                                                    onChange={e => updateWorldSetting(world.worldName, current => ({ ...current, lockTime: e.target.checked }))}
                                                    className="rounded border-gray-300"
                                                />
                                                Keep fixed world time
                                            </label>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Locked Time (ticks)</label>
                                            <input
                                                type="number"
                                                value={world.lockedTime}
                                                onChange={e => updateWorldSetting(world.worldName, current => ({ ...current, lockedTime: Number(e.target.value) || 0 }))}
                                                className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Weather Behavior</label>
                                            <select
                                                value={weather.mode}
                                                onChange={e => updateWorldSetting(world.worldName, current => ({
                                                    ...current,
                                                    weather: { ...current.weather, mode: e.target.value as WeatherMode },
                                                }))}
                                                className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                                            >
                                                {WEATHER_MODES.map(mode => (
                                                    <option key={mode} value={mode}>{mode}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {weather.mode === 'Constant' && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Forced Weather</label>
                                                <select
                                                    value={weather.forcedWeather || 'CLEAR'}
                                                    onChange={e => updateWorldSetting(world.worldName, current => ({
                                                        ...current,
                                                        weather: { ...current.weather, forcedWeather: e.target.value as WeatherType },
                                                    }))}
                                                    className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                                                >
                                                    {WEATHER_TYPES.map(type => (
                                                        <option key={type} value={type}>{type}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    {weather.mode === 'Blocked' && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-700 mb-2">Blocked Weather Types</p>
                                            <div className="flex gap-4">
                                                {WEATHER_TYPES.map(type => {
                                                    const checked = weather.blockedWeatherTypes.includes(type);
                                                    return (
                                                        <label key={type} className="inline-flex items-center gap-2 text-sm text-gray-700">
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
                                                                className="rounded border-gray-300"
                                                            />
                                                            {type}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {weather.mode === 'Weighted' && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Clear Weight</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={weather.clearWeight}
                                                    onChange={e => updateWorldSetting(world.worldName, current => ({
                                                        ...current,
                                                        weather: { ...current.weather, clearWeight: Math.max(0, Number(e.target.value) || 0) },
                                                    }))}
                                                    className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Rain Weight</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={weather.rainWeight}
                                                    onChange={e => updateWorldSetting(world.worldName, current => ({
                                                        ...current,
                                                        weather: { ...current.weather, rainWeight: Math.max(0, Number(e.target.value) || 0) },
                                                    }))}
                                                    className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Thunder Weight</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={weather.thunderWeight}
                                                    onChange={e => updateWorldSetting(world.worldName, current => ({
                                                        ...current,
                                                        weather: { ...current.weather, thunderWeight: Math.max(0, Number(e.target.value) || 0) },
                                                    }))}
                                                    className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="border-t border-gray-200 pt-4">
                                        <p className="text-sm font-semibold text-gray-800 mb-2">World Spawn Point</p>
                                        <LocationReferencePicker
                                            value={world.worldSpawnReference || null}
                                            options={locationOptions}
                                            onChange={reference => updateWorldSetting(world.worldName, current => ({ ...current, worldSpawnReference: reference }))}
                                            onCreateLocation={() => navigate('/forms/location?autoOpen=true')}
                                        />
                                    </div>

                                    <div className="border-t border-gray-200 pt-4 space-y-3">
                                        <p className="text-sm font-semibold text-gray-800">Respawn after dying in this world</p>
                                        <RespawnPolicyEditor
                                            value={respawn}
                                            options={locationOptions}
                                            onChange={policy => updateWorldSetting(world.worldName, current => ({ ...current, respawnPolicy: policy }))}
                                            onCreateLocation={() => navigate('/forms/location?autoOpen=true')}
                                        />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Audit log / private message log retention - saved on its own (knk.admin.config). */}
                <DataRetentionCard />
            </div>
        </div>
    );
};
