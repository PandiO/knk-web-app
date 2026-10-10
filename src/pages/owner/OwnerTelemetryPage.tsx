import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Search, X } from 'lucide-react';
import { telemetryClient } from '../../apiClients/telemetryClient';
import { OwnerOnlyNotice } from '../../components/OwnerRoute';
import {
  EnhancedTargetDto,
  OWNER_TELEMETRY_MANAGE_NODE,
  OWNER_TELEMETRY_VIEW_NODE,
  TelemetryEventDetailDto,
  TelemetryEventViewDto,
  TelemetryHealthDto,
  TelemetryOutcome,
  TelemetrySearchParams,
  TelemetryTestRunDto,
  TelemetryTimelineItemDto,
} from '../../types/dtos/telemetry/TelemetryDtos';

/**
 * Owner diagnostics (KNG-34 link 6, IMPLEMENTATION_PLAN.md §8 link 6; DESIGN.md "First vertical
 * slice"): search events by player, time, session, test run, match, correlation id, name and
 * outcome; a player's ordered timeline with their ledger postings and Siege participations; an
 * event drawer with its correlated events and links; test runs and enhanced targets. Every read is
 * audited by the API. Owner only (exact grant).
 */

const OUTCOMES: TelemetryOutcome[] = ['Succeeded', 'Denied', 'Failed', 'Info'];

const OUTCOME_CLASS: Record<TelemetryOutcome, string> = {
  Succeeded: 'bg-green-100 text-green-800',
  Denied: 'bg-amber-100 text-amber-800',
  Failed: 'bg-red-100 text-red-800',
  Info: 'bg-gray-100 text-gray-700',
};

type Filters = {
  userId: string;
  from: string;
  to: string;
  sessionKey: string;
  testRunId: string;
  matchId: string;
  correlationId: string;
  name: string;
  outcome: string;
};

const EMPTY_FILTERS: Filters = {
  userId: '', from: '', to: '', sessionKey: '', testRunId: '', matchId: '', correlationId: '', name: '', outcome: '',
};

