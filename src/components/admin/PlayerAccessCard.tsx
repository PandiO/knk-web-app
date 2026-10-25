import React from 'react';
import { DoorOpen, Unlink } from 'lucide-react';
import { userManagementClient } from '../../apiClients/userManagementClient';
import { usePermission } from '../../hooks/useStaffAccess';
import { ProfileAccountDto } from '../../types/dtos/userManagement/UserProfileSummaryDtos';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { FeedbackModal } from '../FeedbackModal';

export const USER_MANAGE_NODE = 'knk.admin.user.manage';

type Action = 'admit' | 'detach';

const CONFIRM: Record<Action, { title: string; message: string; label: string; danger: boolean }> = {
  admit: {
    title: 'Admit this player?',
    message: 'They can join the server without an invitation from now on. This is recorded in the audit log.',
    label: 'Admit',
    danger: false,
  },
  detach: {
    title: 'Detach the web login?',
    message:
      'The email and password are removed from this account and every session ends. The Minecraft account and its data stay; ' +
      'the owner can register again with /account link in game. Use this when a code was given away.',
    label: 'Detach web login',
    danger: true,
  },
};

interface PlayerAccessCardProps {
  account: ProfileAccountDto;
  /** Re-fetch the profile after a change. */
  onChanged: () => Promise<void> | void;
}

/**
 * Admission and web login on the player profile (KNG-214, DESIGN.md § 5.3 / § 5.5): staff "Admit"
 * for an account the gate stops (no invitation, a reactivated account) and "Detach web login" for a
 * Minecraft account whose web login isn't the owner's. Needs knk.admin.user.manage, which the API checks.
 */
export const PlayerAccessCard: React.FC<PlayerAccessCardProps> = ({ account, onChanged }) => {
  const { allowed } = usePermission(USER_MANAGE_NODE);
  const [pending, setPending] = React.useState<Action | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!allowed) return null;

  const run = async (action: Action) => {
    setPending(null);
    setBusy(true);
    setError(null);
    try {
      if (action === 'admit') {
        await userManagementClient.admit(account.id);
      } else {
        await userManagementClient.detachWebLogin(account.id);
      }
      await onChanged();
    } catch (err) {
      setError(apiRefusalReason(err) ?? (action === 'admit' ? 'Could not admit this player.' : 'Could not detach the web login.'));
    } finally {
      setBusy(false);
    }
  };

  const hasWebLogin = !!account.email;
  const canDetach = !!account.uuid && hasWebLogin;

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200" data-testid="player-access-card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Access</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-gray-500">Admission</dt>
          <dd className="font-semibold text-gray-900">
            {account.admitted === undefined ? '-' : account.admitted ? 'Admitted' : 'Not admitted'}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Minecraft</dt>
          <dd className="font-semibold text-gray-900">{account.uuid ? 'Linked' : 'Not linked'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Web login</dt>
          <dd className="font-semibold text-gray-900">{hasWebLogin ? account.email : 'None'}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {account.admitted === false && (
          <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => setPending('admit')}>
            <DoorOpen className="h-4 w-4 mr-2" aria-hidden="true" />
            Admit
          </button>
        )}
        {canDetach && (
          <button type="button" className="btn-secondary text-sm text-red-700" disabled={busy} onClick={() => setPending('detach')}>
            <Unlink className="h-4 w-4 mr-2" aria-hidden="true" />
            Detach web login
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}

      <FeedbackModal
        open={pending !== null}
        status={pending && CONFIRM[pending].danger ? 'error' : 'info'}
        title={pending ? CONFIRM[pending].title : ''}
        message={pending ? CONFIRM[pending].message : ''}
        continueLabel={pending ? CONFIRM[pending].label : undefined}
        danger={pending ? CONFIRM[pending].danger : false}
        cancelLabel="Cancel"
        onContinue={() => { if (pending) void run(pending); }}
        onClose={() => setPending(null)}
      />
    </div>
  );
};

export default PlayerAccessCard;
