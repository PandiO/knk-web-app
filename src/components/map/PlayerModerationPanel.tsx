import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Gavel, Loader2 } from 'lucide-react';
import { userManagementClient } from '../../apiClients/userManagementClient';
import { useConfirm } from '../../hooks/useConfirm';
import { anyNodeStatus, STAFF_PERMISSION_NODE, usePermissions } from '../../hooks/useStaffAccess';
import { BAN_NODE, KICK_NODE, usePlayerKickBan } from '../../pages/admin/playerProfile/usePlayerKickBan';
import { FREEZE_NODE, UNFREEZE_NODE, usePlayerFreeze } from '../../pages/admin/playerProfile/usePlayerFreeze';
import type { MapPlayerDto } from '../../types/dtos/map/MapDtos';
import type { ProfileAccountDto, UserByUuidDto } from '../../types/dtos/userManagement/UserProfileSummaryDtos';
import { apiRefusalReason } from '../../utils/apiRefusalReason';

/**
 * The nodes that open the player context panel (OVERVIEW_MAP_DESIGN § 4.4, § 5 rule 12, O11, O25): holding **any** of
 * them is enough; each action then shows only under its own node. `knk.admin.user.manage` alone gives the panel with
 * "Open profile" (the profile page's own node).
 */
export const MODERATION_NODES: readonly string[] = [FREEZE_NODE, UNFREEZE_NODE, KICK_NODE, BAN_NODE, STAFF_PERMISSION_NODE];

/** The profile page of a user (`playerProfile` in routeTable, `PlayerProfilePage`). */
export const playerProfilePath = (userId: number) => `/admin/users/${userId}`;

/**
 * The player context panel under the name card of a clicked player (PandiO/knk-workspace#743; § 4.4, § 5 rule 12,
 * O11, O25; A20, A21). Shown only to a logged-in viewer holding a moderation node: anonymous viewers make no request,
 * a viewer without any of the nodes gets only the name card and no further request after the node checks (shared,
 * once per node and page load). Once allowed, the player's account is read by Minecraft UUID
 * (`GET api/Users/uuid/{uuid}`) for the user id the moderation endpoints take, and the profile page's own hooks
 * (`usePlayerFreeze`, `usePlayerKickBan`) do the rest: the same dialogs, endpoints and toasts. Actions the viewer may
 * not take are hidden, not disabled (the map's rule for staff actions, § 5 rule 13); the API still decides. The one
 * exception is "Open profile" (#809, developer decision 2026-11-19): without the profile page's node it stays visible
 * but disabled, with a tooltip that says why, so a kick-only moderator is not sent to a no-access page.
 */
export const PlayerModerationPanel: React.FC<{ player: MapPlayerDto }> = ({ player }) => {
  const statuses = usePermissions(MODERATION_NODES);
  if (anyNodeStatus(statuses, MODERATION_NODES) !== 'allowed') return null;
  return (
    <ModerationSection
      uuid={player.uuid}
      name={player.label.name}
      canOpenProfile={statuses[STAFF_PERMISSION_NODE] === 'allowed'}
    />
  );
};

/** Why "Open profile" is disabled (#809): the profile page needs its own node. */
export const PROFILE_DENIED_TOOLTIP = `You need access to player profiles (${STAFF_PERMISSION_NODE}) to open this.`;

/**
 * "Open profile" for a viewer without the profile page's node (#809): a disabled control (not a link) with
 * `aria-disabled`, described by a tooltip that shows on hover, keyboard focus and tap. Escape hides the tooltip first
 * (WCAG 1.4.13); a second Escape closes the panel as usual.
 */
const DisabledProfileControl: React.FC = () => {
  const [shown, setShown] = React.useState(false);
  const tooltipId = React.useId();
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShown(true)} onMouseLeave={() => setShown(false)}>
      <button
        type="button"
        aria-disabled="true"
        aria-describedby={tooltipId}
        className="inline-flex cursor-not-allowed items-center rounded-sm text-sm font-medium text-muted focus:outline-none focus:ring-2 focus:ring-focus"
        onClick={() => setShown(true)} // a tap focuses and clicks: keep it shown; a tap elsewhere blurs and hides it
        onFocus={() => setShown(true)}
        onBlur={() => setShown(false)}
        onKeyDown={event => {
          if (event.key === 'Escape' && shown) {
            event.stopPropagation(); // keep the page's Escape listener from also closing the panel
            setShown(false);
          }
        }}
      >
        Open profile
        <ExternalLink className="ml-1 h-4 w-4" aria-hidden="true" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        hidden={!shown}
        className="absolute bottom-full left-0 z-10 mb-2 w-64 rounded-md bg-fg px-3 py-2 text-xs text-canvas shadow"
      >
        {PROFILE_DENIED_TOOLTIP}
      </span>
    </span>
  );
};

