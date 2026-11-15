import React from 'react';
import { History, Loader2, Pencil, Plus, Repeat, ShieldCheck, X } from 'lucide-react';
import { permissionGrantClient } from '../../../apiClients/permissionGrantClient';
import { permissionGroupClient } from '../../../apiClients/permissionGroupClient';
import { userManagementClient } from '../../../apiClients/userManagementClient';
import { DataTable, DataTableColumn } from '../../DataTable';
import { Pager } from '../../Pager';
import { useConfirm } from '../../../hooks/useConfirm';
import { useActionGate } from '../../../hooks/useActionGate';
import { usePermission } from '../../../hooks/useStaffAccess';
import { apiRefusalReason } from '../../../utils/apiRefusalReason';
import { auditActionLabel, describeAuditDetails } from '../../../utils/auditDetails';
import { formatDateTime } from '../../../utils/format';
import { toast } from '../../../utils/toast';
import { PermissionGrantListDto } from '../../../types/dtos/userManagement/PermissionGrantListDto';
import { PermissionGroupMemberCountDto } from '../../../types/dtos/userManagement/PermissionGroupDto';
import { AuditLogEntryDto } from '../../../types/dtos/userManagement/UserProfileSummaryDtos';

/** Reads a group's grants and its History (knk-web-api: grant reads and GET api/audit-log). */
export const GROUP_READ_NODE = 'knk.admin.user.manage';
/** Writes a group's grants (PUT/DELETE api/PermissionGrants/by-node). */
export const GROUP_GRANT_WRITE_NODE = 'knk.admin.user.perm';
export const HISTORY_PAGE_SIZE = 10;

/** "2027-01-15T10:30:00Z" → the value a datetime-local input takes, in the viewer's own time. */
export function toLocalInput(iso: string | null | undefined): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const isExpired = (grant: PermissionGrantListDto, now = Date.now()) =>
    !!grant.expiresAt && new Date(grant.expiresAt).getTime() <= now;

const players = (n: number) => `${n} ${n === 1 ? 'player' : 'players'}`;

/**
 * The confirmation's blast radius (#50): "This affects N players (…)", members of inheriting groups included, and that
 * online players get the change within seconds (the API sends PermissionGroupChanged after every grant write, #179).
 */
export function blastRadiusText(count: PermissionGroupMemberCountDto | null, groupName: string): string {
    const timing = 'Online players get the change within seconds.';
    if (!count) return `Couldn't count the players this affects. ${timing}`;
    const inheriting = count.inheritingGroups === 1 ? '1 group that inherits from it' : `${count.inheritingGroups} groups that inherit from it`;
    const scope = count.inheritingGroups > 0 ? `members of ${groupName} and of ${inheriting}` : `members of ${groupName}`;
    return `This affects ${players(count.totalMembers)} (${scope}). ${timing}`;
}

interface Props {
    groupId: number;
    groupName: string;
}

/**
 * PandiO/knk-workspace#50: a permission group's own grants on the group's detail page. Lists the nodes (Granted or
 * Denied, expiry), grants, denies or changes the expiry of a node through the by-node route (one row per group and
 * node; no default expiry: a group node is normally permanent), removes a node, and asks first, with the blast radius,
 * before a node flips between Granted and Denied or is removed. The History list shows the group's audit entries
 * (generic audit subject, developer decision 2026-11-15). Without `knk.admin.user.perm` the panel is read-only with
 * "Requires …" (the #280 rule: shown disabled, not hidden); without `knk.admin.user.manage` it reads nothing.
 * The API checks every node itself, and the escalation guard refuses a group ranked at or above the actor's own.
 */
