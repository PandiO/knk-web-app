import React from 'react';
import { Loader2, Radar, XCircle } from 'lucide-react';
import { minecraftCatalogClient } from '../../../apiClients/minecraftCatalogClient';
import {
  MinecraftCatalogScanDto,
  isActiveScanStatus,
} from '../../../types/dtos/minecraftCatalog/MinecraftCatalogDtos';
import { apiRefusalReason } from '../../../utils/apiRefusalReason';
import { formatDateTime, scanStatusClass } from './minecraftCatalogFormat';

// KNG-200 §5.2a: "Scan server" creates a scan and a WorldTask; knk-plugin picks the task up, reads
// the registry and sends the snapshot, and the API ingests it. The page polls the scan while it is
// Requested/Running/Ingesting and stops on Completed/Failed or when it is left.

/** How often an active scan is polled. */
export const SCAN_POLL_INTERVAL_MS = 3000;
/** Scans listed in the history table. */
export const SCAN_HISTORY_SIZE = 10;

const COUNTERS: { key: keyof MinecraftCatalogScanDto; label: string; hint: string }[] = [
  { key: 'entryCount', label: 'Entries', hint: 'Registry entries the server sent' },
  { key: 'inserted', label: 'Inserted', hint: 'New materials' },
  { key: 'updated', label: 'Updated', hint: 'Existing materials whose facts changed' },
  { key: 'unchanged', label: 'Unchanged', hint: 'Existing materials that were already up to date' },
  { key: 'merged', label: 'Merged', hint: 'Notation duplicates merged into the scanned row' },
  { key: 'deleted', label: 'Deleted', hint: 'Unreferenced materials the server no longer has' },
  { key: 'markedMissing', label: 'Missing', hint: 'Referenced materials the server no longer has (merge them below)' },
  { key: 'iconsMissing', label: 'No icon', hint: 'Materials without an icon (set an override below)' },
];

