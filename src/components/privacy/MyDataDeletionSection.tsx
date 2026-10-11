import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { dataDeletionClient } from '../../apiClients/dataDeletionClient';
import { PrivacyDeletionRequestDto } from '../../types/dtos/privacy/PrivacyDtos';

/**
 * "Delete my data" on the account page (KNG-34 GDPR deletion, developer decisions 2026-10-03). The
 * player asks for deletion, confirms it through an emailed link, and can cancel it during the
 * 5-day grace period before it runs. Staff can file the same request for the player; it then shows
 * up here too (and can be cancelled the same way).
 */

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '-');

const messageOf = (err: unknown): string => {
  const e = err as { status?: number; response?: { error?: string; message?: string } } | undefined;
  if (e?.response?.message) return e.response.message;
  return err instanceof Error ? err.message : 'Request failed';
};

interface Props {
  /** Without an email address the request can't be confirmed. */
  hasEmail: boolean;
}

export const MyDataDeletionSection: React.FC<Props> = ({ hasEmail }) => {
  const [request, setRequest] = useState<PrivacyDeletionRequestDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRequest(await dataDeletionClient.getMine());
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
    } catch (err) {
      setError(messageOf(err));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const requestDeletion = () => run(async () => {
    setRequest(await dataDeletionClient.requestMine());
    setAsking(false);
    setNotice('We sent you an email. Open the link in it to confirm.');
  });

  const cancel = () => run(async () => {
    await dataDeletionClient.cancelMine();
    setRequest(null);
    setNotice('Your data deletion request was cancelled.');
  });

  return (
    <section aria-label="Delete my data" className="border-b pb-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center mb-2">
        <Trash2 className="h-5 w-5 mr-2" /> Delete my data
      </h2>
      <p className="text-sm text-gray-600">
        Deletes your statistics, privacy settings, discoveries, private-message logs, ranks and permissions, and your
        username, email and Minecraft link. Your coin, gem and XP history and Siege match results are kept, without your
        name. This can't be undone.
      </p>

      {loading && <Loader2 className="mt-3 h-5 w-5 animate-spin text-gray-400" aria-label="Loading" />}
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      {notice && <p className="mt-3 text-sm text-green-800" role="status">{notice}</p>}

      {!loading && request?.status === 'AwaitingConfirmation' && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            Check your email and open the confirmation link before <strong>{when(request.confirmationExpiresAt)}</strong>.
            Nothing is deleted until you confirm.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={requestDeletion}
              className="rounded border border-amber-300 px-3 py-1.5 text-sm font-medium">Send the link again</button>
            <button type="button" disabled={busy} onClick={cancel}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm">Cancel request</button>
          </div>
        </div>
      )}

      {!loading && request?.status === 'Pending' && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p>
            Your data will be deleted on <strong>{when(request.scheduledAt)}</strong>
            {request.source !== 'Player' && ' (requested by staff on your behalf)'}. You can cancel it until then.
          </p>
          <button type="button" disabled={busy} onClick={cancel}
            className="mt-3 rounded bg-white border border-red-300 px-3 py-1.5 text-sm font-medium text-red-800">
            Cancel deletion
          </button>
        </div>
      )}

      {!loading && !request && !asking && (
        <div className="mt-3">
          {!hasEmail && (
            <p className="mb-2 text-sm text-gray-600">Add an email address above first: the request is confirmed by email.</p>
          )}
          <button type="button" disabled={!hasEmail || busy} onClick={() => setAsking(true)}
            className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-50">
            Delete my data…
          </button>
        </div>
      )}

      {!loading && !request && asking && (
        <div role="dialog" aria-label="Confirm data deletion request" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p>
            We'll email you a link to confirm. After you confirm, your data is deleted five days later unless you cancel
            it here first.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={requestDeletion}
              className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              Email me the confirmation link
            </button>
            <button type="button" onClick={() => setAsking(false)} className="px-3 py-1.5 text-sm text-gray-700">Keep my data</button>
          </div>
        </div>
      )}
    </section>
  );
};

export default MyDataDeletionSection;