export const GroupPermissionsPanel: React.FC<Props> = ({ groupId, groupName }) => {
    const read = usePermission(GROUP_READ_NODE);
    const writeGate = useActionGate(GROUP_GRANT_WRITE_NODE);
    const canWrite = writeGate.allowed;
    const [confirm, confirmModal] = useConfirm();

    const [grants, setGrants] = React.useState<PermissionGrantListDto[]>([]);
    const [grantTotal, setGrantTotal] = React.useState(0);
    const [loadingGrants, setLoadingGrants] = React.useState(true);
    const [grantsError, setGrantsError] = React.useState<string | null>(null);
    const [memberCount, setMemberCount] = React.useState<PermissionGroupMemberCountDto | null>(null);

    const [history, setHistory] = React.useState<AuditLogEntryDto[]>([]);
    const [historyTotal, setHistoryTotal] = React.useState(0);
    const [historyPage, setHistoryPage] = React.useState(1);
    const [loadingHistory, setLoadingHistory] = React.useState(true);
    const [historyError, setHistoryError] = React.useState<string | null>(null);
    const [refresh, setRefresh] = React.useState(0);

    const [node, setNode] = React.useState('');
    const [value, setValue] = React.useState<'true' | 'false'>('true');
    const [expiresAt, setExpiresAt] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [busyNode, setBusyNode] = React.useState<string | null>(null);
    const [actionError, setActionError] = React.useState<string | null>(null);

    const canRead = read.allowed;

    React.useEffect(() => {
        if (!canRead) return;
        let cancelled = false;
        setLoadingGrants(true);
        permissionGrantClient.getForHolder(groupId)
            .then(result => {
                if (cancelled) return;
                setGrants(result?.items ?? []);
                setGrantTotal(result?.totalCount ?? 0);
                setGrantsError(null);
            })
            .catch(err => {
                if (cancelled) return;
                console.error('Failed to load the group grants:', err);
                setGrantsError(apiRefusalReason(err) ?? 'Could not load the permission nodes of this group.');
            })
            .finally(() => { if (!cancelled) setLoadingGrants(false); });
        permissionGroupClient.getMemberCount(groupId)
            .then(count => { if (!cancelled) setMemberCount(count ?? null); })
            .catch(err => {
                if (cancelled) return;
                console.error('Failed to count the group members:', err);
                setMemberCount(null);
            });
        return () => { cancelled = true; };
    }, [canRead, groupId, refresh]);

    React.useEffect(() => {
        if (!canRead) return;
        let cancelled = false;
        setLoadingHistory(true);
        userManagementClient.getAuditLog({ subjectType: 'PermissionGroup', subjectId: groupId, pageNumber: historyPage, pageSize: HISTORY_PAGE_SIZE })
            .then(result => {
                if (cancelled) return;
                setHistory(result?.items ?? []);
                setHistoryTotal(result?.totalCount ?? 0);
                setHistoryError(null);
            })
            .catch(err => {
                if (cancelled) return;
                console.error('Failed to load the group history:', err);
                setHistoryError(apiRefusalReason(err) ?? 'Could not load the history of this group.');
            })
            .finally(() => { if (!cancelled) setLoadingHistory(false); });
        return () => { cancelled = true; };
    }, [canRead, groupId, historyPage, refresh]);

    const reload = () => {
        setHistoryPage(1);
        setRefresh(n => n + 1);
    };

    const byNode = (wanted: string) => grants.find(g => g.node === wanted);

    const save = async (request: { node: string; value: boolean; expiresAt: string | null }, flip: boolean) => {
        if (flip) {
            const confirmed = await confirm({
                title: `${request.value ? 'Grant' : 'Deny'} ${request.node} on ${groupName}?`,
                message: `${request.node} changes from ${request.value ? 'Denied to Granted' : 'Granted to Denied'}. ${blastRadiusText(memberCount, groupName)}`,
                confirmLabel: request.value ? 'Grant' : 'Deny',
                danger: !request.value,
            });
            if (!confirmed) return false;
        }
        await permissionGrantClient.upsertByNode({ holderId: groupId, ...request });
        toast.success(`${request.node} saved on ${groupName}.`);
        reload();
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = node.trim();
        if (!trimmed || !canWrite) return;
        const wanted = value === 'true';
        const existing = byNode(trimmed);
        setSaving(true);
        setActionError(null);
        try {
            const saved = await save({
                node: trimmed,
                value: wanted,
                expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
            }, !!existing && existing.value !== wanted);
            if (saved) {
                setNode('');
                setValue('true');
                setExpiresAt('');
            }
        } catch (err) {
            console.error('Failed to save the group node:', err);
            setActionError(apiRefusalReason(err) ?? `Could not save ${trimmed}.`);
        } finally {
            setSaving(false);
        }
    };

    const handleFlip = async (grant: PermissionGrantListDto) => {
        setBusyNode(grant.node);
        setActionError(null);
        try {
            await save({ node: grant.node, value: !grant.value, expiresAt: grant.expiresAt ?? null }, true);
        } catch (err) {
            console.error('Failed to change the group node:', err);
            setActionError(apiRefusalReason(err) ?? `Could not change ${grant.node}.`);
        } finally {
            setBusyNode(null);
        }
    };

    const handleRemove = async (grant: PermissionGrantListDto) => {
        const confirmed = await confirm({
            title: `Remove ${grant.node} from ${groupName}?`,
            message: `The group's ${grant.value ? 'grant' : 'deny'} of ${grant.node} is removed. ${blastRadiusText(memberCount, groupName)}`,
            confirmLabel: 'Remove',
            danger: true,
        });
        if (!confirmed) return;
        setBusyNode(grant.node);
        setActionError(null);
        try {
            await permissionGrantClient.revokeByNode(groupId, grant.node);
            toast.success(`${grant.node} removed from ${groupName}.`);
            reload();
        } catch (err) {
            console.error('Failed to remove the group node:', err);
            setActionError(apiRefusalReason(err) ?? `Could not remove ${grant.node}.`);
        } finally {
            setBusyNode(null);
        }
    };

    const handleEdit = (grant: PermissionGrantListDto) => {
        setNode(grant.node);
        setValue(grant.value ? 'true' : 'false');
        setExpiresAt(toLocalInput(grant.expiresAt));
        setActionError(null);
        document.getElementById('group-grant-node')?.focus();
    };

    const writeTitle = (text: string) => writeGate.hint ?? text;
    const columns: DataTableColumn<PermissionGrantListDto>[] = [
        { key: 'node', header: 'Node', className: 'font-mono text-xs', cell: g => g.node },
        {
            key: 'value', header: 'Effect', cell: g => (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${g.value
                    ? 'bg-success-muted text-success-strong'
                    : 'bg-danger-muted text-danger-strong'}`}>
                    {g.value ? 'Granted' : 'Denied'}
                </span>
            ),
        },
        {
            key: 'expiresAt', header: 'Expires', cell: g => !g.expiresAt ? 'Never' : (
                <span className="whitespace-nowrap">
                    {formatDateTime(g.expiresAt)}
                    {isExpired(g) && <span className="ml-2 rounded-full bg-surface-alt px-2 py-0.5 text-xs text-muted">expired</span>}
                </span>
            ),
        },
        {
            key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', cell: g => (
                <span className="inline-flex items-center gap-2">
                    <button type="button" className="text-muted hover:text-fg disabled:opacity-50"
                        disabled={!canWrite || busyNode !== null || saving}
                        onClick={() => handleEdit(g)}
                        title={writeTitle('Edit the value or expiry')}
                        aria-label={`Edit ${g.node}`}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button type="button" className="text-muted hover:text-warning-strong disabled:opacity-50"
                        disabled={!canWrite || busyNode !== null || saving}
                        onClick={() => void handleFlip(g)}
                        title={writeTitle(g.value ? 'Change to Denied' : 'Change to Granted')}
                        aria-label={`Change ${g.node} to ${g.value ? 'Denied' : 'Granted'}`}>
                        <Repeat className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button type="button" className="text-muted hover:text-danger disabled:opacity-50"
                        disabled={!canWrite || busyNode !== null || saving}
                        onClick={() => void handleRemove(g)}
                        title={writeTitle(`Remove ${g.value ? 'grant' : 'deny'}`)}
                        aria-label={`Remove ${g.node}`}>
                        {busyNode === g.node
                            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            : <X className="h-4 w-4" aria-hidden="true" />}
                    </button>
                </span>
            ),
        },
    ];

    const historyColumns: DataTableColumn<AuditLogEntryDto>[] = [
        { key: 'timestamp', header: 'When', cell: e => <span className="whitespace-nowrap">{formatDateTime(e.timestamp)}</span> },
        { key: 'action', header: 'Change', className: 'font-medium', cell: e => auditActionLabel(e) },
        { key: 'actor', header: 'By', cell: e => e.actorUsername ?? (e.actorUserId ? `User #${e.actorUserId}` : <span className="italic text-muted">system</span>) },
        {
            key: 'details', header: 'Details', cell: e => {
                const lines = describeAuditDetails(e);
                return lines.length === 0 ? <span className="text-muted">-</span> : (
                    <div className="min-w-[12rem] space-y-0.5 text-xs">
                        {lines.map((line, i) => <p key={i} className="break-words">{line}</p>)}
                    </div>
                );
            },
        },
    ];

    const writeHintId = `group-grant-hint-${groupId}`;
    const readRefused = !read.isChecking && !canRead;

    return (
        <div className="mt-6 space-y-6" data-testid="group-permissions">
            <section className="panel p-4 sm:p-6" aria-labelledby="group-permissions-heading">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="group-permissions-heading" className="flex items-center text-lg font-semibold text-fg">
                        <ShieldCheck className="mr-2 h-5 w-5" aria-hidden="true" />
                        Permissions
                    </h2>
                    {memberCount && (
                        <p className="text-sm text-muted" data-testid="group-member-count">
                            {players(memberCount.totalMembers)}
                            {memberCount.inheritingGroups > 0 && ` (with ${memberCount.inheritingGroups} inheriting ${memberCount.inheritingGroups === 1 ? 'group' : 'groups'})`}
                        </p>
                    )}
                </div>
                {readRefused ? (
                    <p className="text-sm text-muted">Requires {GROUP_READ_NODE} to see this group's permission nodes.</p>
                ) : (
                    <>
                        {grantsError && <p className="mb-2 text-sm field-error" role="alert">{grantsError}</p>}
                        <DataTable
                            caption={`Permission nodes of ${groupName}`}
                            columns={columns}
                            rows={grants}
                            rowKey={g => String(g.id ?? g.node)}
                            loading={(loadingGrants || read.isChecking) && grants.length === 0}
                            density="compact"
                            className="rounded-md border border-line"
                            empty="This group has no permission nodes of its own."
                        />
                        {grantTotal > grants.length && (
                            <p className="mt-2 text-xs text-muted">Showing the first {grants.length} of {grantTotal} nodes.</p>
                        )}
                        {actionError && <p className="mt-2 text-xs field-error" role="alert">{actionError}</p>}

                        {/* Saving a node the group already has updates it (one row per group and node). No default expiry:
                            an expiring group node would quietly take the permission from every member at once. */}
                        <form className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4" onSubmit={e => void handleSubmit(e)}
                            aria-label={`Grant or deny a node on ${groupName}`}>
                            <div className="min-w-[12rem] flex-1">
                                <label htmlFor="group-grant-node" className="mb-1 block text-xs text-muted">Node</label>
                                <input id="group-grant-node" type="text" placeholder="e.g. knk.gate.open"
                                    className="input w-full px-2 py-1.5 font-mono text-sm"
                                    value={node} disabled={!canWrite} onChange={e => setNode(e.target.value)} />
                            </div>
                            <div>
                                <label htmlFor="group-grant-value" className="mb-1 block text-xs text-muted">Value</label>
                                <select id="group-grant-value" className="input px-2 py-1.5 text-sm" value={value} disabled={!canWrite}
                                    onChange={e => setValue(e.target.value as 'true' | 'false')}>
                                    <option value="true">Grant</option>
                                    <option value="false">Deny</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="group-grant-expires" className="mb-1 block text-xs text-muted">
                                    Expires {expiresAt ? '(clear for permanent)' : '(permanent)'}
                                </label>
                                <div className="flex items-center gap-2">
                                    <input id="group-grant-expires" type="datetime-local" className="input px-2 py-1.5 text-sm"
                                        value={expiresAt} disabled={!canWrite} onChange={e => setExpiresAt(e.target.value)} />
                                    {expiresAt && (
                                        <button type="button" className="text-xs text-muted underline hover:text-danger" onClick={() => setExpiresAt('')}>
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                            <button type="submit" className="btn-primary text-sm"
                                disabled={!canWrite || !node.trim() || saving}
                                title={writeGate.hint ?? undefined}
                                aria-describedby={writeGate.hint ? writeHintId : undefined}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="mr-2 h-4 w-4" aria-hidden="true" />}
                                Save
                            </button>
                            {writeGate.hint && <span id={writeHintId} className="text-xs text-muted" data-testid="group-grant-hint">{writeGate.hint}</span>}
                        </form>
                    </>
                )}
            </section>

            <section className="panel p-4 sm:p-6" aria-labelledby="group-history-heading">
                <h2 id="group-history-heading" className="mb-3 flex items-center text-lg font-semibold text-fg">
                    <History className="mr-2 h-5 w-5" aria-hidden="true" />
                    History
                </h2>
                {readRefused ? (
                    <p className="text-sm text-muted">Requires {GROUP_READ_NODE} to see this group's history.</p>
                ) : (
                    <>
                        {historyError && <p className="mb-2 text-sm field-error" role="alert">{historyError}</p>}
                        <DataTable
                            caption={`History of ${groupName}`}
                            columns={historyColumns}
                            rows={history}
                            rowKey={e => String(e.id)}
                            loading={(loadingHistory || read.isChecking) && history.length === 0}
                            density="compact"
                            className="rounded-md border border-line"
                            empty="No recorded changes to this group's permission nodes yet."
                        />
                        {historyTotal > 0 && (
                            <Pager label="History pages" noun="entries" page={historyPage} pageSize={HISTORY_PAGE_SIZE}
                                totalCount={historyTotal} disabled={loadingHistory} onPageChange={setHistoryPage} />
                        )}
                    </>
                )}
            </section>
            {confirmModal}
        </div>
    );
};

export default GroupPermissionsPanel;
