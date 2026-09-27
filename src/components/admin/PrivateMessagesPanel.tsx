import React from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Loader2, MessageSquare, X } from 'lucide-react';
import { privateMessageLogClient } from '../../apiClients/privateMessageLogClient';
import { usePermission } from '../../hooks/useStaffAccess';
import {
    PrivateMessageLogEntryDto,
    PrivateMessageLogPagedResultDto,
    PrivateMessageOutcome,
} from '../../types/dtos/privateMessageLog';

// docs/specs/private-messages/DESIGN.md §3.4 / IMPLEMENTATION_PLAN.md Phase 4 - a player's
// private messages (sent and received) on their moderation profile. Only shown to holders of
// PM_LOG_READ_NODE; the API enforces the node as well and a 403 hides the panel. Every read is
// written to the player's audit log (PrivateMessagesViewed), so nothing is loaded until staff
// deliberately open the log - merely opening a profile reads no messages.

/** knk-web-api StaffPermissions.ReadPrivateMessages. */
export const PM_LOG_READ_NODE = 'knk.pmlog.read';

export const PM_PAGE_SIZE = 25;

const OUTCOME_BADGES: Record<PrivateMessageOutcome, { label: string; className: string }> = {
    Delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800' },
    BlockedIgnored: { label: 'Blocked: ignored', className: 'bg-gray-100 text-gray-700' },
    BlockedRateLimited: { label: 'Blocked: rate limit', className: 'bg-amber-100 text-amber-800' },
    BlockedFrozen: { label: 'Blocked: frozen', className: 'bg-red-100 text-red-800' },
};

/**
 * The API's [from, to) range for two `<input type="date">` values in the viewer's time zone:
 * from the start of the first day up to (not including) the day after the last one. Empty
 * inputs give no bound.
 */
export function toSentAtRange(fromDate: string, toDate: string): { from?: string; to?: string } {
    const startOfDay = (value: string, addDays = 0): string | undefined => {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!match) return undefined;
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + addDays);
        return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    };
    return { from: startOfDay(fromDate), to: startOfDay(toDate, 1) };
}

const formatDate = (iso: string): string => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

type Counterpart = { userId: number; name: string };

