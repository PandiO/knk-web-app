import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { dataDeletionClient } from '../../apiClients/dataDeletionClient';
import { PrivacyDeletionRequestDto } from '../../types/dtos/privacy/PrivacyDtos';

/**
 * Target of the emailed confirmation link (KNG-34 GDPR deletion, developer decisions 2026-10-03):
 * /account/delete-data/confirm?token=…. Confirming takes an explicit click (mail scanners that open
 * links must not confirm anything). The deletion then runs five days later unless cancelled on the
 * account page. No sign-in needed: the link proves access to the mailbox.
 */
export const ConfirmDataDeletionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);
  const [confirmed, setConfirmed] = useState<PrivacyDeletionRequestDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      setConfirmed(await dataDeletionClient.confirm(token));
    } catch (err: any) {
      setError(err?.response?.message || err?.message || 'This confirmation link is invalid, already used or expired.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-4 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Delete your Knights &amp; Kings data</h1>

        {!token && (
          <p className="mt-4 text-sm text-red-700" role="alert">
            The confirmation link is incomplete. Open the link from your email again.
          </p>
        )}

        {token && !confirmed && (
          <>
            <p className="mt-4 text-sm text-gray-700">
              Confirm that you want your account data deleted: statistics, settings, discoveries, private-message logs,
              ranks and your username, email and Minecraft link. It is deleted five days after you confirm; until then you
              can cancel it on your account page.
            </p>
            {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button type="button" disabled={busy} onClick={confirm}
                className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                Yes, delete my data
              </button>
              <Link to="/account" className="px-4 py-2 text-sm text-gray-700">Keep my data</Link>
            </div>
          </>
        )}

        {confirmed && (
          <div className="mt-4 text-sm text-gray-700" role="status">
            <p>
              Confirmed. Your data will be deleted on <strong>{confirmed.scheduledAt ? new Date(confirmed.scheduledAt).toLocaleString() : '-'}</strong>.
            </p>
            <p className="mt-2">
              Changed your mind? Cancel it on your <Link to="/account" className="text-primary underline">account page</Link> before then.
            </p>
          </div>
        )}
      </div>
    </main>
  );
};

export default ConfirmDataDeletionPage;