const isForbidden = (err: unknown) => (err as { status?: number })?.status === 403;
const messageOf = (err: unknown) => (err instanceof Error ? err.message : 'Request failed');
const toNumber = (value: string) => (value.trim() === '' ? undefined : Number(value));
/** datetime-local (browser time) → ISO UTC. */
const toIso = (value: string) => (value ? new Date(value).toISOString() : undefined);
export const formatTime = (iso: string) => new Date(iso).toLocaleString(undefined, {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

export const OwnerTelemetryPage: React.FC = () => {
  const [forbidden, setForbidden] = useState(false);
  const [health, setHealth] = useState<TelemetryHealthDto | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [mode, setMode] = useState<'events' | 'timeline'>('events');
  const [events, setEvents] = useState<TelemetryEventViewDto[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TelemetryTimelineItemDto[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<TelemetryEventDetailDto | null>(null);

  useEffect(() => {
    telemetryClient.getHealth()
      .then(setHealth)
      .catch(err => { if (isForbidden(err)) setForbidden(true); });
  }, []);

  const searchParams = (before?: string): TelemetrySearchParams => ({
    userId: toNumber(filters.userId),
    from: toIso(filters.from),
    to: toIso(filters.to),
    sessionKey: filters.sessionKey.trim() || undefined,
    testRunId: toNumber(filters.testRunId),
    matchId: toNumber(filters.matchId),
    correlationId: filters.correlationId.trim() || undefined,
    name: filters.name.trim() || undefined,
    outcome: (filters.outcome || undefined) as TelemetryOutcome | undefined,
    before,
  });

  const runSearch = async (before?: string) => {
    setLoading(true);
    setError(null);
    try {
      const page = await telemetryClient.search(searchParams(before));
      setMode('events');
      setTimeline(null);
      setEvents(prev => (before ? [...prev, ...page.items] : page.items));
      setNextBefore(page.nextBefore ?? null);
    } catch (err) {
      if (isForbidden(err)) setForbidden(true);
      else setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  };

  const runTimeline = async () => {
    const userId = toNumber(filters.userId);
    if (userId === undefined || Number.isNaN(userId)) {
      setError('Enter a player id for the timeline.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await telemetryClient.getTimeline(userId, toIso(filters.from), toIso(filters.to));
      setMode('timeline');
      setTimeline(result.items);
      setTruncated(result.truncated);
    } catch (err) {
      if (isForbidden(err)) setForbidden(true);
      else setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  };

  const openEvent = useCallback(async (eventId: string) => {
    try {
      setDetail(await telemetryClient.getEvent(eventId));
    } catch (err) {
      if (isForbidden(err)) setForbidden(true);
      else setError(messageOf(err));
    }
  }, []);

  /** Follow a correlation id: search everything that shares it. */
  const followCorrelation = (correlationId: string) => {
    setFilters({ ...EMPTY_FILTERS, correlationId });
    setDetail(null);
    setLoading(true);
    telemetryClient.search({ correlationId })
      .then(page => { setMode('events'); setTimeline(null); setEvents(page.items); setNextBefore(page.nextBefore ?? null); })
      .catch(err => setError(messageOf(err)))
      .finally(() => setLoading(false));
  };

  if (forbidden) return <OwnerOnlyNotice node={OWNER_TELEMETRY_VIEW_NODE} />;

  const field = (key: keyof Filters, label: string, type = 'text', placeholder = '') => (
    <label className="block text-xs font-medium text-gray-600">
      {label}
      <input
        aria-label={label}
        type={type}
        value={filters[key]}
        placeholder={placeholder}
        onChange={e => setFilters({ ...filters, [key]: e.target.value })}
        className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
      />
    </label>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="h-6 w-6" /> Diagnostics
        </h1>
        {health && (
          <p className="text-xs text-gray-500" data-testid="telemetry-health">
            {health.enabled ? 'Recording' : 'Switched off'} · {health.eventsLast24h} events in 24 h · queue {health.queueDepth}/{health.queueCapacity}
            {health.droppedSinceStart > 0 && <span className="text-amber-700"> · {health.droppedSinceStart} dropped since start</span>}
          </p>
        )}
      </div>

      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {field('userId', 'Player id', 'number')}
          {field('from', 'From', 'datetime-local')}
          {field('to', 'To', 'datetime-local')}
          {field('sessionKey', 'Session')}
          {field('testRunId', 'Test run', 'number')}
          {field('matchId', 'Siege match', 'number')}
          {field('correlationId', 'Correlation id')}
          {field('name', 'Event name', 'text', 'siege.match_join')}
          <label className="block text-xs font-medium text-gray-600">
            Outcome
            <select
              aria-label="Outcome"
              value={filters.outcome}
              onChange={e => setFilters({ ...filters, outcome: e.target.value })}
              className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">Any</option>
              {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => runSearch()} disabled={loading}
            className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            <Search className="h-4 w-4" /> Search events
          </button>
          <button type="button" onClick={runTimeline} disabled={loading}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50">
            Player timeline
          </button>
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="px-3 py-1.5 text-sm text-gray-500">Clear</button>
        </div>
        <p className="mt-2 text-xs text-gray-500">Every search is recorded in the audit log.</p>
      </section>

      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

      {mode === 'events' && (
        <section aria-label="Events">
          {events.length === 0 && !loading && <p className="text-sm text-gray-500">No events yet - set filters and search.</p>}
          <ul className="divide-y divide-gray-100 bg-white rounded-lg border border-gray-200">
            {events.map(e => <EventRow key={e.id} event={e} onOpen={openEvent} />)}
          </ul>
          {nextBefore && (
            <button type="button" onClick={() => runSearch(nextBefore)} disabled={loading}
              className="mt-3 text-sm font-medium text-primary hover:underline">Load older events</button>
          )}
        </section>
      )}

      {mode === 'timeline' && timeline && (
        <section aria-label="Timeline">
          {truncated && (
            <p className="mb-2 text-xs text-amber-700 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> More happened in this window than is shown - narrow the time range.
            </p>
          )}
          {timeline.length === 0 && <p className="text-sm text-gray-500">Nothing recorded for this player in the window.</p>}
          <ol className="divide-y divide-gray-100 bg-white rounded-lg border border-gray-200">
            {timeline.map((item, i) => <TimelineRow key={i} item={item} onOpen={openEvent} />)}
          </ol>
        </section>
      )}

      {detail && (
        <EventDrawer detail={detail} onClose={() => setDetail(null)} onOpen={openEvent} onFollow={followCorrelation} />
      )}

      <TestRunsPanel />
    </div>
  );
};

const OutcomeBadge: React.FC<{ outcome: TelemetryOutcome }> = ({ outcome }) => (
  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${OUTCOME_CLASS[outcome]}`}>{outcome}</span>
);

const EventRow: React.FC<{ event: TelemetryEventViewDto; onOpen: (id: string) => void }> = ({ event, onOpen }) => (
  <li>
    <button type="button" onClick={() => onOpen(event.eventId)} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-3 text-sm">
      <span className="w-40 shrink-0 text-xs text-gray-500">{formatTime(event.occurredAt)}</span>
      <OutcomeBadge outcome={event.outcome} />
      <span className="font-mono text-gray-900">{event.name}</span>
      {event.reasonCode && <span className="text-xs text-gray-500">{event.reasonCode}</span>}
      {event.username && <span className="ml-auto text-xs text-gray-600">{event.username}</span>}
      {event.level === 'Enhanced' && <span className="text-xs text-purple-700">enhanced</span>}
    </button>
  </li>
);

const TimelineRow: React.FC<{ item: TelemetryTimelineItemDto; onOpen: (id: string) => void }> = ({ item, onOpen }) => {
  if (item.kind === 'event' && item.event) return <EventRow event={item.event} onOpen={onOpen} />;
  return (
    <li className="px-3 py-2 flex items-center gap-3 text-sm">
      <span className="w-40 shrink-0 text-xs text-gray-500">{formatTime(item.at)}</span>
      {item.kind === 'ledger' && item.ledger && (
        <>
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">Ledger</span>
          <span className="font-mono">{item.ledger.reasonCode}</span>
          <span className={item.ledger.delta < 0 ? 'text-red-700' : 'text-green-700'}>
            {item.ledger.delta > 0 ? '+' : ''}{item.ledger.delta} {item.ledger.currency}
          </span>
          <Link to={`/admin/economy/transactions/${item.ledger.publicId}`} className="ml-auto text-xs text-primary hover:underline">
            {item.ledger.publicId}
          </Link>
        </>
      )}
      {item.kind === 'siege' && item.siege && (
        <>
          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-800">Siege</span>
          <span>Match #{item.siege.matchId} {item.siege.kind}</span>
          <span className="text-xs text-gray-500">
            {item.siege.status} · team {item.siege.teamId ?? '-'} · {item.siege.kills} kills, {item.siege.deaths} deaths, {item.siege.captures} captures
          </span>
        </>
      )}
    </li>
  );
};

const EventDrawer: React.FC<{
  detail: TelemetryEventDetailDto;
  onClose: () => void;
  onOpen: (id: string) => void;
  onFollow: (correlationId: string) => void;
}> = ({ detail, onClose, onOpen, onFollow }) => {
  const e = detail.event;
  const rows: [string, React.ReactNode][] = [
    ['When', formatTime(e.occurredAt)],
    ['Player', e.userId ? `${e.username ?? '?'} (#${e.userId})` : '-'],
    ['Outcome', <OutcomeBadge key="o" outcome={e.outcome} />],
    ['Reason', e.reasonCode ?? '-'],
    ['Object', e.objectType ? `${e.objectType} ${e.objectId ?? ''}` : '-'],
    ['Session', e.sessionKey ?? '-'],
    ['Test run', e.testRunId ?? '-'],
    ['Source', `${e.source} · ${e.serverName} #${e.serverSeq} · ${e.appVersion}`],
    ['Level', e.level],
  ];
  // Smoke test 2026-10-10: above the fixed nav (z-50), which hid the drawer's top and its close
  // button; a click on the backdrop or Escape closes it too.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} data-testid="event-drawer-backdrop" />
    <aside role="dialog" aria-label="Event detail"
      className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-white shadow-xl border-l border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <h2 className="font-mono text-lg text-gray-900">{e.name}</h2>
        <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-gray-500" /></button>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-gray-500">{label}</dt>
            <dd className="col-span-2 text-gray-900 break-all">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      {e.payload && Object.keys(e.payload).length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase text-gray-500">Details</h3>
          <dl className="mt-1 grid grid-cols-3 gap-y-1 text-sm">
            {Object.entries(e.payload).map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="text-gray-500">{k}</dt>
                <dd className="col-span-2 font-mono">{String(v)}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      )}
      <div className="mt-4 space-y-1 text-sm">
        <h3 className="text-xs font-semibold uppercase text-gray-500">Links</h3>
        {detail.links.siegeMatchId && <p>Siege match #{detail.links.siegeMatchId}</p>}
        {detail.links.ledgerTransactionPublicIds.map(id => (
          <p key={id}><Link to={`/admin/economy/transactions/${id}`} className="text-primary hover:underline">Ledger {id}</Link></p>
        ))}
        {e.correlationId && (
          <button type="button" onClick={() => onFollow(e.correlationId!)} className="text-primary hover:underline">
            Everything with correlation {e.correlationId}
          </button>
        )}
        {!detail.links.siegeMatchId && detail.links.ledgerTransactionPublicIds.length === 0 && !e.correlationId && (
          <p className="text-gray-500">No linked records.</p>
        )}
      </div>
      {detail.related.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase text-gray-500">Same action ({detail.related.length})</h3>
          <ul className="mt-1 divide-y divide-gray-100">
            {detail.related.map(r => <EventRow key={r.id} event={r} onOpen={onOpen} />)}
          </ul>
        </div>
      )}
    </aside>
    </div>
  );
};

/** Test runs and enhanced targets (knk.owner.telemetry.manage); hidden for a view-only owner. */
const TestRunsPanel: React.FC = () => {
  const [runs, setRuns] = useState<TelemetryTestRunDto[] | null>(null);
  const [targets, setTargets] = useState<EnhancedTargetDto[]>([]);
  const [hidden, setHidden] = useState(false);
  const [runName, setRunName] = useState('');
  const [targetUser, setTargetUser] = useState('');
  const [targetRun, setTargetRun] = useState('');
  const [hours, setHours] = useState('4');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([telemetryClient.getTestRuns(), telemetryClient.getEnhancedTargets()])
      .then(([r, t]) => { setRuns(r); setTargets(t); })
      .catch(err => { if (isForbidden(err)) setHidden(true); else setError(messageOf(err)); });
  }, []);

  useEffect(load, [load]);

  if (hidden) {
    return <p className="text-xs text-gray-500">Test runs and enhanced mode need <code>{OWNER_TELEMETRY_MANAGE_NODE}</code>.</p>;
  }
  if (!runs) return null;

  const act = (work: Promise<unknown>) => work.then(load).catch(err => setError(messageOf(err)));

  const addTarget = () => {
    const expiresAt = new Date(Date.now() + Number(hours || '1') * 3600_000).toISOString();
    const userId = toNumber(targetUser);
    const testRunId = toNumber(targetRun);
    act(telemetryClient.addEnhancedTarget(userId !== undefined ? { userId, expiresAt } : { testRunId, expiresAt }))
      .then(() => { setTargetUser(''); setTargetRun(''); });
  };

  return (
    <section aria-label="Test runs" className="grid md:grid-cols-2 gap-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900">Test runs</h2>
        <p className="text-xs text-gray-500">The running test run's id is stamped on every event the server sends.</p>
        <div className="mt-3 flex gap-2">
          <input aria-label="Test run name" value={runName} onChange={e => setRunName(e.target.value)} placeholder="Siege alpha 1"
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
          <button type="button" disabled={!runName.trim()}
            onClick={() => act(telemetryClient.startTestRun(runName.trim())).then(() => setRunName(''))}
            className="rounded bg-primary px-3 py-1 text-sm text-white disabled:opacity-50">Start</button>
        </div>
        <ul className="mt-3 divide-y divide-gray-100 text-sm">
          {runs.map(r => (
            <li key={r.id} className="py-1.5 flex items-center gap-2">
              <span className="font-medium">#{r.id} {r.name}</span>
              <span className="text-xs text-gray-500">{formatTime(r.startedAt)}{r.endedAt ? ` – ${formatTime(r.endedAt)}` : ' (running)'}</span>
              {!r.endedAt && (
                <button type="button" onClick={() => act(telemetryClient.endTestRun(r.id))} className="ml-auto text-xs text-red-700 hover:underline">End</button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900">Enhanced mode</h2>
        <p className="text-xs text-gray-500">Position samples, menu clicks and hits - for one player, or everyone during a test run.</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <input aria-label="Enhanced player id" value={targetUser} onChange={e => setTargetUser(e.target.value)} placeholder="Player id"
            className="rounded border border-gray-300 px-2 py-1 text-sm" />
          <input aria-label="Enhanced test run id" value={targetRun} onChange={e => setTargetRun(e.target.value)} placeholder="or run id"
            className="rounded border border-gray-300 px-2 py-1 text-sm" />
          <input aria-label="Hours" value={hours} onChange={e => setHours(e.target.value)} type="number" min={1} max={168}
            className="rounded border border-gray-300 px-2 py-1 text-sm" />
          <button type="button" onClick={addTarget} disabled={!targetUser && !targetRun}
            className="rounded bg-primary px-3 py-1 text-sm text-white disabled:opacity-50">Add</button>
        </div>
        <ul className="mt-3 divide-y divide-gray-100 text-sm">
          {targets.map(t => (
            <li key={t.id} className="py-1.5 flex items-center gap-2">
              <span>{t.userId ? `${t.username ?? 'player'} (#${t.userId})` : `Test run #${t.testRunId}`}</span>
              <span className="text-xs text-gray-500">until {formatTime(t.expiresAt)}</span>
              <button type="button" onClick={() => act(telemetryClient.removeEnhancedTarget(t.id))} className="ml-auto text-xs text-red-700 hover:underline">Remove</button>
            </li>
          ))}
        </ul>
      </div>
      {error && <p className="text-sm text-red-700 md:col-span-2" role="alert">{error}</p>}
    </section>
  );
};

export default OwnerTelemetryPage;
