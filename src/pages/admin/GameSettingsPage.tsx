import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCcw, Save } from 'lucide-react';
import { logging } from '../../utils';
import { gameSettingsClient } from '../../apiClients/gameSettingsClient';
import { locationClient } from '../../apiClients/locationClient';
import { townClient } from '../../apiClients/townClient';
import { districtClient } from '../../apiClients/districtClient';
import { structureClient } from '../../apiClients/structureClient';
import {
    GameSettingsDto,
    GameSettingsUpdateDto,
    JoinSpawnMode,
    LocationReferenceDto,
    LocationReferenceSourceType,
    LocationSnapshotDto,
    RespawnMode,
    RespawnPolicyDto,
    WeatherMode,
    WeatherType,
    WorldGameSettingsDto,
} from '../../types/dtos/gameSettings/GameSettingsModels';

type LocationOption = {
    key: string;
    sourceType: LocationReferenceSourceType;
    sourceId: number;
    displayLabel: string;
    location: LocationSnapshotDto;
};

const WEATHER_TYPES: WeatherType[] = ['CLEAR', 'RAIN', 'THUNDER'];
const WEATHER_MODES: WeatherMode[] = ['Normal', 'Constant', 'Blocked', 'Weighted'];
const RESPAWN_MODES: RespawnMode[] = ['WorldSpawn', 'ConfiguredReference', 'NearestTown'];
const JOIN_SPAWN_MODES: JoinSpawnMode[] = ['WorldSpawn', 'CustomReference'];
const SOURCE_TYPES: LocationReferenceSourceType[] = ['Location', 'Town', 'District', 'Structure'];
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

const toLocationSnapshot = (location: any): LocationSnapshotDto | null => {
    if (!location) {
        return null;
    }

    const x = Number(location.x ?? location.X);
    const y = Number(location.y ?? location.Y);
    const z = Number(location.z ?? location.Z);

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return null;
    }

    return {
        locationId: location.id ?? location.Id ?? null,
        name: location.name ?? location.Name ?? null,
        x,
        y,
        z,
        yaw: Number(location.yaw ?? location.Yaw ?? 0),
        pitch: Number(location.pitch ?? location.Pitch ?? 0),
        world: String(location.world ?? location.World ?? 'world'),
    };
};

const buildLocationOptions = (
    locations: any[],
    towns: any[],
    districts: any[],
    structures: any[]
): LocationOption[] => {
    const options: LocationOption[] = [];

    const locationMap = new Map<number, LocationSnapshotDto>();
    locations.forEach(raw => {
        const snapshot = toLocationSnapshot(raw);
        if (!snapshot || snapshot.locationId == null) {
            return;
        }
        locationMap.set(snapshot.locationId, snapshot);
        options.push({
            key: `Location-${snapshot.locationId}`,
            sourceType: 'Location',
            sourceId: snapshot.locationId,
            displayLabel: `Location: ${snapshot.name || `#${snapshot.locationId}`} (${snapshot.world} ${snapshot.x}, ${snapshot.y}, ${snapshot.z})`,
            location: snapshot,
        });
    });

    const addFromDomain = (sourceType: LocationReferenceSourceType, values: any[]) => {
        values.forEach(raw => {
            const sourceId = Number(raw.id ?? raw.Id);
            if (!Number.isFinite(sourceId) || sourceId <= 0) {
                return;
            }

            const direct = toLocationSnapshot(raw.location ?? raw.Location);
            const fallbackLocationId = Number(raw.locationId ?? raw.LocationId);
            const fallback = Number.isFinite(fallbackLocationId) ? locationMap.get(fallbackLocationId) : undefined;
            const location = direct ?? fallback ?? null;

            if (!location) {
                return;
            }

            const name = String(raw.name ?? raw.Name ?? `${sourceType} #${sourceId}`);
            options.push({
                key: `${sourceType}-${sourceId}`,
                sourceType,
                sourceId,
                displayLabel: `${sourceType}: ${name} (${location.world} ${location.x}, ${location.y}, ${location.z})`,
                location,
            });
        });
    };

    addFromDomain('Town', towns || []);
    addFromDomain('District', districts || []);
    addFromDomain('Structure', structures || []);

    return options.sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));
};

