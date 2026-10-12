import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PermissionGroupDto } from '../../../types/dtos/userManagement/PermissionGroupDto';
import {
    HubExemptionEligibilityDto,
    HubOutageAction,
    PermissionGroupGameSettingsDto,
} from '../../../types/dtos/gameSettings/GameSettingsModels';
import { MAX_OUTAGE_DELAY_SECONDS, OUTAGE_ACTION_LABELS } from './HubSettingsCard';
import { LocationOption } from './locationReferenceOptions';
import { LocationReferencePicker } from './LocationReferencePicker';
import { MinecraftLegacyPreview } from './MinecraftLegacyPreview';
import { PREVIEW_SAMPLE, fillMessagePlaceholders } from './messagePlaceholders';
import { RespawnPolicyEditor, defaultRespawnPolicy } from './RespawnPolicyEditor';

type GroupLike = Pick<PermissionGroupDto, 'id' | 'name' | 'weight' | 'parentGroupId'>;

/**
 * Every group in precedence order, as the API's PermissionGroupPrecedence orders them (decision 2026-10-12, option (i):
 * hierarchy first, then weight). A group that another group inherits from is reached through that group's chain, after
 * it; the other groups start by weight (highest first, ties by lower id), each followed by its parents. Cycles are cut.
 */
export const precedenceOrder = (groups: GroupLike[]): number[] => {
    const byId = new Map(groups.filter(g => g.id != null).map(g => [g.id as number, g]));
    const parentOf = (id: number): number | null => {
        const parent = byId.get(id)?.parentGroupId ?? null;
        return parent != null && byId.has(parent) ? parent : null;
    };
    const inherited = new Set<number>();
    byId.forEach((_, id) => {
        const walked = new Set<number>([id]);
        for (let p = parentOf(id); p != null && !walked.has(p); p = parentOf(p)) {
            walked.add(p);
            inherited.add(p);
        }
    });
    const byWeight = Array.from(byId.values()).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || (a.id as number) - (b.id as number));
    const starts = [...byWeight.filter(g => !inherited.has(g.id as number)), ...byWeight.filter(g => inherited.has(g.id as number))];
    const order: number[] = [];
    const seen = new Set<number>();
    starts.forEach(group => {
        const walked = new Set<number>();
        for (let id: number | null = group.id as number; id != null && !walked.has(id); id = parentOf(id)) {
            walked.add(id);
            if (!seen.has(id)) {
                seen.add(id);
                order.push(id);
            }
        }
    });
    return order;
};

/** Overrides in the order the plugin considers them (precedenceOrder); unknown groups last, by id. */
export const orderByPrecedence = (
    overrides: PermissionGroupGameSettingsDto[],
    groups: GroupLike[]
): PermissionGroupGameSettingsDto[] => {
    const rank = new Map(precedenceOrder(groups).map((id, i) => [id, i]));
    const rankOf = (id: number) => rank.get(id) ?? Number.MAX_SAFE_INTEGER;
    return [...overrides].sort((a, b) =>
        rankOf(a.permissionGroupId) - rankOf(b.permissionGroupId) || a.permissionGroupId - b.permissionGroupId);
};

const DEFAULT_GROUP_MESSAGE = {
    join: '&6[{group}] &e{player} &7joined the server.',
    leave: '&6[{group}] &e{player} &7left the server.',
};

/** A group's own join or leave message: null = not overridden, '' = the group's members are silent. */
const GroupMessageField: React.FC<{
    kind: 'join' | 'leave';
    groupName: string;
    value: string | null | undefined;
    onChange: (value: string | null) => void;
}> = ({ kind, groupName, value, onChange }) => {
    const enabled = value != null;
    return (
        <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={e => onChange(e.target.checked ? DEFAULT_GROUP_MESSAGE[kind] : null)}
                    className="rounded border-gray-300"
                />
                Own {kind} message
            </label>
            {enabled && (
                <>
                    <textarea
                        aria-label={`${groupName} ${kind} message`}
                        value={value || ''}
                        onChange={e => onChange(e.target.value)}
                        rows={2}
                        className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                    />
                    <p className="text-xs text-gray-500">
                        <code>{'{player}'}</code> = player name, <code>{'{title}'}</code> = their title (e.g. {PREVIEW_SAMPLE.title}; empty
                        if none), <code>{'{group}'}</code> = {groupName}. Colour codes like <code>&amp;6</code>, several per line, and hex
                        {' '}<code>&amp;x&amp;f&amp;f&amp;a&amp;a&amp;0&amp;0</code>. Empty = this group {kind === 'join' ? 'joins' : 'leaves'} silently.
                    </p>
                    <MinecraftLegacyPreview dark text={fillMessagePlaceholders(value || '', { ...PREVIEW_SAMPLE, group: groupName })} />
                </>
            )}
        </div>
    );
};

