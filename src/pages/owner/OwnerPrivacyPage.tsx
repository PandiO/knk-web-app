import React, { useCallback, useEffect, useState } from 'react';
import { ShieldOff } from 'lucide-react';
import { privacyClient } from '../../apiClients/privacyClient';
import { OwnerOnlyNotice } from '../../components/OwnerRoute';
import { PrivacyDeletionRequestDto, PrivacyRequestStatus } from '../../types/dtos/privacy/PrivacyDtos';
import { OWNER_PRIVACY_MANAGE_NODE } from '../../types/dtos/telemetry/TelemetryDtos';

/**
 * GDPR deletion requests (KNG-34 D12, DESIGN.md §F.14, link 6 + developer decisions 2026-10-03).
 * Players request on their account page and confirm by email; staff file for players on the player
 * profile; here the owner sees every request, can file one too, preview exactly what an erasure
 * removes (counts only) and cancel. A confirmed request runs automatically five days later; "Delete
 * now" is only possible once that grace period is over (when automatic execution is switched off).
 * Execution is irreversible: the player's data is deleted and the account pseudonymized; the
 * ledger and Siege match rows stay. Owner only (exact grant).
 */

const STATUS_CLASS: Record<PrivacyRequestStatus, string> = {
  AwaitingConfirmation: 'bg-blue-100 text-blue-800',
  Pending: 'bg-amber-100 text-amber-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-gray-100 text-gray-600',
  Expired: 'bg-gray-100 text-gray-600',
};

const STATUS_LABEL: Record<PrivacyRequestStatus, string> = {
  AwaitingConfirmation: 'Awaiting email confirmation',
  Pending: 'Scheduled',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  Expired: 'Link expired',
};

const isForbidden = (err: unknown) => (err as { status?: number })?.status === 403;
const messageOf = (err: unknown) => (err instanceof Error ? err.message : 'Request failed');
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : '-');
const isOpen = (r: PrivacyDeletionRequestDto) => r.status === 'Pending' || r.status === 'AwaitingConfirmation';
const graceOver = (r: PrivacyDeletionRequestDto) => r.status === 'Pending' && !!r.scheduledAt && new Date(r.scheduledAt) <= new Date();

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
        <h2 className="font-semibold text-gray-900">File a request for a player</h2>
        <p className="text-xs text-gray-500">
          No email confirmation. It runs automatically in five days unless the player or staff cancel it (GDPR deadline:
          one month). Players can also request on their account page; staff on the player profile.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input aria-label="Player id" type="number" value={userId} onChange={e => setUserId(e.target.value)} placeholder="Player id"
            className="w-32 rounded border border-gray-300 px-2 py-1 text-sm" />
          <input aria-label="Note" value={note} onChange={e => setNote(e.target.value)} maxLength={500}
            placeholder="Where the request came from (optional)" className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
          <button type="button" disabled={busy || !userId} onClick={create}
            className="rounded bg-primary px-3 py-1 text-sm font-medium text-white disabled:opacity-50">File request</button>
        </div>
      </section>

      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

      <section aria-label="Requests" className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Requests</h2>
          <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value as PrivacyRequestStatus | '')}
            className="rounded border border-gray-300 px-2 py-1 text-sm">
            <option value="">All</option>
            <option value="AwaitingConfirmation">Awaiting email confirmation</option>
            <option value="Pending">Scheduled</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Expired">Link expired</option>
          </select>
        </div>
        {requests && requests.length === 0 && <p className="px-4 py-3 text-sm text-gray-500">No requests.</p>}
        <ul className="divide-y divide-gray-100">
          {(requests ?? []).map(r => (
            <li key={r.id} className="px-4 py-3 text-sm flex flex-wrap items-center gap-3">
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              <span className="font-medium">{r.username ?? 'unknown'} (#{r.userId})</span>
              <span className="text-xs text-gray-500">
                by {r.source.toLowerCase()} · requested {day(r.requestedAt)}
                {r.status === 'Pending' && r.scheduledAt && ` · runs ${r.autoExecute ? 'automatically ' : ''}${new Date(r.scheduledAt).toLocaleString()}`}
                {r.status === 'Pending' && ` · deadline ${day(r.dueAt)}`}
                {r.status === 'AwaitingConfirmation' && r.confirmationExpiresAt && ` · link valid until ${new Date(r.confirmationExpiresAt).toLocaleString()}`}
                {r.cancelledAt && ` · cancelled ${day(r.cancelledAt)}${r.cancelledByUserId === r.userId ? ' by the player' : ''}`}
                {r.executedAt && ` · executed ${day(r.executedAt)}${r.executedByUserId ? '' : ' (automatically)'}`}
              </span>
              {r.note && <span className="text-xs text-gray-600 italic">{r.note}</span>}
              {isOpen(r) && (
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
          {!graceOver(preview) && (
            <p className="mt-2 text-sm text-red-800">
              {preview.status === 'Pending'
                ? `Grace period: the player can cancel until ${preview.scheduledAt ? new Date(preview.scheduledAt).toLocaleString() : '-'}; it can't be executed before then.`
                : 'The player has not confirmed the request by email yet; it can\'t be executed.'}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy || !graceOver(preview) || confirmText.trim() !== String(preview.userId)} onClick={execute}
              className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Delete now</button>
            <button type="button" onClick={() => setPreview(null)} className="px-3 py-1.5 text-sm text-gray-700">Close</button>
          </div>
        </section>
      )}
    </div>
  );
};

export default OwnerPrivacyPage;
