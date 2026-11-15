import React from 'react';
import { Loader2, Plus, Search, ShieldCheck, X } from 'lucide-react';
import { userManagementClient } from '../../../apiClients/userManagementClient';
import { DataTable, DataTableColumn, DataTableSort, nextSort } from '../../../components/DataTable';
import type { ActionGate } from '../../../hooks/useActionGate';
import type { EffectivePermissionEntryDto } from '../../../types/dtos/userManagement/UserProfileSummaryDtos';
import { apiRefusalReason } from '../../../utils/apiRefusalReason';
import { dateTimeLocalDaysFromNow } from '../../../utils/dateTimeLocal';
import {
    filterEffectivePermissions,
    isDirectGrant,
    permissionSourceLabel,
    permissionValueLabel,
    sortEffectivePermissions,
} from './effectivePermissions';
import { GatedHint } from './PlayerStatusStrip';

// KNG-59 safeguard: a direct grant/deny defaults to expiring a day from now, so a permanent one
// takes an explicit "clear the expiry" from the admin.
export const GRANT_DEFAULT_EXPIRY_DAYS = 1;
const defaultGrantExpiry = (): string => dateTimeLocalDaysFromNow(GRANT_DEFAULT_EXPIRY_DAYS);

const fieldInput = 'input text-sm px-2 py-1.5';

interface Props {
    userId: number;
    permissions: EffectivePermissionEntryDto[];
    /** `knk.admin.user.perm`: grant, deny and remove (shown disabled with "Requires …" without it). */
    gate: ActionGate;
    /** Reads the profile again after a change, so the list shows the resolved effect. */
    onChanged: () => Promise<void>;
}

/**
 * The player profile's Effective Permissions card (Permissions tab), PandiO/knk-workspace#407: the grant/deny
 * form on top, then a search over node and source and the list with sortable columns. Without a sort the list
 * keeps the API's order. Direct grants can be removed here; inherited rows change on their group.
 */