/**
 * Per-permission-group overrides of the join/leave message, join spawn and respawn (KNG-52,
 * docs/specs/game-settings/DESIGN.md §3.8). Saved with the rest of the page.
 */
export const GroupOverridesCard: React.FC<{
    overrides: PermissionGroupGameSettingsDto[];
    groups: PermissionGroupDto[];
    options: LocationOption[];
    onChange: (overrides: PermissionGroupGameSettingsDto[]) => void;
    onCreateLocation?: () => void;
    /** KNG-116: which groups may carry the hub's mode exemptions; absent = the exemption boxes are not shown. */
    eligibility?: HubExemptionEligibilityDto[];
}> = ({ overrides, groups, options, onChange, onCreateLocation, eligibility = [] }) => {
    const [toAdd, setToAdd] = React.useState<string>('');
    // Groups whose 'Own spawn' is ticked but no spot is chosen yet (nothing is saved until one is).
    const [spawnPending, setSpawnPending] = React.useState<number[]>([]);
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
                    Give a group its own join or leave message, spawn or respawn. A player in several groups gets each setting
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
                        onChange([...overrides, { permissionGroupId: id, groupName: groupName(id), joinAnnouncement: null, leaveAnnouncement: null, joinSpawnReference: null, joinAtLastLocation: null, respawnPolicy: null }]);
                        setToAdd('');
                    }}
                >
                    <Plus className="h-4 w-4 mr-1" /> Add override
                </button>
            </div>

            {ordered.length === 0 && <p className="text-sm text-gray-500">No group overrides: every player gets the settings above.</p>}

            {ordered.map((o, index) => {
                const name = groupName(o.permissionGroupId);
                const atLastLocation = o.joinAtLastLocation === true;
                const ownSpawn = o.joinSpawnReference != null || atLastLocation || spawnPending.includes(o.permissionGroupId);
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

                        <GroupMessageField
                            kind="join"
                            groupName={name}
                            value={o.joinAnnouncement}
                            onChange={joinAnnouncement => update(o.permissionGroupId, x => ({ ...x, joinAnnouncement }))}
                        />

                        <GroupMessageField
                            kind="leave"
                            groupName={name}
                            value={o.leaveAnnouncement}
                            onChange={leaveAnnouncement => update(o.permissionGroupId, x => ({ ...x, leaveAnnouncement }))}
                        />

                        <div className="space-y-2">
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={ownSpawn}
                                    onChange={e => {
                                        const id = o.permissionGroupId;
                                        setSpawnPending(prev => (e.target.checked ? [...prev, id] : prev.filter(x => x !== id)));
                                        if (!e.target.checked) {
                                            update(id, x => ({ ...x, joinSpawnReference: null, joinAtLastLocation: null }));
                                        }
                                    }}
                                    className="rounded border-gray-300"
                                />
                                Own spawn (join and <code>/spawn</code>)
                            </label>
                            {ownSpawn && (
                                <div className="ml-6 space-y-2">
                                    <div className="flex flex-wrap gap-x-5 gap-y-1" role="radiogroup" aria-label={`${name} spawn`}>
                                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                            <input
                                                type="radio"
                                                name={`group-spawn-${o.permissionGroupId}`}
                                                checked={!atLastLocation}
                                                onChange={() => {
                                                    const id = o.permissionGroupId;
                                                    setSpawnPending(prev => (prev.includes(id) ? prev : [...prev, id]));
                                                    update(id, x => ({ ...x, joinAtLastLocation: null }));
                                                }}
                                                className="border-gray-300"
                                            />
                                            A chosen spot
                                        </label>
                                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                            <input
                                                type="radio"
                                                name={`group-spawn-${o.permissionGroupId}`}
                                                checked={atLastLocation}
                                                onChange={() => update(o.permissionGroupId, x => ({ ...x, joinAtLastLocation: true, joinSpawnReference: null }))}
                                                className="border-gray-300"
                                            />
                                            Where they logged out (no join teleport)
                                        </label>
                                    </div>
                                    {atLastLocation ? (
                                        <p className="text-xs text-gray-500">
                                            Members stay where they logged out, like owners. <code>/spawn</code> still takes them to the server spawn.
                                        </p>
                                    ) : (
                                        <>
                                            <LocationReferencePicker
                                                value={o.joinSpawnReference ?? null}
                                                options={options}
                                                onChange={reference => update(o.permissionGroupId, x => ({ ...x, joinSpawnReference: reference, joinAtLastLocation: null }))}
                                                onCreateLocation={onCreateLocation}
                                            />
                                            {o.joinSpawnReference == null && (
                                                <p className="text-xs text-gray-500">Choose a spot - without one this group keeps the normal spawn.</p>
                                            )}
                                        </>
                                    )}
                                </div>
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

                        <HubOutageOverride
                            override={o}
                            groupName={name}
                            eligibility={eligibility.find(e => e.permissionGroupId === o.permissionGroupId)}
                            onChange={change => update(o.permissionGroupId, x => ({ ...x, ...change }))}
                        />
                    </div>
                );
            })}
        </div>
    );
};

