import React, { useCallback, useEffect, useState } from 'react';
import { ShieldOff } from 'lucide-react';
import { privacyClient } from '../../apiClients/privacyClient';
import { OwnerOnlyNotice } from '../../components/OwnerRoute';
import { PrivacyDeletionRequestDto, PrivacyRequestStatus } from '../../types/dtos/privacy/PrivacyDtos';
import { OWNER_PRIVACY_MANAGE_NODE } from '../../types/dtos/telemetry/TelemetryDtos';

/**
 * GDPR deletion requests (KNG-34 D12, DESIGN.md §F.14, link 6). Record a player's request (due in
 * 30 days; executed automatically 3 days before that unless done earlier), preview exactly what an
 * erasure removes (counts only), execute it after typing the player id, or cancel it. Execution is
 * irreversible: statistics, diagnostics and discoveries are deleted and the account pseudonymized;
 * the ledger and Siege match rows stay. Owner only (exact grant).
 */

const STATUS_CLASS: Record<PrivacyRequestStatus, string> = {
  Pending: 'bg-amber-100 text-amber-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-gray-100 text-gray-600',
};

const isForbidden = (err: unknown) => (err as { status?: number })?.status === 403;
const messageOf = (err: unknown) => (err instanceof Error ? err.message : 'Request failed');
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : '-');

export const OwnerPrivacyPage: React.FC = () => {
  const [requests, setRequests] = useState<PrivacyDeletionRequestDto[] | null>(null);
  const [status, setStatus] = useState<PrivacyRequestStatus | ''>('');
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<PrivacyDeletionRequestDto | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    privacyClient.getRequests(status || undefined)
      .then(setRequests)
      .catch(err => { if (isForbidden(err)) setForbidden(true); else setError(messageOf(err)); });
  }, [status]);

  useEffect(load, [load]);

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      load();
    } catch (err) {
      if (isForbidden(err)) setForbidden(true);
      else setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  if (forbidden) return <OwnerOnlyNotice node={OWNER_PRIVACY_MANAGE_NODE} />;

  const create = () => run(async () => {
    await privacyClient.createRequest(Number(userId), note.trim() || undefined);
    setUserId('');
    setNote('');
  });

  const showPreview = (id: number) => run(async () => {
    setConfirmText('');
    setPreview(await privacyClient.execute(id, true));
  });

  const execute = () => preview && run(async () => {
    await privacyClient.execute(preview.id, false);
    setPreview(null);
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
        <ShieldOff className="h-6 w-6" /> Data deletion requests
      </h1>

      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900">Record a request</h2>
        <p className="text-xs text-gray-500">
          GDPR: delete within one month. The request is due in 30 days and runs automatically 3 days before that.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input aria-label="Player id" type="number" value={userId} onChange={e => setUserId(e.target.value)} placeholder="Player id"
            className="w-32 rounded border border-gray-300 px-2 py-1 text-sm" />
          <input aria-label="Note" value={note} onChange={e => setNote(e.target.value)} maxLength={500}
            placeholder="Where the request came from (optional)" className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
          <button type="button" disabled={busy || !userId} onClick={create}
            className="rounded bg-primary px-3 py-1 text-sm font-medium text-white disabled:opacity-50">Record request</button>
        </div>
      </section>

      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

      <section aria-label="Requests" className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Requests</h2>
          <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value as PrivacyRequestStatus | '')}
            className="rounded border border-gray-300 px-2 py-1 text-sm">
            <option value="">All</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        {requests && requests.length === 0 && <p className="px-4 py-3 text-sm text-gray-500">No requests.</p>}
        <ul className="divide-y divide-gray-100">
          {(requests ?? []).map(r => (
            <li key={r.id} className="px-4 py-3 text-sm flex flex-wrap items-center gap-3">
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>{r.status}</span>
              <span className="font-medium">{r.username ?? 'unknown'} (#{r.userId})</span>
              <span className="text-xs text-gray-500">
                requested {day(r.requestedAt)} · due {day(r.dueAt)}
                {r.autoExecuteAt && ` · runs automatically ${day(r.autoExecuteAt)}`}
                {r.executedAt && ` · executed ${day(r.executedAt)}${r.executedByUserId ? '' : ' (automatically)'}`}
              </span>
              {r.note && <span className="text-xs text-gray-600 italic">{r.note}</span>}
              {r.status === 'Pending' && (
                <span className="ml-auto flex gap-2">
                  <button type="button" disabled={busy} onClick={() => showPreview(r.id)}
                    className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700">Review &amp; delete</button>
                  <button type="button" disabled={busy} onClick={() => run(() => privacyClient.cancel(r.id))}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700">Cancel request</button>
                </span>
              )}
              {r.status === 'Completed' && r.result && (
                <span className="ml-auto text-xs text-gray-600">
                  {Object.values(r.result.deleted).reduce((a, b) => a + b, 0)} rows deleted, {r.result.pseudonymizedUsers} account(s) pseudonymized
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {preview?.result && (
        <section role="dialog" aria-label="Deletion preview" className="bg-red-50 rounded-lg border border-red-200 p-4">
          <h2 className="font-semibold text-red-900">Delete the data of {preview.username} (#{preview.userId})?</h2>
          <p className="mt-1 text-sm text-red-800">
            This can't be undone. Accounts covered: {preview.result.userIds.join(', ')} (including merged accounts). The
            account{preview.result.userIds.length > 1 ? 's are' : ' is'} pseudonymized; ledger and Siege match rows stay.
          </p>
          <table className="mt-3 text-sm">
            <tbody>
              {Object.entries(preview.result.deleted).map(([table, count]) => (
                <tr key={table}><td className="pr-6 font-mono text-gray-700">{table}</td><td className="text-right">{count}</td></tr>
              ))}
            </tbody>
          </table>
          <label className="mt-3 block text-sm text-red-900">
            Type the player id <strong>{preview.userId}</strong> to confirm
            <input aria-label="Confirm player id" value={confirmText} onChange={e => setConfirmText(e.target.value)}
              className="ml-2 w-24 rounded border border-red-300 px-2 py-1 text-sm" />
          </label>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy || confirmText.trim() !== String(preview.userId)} onClick={execute}
              className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Delete now</button>
            <button type="button" onClick={() => setPreview(null)} className="px-3 py-1.5 text-sm text-gray-700">Close</button>
          </div>
        </section>
      )}
    </div>
  );
};

export default OwnerPrivacyPage;