export const EffectivePermissionsCard: React.FC<Props> = ({ userId, permissions, gate, onChanged }) => {
    const [grantNode, setGrantNode] = React.useState('');
    const [grantValue, setGrantValue] = React.useState<'true' | 'false'>('true');
    const [grantExpiresAt, setGrantExpiresAt] = React.useState(defaultGrantExpiry);
    const [grantingNode, setGrantingNode] = React.useState(false);
    const [grantActionError, setGrantActionError] = React.useState<string | null>(null);
    const [revokingNode, setRevokingNode] = React.useState<string | null>(null);
    const [revokeNodeError, setRevokeNodeError] = React.useState<string | null>(null);
    const [query, setQuery] = React.useState('');
    const [sort, setSort] = React.useState<DataTableSort | null>(null);
    const grantHintId = React.useId();

    const shown = React.useMemo(
        () => sortEffectivePermissions(filterEffectivePermissions(permissions, query), sort),
        [permissions, query, sort],
    );
    const searching = query.trim() !== '';

    const handleGrantNode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!grantNode.trim() || !gate.allowed) return;
        setGrantingNode(true);
        setGrantActionError(null);
        try {
            await userManagementClient.grantNode(userId, {
                node: grantNode.trim(),
                value: grantValue === 'true',
                expiresAt: grantExpiresAt ? new Date(grantExpiresAt).toISOString() : null,
            });
            setGrantNode('');
            setGrantExpiresAt(defaultGrantExpiry());
            await onChanged();
        } catch (err) {
            console.error('Failed to grant node:', err);
            setGrantActionError(apiRefusalReason(err) ?? 'Could not save this permission node.');
        } finally {
            setGrantingNode(false);
        }
    };

    // KNG-59: remove a node granted/denied directly on the player (group-inherited rows have no
    // remove button - removing those would change the group for every member).
    const handleRevokeNode = async (node: string) => {
        setRevokingNode(node);
        setRevokeNodeError(null);
        try {
            await userManagementClient.revokeNode(userId, node);
            await onChanged();
        } catch (err) {
            console.error('Failed to remove node:', err);
            setRevokeNodeError(apiRefusalReason(err) ?? `Could not remove ${node}.`);
        } finally {
            setRevokingNode(null);
        }
    };

    const columns: DataTableColumn<EffectivePermissionEntryDto>[] = [
        { key: 'node', header: 'Node', sortable: true, className: 'font-mono text-xs', cell: p => p.node },
        {
            key: 'value',
            header: 'Value',
            sortable: true,
            cell: p => (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${p.value
                    ? 'bg-success-muted text-success-strong'
                    : 'bg-danger-muted text-danger-strong'}`}>
                    {permissionValueLabel(p)}
                </span>
            ),
        },
        { key: 'source', header: 'Source', sortable: true, cell: permissionSourceLabel },
    ];

    const rowActions = (p: EffectivePermissionEntryDto) => (isDirectGrant(p) ? (
        <button
            type="button"
            className="text-muted hover:text-danger disabled:opacity-50"
            disabled={!gate.allowed || revokingNode !== null}
            onClick={() => void handleRevokeNode(p.node)}
            title={gate.hint ?? `Remove direct ${p.value ? 'grant' : 'deny'}`}
            aria-label={`Remove direct ${p.value ? 'grant' : 'deny'} of ${p.node}`}
        >
            {revokingNode === p.node
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <X className="h-4 w-4" aria-hidden="true" />}
        </button>
    ) : (
        <span
            className="text-xs font-normal text-muted"
            title="Inherited from a group: remove the node on the group, or remove the group membership above"
        >
            Inherited
        </span>
    ));

    return (
        <section className="panel p-4 sm:p-6" aria-labelledby="permissions-heading">
            <h2 id="permissions-heading" className="text-lg font-semibold text-fg mb-4 flex items-center">
                <ShieldCheck className="mr-2 h-5 w-5" aria-hidden="true" />
                Effective Permissions ({permissions.length})
            </h2>

            {/* Quick action: grant/deny a node directly on the player (DESIGN.md §3), above the list (#407). Saving a
                node the player already has directly updates its value and expiry (KNG-59). */}
            <form
                className="mb-4 flex flex-wrap items-end gap-3 border-b border-line pb-4"
                aria-label="Grant or deny a node"
                onSubmit={(e) => void handleGrantNode(e)}
            >
                <div className="min-w-[12rem] flex-1">
                    <label htmlFor="grant-node" className="mb-1 block text-xs text-muted">Grant/deny node</label>
                    <input
                        id="grant-node"
                        type="text"
                        placeholder="e.g. knk.gate.open"
                        className={`${fieldInput} w-full font-mono`}
                        value={grantNode}
                        disabled={!gate.allowed}
                        onChange={(e) => setGrantNode(e.target.value)}
                    />
                </div>
                <div>
                    <label htmlFor="grant-value" className="mb-1 block text-xs text-muted">Value</label>
                    <select
                        id="grant-value"
                        className={fieldInput}
                        value={grantValue}
                        disabled={!gate.allowed}
                        onChange={(e) => setGrantValue(e.target.value as 'true' | 'false')}
                    >
                        <option value="true">Grant</option>
                        <option value="false">Deny</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="grant-expires" className="mb-1 block text-xs text-muted">
                        Expires {grantExpiresAt ? '(clear for permanent)' : <span className="font-medium text-warning-strong">(permanent)</span>}
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            id="grant-expires"
                            type="datetime-local"
                            className={fieldInput}
                            value={grantExpiresAt}
                            disabled={!gate.allowed}
                            onChange={(e) => setGrantExpiresAt(e.target.value)}
                        />
                        {grantExpiresAt ? (
                            <button type="button" className="text-xs text-muted underline hover:text-danger" onClick={() => setGrantExpiresAt('')}>
                                Clear
                            </button>
                        ) : (
                            <button type="button" className="text-xs text-muted underline hover:text-fg" onClick={() => setGrantExpiresAt(defaultGrantExpiry())}>
                                Reset to 1 day
                            </button>
                        )}
                    </div>
                </div>
                <button
                    type="submit"
                    className="btn-primary text-sm"
                    disabled={!gate.allowed || !grantNode.trim() || grantingNode}
                    title={gate.hint ?? undefined}
                    aria-describedby={gate.hint ? grantHintId : undefined}
                >
                    {grantingNode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="mr-2 h-4 w-4" aria-hidden="true" />}
                    Save
                </button>
                <GatedHint id={grantHintId} hint={gate.hint} />
                {grantActionError && <span className="field-error text-xs">{grantActionError}</span>}
            </form>

            {permissions.length === 0 ? (
                <p className="text-sm text-muted">No declared permission nodes for this player.</p>
            ) : (
                <>
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                        <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
                            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                            <input
                                type="search"
                                className={`${fieldInput} w-full pl-8`}
                                placeholder="Node or source"
                                aria-label="Search permissions by node or source"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
                        <p className="text-xs text-muted" role="status" aria-live="polite">
                            {searching ? `${shown.length} of ${permissions.length} nodes` : ''}
                        </p>
                    </div>
                    <DataTable
                        caption="Effective permissions"
                        columns={columns}
                        rows={shown}
                        rowKey={p => p.node}
                        sort={sort}
                        onSortChange={key => setSort(current => nextSort(current, key))}
                        rowActions={rowActions}
                        density="compact"
                        className="rounded-md border border-line"
                        empty={`No permissions match “${query.trim()}”.`}
                    />
                </>
            )}
            {revokeNodeError && <p className="field-error mt-2 text-xs">{revokeNodeError}</p>}
        </section>
    );
};

export default EffectivePermissionsCard;