/**
 * The hub's outage handling for one group (hub DESIGN §13): its own outage action and delay, and the staff/owner mode
 * exemptions. An exemption box is only shown when the group effectively has the mode's node (KNG-116), and only a
 * ticked box counts (decision 5).
 */
const HubOutageOverride: React.FC<{
    override: PermissionGroupGameSettingsDto;
    groupName: string;
    eligibility?: HubExemptionEligibilityDto;
    onChange: (change: Partial<PermissionGroupGameSettingsDto>) => void;
}> = ({ override: o, groupName, eligibility, onChange }) => {
    const ownAction = o.outageAction != null || o.outageDelaySeconds != null;
    return (
        <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                    type="checkbox"
                    checked={ownAction}
                    onChange={e => onChange(e.target.checked
                        ? { outageAction: 'SendToHub', outageDelaySeconds: 0 }
                        : { outageAction: null, outageDelaySeconds: null })}
                    className="rounded border-gray-300"
                />
                Own action when the API is lost
            </label>
            {ownAction && (
                <div className="ml-6 flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <select
                        aria-label={`${groupName} outage action`}
                        value={o.outageAction ?? 'SendToHub'}
                        onChange={e => onChange({ outageAction: e.target.value as HubOutageAction })}
                        className="rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                    >
                        {(Object.keys(OUTAGE_ACTION_LABELS) as HubOutageAction[]).map(a => (
                            <option key={a} value={a}>{OUTAGE_ACTION_LABELS[a]}</option>
                        ))}
                    </select>
                    after
                    <input
                        type="number"
                        min={0}
                        max={MAX_OUTAGE_DELAY_SECONDS}
                        aria-label={`${groupName} outage delay`}
                        value={o.outageDelaySeconds ?? 0}
                        onChange={e => onChange({ outageDelaySeconds: Math.min(MAX_OUTAGE_DELAY_SECONDS, Math.max(0, Math.round(Number(e.target.value)) || 0)) })}
                        className="w-24 rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                    />
                    seconds (0 = immediately)
                </div>
            )}
            <ExemptionBox
                label="Exempt while in staff mode"
                node="knk.mode.staff"
                eligible={eligibility?.canExemptStaffMode === true}
                source={eligibility?.staffModeSource}
                checked={o.exemptInStaffMode === true}
                onChange={checked => onChange({ exemptInStaffMode: checked ? true : null })}
            />
            <ExemptionBox
                label="Exempt while in owner mode"
                node="knk.mode.owner"
                eligible={eligibility?.canExemptOwnerMode === true}
                source={eligibility?.ownerModeSource}
                checked={o.exemptInOwnerMode === true}
                onChange={checked => onChange({ exemptInOwnerMode: checked ? true : null })}
            />
            {(eligibility?.canExemptStaffMode || eligibility?.canExemptOwnerMode) && (
                <p className="ml-6 text-xs text-gray-500">
                    An exempt member in that active mode is not moved or kicked during an outage and may still enter gameplay.
                    Being in the group alone exempts no one.
                </p>
            )}
        </div>
    );
};

/**
 * One mode exemption box: shown when the group has the node, and also while it is still ticked after the group lost
 * the node (marked, so it can be unticked - the API refuses to save it ticked).
 */
const ExemptionBox: React.FC<{
    label: string;
    node: string;
    eligible: boolean;
    source?: string | null;
    checked: boolean;
    onChange: (checked: boolean) => void;
}> = ({ label, node, eligible, source, checked, onChange }) => {
    if (!eligible && !checked) {
        return null;
    }
    return (
        <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
                type="checkbox"
                checked={checked}
                disabled={!eligible && !checked}
                onChange={e => onChange(e.target.checked)}
                className="rounded border-gray-300"
            />
            {label}
            {eligible
                ? <span className="text-xs text-gray-500">({node} from {source})</span>
                : <span className="text-xs text-red-600">(the group no longer has {node}; untick to save)</span>}
        </label>
    );
};