export const MinecraftCatalogScanCard: React.FC<{
  /** Called when a scan reaches Completed or Failed while the page watches it (the audit changed). */
  onScanFinished?: (scan: MinecraftCatalogScanDto) => void;
}> = ({ onScanFinished }) => {
  const [scans, setScans] = React.useState<MinecraftCatalogScanDto[]>([]);
  const [current, setCurrent] = React.useState<MinecraftCatalogScanDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [requesting, setRequesting] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const onScanFinishedRef = React.useRef(onScanFinished);
  onScanFinishedRef.current = onScanFinished;

  // Keeps the history row of a scan in step with the latest read of it.
  const applyScan = React.useCallback((scan: MinecraftCatalogScanDto) => {
    setCurrent(scan);
    setScans((previous) => {
      const rest = previous.filter((s) => s.id !== scan.id);
      return [scan, ...rest].sort((a, b) => b.id - a.id).slice(0, SCAN_HISTORY_SIZE);
    });
  }, []);

  const loadScans = React.useCallback(async () => {
    setLoadError(null);
    try {
      const result = (await minecraftCatalogClient.getScans(SCAN_HISTORY_SIZE)) ?? [];
      setScans(result);
      setCurrent(result[0] ?? null);
    } catch (err) {
      console.error('Failed to load the catalogue scans:', err);
      setLoadError(apiRefusalReason(err) ?? 'Could not load the scans.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadScans();
  }, [loadScans]);

  const currentId = current?.id ?? null;
  const currentActive = isActiveScanStatus(current?.status);

  // Poll the active scan; one request at a time, stopped on a final status or on unmount.
  React.useEffect(() => {
    if (currentId === null || !currentActive) return undefined;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const scan = await minecraftCatalogClient.getScan(currentId);
        if (stopped) return;
        applyScan(scan);
        if (!isActiveScanStatus(scan.status)) {
          onScanFinishedRef.current?.(scan);
          return;
        }
      } catch (err) {
        // A failed read is retried on the next tick; the scan itself is unaffected.
        console.error('Failed to read the catalogue scan:', err);
        if (stopped) return;
      }
      timer = setTimeout(() => void poll(), SCAN_POLL_INTERVAL_MS);
    };
    timer = setTimeout(() => void poll(), SCAN_POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [currentId, currentActive, applyScan]);

  const requestScan = async () => {
    setRequesting(true);
    setNotice(null);
    setActionError(null);
    try {
      applyScan(await minecraftCatalogClient.requestScan());
    } catch (err) {
      const status = (err as { status?: number } | null)?.status;
      if (status === 409) {
        // Another scan is still active: show the API's reason and pick that scan up.
        setNotice(apiRefusalReason(err) ?? 'A scan is already running.');
        await loadScans();
      } else {
        console.error('Failed to request a catalogue scan:', err);
        setActionError(apiRefusalReason(err) ?? 'Could not start a scan.');
      }
    } finally {
      setRequesting(false);
    }
  };

  const cancelScan = async () => {
    if (!current) return;
    setCancelling(true);
    setNotice(null);
    setActionError(null);
    try {
      applyScan(await minecraftCatalogClient.cancelScan(current.id));
    } catch (err) {
      console.error('Failed to cancel the catalogue scan:', err);
      setActionError(apiRefusalReason(err) ?? 'Could not cancel the scan.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-4" aria-labelledby="catalog-scan-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="catalog-scan-heading" className="text-lg font-semibold flex items-center">
            <Radar className="h-5 w-5 mr-2" aria-hidden="true" />
            Server scan
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            The Minecraft server must be running with knk-plugin, which picks the scan up within about a minute.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {current && currentActive && (
            <button type="button" className="btn-secondary" onClick={() => void cancelScan()} disabled={cancelling}>
              <XCircle className="h-4 w-4 mr-2 inline" aria-hidden="true" />
              {cancelling ? 'Cancelling…' : 'Cancel scan'}
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => void requestScan()}
            disabled={requesting || loading || currentActive}
          >
            {requesting ? 'Requesting…' : 'Scan server'}
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>
      )}
      {actionError && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{actionError}</p>
      )}
      {loadError && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{loadError}</p>
      )}

      {loading ? (
        <div className="flex items-center text-sm text-gray-500"><Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />Loading scans…</div>
      ) : current === null ? (
        <p className="text-sm text-gray-500">No scan yet. Until the first scan the catalogue only holds rows that forms and seeds created.</p>
      ) : (
        <CurrentScan scan={current} />
      )}

      {scans.length > 0 && (
        <div className="overflow-x-auto">
          <h3 className="text-sm font-semibold mb-2">Recent scans</h3>
          <table className="min-w-full text-sm" aria-label="Recent scans">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Requested</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Version</th>
                <th className="py-2 pr-3 font-medium text-right">Entries</th>
                <th className="py-2 pr-3 font-medium text-right">Ins / Upd / Del</th>
                <th className="py-2 pr-3 font-medium text-right">Missing</th>
                <th className="py-2 font-medium">Finished</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-3 text-gray-500">{scan.id}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{formatDateTime(scan.createdAt)}</td>
                  <td className="py-1.5 pr-3"><StatusBadge status={scan.status} /></td>
                  <td className="py-1.5 pr-3">{scan.minecraftVersion ?? '—'}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{scan.entryCount ?? '—'}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{scan.inserted} / {scan.updated} / {scan.deleted}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{scan.markedMissing}</td>
                  <td className="py-1.5 whitespace-nowrap">{formatDateTime(scan.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${scanStatusClass(status)}`}>
    {isActiveScanStatus(status) && <Loader2 className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />}
    {status}
  </span>
);

const CurrentScan: React.FC<{ scan: MinecraftCatalogScanDto }> = ({ scan }) => (
  <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3" aria-label="Latest scan" role="group">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="font-medium text-gray-900">Scan #{scan.id}</span>
      <span data-testid="current-scan-status"><StatusBadge status={scan.status} /></span>
      <span className="text-gray-500">requested {formatDateTime(scan.createdAt)}</span>
      {scan.completedAt && <span className="text-gray-500">finished {formatDateTime(scan.completedAt)}</span>}
      {scan.minecraftVersion && (
        <span className="text-gray-500" title={scan.serverVersion ?? undefined}>Minecraft {scan.minecraftVersion}</span>
      )}
    </div>
    {scan.status === 'Requested' && (
      <p className="text-sm text-gray-600">Waiting for knk-plugin to pick the scan up…</p>
    )}
    {scan.error && (
      <p role="alert" className="text-sm text-red-700">{scan.error}</p>
    )}
    <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {COUNTERS.map(({ key, label, hint }) => (
        <div key={key} className="rounded border border-gray-200 bg-white px-3 py-2" title={hint}>
          <dt className="text-xs text-gray-500">{label}</dt>
          <dd className="text-lg font-semibold tabular-nums text-gray-900">{scan[key] ?? '—'}</dd>
        </div>
      ))}
    </dl>
  </div>
);
