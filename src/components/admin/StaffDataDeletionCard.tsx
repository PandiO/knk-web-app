import React, { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { dataDeletionClient } from '../../apiClients/dataDeletionClient';
import { usePermission } from '../../hooks/useStaffAccess';
import { DATA_DELETION_REQUEST_NODE, PrivacyDeletionRequestDto } from '../../types/dtos/privacy/PrivacyDtos';

/**
 * Staff: file a GDPR data-deletion request on a player's behalf (KNG-34, developer decisions
 * 2026-10-03) — e.g. when the player asked in-game or on Discord. No email confirmation; the
 * deletion still waits the 5-day grace period, in which the player or staff can cancel it. Only
 * for holders of knk.admin.privacy.request (hidden otherwise, and on a 403).
 */

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '-');

const messageOf = (err: unknown): string => {
  const e = err as { response?: { message?: string } } | undefined;
  if (e?.response?.message) return e.response.message;
  return err instanceof Error ? err.message : 'Request failed';
};

interface Props {
  userId: number;
  username?: string;
  /** Called after filing or cancelling (refreshes Recent Activity). */
  onChanged?: () => void;
}

export const StaffDataDeletionCard: React.FC<Props> = ({ userId, username, onChanged }) => {
  const { allowed } = usePermission(DATA_DELETION_REQUEST_NODE);
  const [request, setRequest] = useState<PrivacyDeletionRequestDto | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRequest(await dataDeletionClient.getForPlayer(userId));
    } catch (err) {
      if ((err as { status?: number })?.status === 403) setForbidden(true);
      else setError(messageOf(err));
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => { if (allowed) void load(); }, [allowed, load]);

  if (!allowed || forbidden) return null;

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      onChanged?.();
    } catch (err) {
      setError(messageOf(err));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const file = () => run(async () => {
    setRequest(await dataDeletionClient.fileForPlayer(userId, note.trim() || undefined));
    setAsking(false);
    setNote('');
  });

  const cancel = () => run(async () => {
    await dataDeletionClient.cancelForPlayer(userId);
    setRequest(null);
  });

  return (
    <section aria-label="Data deletion" className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
        <Trash2 className="h-5 w-5 mr-2" /> Data deletion
      </h2>
      {error && <p className="mb-2 text-sm text-red-700" role="alert">{error}</p>}

      {loaded && request?.status === 'Pending' && (
        <div className="text-sm text-gray-700">
          <p>
            Scheduled for <strong>{when(request.scheduledAt)}</strong>
            {request.source === 'Player' ? ' (requested and confirmed by the player)' : ' (filed by staff)'}.
            {request.note && <span className="ml-1 italic text-gray-600">“{request.note}”</span>}
          </p>
          <button type="button" disabled={busy} onClick={cancel}
            className="mt-2 rounded border border-gray-300 px-3 py-1.5 text-sm">Cancel deletion</button>
        </div>
      )}

      {loaded && request?.status === 'AwaitingConfirmation' && (
        <div className="text-sm text-gray-700">
          <p>The player asked for deletion and hasn't confirmed the email link yet (valid until {when(request.confirmationExpiresAt)}).</p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} onClick={() => setAsking(true)}
              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700">Confirm on their behalf…</button>
            <button type="button" disabled={busy} onClick={cancel}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm">Cancel request</button>
          </div>
        </div>
      )}

      {loaded && !request && !asking && (
        <div className="text-sm text-gray-600">
          <p>No open request. File one when the player asked for their data to be deleted.</p>
          <button type="button" disabled={busy} onClick={() => setAsking(true)}
            className="mt-2 rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700">Request data deletion…</button>
        </div>
      )}

      {asking && request?.status !== 'Pending' && (
        <div role="dialog" aria-label="File data deletion" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p>
            Delete the data of <strong>{username ?? `player #${userId}`}</strong>? No email confirmation is needed: the
            deletion runs in five days unless the player or staff cancel it. The player is emailed if the account has an
            address.
          </p>
          <input aria-label="Note" value={note} onChange={e => setNote(e.target.value)} maxLength={500}
            placeholder="Where the player asked (optional, not shown to the player)"
            className="mt-3 w-full rounded border border-red-200 px-2 py-1 text-sm" />
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={file}
              className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">File deletion request</button>
            <button type="button" onClick={() => setAsking(false)} className="px-3 py-1.5 text-sm text-gray-700">Back</button>
          </div>
        </div>
      )}
    </section>
  );
};

export default StaffDataDeletionCard;
