import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clipboard, History, Loader2, MapPinOff, RefreshCw, Settings2 } from 'lucide-react';
import { locationRetentionClient } from '../../../apiClients/locationRetentionClient';
import { FeedbackModal } from '../../../components/FeedbackModal';
import { parseUtc } from '../../../components/currency/BalanceLedgerTable';
import { usePermission } from '../../../hooks/useStaffAccess';
import {
    LOCATION_RETENTION_NODES,
    LocationOrphanDeleteResultDto,
    LocationOrphanDto,
    LocationOrphanPageDto,
    LocationOrphanStatus,
    LocationOrphanStatusFilter,
    LocationRetentionSettingsDto,
    LocationRetentionStatusDto,
} from '../../../types/dtos/locationRetention/LocationRetentionDtos';

const PAGE_SIZE = 25;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const numberFormat = new Intl.NumberFormat('en-US');

const STATUS_STYLES: Record<LocationOrphanStatus, string> = {
    Open: 'bg-amber-50 text-amber-800 border-amber-200',
    Kept: 'bg-blue-50 text-blue-800 border-blue-200',
    Deleted: 'bg-red-50 text-red-800 border-red-200',
    Resolved: 'bg-green-50 text-green-800 border-green-200',
};

const errorMessage = (err: unknown, fallback: string): string =>
    err instanceof Error && err.message ? err.message : fallback;

const formatWhen = (value?: string | null): string => {
    if (!value) return '';
    const date = parseUtc(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const coord = (value: number): string => (Math.round(value * 100) / 100).toString();

/** The in-game command (preferred: world-aware, vanish-safe, audited). */
export const pluginTeleportCommand = (locationId: number): string => `/knk location tp ${locationId}`;

/**
 * Vanilla dimension id of a Bukkit world name for /execute in: the server's main worlds map to the
 * vanilla dimensions, any other world to minecraft:<name> (Paper's key for extra worlds). Assumes
 * the default level-name "world".
 */
export const dimensionFor = (world?: string | null): string => {
    const name = (world || 'world').toLowerCase();
    if (name === 'world') return 'minecraft:overworld';
    if (name === 'world_nether') return 'minecraft:the_nether';
    if (name === 'world_the_end') return 'minecraft:the_end';
    return name.includes(':') ? name : `minecraft:${name}`;
};

/** Coordinate fallback for when the plugin command is not available. */
export const executeTeleportCommand = (item: Pick<LocationOrphanDto, 'world' | 'x' | 'y' | 'z' | 'yaw' | 'pitch'>): string =>
    `/execute in ${dimensionFor(item.world)} run tp @s ${coord(item.x)} ${coord(item.y)} ${coord(item.z)} ${coord(item.yaw)} ${coord(item.pitch)}`;

/**
 * A command with click-to-copy. Without the Clipboard API (plain-HTTP admin page) or when it
 * refuses, the command is shown selected in a read-only field to copy by hand.
 */
export const CopyCommand: React.FC<{ label: string; command: string }> = ({ label, command }) => {
    const [copied, setCopied] = React.useState(false);
    const [manual, setManual] = React.useState(false);
    const fieldRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (!copied) return undefined;
        const timer = window.setTimeout(() => setCopied(false), 2000);
        return () => window.clearTimeout(timer);
    }, [copied]);

    React.useEffect(() => {
        if (manual) fieldRef.current?.select();
    }, [manual]);

    const copy = async () => {
        try {
            if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard API unavailable');
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setManual(false);
        } catch {
            setManual(true);
        }
    };

    return (
        <div className="text-xs">
            <div className="text-gray-500 mb-0.5">{label}</div>
            {manual ? (
                <div>
                    <input
                        ref={fieldRef}
                        readOnly
                        value={command}
                        aria-label={`${label} (select and copy)`}
                        onFocus={e => e.currentTarget.select()}
                        className="w-full font-mono border border-gray-300 rounded px-2 py-1 bg-white"
                    />
                    <p className="text-gray-500 mt-0.5">Copying is not available here; press Ctrl+C (⌘C) to copy the selected command.</p>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => void copy()}
                    className="inline-flex items-center gap-2 font-mono bg-gray-50 border border-gray-200 rounded px-2 py-1 hover:bg-gray-100 max-w-full"
                    aria-label={`Copy ${label}`}
                    title="Click to copy"
                >
                    <span className="truncate">{command}</span>
                    {copied ? <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" /> : <Clipboard className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />}
                    {copied && <span className="text-green-700 font-sans">Copied</span>}
                </button>
            )}
        </div>
    );
};

