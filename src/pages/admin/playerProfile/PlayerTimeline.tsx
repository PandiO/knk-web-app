import React from 'react';
import { History, Loader2 } from 'lucide-react';
import { userManagementClient } from '../../../apiClients/userManagementClient';
import { currencyClient } from '../../../apiClients/currencyClient';
import { formatDateTime } from '../../../utils/format';
import {
    auditToTimelineEvent,
    ledgerToTimelineEvent,
    TIMELINE_CATEGORIES,
    TimelineCategory,
    TimelineEvent,
    TimelineMerger,
    TimelineSource,
} from '../../../utils/playerTimeline';

/** Events read per "Load older". */
export const TIMELINE_BATCH = 25;

const TONE_DOT: Record<TimelineEvent['tone'], string> = {
    danger: 'bg-danger',
    success: 'bg-success',
    neutral: 'bg-line',
};

interface Props {
    userId: number;
    /** knk.admin.currency.history: the balance ledger joins the timeline. */
    includeLedger: boolean;
    /** Changes after an action on the page: read the timeline again from the newest. */
    refreshToken?: number;
}

/**
 * #119 (MOD-3): one player's history in one list, newest first: the audit log about them (moderation,
 * permissions, titles, kits, discoveries…) and, for holders of knk.admin.currency.history, every balance change
 * of their ledger. Filter chips narrow what was loaded; "Load older" reads further back.
 */
export const PlayerTimeline: React.FC<Props> = ({ userId, includeLedger, refreshToken = 0 }) => {
    const [events, setEvents] = React.useState<TimelineEvent[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [hasMore, setHasMore] = React.useState(false);
    const [errors, setErrors] = React.useState<string[]>([]);
    const [hidden, setHidden] = React.useState<Set<TimelineCategory>>(() => new Set());
    const mergerRef = React.useRef<TimelineMerger | null>(null);

    const sourceLabel = (id: string) => (id === 'ledger' ? 'balance history' : 'audit log');

    const readMore = React.useCallback(async (merger: TimelineMerger, replace: boolean) => {
        setLoading(true);
        const batch = await merger.next(TIMELINE_BATCH);
        if (mergerRef.current !== merger) return;
        setEvents(previous => (replace ? batch : [...previous, ...batch]));
        setHasMore(merger.hasMore);
        setErrors(merger.errors.map(e => `Could not load the ${sourceLabel(e.id)}.`));
        setLoading(false);
    }, []);

    React.useEffect(() => {
        if (!Number.isFinite(userId) || userId <= 0) return;
        const sources: TimelineSource[] = [{
            id: 'audit',
            fetchPage: async (page, pageSize) => {
                const result = await userManagementClient.getAuditLog({ targetUserId: userId, pageNumber: page, pageSize });
                return { events: (result?.items ?? []).map(auditToTimelineEvent), totalCount: result?.totalCount ?? 0 };
            },
        }];
        if (includeLedger) {
            sources.push({
                id: 'ledger',
                fetchPage: async (page, pageSize) => {
                    const result = await currencyClient.getLedger({ userId, sort: 'createdAt', dir: 'desc', page, pageSize });
                    return { events: (result?.items ?? []).map(ledgerToTimelineEvent), totalCount: result?.totalCount ?? 0 };
                },
            });
        }
        const merger = new TimelineMerger(sources, TIMELINE_BATCH);
        mergerRef.current = merger;
        void readMore(merger, true);
        return () => {
            if (mergerRef.current === merger) mergerRef.current = null;
        };
    }, [userId, includeLedger, refreshToken, readMore]);

    const toggle = (key: TimelineCategory) => setHidden(previous => {
        const next = new Set(previous);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    });

    const shown = events.filter(e => !hidden.has(e.category));

    return (
        <section className="panel p-4 sm:p-6" aria-labelledby="timeline-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id="timeline-heading" className="flex items-center text-lg font-semibold text-fg">
                    <History className="mr-2 h-5 w-5" aria-hidden="true" />
                    Timeline
                </h2>
                <div role="group" aria-label="Show in the timeline" className="flex flex-wrap gap-1">
                    {TIMELINE_CATEGORIES.map(c => (
                        <button
                            key={c.key}
                            type="button"
                            aria-pressed={!hidden.has(c.key)}
                            onClick={() => toggle(c.key)}
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${hidden.has(c.key)
                                ? 'border-line bg-surface text-muted line-through'
                                : 'border-primary bg-surface-alt text-fg'}`}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            </div>
            <p className="mb-3 text-xs text-muted" data-testid="timeline-sources">
                From the audit log{includeLedger ? ' and the balance history' : ''}. {includeLedger
                    ? ''
                    : 'Balance changes need knk.admin.currency.history. '}Game sessions are not in it yet.
            </p>
            {errors.map(e => <p key={e} className="mb-2 text-sm field-error" role="alert">{e}</p>)}
            {events.length === 0 && loading ? (
                <p className="flex items-center text-sm text-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Loading…</p>
            ) : shown.length === 0 ? (
                <p className="text-sm text-muted">
                    {events.length === 0 ? 'Nothing recorded for this player yet.' : 'Nothing of the selected kinds in what is loaded.'}
                </p>
            ) : (
                <ol className="relative space-y-0" data-testid="timeline">
                    {shown.map(event => (
                        <li key={event.key} className="flex gap-3 border-b border-line py-3 last:border-b-0" data-testid="timeline-event">
                            <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${TONE_DOT[event.tone]}`} aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                    <p className="text-sm font-medium text-fg">{event.title}</p>
                                    <time className="whitespace-nowrap text-xs text-muted" dateTime={event.at}>{formatDateTime(event.at)}</time>
                                </div>
                                <p className="mt-0.5 text-xs text-muted">
                                    {TIMELINE_CATEGORIES.find(c => c.key === event.category)?.label}
                                    {' · '}
                                    {event.actor ? <>by <span className="font-medium">{event.actor}</span></> : <span className="italic">system</span>}
                                </p>
                                {event.lines.map((line, i) => (
                                    <p key={i} className="mt-0.5 break-words text-xs text-fg">{line}</p>
                                ))}
                                {event.tags.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {event.tags.map(tag => (
                                            <span key={tag.label} className={`rounded-full px-2 py-0.5 text-xs font-medium ${tag.tone === 'red'
                                                ? 'bg-danger-muted text-danger-strong'
                                                : 'bg-surface-alt text-fg'}`}>
                                                {tag.label}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </li>
                    ))}
                </ol>
            )}
            {hasMore && (
                <div className="mt-3">
                    <button
                        type="button"
                        className="btn-secondary text-sm"
                        disabled={loading}
                        onClick={() => mergerRef.current && void readMore(mergerRef.current, false)}
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                        Load older
                    </button>
                </div>
            )}
        </section>
    );
};
