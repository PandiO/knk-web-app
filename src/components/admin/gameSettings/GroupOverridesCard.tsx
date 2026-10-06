import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PermissionGroupDto } from '../../../types/dtos/userManagement/PermissionGroupDto';
import { PermissionGroupGameSettingsDto } from '../../../types/dtos/gameSettings/GameSettingsModels';
import { LocationOption } from './locationReferenceOptions';
import { LocationReferencePicker } from './LocationReferencePicker';
import { MinecraftLegacyPreview } from './MinecraftLegacyPreview';
import { RespawnPolicyEditor, defaultRespawnPolicy } from './RespawnPolicyEditor';

type GroupLike = Pick<PermissionGroupDto, 'id' | 'name' | 'weight' | 'parentGroupId'>;

/** How many parents a group has (cycles cut), as the API's PermissionGroupPrecedence counts them. */
export const groupDepth = (groupId: number, groups: GroupLike[]): number => {
    const byId = new Map(groups.filter(g => g.id != null).map(g => [g.id as number, g]));
    const seen = new Set<number>([groupId]);
    let depth = 0;
    let parentId = byId.get(groupId)?.parentGroupId ?? null;
    while (parentId != null && byId.has(parentId) && !seen.has(parentId)) {
        seen.add(parentId);
        depth++;
        parentId = byId.get(parentId)?.parentGroupId ?? null;
    }
    return depth;
};

/**
 * Overrides in the order the plugin considers them: deeper in the group hierarchy first, then higher
 * weight, then lower id (developer decision 2026-10-05, DESIGN §3.8).
 */
export const orderByPrecedence = (
    overrides: PermissionGroupGameSettingsDto[],
    groups: GroupLike[]
): PermissionGroupGameSettingsDto[] => {
    const weight = (id: number) => groups.find(g => g.id === id)?.weight ?? 0;
    return [...overrides].sort((a, b) =>
        groupDepth(b.permissionGroupId, groups) - groupDepth(a.permissionGroupId, groups)
        || weight(b.permissionGroupId) - weight(a.permissionGroupId)
        || a.permissionGroupId - b.permissionGroupId);
};

/**
 * Per-permission-group overrides of the join message, join spawn and respawn (KNG-52,
 * docs/specs/game-settings/DESIGN.md §3.8). Saved with the rest of the page.
 */