export const PrivateMessagesPanel: React.FC<{
    userId: number;
    /** Called after each successful read, which added a PrivateMessagesViewed audit entry. */
    onViewed?: () => void;
}> = ({ userId, onViewed }) => {
    const { allowed } = usePermission(PM_LOG_READ_NODE);

    const [opened, setOpened] = React.useState(false);
    const [forbidden, setForbidden] = React.useState(false);
    const [result, setResult] = React.useState<PrivateMessageLogPagedResultDto | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [counterpart, setCounterpart] = React.useState<Counterpart | null>(null);
    const [fromDate, setFromDate] = React.useState('');
    const [toDate, setToDate] = React.useState('');
    // The date range the shown page was loaded with (inputs apply on "Apply").
    const [appliedRange, setAppliedRange] = React.useState<{ from?: string; to?: string }>({});

    // Only the newest request may update the panel (fast paging/filter clicks).
    const requestSeq = React.useRef(0);

    const load = React.useCallback(async (
        pageNumber: number,
        filters: { counterpart: Counterpart | null; range: { from?: string; to?: string } },
    ) => {
        const seq = ++requestSeq.current;
        setLoading(true);
        setError(null);
        try {
            const page = await privateMessageLogClient.search({
                participantUserId: userId,
                otherUserId: filters.counterpart?.userId,
                from: filters.range.from,
                to: filters.range.to,
                pageNumber,
                pageSize: PM_PAGE_SIZE,
            });
            if (seq !== requestSeq.current) return;
            setResult(page);
            onViewed?.();
        } catch (err) {
            if (seq !== requestSeq.current) return;
            const status = (err as { status?: number } | null)?.status;
            if (status === 403) {
                setForbidden(true);
                return;
            }
            console.error('Failed to load private messages:', err);
            const message = err instanceof Error ? err.message : null;
            setError(status === 400 && message ? message : 'Could not load private messages.');
        } finally {
            if (seq === requestSeq.current) setLoading(false);
        }
    }, [userId, onViewed]);

    if (!allowed || forbidden) return null;

    const open = () => {
        setOpened(true);
        void load(1, { counterpart, range: appliedRange });
    };

    const applyDates = (e: React.FormEvent) => {
        e.preventDefault();
        const range = toSentAtRange(fromDate, toDate);
        if (range.from && range.to && range.from >= range.to) {
            setError('The start date must be on or before the end date.');
            return;
        }
        setAppliedRange(range);
        void load(1, { counterpart, range });
    };

    const selectCounterpart = (next: Counterpart | null) => {
        setCounterpart(next);
        void load(1, { counterpart: next, range: appliedRange });
    };

    const goToPage = (pageNumber: number) => {
        void load(pageNumber, { counterpart, range: appliedRange });
    };

    const totalPages = result ? Math.max(1, Math.ceil(result.totalCount / (result.pageSize || PM_PAGE_SIZE))) : 1;

    return (
        <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200" data-testid="private-messages-panel">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Private Messages
                </h2>
                {!opened && (
                    <button className="btn-secondary text-sm" onClick={open}>
                        Show messages
                    </button>
                )}
            </div>

            {!opened ? (
                <p className="text-sm text-gray-500">
                    Messages this player sent and received with /msg and /reply. Each time you open or page through
                    them, it is recorded in the player’s Recent Activity.
                </p>
            ) : (
                <>
                    <form className="flex flex-wrap items-end gap-3 mb-4" onSubmit={applyDates}>
                        <div>
                            <label htmlFor="pm-from" className="block text-xs text-gray-500 mb-1">From</label>
                            <input
                                id="pm-from"
                                type="date"
                                className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="pm-to" className="block text-xs text-gray-500 mb-1">To</label>
                            <input
                                id="pm-to"
                                type="date"
                                className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn-secondary text-sm" disabled={loading}>Apply</button>
                        {counterpart ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                With {counterpart.name}
                                <button
                                    type="button"
                                    className="ml-1.5 hover:text-blue-950"
                                    onClick={() => selectCounterpart(null)}
                                    title="Show every conversation"
                                    aria-label="Show every conversation"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </span>
                        ) : (
                            <span className="text-xs text-gray-500">Click a name to show only that conversation.</span>
                        )}
                        {loading && <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />}
                    </form>

                    {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

                    {result && result.items.length === 0 ? (
                        <p className="text-sm text-gray-500">No private messages found.</p>
                    ) : result ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b border-gray-200">
                                        <th className="py-2 pr-4">Time</th>
                                        <th className="py-2 pr-4">With</th>
                                        <th className="py-2 pr-4">Message</th>
                                        <th className="py-2 pr-4">Outcome</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.items.map((entry) => (
                                        <MessageRow key={entry.id} entry={entry} userId={userId} onSelectCounterpart={selectCounterpart} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : null}

                    {result && result.totalCount > 0 && (
                        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                            <span>
                                Page {result.pageNumber} of {totalPages} ({result.totalCount} message{result.totalCount === 1 ? '' : 's'})
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    className="btn-secondary text-xs px-2 py-1"
                                    disabled={loading || result.pageNumber <= 1}
                                    onClick={() => goToPage(result.pageNumber - 1)}
                                    aria-label="Newer messages"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                    className="btn-secondary text-xs px-2 py-1"
                                    disabled={loading || result.pageNumber >= totalPages}
                                    onClick={() => goToPage(result.pageNumber + 1)}
                                    aria-label="Older messages"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const MessageRow: React.FC<{
    entry: PrivateMessageLogEntryDto;
    userId: number;
    onSelectCounterpart: (counterpart: Counterpart) => void;
}> = ({ entry, userId, onSelectCounterpart }) => {
    const sent = entry.senderUserId === userId;
    const otherId = sent ? entry.recipientUserId : entry.senderUserId;
    const otherName = sent ? entry.recipientName : entry.senderName;
    const badge = OUTCOME_BADGES[entry.outcome] ?? { label: entry.outcome, className: 'bg-gray-100 text-gray-700' };

    return (
        <tr className="border-b border-gray-100 align-top">
            <td className="py-2 pr-4 text-xs text-gray-500 whitespace-nowrap">{formatDate(entry.sentAt)}</td>
            <td className="py-2 pr-4 whitespace-nowrap">
                <span className="inline-flex items-center" title={sent ? 'Sent' : 'Received'}>
                    {sent
                        ? <ArrowUpRight className="h-4 w-4 mr-1 text-blue-600" aria-label="Sent to" />
                        : <ArrowDownLeft className="h-4 w-4 mr-1 text-green-600" aria-label="Received from" />}
                    {/* The console has no user id, so its conversation can't be filtered on. */}
                    {otherId != null ? (
                        <button
                            type="button"
                            className="font-medium text-gray-900 hover:underline"
                            onClick={() => onSelectCounterpart({ userId: otherId, name: otherName })}
                            title={`Only the conversation with ${otherName}`}
                        >
                            {otherName}
                        </button>
                    ) : (
                        <span className="font-medium text-gray-900 italic">{otherName}</span>
                    )}
                </span>
            </td>
            <td className="py-2 pr-4 text-gray-800 break-words whitespace-pre-wrap">
                {entry.content}
                {entry.viaReply && <span className="ml-2 text-xs text-gray-400">(reply)</span>}
            </td>
            <td className="py-2 pr-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                    {badge.label}
                </span>
            </td>
        </tr>
    );
};