type Lookup =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; user: UserByUuidDto };

const ModerationSection: React.FC<{ uuid: string; name: string; canOpenProfile: boolean }> = ({ uuid, name, canOpenProfile }) => {
  const [lookup, setLookup] = React.useState<Lookup>({ status: 'loading' });
  const alive = React.useRef(true);
  React.useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = React.useCallback(async () => {
    try {
      const user = await userManagementClient.getByUuid(uuid);
      if (alive.current) setLookup({ status: 'ready', user });
    } catch (err) {
      if (!alive.current) return;
      setLookup((err as { status?: number } | null)?.status === 404
        ? { status: 'missing' }
        : { status: 'error', message: apiRefusalReason(err) ?? 'The player’s account could not be read.' });
    }
  }, [uuid]);

  React.useEffect(() => { void load(); }, [load]);

  return (
    <section aria-labelledby="map-moderation-heading" className="space-y-3 border-t border-line pt-4">
      <h3 id="map-moderation-heading" className="flex items-center text-sm font-semibold text-fg">
        <Gavel className="mr-2 h-4 w-4" aria-hidden="true" />
        Moderation
      </h3>
      {lookup.status === 'loading' && (
        <p className="flex items-center text-sm text-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          Loading…
        </p>
      )}
      {lookup.status === 'missing' && (
        <p className="text-sm text-muted">{name} has no account in the web app yet, so there is nothing to moderate here.</p>
      )}
      {lookup.status === 'error' && <p role="alert" className="field-error text-sm">{lookup.message}</p>}
      {lookup.status === 'ready' && <ModerationActions user={lookup.user} reload={load} canOpenProfile={canOpenProfile} />}
    </section>
  );
};

const ModerationActions: React.FC<{ user: UserByUuidDto; reload: () => Promise<void>; canOpenProfile: boolean }> = ({
  user, reload, canOpenProfile,
}) => {
  const [confirm, confirmModal, confirmWithReason] = useConfirm();
  // The freeze hook reads the frozen state from a profile account; the by-UUID summary carries the same two fields.
  const account = React.useMemo(
    () => ({ id: user.id, username: user.username, isFrozen: user.isFrozen === true, frozenReason: user.frozenReason ?? null }) as ProfileAccountDto,
    [user],
  );
  const noop = React.useCallback(() => undefined, []);
  const freeze = usePlayerFreeze({
    userId: user.id, username: user.username, account, reloadSummary: reload, confirm, confirmWithReason, onChanged: noop,
  });
  const kickBan = usePlayerKickBan({ userId: user.id, username: user.username, confirmWithReason, onChanged: noop });

  const frozen = freeze.state?.isFrozen === true;
  const freezeGate = frozen ? freeze.unfreezeGate : freeze.freezeGate;
  const seesFreeze = freeze.freezeGate.allowed || freeze.unfreezeGate.allowed;
  const busy = freeze.busy || kickBan.busy !== null;

  return (
    <div className="space-y-3">
      {seesFreeze && frozen && (
        <p className="text-sm text-fg">
          <span className="font-medium">Frozen.</span>{' '}
          <span className="text-muted">Reason: {freeze.state?.frozenReason?.trim() || 'none recorded'}</span>
        </p>
      )}
      <div role="group" aria-label="Moderation actions" className="flex flex-wrap gap-2">
        {freezeGate.allowed && (
          <button
            type="button"
            className={frozen ? 'btn-secondary text-sm' : 'btn-danger text-sm'}
            disabled={busy}
            onClick={() => void (frozen ? freeze.unfreeze() : freeze.freeze())}
          >
            {freeze.busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {frozen ? 'Unfreeze' : 'Freeze…'}
          </button>
        )}
        {kickBan.kickGate.allowed && (
          <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => void kickBan.kick()}>
            {kickBan.busy === 'kick' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Kick…
          </button>
        )}
        {kickBan.banGate.allowed && (
          <button type="button" className="btn-danger text-sm" disabled={busy} onClick={() => void kickBan.ban()}>
            {kickBan.busy === 'ban' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Ban…
          </button>
        )}
      </div>
      {canOpenProfile ? (
        <Link
          to={playerProfilePath(user.id)}
          className="inline-flex items-center text-sm font-medium text-primary hover:underline"
        >
          Open profile
          <ExternalLink className="ml-1 h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <DisabledProfileControl />
      )}
      {confirmModal}
    </div>
  );
};