const StatusBadge: React.FC<{ status: LocationOrphanStatus }> = ({ status }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.Open}`}>
        {status}
    </span>
);

type PendingAction = { kind: 'keep' | 'delete'; item: LocationOrphanDto; note: string };

/**
 * Staff → Orphaned Locations (KNG-80): Locations that still have the default name and that nothing
 * references, found by the API's weekly check. Each is reviewed by hand - Keep (with a note) or
 * Delete - and nothing is ever deleted automatically; Delete re-checks on the server and refuses
 * when the Location got a relation or a name since it was flagged. Teleport commands let staff
 * look at the spot first. Needs knk.admin.location.orphans (StaffRoute node); every action has
 * its own node, enforced by the API.
 */
export const LocationRetentionPage: React.FC = () => {
    const { allowed: canKeep } = usePermission(LOCATION_RETENTION_NODES.keep);
    const { allowed: canDelete } = usePermission(LOCATION_RETENTION_NODES.delete);
    const { allowed: canTeleport } = usePermission(LOCATION_RETENTION_NODES.teleport);

    const [status, setStatus] = React.useState<LocationOrphanStatusFilter>('open');
    const [page, setPage] = React.useState(1);
    const [orphans, setOrphans] = React.useState<LocationOrphanPageDto | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [notice, setNotice] = React.useState<{ text: string; tone: 'success' | 'info' } | null>(null);
    const [notes, setNotes] = React.useState<Record<number, string>>({});
    const [teleportOpen, setTeleportOpen] = React.useState<number | null>(null);
    const [pending, setPending] = React.useState<PendingAction | null>(null);
    const [busy, setBusy] = React.useState<number | null>(null);
    const [statusReload, setStatusReload] = React.useState(0);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setOrphans(await locationRetentionClient.getOrphans(status, page, PAGE_SIZE));
        } catch (err) {
            setError(errorMessage(err, 'Could not load the orphaned Locations.'));
        } finally {
            setLoading(false);
        }
    }, [status, page]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const decide = async (action: PendingAction) => {
        setBusy(action.item.id);
        setError(null);
        setNotice(null);
        try {
            if (action.kind === 'keep') {
                await locationRetentionClient.keep(action.item.id, action.note.trim());
                setNotice({ text: `Location #${action.item.locationId} kept.`, tone: 'success' });
            } else {
                const result = await locationRetentionClient.delete(action.item.id, action.note.trim());
                setNotice({ text: result.message || `Location #${action.item.locationId} deleted.`, tone: 'success' });
            }
            setNotes(current => {
                const next = { ...current };
                delete next[action.item.id];
                return next;
            });
        } catch (err) {
            const result = (err as { status?: number; response?: LocationOrphanDeleteResultDto })?.response;
            if ((err as { status?: number })?.status === 409 && result?.outcome === 'NoLongerOrphan') {
                // The server's re-check found a relation or a name: nothing was deleted.
                setNotice({ text: result.message, tone: 'info' });
            } else {
                setError(errorMessage(err, action.kind === 'keep' ? 'Could not keep the Location.' : 'Could not delete the Location.'));
            }
        } finally {
            setBusy(null);
            await load();
        }
    };

    const totalPages = orphans ? Math.max(1, Math.ceil(orphans.totalCount / Math.max(1, orphans.pageSize))) : 1;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <Link to="/admin/users" className="text-sm text-gray-500 hover:underline inline-flex items-center">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Player moderation
                        </Link>
                        <h1 className="mt-2 text-2xl font-bold text-gray-900 flex items-center">
                            <MapPinOff className="h-6 w-6 mr-2" />
                            Orphaned Locations
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Locations that still have the default name and that nothing uses. The weekly check only lists
                            them — nothing is deleted automatically. Look at each one, then keep or delete it.
                        </p>
                    </div>
                    {orphans && (
                        <div className="text-sm text-gray-600 flex gap-3" aria-label="Orphan totals">
                            <span>{numberFormat.format(orphans.openCount)} open</span>
                            <span>{numberFormat.format(orphans.keptCount)} kept</span>
                        </div>
                    )}
                </div>

                <RunPanel reloadKey={statusReload} onRan={() => { setStatusReload(k => k + 1); void load(); }} />

                <div className="bg-white shadow-sm rounded-lg border border-gray-200">
                    <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-end">
                        <div>
                            <label htmlFor="orphan-status" className="block text-xs text-gray-500 mb-1">Status</label>
                            <select id="orphan-status" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" value={status}
                                onChange={e => { setStatus(e.target.value as LocationOrphanStatusFilter); setPage(1); }}>
                                <option value="open">Open</option>
                                <option value="kept">Kept</option>
                                <option value="deleted">Deleted</option>
                                <option value="resolved">Resolved</option>
                                <option value="all">All</option>
                            </select>
                        </div>
                        <button type="button" className="btn-secondary text-sm" onClick={() => void load()} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>

                    {error && <p className="p-4 text-sm text-red-600" role="alert">{error}</p>}
                    {notice && (
                        <p className={`px-4 pt-4 text-sm ${notice.tone === 'success' ? 'text-green-700' : 'text-blue-800'}`} role="status">{notice.text}</p>
                    )}
                    {loading && !orphans && (
                        <div className="p-4 flex items-center text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading…
                        </div>
                    )}
                    {orphans && orphans.items.length === 0 && !error && (
                        <p className="p-6 text-sm text-gray-500">
                            {status === 'open' ? 'No orphaned Locations waiting for review.' : 'Nothing matches this filter.'}
                        </p>
                    )}

                    {orphans && orphans.items.length > 0 && (
                        <ul className="divide-y divide-gray-100">
                            {orphans.items.map(item => (
                                <li key={item.id} className="p-4 space-y-2" data-testid={`orphan-${item.id}`}>
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1 text-sm">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <StatusBadge status={item.status} />
                                                <span className="font-medium text-gray-900">Location #{item.locationId}</span>
                                                <span className="text-gray-500">{item.name ? `“${item.name}”` : '(no name)'}</span>
                                                {!item.locationExists && item.status !== 'Deleted' && (
                                                    <span className="text-xs text-gray-500">(no longer in the database)</span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-gray-700">
                                                {item.world ?? 'world'} · {coord(item.x)}, {coord(item.y)}, {coord(item.z)}
                                                <span className="text-gray-400"> (yaw {coord(item.yaw)}, pitch {coord(item.pitch)})</span>
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                Created {item.locationCreatedAt ? formatWhen(item.locationCreatedAt) : 'before creation dates were recorded'}
                                                {' · '}flagged {formatWhen(item.flaggedAt)}
                                                {item.flaggedByRunId ? ` (run #${item.flaggedByRunId})` : ''}
                                                {' · '}last seen {formatWhen(item.lastSeenAt)}
                                            </p>
                                            {item.previousDecision && (
                                                <p className="mt-1 text-xs text-blue-800 inline-flex items-center gap-1">
                                                    <History className="h-3.5 w-3.5" />
                                                    Kept before by {item.previousDecision.decidedByUsername ?? 'staff'}
                                                    {item.previousDecision.decidedAt ? ` on ${formatWhen(item.previousDecision.decidedAt)}` : ''}
                                                    {item.previousDecision.decisionNote ? ` — “${item.previousDecision.decisionNote}”` : ''}
                                                    {' '}(flagged again after the recheck period or a change).
                                                </p>
                                            )}
                                            {item.status !== 'Open' && (
                                                <p className="mt-1 text-xs text-gray-600">
                                                    {item.status} {item.decidedByUsername ? `by ${item.decidedByUsername}` : ''}
                                                    {item.decidedAt ? ` on ${formatWhen(item.decidedAt)}` : ''}
                                                    {item.decisionNote ? ` — “${item.decisionNote}”` : ''}
                                                    {item.resolvedReason ? ` — ${item.resolvedReason}` : ''}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 items-start">
                                            {canTeleport && item.status !== 'Deleted' && (
                                                <button type="button" className="btn-secondary text-sm"
                                                    onClick={() => setTeleportOpen(teleportOpen === item.id ? null : item.id)}
                                                    aria-expanded={teleportOpen === item.id}>
                                                    Teleport info
                                                </button>
                                            )}
                                            {item.status === 'Open' && canKeep && (
                                                <button type="button" className="btn-secondary text-sm" disabled={busy === item.id}
                                                    onClick={() => setPending({ kind: 'keep', item, note: notes[item.id] ?? '' })}
                                                    aria-label={`Keep Location ${item.locationId}`}>
                                                    Keep
                                                </button>
                                            )}
                                            {item.status === 'Open' && canDelete && (
                                                <button type="button" className="btn-secondary text-sm text-red-700" disabled={busy === item.id}
                                                    onClick={() => setPending({ kind: 'delete', item, note: notes[item.id] ?? '' })}
                                                    aria-label={`Delete Location ${item.locationId}`}>
                                                    {busy === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {item.status === 'Open' && (canKeep || canDelete) && (
                                        <input
                                            type="text"
                                            maxLength={500}
                                            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                                            placeholder="Note for the record (optional), e.g. why it is kept"
                                            aria-label={`Note for Location ${item.locationId}`}
                                            value={notes[item.id] ?? ''}
                                            onChange={e => setNotes(current => ({ ...current, [item.id]: e.target.value }))}
                                        />
                                    )}
                                    {teleportOpen === item.id && canTeleport && (
                                        <div className="grid gap-2 sm:grid-cols-2 bg-gray-50 border border-gray-200 rounded p-3">
                                            <CopyCommand label="In game (preferred)" command={pluginTeleportCommand(item.locationId)} />
                                            <CopyCommand label="Coordinates (without the plugin)" command={executeTeleportCommand(item)} />
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}

                    {orphans && orphans.totalCount > orphans.pageSize && (
                        <div className="p-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
                            <span>Page {orphans.pageNumber} of {totalPages} · {numberFormat.format(orphans.totalCount)} items</span>
                            <div className="flex gap-2">
                                <button type="button" className="btn-secondary text-sm" disabled={page <= 1 || loading}
                                    onClick={() => setPage(p => Math.max(1, p - 1))} aria-label="Previous page">
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button type="button" className="btn-secondary text-sm" disabled={page >= totalPages || loading}
                                    onClick={() => setPage(p => p + 1)} aria-label="Next page">
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <FeedbackModal
                open={pending !== null}
                status={pending?.kind === 'delete' ? 'error' : 'info'}
                title={pending?.kind === 'delete' ? `Delete Location #${pending.item.locationId}?` : `Keep Location #${pending?.item.locationId ?? ''}?`}
                message={pending?.kind === 'delete'
                    ? `This removes the Location from the database for good (the review keeps its coordinates and your name). `
                        + `The server checks again first and refuses if anything started using it.${pending.note.trim() ? ` Note: “${pending.note.trim()}”.` : ''}`
                    : `It won't be listed again for the recheck period, or until the Location changes.${pending?.note.trim() ? ` Note: “${pending.note.trim()}”.` : ''}`}
                continueLabel={pending?.kind === 'delete' ? 'Delete' : 'Keep'}
                onContinue={() => { if (pending) void decide(pending); }}
                onClose={() => setPending(null)}
            />
        </div>
    );
};

/** The last run, the next scheduled one, "Run check now" and the schedule settings. */
const RunPanel: React.FC<{ reloadKey: number; onRan: () => void }> = ({ reloadKey, onRan }) => {
    const { allowed: canRun } = usePermission(LOCATION_RETENTION_NODES.run);
    const { allowed: canEditSettings } = usePermission(LOCATION_RETENTION_NODES.settings);
    const [state, setState] = React.useState<LocationRetentionStatusDto | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [running, setRunning] = React.useState(false);
    const [editing, setEditing] = React.useState(false);

    const load = React.useCallback(async () => {
        try {
            setState(await locationRetentionClient.getStatus());
            setError(null);
        } catch (err) {
            setError(errorMessage(err, 'Could not load the last run.'));
        }
    }, []);

    React.useEffect(() => {
        void load();
    }, [load, reloadKey]);

    const handleRun = async () => {
        setRunning(true);
        setError(null);
        try {
            await locationRetentionClient.runNow();
            await load();
            onRan();
        } catch (err) {
            setError(errorMessage(err, 'Could not run the check.'));
        } finally {
            setRunning(false);
        }
    };

    const last = state?.lastRun;
    const settings = state?.settings;
    return (
        <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-4 space-y-2" aria-label="Orphan check">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Orphan check</h2>
                <div className="flex gap-2">
                    {canEditSettings && settings && (
                        <button type="button" className="btn-secondary text-sm" onClick={() => setEditing(e => !e)} aria-expanded={editing}>
                            <Settings2 className="h-4 w-4 mr-2" />
                            Schedule
                        </button>
                    )}
                    {canRun && (
                        <button type="button" className="btn-secondary text-sm" onClick={() => void handleRun()} disabled={running || state?.running}>
                            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                            Run check now
                        </button>
                    )}
                </div>
            </div>
            {settings && (
                <p className="text-xs text-gray-500">
                    {settings.scheduleEnabled
                        ? `Runs ${settings.frequency === 'Daily' ? 'daily' : `every ${settings.runDayOfWeek}`} at ${settings.runAtTime} server time${settings.timeZone ? ` (${settings.timeZone})` : ''}`
                        : 'The scheduled run is switched off'}
                    {state?.nextScheduledRunAt ? `, next ${formatWhen(state.nextScheduledRunAt)}` : ''}.
                    {' '}Skips Locations younger than {settings.gracePeriodDays} days; a kept Location is listed again after {settings.keptRecheckMonths} months.
                </p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {state && !last && <p className="text-sm text-gray-500">No run yet.</p>}
            {last && (
                <p className={`text-sm ${last.succeeded ? 'text-gray-700' : 'text-red-600'}`}>
                    {last.succeeded
                        ? `Last run ${formatWhen(last.startedAt)} (${last.trigger}${last.triggeredByUsername ? ` by ${last.triggeredByUsername}` : ''}): `
                            + `${numberFormat.format(last.candidatesScanned)} unnamed Locations checked, ${numberFormat.format(last.orphansFound)} orphaned, `
                            + `${numberFormat.format(last.newOrphans)} new${last.reflagged ? ` (${last.reflagged} kept before)` : ''}, `
                            + `${numberFormat.format(last.resolved)} resolved, ${numberFormat.format(last.durationMs)} ms.`
                        : `The last run (${formatWhen(last.startedAt)}) failed: ${last.error ?? 'unknown error'}`}
                </p>
            )}
            {state && state.relations.length > 0 && (
                <details className="text-xs text-gray-500">
                    <summary className="cursor-pointer">What counts as “in use”</summary>
                    <p className="mt-1">
                        Foreign keys (read from the database model): {state.relations.join(', ')}. Also: {state.otherReferenceSources.join('; ')}.
                    </p>
                </details>
            )}
            {editing && settings && (
                <SettingsForm initial={settings} onSaved={() => { setEditing(false); void load(); }} />
            )}
        </section>
    );
};

const SettingsForm: React.FC<{ initial: LocationRetentionSettingsDto; onSaved: () => void }> = ({ initial, onSaved }) => {
    const [form, setForm] = React.useState<LocationRetentionSettingsDto>(initial);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            await locationRetentionClient.updateSettings(form);
            onSaved();
        } catch (err) {
            setError(errorMessage(err, 'Could not save the schedule.'));
        } finally {
            setSaving(false);
        }
    };

    const field = 'border border-gray-300 rounded-md px-2 py-1 text-sm';
    return (
        <div className="border-t border-gray-200 pt-3 grid gap-3 sm:grid-cols-3 text-sm" aria-label="Schedule settings">
            <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.scheduleEnabled} onChange={e => setForm({ ...form, scheduleEnabled: e.target.checked })} />
                Run on a schedule
            </label>
            <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">Frequency</span>
                <select className={field} value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as LocationRetentionSettingsDto['frequency'] })}>
                    <option value="Weekly">Weekly</option>
                    <option value="Daily">Daily</option>
                </select>
            </label>
            {form.frequency === 'Weekly' && (
                <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Day</span>
                    <select className={field} value={form.runDayOfWeek} onChange={e => setForm({ ...form, runDayOfWeek: e.target.value })}>
                        {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </label>
            )}
            <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">Time (server time)</span>
                <input type="time" className={field} value={form.runAtTime} onChange={e => setForm({ ...form, runAtTime: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">Grace period (days)</span>
                <input type="number" min={0} max={365} className={field} value={form.gracePeriodDays}
                    onChange={e => setForm({ ...form, gracePeriodDays: Number(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">List kept Locations again after (months)</span>
                <input type="number" min={1} max={120} className={field} value={form.keptRecheckMonths}
                    onChange={e => setForm({ ...form, keptRecheckMonths: Number(e.target.value) })} />
            </label>
            <div className="sm:col-span-3 flex items-center gap-3">
                <button type="button" className="btn-primary text-sm" onClick={() => void save()} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save schedule
                </button>
                {error && <span className="text-red-600">{error}</span>}
                {initial.updatedAt && (
                    <span className="text-xs text-gray-500">Last changed {formatWhen(initial.updatedAt)}{initial.updatedByUsername ? ` by ${initial.updatedByUsername}` : ''}</span>
                )}
            </div>
        </div>
    );
};

export default LocationRetentionPage;
