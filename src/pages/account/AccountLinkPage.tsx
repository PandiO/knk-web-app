import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useNoReferrer } from '../../hooks/useNoReferrer';
import { appConfig } from '../../config/appConfig';
import { authService } from '../../services/authService';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { LINK_CODE_LENGTH, normalizeLinkCode } from '../../utils/linkCode';
import { clearPendingClaim, loadPendingClaim } from '../../utils/claimCode';

/**
 * /account/link (KNG-214, DESIGN.md § 5.3): where a new account lands after sign-up. It explains the
 * join → code → enter step and links with either code: the claim code from the disconnect screen or an
 * /account link code from chat (the API tells them apart). After a fold into an existing Minecraft
 * account (case B) the API answers with a session for that account; authService stores it before the
 * user is reloaded.
 */
export const AccountLinkPage: React.FC = () => {
  usePageTitle('Link your Minecraft account');
  useNoReferrer();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const pending = loadPendingClaim();
  const [code, setCode] = useState(() => (pending ? pending.code : ''));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const linked = !!user && (user.minecraftLinked ?? !!user.uuid);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeLinkCode(code);
    if (normalized.length !== LINK_CODE_LENGTH) {
      setError(`Enter the ${LINK_CODE_LENGTH}-character code from the server.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await authService.linkMinecraftAccount({ linkCode: normalized });
      clearPendingClaim();
      await refresh();
      navigate('/account', { replace: true });
    } catch (err) {
      setError(apiRefusalReason(err) ?? 'Linking failed. Check the code, or join the server again for a new one.');
    } finally {
      setBusy(false);
    }
  };

  if (linked) {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6 sm:p-8 text-center space-y-4">
        <CheckCircle2 className="h-10 w-10 mx-auto text-green-600" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900">Your Minecraft account is linked</h1>
        <p className="text-gray-700">
          You play as <strong>{user!.username}</strong>. Join <code className="font-mono">{appConfig.minecraft.serverAddress}</code> to start.
        </p>
        <Link to="/account" className="inline-block btn-primary">Go to my account</Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <LinkIcon className="h-6 w-6" aria-hidden="true" />
          Link your Minecraft account
        </h1>
        <p className="mt-2 text-sm text-gray-600">One more step before you can play.</p>
      </div>

      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-800">
        <li>
          Join <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-xs">{appConfig.minecraft.serverAddress}</code> with Minecraft Java Edition 26.3.
        </li>
        <li>You'll be stopped with a code on the screen, like <span className="font-mono">K7QH-M2XA</span> (valid 15 minutes).</li>
        <li>Enter that code here. Never give it to anyone; staff never ask for it.</li>
      </ol>
      <p className="text-xs text-gray-500">
        Played here before? Type <code className="font-mono">/account link</code> in chat and enter that code instead.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      <form noValidate onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="account-link-code" className="block text-sm font-medium text-gray-700 mb-1">Code from the server</label>
          <input
            id="account-link-code"
            type="text"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            onChange={e => setCode(normalizeLinkCode(e.target.value))}
            placeholder="K7QHM2XA"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button type="submit" disabled={busy} className="w-full btn-primary disabled:opacity-50">
          {busy ? 'Linking…' : 'Link account'}
        </button>
      </form>
    </div>
  );
};

export default AccountLinkPage;
