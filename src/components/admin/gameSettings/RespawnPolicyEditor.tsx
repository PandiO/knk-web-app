import React from 'react';
import { LocationReferenceDto, RespawnMode, RespawnPolicyDto } from '../../../types/dtos/gameSettings/GameSettingsModels';
import { LocationOption } from './locationReferenceOptions';
import { LocationReferencePicker } from './LocationReferencePicker';

export const RESPAWN_MODE_LABELS: Record<RespawnMode, string> = {
    WorldSpawn: 'Server decides (bed / anchor, else world spawn)',
    JoinSpawn: 'Same as the join spawn (synced)',
    ConfiguredReference: 'A chosen spot (separate)',
    NearestTown: 'Nearest town',
};

const RESPAWN_MODES: RespawnMode[] = ['WorldSpawn', 'JoinSpawn', 'ConfiguredReference', 'NearestTown'];

export const defaultRespawnPolicy = (): RespawnPolicyDto => ({
    mode: 'WorldSpawn',
    useWorldSpawnFallback: true,
    maxNearestTownDistance: null,
    locationReference: null,
});

/**
 * One respawn policy (docs/specs/game-settings/DESIGN.md §3.3): a world's, or a permission group's
 * override (KNG-52). "Same as the join spawn" keeps spawn and respawn synced; the other modes keep
 * them separate.
 */
export const RespawnPolicyEditor: React.FC<{
    value: RespawnPolicyDto;
    options: LocationOption[];
    onChange: (value: RespawnPolicyDto) => void;
    onCreateLocation?: () => void;
}> = ({ value, options, onChange, onCreateLocation }) => (
    <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Respawn at</label>
                <select
                    aria-label="Respawn mode"
                    value={value.mode}
                    onChange={e => onChange({ ...value, mode: e.target.value as RespawnMode })}
                    className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                >
                    {RESPAWN_MODES.map(mode => (
                        <option key={mode} value={mode}>{RESPAWN_MODE_LABELS[mode]}</option>
                    ))}
                </select>
            </div>
            {(value.mode === 'ConfiguredReference' || value.mode === 'NearestTown') && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">If no spot is found</label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={value.useWorldSpawnFallback}
                            onChange={e => onChange({ ...value, useWorldSpawnFallback: e.target.checked })}
                            className="rounded border-gray-300"
                        />
                        Use the world spawn (unticked: the server decides)
                    </label>
                </div>
            )}
        </div>

        {value.mode === 'JoinSpawn' && (
            <p className="text-xs text-gray-500">
                Players respawn where they would join and where <code>/spawn</code> takes them, including a group's spawn override.
            </p>
        )}

        {value.mode === 'ConfiguredReference' && (
            <LocationReferencePicker
                value={value.locationReference || null}
                options={options}
                onChange={(reference: LocationReferenceDto | null) => onChange({ ...value, locationReference: reference })}
                onCreateLocation={onCreateLocation}
            />
        )}

        {value.mode === 'NearestTown' && (
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max nearest-town distance (blocks, empty = any)</label>
                <input
                    type="number"
                    min={0}
                    value={value.maxNearestTownDistance ?? ''}
                    onChange={e => onChange({
                        ...value,
                        maxNearestTownDistance: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0),
                    })}
                    className="block w-full md:w-80 rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                />
            </div>
        )}
    </div>
);
