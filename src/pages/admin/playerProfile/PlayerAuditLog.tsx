import React from 'react';
import { ScrollText } from 'lucide-react';
import { userManagementClient } from '../../../apiClients/userManagementClient';
import { DataTable, DataTableColumn } from '../../../components/DataTable';
import { Pager } from '../../../components/Pager';
import { Field } from '../../../components/Field';
import { AuditAction, AuditLogEntryDto } from '../../../types/dtos/userManagement/UserProfileSummaryDtos';
import { auditActionLabel, auditTags, describeAuditDetails } from '../../../utils/auditDetails';
import { formatDateTime } from '../../../utils/format';

export const AUDIT_PAGE_SIZE = 25;

/** The actions the filter offers, in the order staff look for them (every AuditAction recorded about a player). */
export const PLAYER_AUDIT_ACTIONS: AuditAction[] = [
    'PlayerFrozen', 'PlayerUnfrozen', 'CurrencyTransferLocked', 'CurrencyTransferUnlocked', 'VanishToggled', 'PlayerTeleported',
    'BalanceAdjusted', 'SalaryPayout', 'CurrencyTransactionReversed', 'KitGranted', 'LootboxGranted',
    'GroupAssigned', 'GroupRemoved', 'GrantAdded', 'GrantUpdated', 'GrantRemoved',
    'TitleChanged', 'DiscoveryReset', 'PrivateMessagesViewed',
    'PlayerAdmitted', 'MinecraftLinked', 'MinecraftUnlinked', 'InvitationRedeemed',
    'PrivacyDeletionRequested', 'PrivacyDeletionConfirmed', 'PrivacyDeletionCancelled', 'PrivacyDeletionExecuted',
];

const actionLabel = (action: AuditAction) => auditActionLabel({ action } as AuditLogEntryDto);

interface Props {
    userId: number;
    refreshToken?: number;
}

/**
 * #119 (MOD-3): the audit log about one player, paged by the server (`GET api/audit-log?targetUserId=&pageNumber=`),
 * with a filter on the action. Replaces the profile's fixed "last 20" list.
 */
export const PlayerAuditLog: React.FC<Props> = ({ userId, refreshToken = 0 }) => {
    const [page, setPage] = React.useState(1);
    const [action, setAction] = React.useState<AuditAction | ''>('');
    const [rows, setRows] = React.useState<AuditLogEntryDto[]>([]);
    const [total, setTotal] = React.useState(0);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!Number.isFinite(userId) || userId <= 0) return;
        let cancelled = false;
        setLoading(true);
        userManagementClient.getAuditLog({ targetUserId: userId, action: action || undefined, pageNumber: page, pageSize: AUDIT_PAGE_SIZE })
            .then(result => {
                if (cancelled) return;
                setRows(result?.items ?? []);
                setTotal(result?.totalCount ?? 0);
                setError(null);
            })
            .catch(err => {
                if (cancelled) return;
                console.error('Failed to load the audit log:', err);
                setError('Could not load the audit log.');
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [userId, action, page, refreshToken]);

    const columns: DataTableColumn<AuditLogEntryDto>[] = [
        { key: 'timestamp', header: 'When', cell: e => <span className="whitespace-nowrap">{formatDateTime(e.timestamp)}</span> },
        { key: 'action', header: 'Action', className: 'font-medium', cell: e => auditActionLabel(e) },
        { key: 'actor', header: 'By', cell: e => e.actorUsername ?? <span className="italic text-muted">system</span> },
        {
            key: 'details', header: 'Details', cell: e => {
                const lines = describeAuditDetails(e);
                const tags = auditTags(e);
                if (lines.length === 0 && tags.length === 0) return <span className="text-muted">-</span>;
                return (
                    <div className="min-w-[12rem] space-y-0.5 text-xs">
                        {lines.map((line, i) => <p key={i} className="break-words">{line}</p>)}
                        {tags.map(tag => (
                            <span key={tag.label} className={`mr-1 inline-flex rounded-full px-2 py-0.5 font-medium ${tag.tone === 'red'
                                ? 'bg-danger-muted text-danger-strong'
                                : 'bg-surface-alt text-fg'}`}>{tag.label}</span>
                        ))}
                    </div>
                );
            },
        },
    ];

    return (
        <section className="panel p-4 sm:p-6" aria-labelledby="audit-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <h2 id="audit-heading" className="flex items-center text-lg font-semibold text-fg">
                    <ScrollText className="mr-2 h-5 w-5" aria-hidden="true" />
                    Audit log
                </h2>
                <Field label="Action" labelClassName="block text-xs font-medium text-muted mb-1">
                    <select
                        className="input px-2 py-1.5 text-sm"
                        value={action}
                        onChange={e => { setAction(e.target.value as AuditAction | ''); setPage(1); }}
                    >
                        <option value="">All actions</option>
                        {PLAYER_AUDIT_ACTIONS.map(a => <option key={a} value={a}>{actionLabel(a)}</option>)}
                    </select>
                </Field>
            </div>
            {error && <p className="mb-2 text-sm field-error" role="alert">{error}</p>}
            <DataTable
                caption="Audit log about this player"
                columns={columns}
                rows={rows}
                rowKey={e => String(e.id)}
                loading={loading && rows.length === 0}
                density="compact"
                className="rounded-md border border-line"
                empty={action ? 'No entries of this action.' : 'No recorded activity for this player yet.'}
            />
            {total > 0 && (
                <Pager
                    label="Audit log pages"
                    noun="entries"
                    page={page}
                    pageSize={AUDIT_PAGE_SIZE}
                    totalCount={total}
                    disabled={loading}
                    onPageChange={setPage}
                />
            )}
        </section>
    );
};