export const GroupOverridesCard: React.FC<{
    overrides: PermissionGroupGameSettingsDto[];
    groups: PermissionGroupDto[];
    options: LocationOption[];
    onChange: (overrides: PermissionGroupGameSettingsDto[]) => void;
    onCreateLocation?: () => void;
}> = ({ overrides, groups, options, onChange, onCreateLocation }) => {
    const [toAdd, setToAdd] = React.useState<string>('');
    const ordered = orderByPrecedence(overrides, groups);
    const available = groups
        .filter(g => g.id != null && !overrides.some(o => o.permissionGroupId === g.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    const groupName = (id: number) => groups.find(g => g.id === id)?.name
        ?? overrides.find(o => o.permissionGroupId === id)?.groupName ?? `Group #${id}`;

    const update = (groupId: number, change: (o: PermissionGroupGameSettingsDto) => PermissionGroupGameSettingsDto) =>
        onChange(overrides.map(o => (o.permissionGroupId === groupId ? change(o) : o)));

    return (
        <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Permission Group Overrides</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Give a group its own join message, spawn or respawn. A player in several groups gets each setting
                    from the first group in this list that sets it: deeper in the group hierarchy first (a group beats the
                    group it inherits from), then higher weight. Staff and owner-mode players are never redirected on
                    respawn, and owner-mode players are not moved on join.
                </p>
            </div>

            <div className="flex flex-wrap items-end gap-2">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Add a group</label>
                    <select
                        aria-label="Group to add"
                        value={toAdd}
                        onChange={e => setToAdd(e.target.value)}
                        className="block rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                    >
                        <option value="">Select a group...</option>
                        {available.map(g => (
                            <option key={g.id as number} value={String(g.id)}>{g.name}</option>
                        ))}
                    </select>
                </div>
                <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={!toAdd}
                    onClick={() => {
                        const id = Number(toAdd);
                        onChange([...overrides, { permissionGroupId: id, groupName: groupName(id), joinAnnouncement: null, joinSpawnReference: null, respawnPolicy: null }]);
                        setToAdd('');
                    }}
                >
                    <Plus className="h-4 w-4 mr-1" /> Add override
                </button>
            </div>

            {ordered.length === 0 && <p className="text-sm text-gray-500">No group overrides: every player gets the settings above.</p>}

            {ordered.map((o, index) => {
                const name = groupName(o.permissionGroupId);
                const hasJoin = o.joinAnnouncement != null;
                return (
                    <div key={o.permissionGroupId} className="rounded-md border border-gray-200 p-4 space-y-4" data-testid={`group-override-${o.permissionGroupId}`}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">
                                <span className="mr-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">#{index + 1}</span>
                                {name}
                            </h3>
                            <button
                                type="button"
                                className="btn-secondary text-xs"
                                aria-label={`Remove ${name} override`}
                                onClick={() => onChange(overrides.filter(x => x.permissionGroupId !== o.permissionGroupId))}
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={hasJoin}
                                    onChange={e => update(o.permissionGroupId, x => ({ ...x, joinAnnouncement: e.target.checked ? '&6[{group}] &e{player} &7joined the server.' : null }))}
                                    className="rounded border-gray-300"
                                />
                                Own join message
                            </label>
                            {hasJoin && (
                                <>
                                    <textarea
                                        aria-label={`${name} join message`}
                                        value={o.joinAnnouncement || ''}
                                        onChange={e => update(o.permissionGroupId, x => ({ ...x, joinAnnouncement: e.target.value }))}
                                        rows={2}
                                        className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                                    />
                                    <p className="text-xs text-gray-500">
                                        <code>{'{player}'}</code> = player name, <code>{'{group}'}</code> = {name}. Colour codes like <code>&amp;6</code>,
                                        several per line, and hex <code>&amp;x&amp;f&amp;f&amp;a&amp;a&amp;0&amp;0</code>. Empty = this group joins silently.
                                    </p>
                                    <MinecraftLegacyPreview dark text={(o.joinAnnouncement || '').split('{player}').join('Steve').split('{group}').join(name)} />
                                </>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={o.joinSpawnReference != null}
                                    onChange={e => {
                                        if (!e.target.checked) {
                                            update(o.permissionGroupId, x => ({ ...x, joinSpawnReference: null }));
                                        } else if (options[0]) {
                                            const first = options[0];
                                            update(o.permissionGroupId, x => ({ ...x, joinSpawnReference: { sourceType: first.sourceType, sourceId: first.sourceId, displayLabel: first.displayLabel, location: first.location } }));
                                        }
                                    }}
                                    className="rounded border-gray-300"
                                />
                                Own spawn (join and <code>/spawn</code>)
                            </label>
                            {o.joinSpawnReference != null && (
                                <LocationReferencePicker
                                    value={o.joinSpawnReference}
                                    options={options}
                                    onChange={reference => update(o.permissionGroupId, x => ({ ...x, joinSpawnReference: reference }))}
                                    onCreateLocation={onCreateLocation}
                                />
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={o.respawnPolicy != null}
                                    onChange={e => update(o.permissionGroupId, x => ({ ...x, respawnPolicy: e.target.checked ? { ...defaultRespawnPolicy(), mode: 'JoinSpawn' } : null }))}
                                    className="rounded border-gray-300"
                                />
                                Own respawn (in every world; replaces the world's policy)
                            </label>
                            {o.respawnPolicy != null && (
                                <RespawnPolicyEditor
                                    value={o.respawnPolicy}
                                    options={options}
                                    onChange={policy => update(o.permissionGroupId, x => ({ ...x, respawnPolicy: policy }))}
                                    onCreateLocation={onCreateLocation}
                                />
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