export const GameSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const [settings, setSettings] = React.useState<GameSettingsDto | null>(null);
    const [locationOptions, setLocationOptions] = React.useState<LocationOption[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        void loadAll();
    }, []);

    const loadAll = async () => {
        try {
            setLoading(true);
            const [settingsData, locations, towns, districts, structures] = await Promise.all([
                gameSettingsClient.get(),
                locationClient.getAll().catch(() => []),
                townClient.getAll().catch(() => []),
                districtClient.getAll().catch(() => []),
                structureClient.getAll().catch(() => []),
            ]);

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
                        Supports Minecraft legacy color codes such as <code>&amp;a</code>, <code>&amp;c</code>, and hex formatting.
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
                            <p className="text-xs text-gray-500 mt-1">Use <code>{'{player}'}</code> placeholder for player name.</p>
                            <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2">
                                <p className="text-xs text-gray-500 mb-1">Preview</p>
                                <MinecraftLegacyPreview text={settings.joinAnnouncement.replace('{player}', 'Steve')} />
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
                            <p className="text-xs text-gray-500 mt-1">Use <code>{'{player}'}</code> placeholder for player name.</p>
                            <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2">
                                <p className="text-xs text-gray-500 mb-1">Preview</p>
                                <MinecraftLegacyPreview text={settings.leaveAnnouncement.replace('{player}', 'Alex')} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900">Join Spawn Settings</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Join Spawn Mode</label>
                            <select
                                value={settings.joinSpawnMode}
                                onChange={e => updateSettings(prev => ({ ...prev, joinSpawnMode: e.target.value as JoinSpawnMode }))}
                                className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                            >
                                {JOIN_SPAWN_MODES.map(mode => (
                                    <option key={mode} value={mode}>{mode}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {settings.joinSpawnMode === 'CustomReference' && (
                        <LocationReferenceSelector
                            value={settings.joinSpawnReference || null}
                            options={locationOptions}
                            onChange={reference => updateSettings(prev => ({ ...prev, joinSpawnReference: reference }))}
                            onCreateLocation={() => navigate('/forms/location?autoOpen=true')}
                        />
                    )}
                </div>

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
                                        <p className="text-sm font-semibold text-gray-800 mb-2">World Spawn Reference</p>
                                        <LocationReferenceSelector
                                            value={world.worldSpawnReference || null}
                                            options={locationOptions}
                                            onChange={reference => updateWorldSetting(world.worldName, current => ({ ...current, worldSpawnReference: reference }))}
                                            onCreateLocation={() => navigate('/forms/location?autoOpen=true')}
                                        />
                                    </div>

                                    <div className="border-t border-gray-200 pt-4 space-y-3">
                                        <p className="text-sm font-semibold text-gray-800">Respawn Policy</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                                                <select
                                                    value={respawn.mode}
                                                    onChange={e => updateWorldSetting(world.worldName, current => ({
                                                        ...current,
                                                        respawnPolicy: {
                                                            ...(current.respawnPolicy || { useWorldSpawnFallback: true }),
                                                            mode: e.target.value as RespawnMode,
                                                        },
                                                    }))}
                                                    className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                                                >
                                                    {RESPAWN_MODES.map(mode => (
                                                        <option key={mode} value={mode}>{mode}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Fallback To World Spawn</label>
                                                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={respawn.useWorldSpawnFallback}
                                                        onChange={e => updateWorldSetting(world.worldName, current => ({
                                                            ...current,
                                                            respawnPolicy: {
                                                                ...(current.respawnPolicy || { mode: 'WorldSpawn' as RespawnMode }),
                                                                useWorldSpawnFallback: e.target.checked,
                                                            },
                                                        }))}
                                                        className="rounded border-gray-300"
                                                    />
                                                    Use world spawn if policy cannot resolve location
                                                </label>
                                            </div>
                                        </div>

                                        {respawn.mode === 'ConfiguredReference' && (
                                            <LocationReferenceSelector
                                                value={respawn.locationReference || null}
                                                options={locationOptions}
                                                onChange={reference => updateWorldSetting(world.worldName, current => ({
                                                    ...current,
                                                    respawnPolicy: { ...(current.respawnPolicy || respawn), locationReference: reference },
                                                }))}
                                                onCreateLocation={() => navigate('/forms/location?autoOpen=true')}
                                            />
                                        )}

                                        {respawn.mode === 'NearestTown' && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Max Nearest-Town Distance (optional, blocks beyond this)</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={respawn.maxNearestTownDistance ?? ''}
                                                    onChange={e => updateWorldSetting(world.worldName, current => ({
                                                        ...current,
                                                        respawnPolicy: {
                                                            ...(current.respawnPolicy || respawn),
                                                            maxNearestTownDistance: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0),
                                                        },
                                                    }))}
                                                    className="block w-full md:w-80 rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

const LocationReferenceSelector: React.FC<{
    value: LocationReferenceDto | null;
    options: LocationOption[];
    onChange: (value: LocationReferenceDto | null) => void;
    onCreateLocation: () => void;
}> = ({ value, options, onChange, onCreateLocation }) => {
    const selectedType: LocationReferenceSourceType = value?.sourceType || 'Location';
    const typedOptions = options.filter(option => option.sourceType === selectedType);

    const selectedOption = typedOptions.find(
        option => option.sourceId === value?.sourceId && option.sourceType === value?.sourceType
    );

    return (
        <div className="space-y-3 rounded-md border border-gray-200 p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reference Type</label>
                    <select
                        value={selectedType}
                        onChange={e => {
                            const nextType = e.target.value as LocationReferenceSourceType;
                            const firstOption = options.find(option => option.sourceType === nextType) || null;
                            if (!firstOption) {
                                onChange(null);
                                return;
                            }
                            onChange({
                                sourceType: firstOption.sourceType,
                                sourceId: firstOption.sourceId,
                                displayLabel: firstOption.displayLabel,
                                location: firstOption.location,
                            });
                        }}
                        className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                    >
                        {SOURCE_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                    <select
                        value={selectedOption?.key || ''}
                        onChange={e => {
                            const option = typedOptions.find(candidate => candidate.key === e.target.value) || null;
                            if (!option) {
                                onChange(null);
                                return;
                            }
                            onChange({
                                sourceType: option.sourceType,
                                sourceId: option.sourceId,
                                displayLabel: option.displayLabel,
                                location: option.location,
                            });
                        }}
                        className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                    >
                        <option value="">Select reference...</option>
                        {typedOptions.map(option => (
                            <option key={option.key} value={option.key}>{option.displayLabel}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary text-xs" onClick={onCreateLocation}>
                    Create/Select Location via Form Wizard
                </button>
                <button type="button" className="btn-secondary text-xs" onClick={() => onChange(null)}>
                    Clear Reference
                </button>
            </div>

            {value?.location && (
                <p className="text-xs text-gray-600">
                    Resolved position: {value.location.world} {value.location.x}, {value.location.y}, {value.location.z}
                </p>
            )}
        </div>
    );
};

type LegacyStyleState = {
    color?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
};

type LegacySegment = {
    text: string;
    style: LegacyStyleState;
};

const LEGACY_SECTION_CHAR = '§';
const LEGACY_ALT_CHAR = '&';
const LEGACY_TRANSLATABLE_CODES = '0123456789AaBbCcDdEeFfKkLlMmNnOoRrXx';

const LEGACY_COLOR_MAP: Record<string, string> = {
    '0': '#000000',
    '1': '#0000AA',
    '2': '#00AA00',
    '3': '#00AAAA',
    '4': '#AA0000',
    '5': '#AA00AA',
    '6': '#FFAA00',
    '7': '#AAAAAA',
    '8': '#555555',
    '9': '#5555FF',
    a: '#55FF55',
    b: '#55FFFF',
    c: '#FF5555',
    d: '#FF55FF',
    e: '#FFFF55',
    f: '#FFFFFF',
};

const translateAlternateColorCodes = (altColorChar: string, textToTranslate: string): string => {
    if (!textToTranslate) {
        return '';
    }

    const chars = textToTranslate.split('');
    for (let i = 0; i < chars.length - 1; i++) {
        if (chars[i] === altColorChar && LEGACY_TRANSLATABLE_CODES.indexOf(chars[i + 1]) > -1) {
            chars[i] = LEGACY_SECTION_CHAR;
            chars[i + 1] = chars[i + 1].toLowerCase();
        }
    }
    return chars.join('');
};

const toStyle = (state: LegacyStyleState): React.CSSProperties => ({
    color: state.color,
    fontWeight: state.bold ? 700 : undefined,
    fontStyle: state.italic ? 'italic' : undefined,
    textDecoration: [
        state.underline ? 'underline' : '',
        state.strikethrough ? 'line-through' : '',
    ]
        .filter(Boolean)
        .join(' ') || undefined,
});

const deserializeLegacyText = (input: string): LegacySegment[] => {
    if (!input) {
        return [];
    }

    const segments: LegacySegment[] = [];
    let state: LegacyStyleState = {};
    let currentText = '';

    const flush = () => {
        if (!currentText) {
            return;
        }
        segments.push({ text: currentText, style: { ...state } });
        currentText = '';
    };

    for (let i = 0; i < input.length; i++) {
        if (input.charAt(i) === LEGACY_SECTION_CHAR && i + 1 < input.length) {
            const code = input.charAt(i + 1).toLowerCase();

            if (code in LEGACY_COLOR_MAP) {
                flush();
                state = { color: LEGACY_COLOR_MAP[code] };
                i++;
                continue;
            }

            if (code === 'l') {
                flush();
                state = { ...state, bold: true };
                i++;
                continue;
            }

            if (code === 'm') {
                flush();
                state = { ...state, strikethrough: true };
                i++;
                continue;
            }

            if (code === 'n') {
                flush();
                state = { ...state, underline: true };
                i++;
                continue;
            }

            if (code === 'o') {
                flush();
                state = { ...state, italic: true };
                i++;
                continue;
            }

            if (code === 'r') {
                flush();
                state = {};
                i++;
                continue;
            }
        }

        currentText += input.charAt(i);
    }

    flush();
    return segments;
};

const MinecraftLegacyPreview: React.FC<{ text: string }> = ({ text }) => {
    const translated = translateAlternateColorCodes(LEGACY_ALT_CHAR, text);
    const segments = deserializeLegacyText(translated);

    if (segments.length === 0) {
        return <p className="text-sm text-gray-700 whitespace-pre-wrap">{text || ' '}</p>;
    }

    return (
        <p className="text-sm whitespace-pre-wrap">
            {segments.map((segment, index) => (
                <span key={`${segment.text}-${index}`} style={toStyle(segment.style)}>
                    {segment.text}
                </span>
            ))}
        </p>
    );
};
