import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userManagementClient } from '../apiClients/userManagementClient';

/**
 * The permission that makes someone staff for the web moderation pages - the same node that
 * opens the in-game Player manager (knk-web-api StaffPermissions.ManageUsers), so it is also
 * matched by knk.admin.* and *. The API enforces it too; this only decides what to show.
 */
export const STAFF_PERMISSION_NODE = 'knk.admin.user.manage';

// One check per logged-in user and node per page load, shared by every component asking (nav
// bar, route guard, panels). A failed check isn't cached, so the next render retries. A rank
// change applies after a reload.
const permissionChecks = new Map<string, Promise<boolean>>();

function checkPermission(userId: number, node: string): Promise<boolean> {
  const key = `${userId}:${node}`;
  let check = permissionChecks.get(key);
  if (!check) {
    check = userManagementClient
      .checkPermission(userId, node)
      .then(result => result?.allowed === true)
      .catch(err => {
        permissionChecks.delete(key);
        throw err;
      });
    permissionChecks.set(key, check);
  }
  return check;
}

/**
 * Whether the logged-in user holds `node` in the in-house permission system (wildcards
 * included); `isChecking` while that is being resolved. Only decides what the UI shows - the
 * API enforces the node on its own.
 */
export function usePermission(node: string): { allowed: boolean; isChecking: boolean } {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<{ key?: string; allowed: boolean; isChecking: boolean }>({
    allowed: false,
    isChecking: userId !== undefined,
  });
  const key = userId === undefined ? undefined : `${userId}:${node}`;

  useEffect(() => {
    if (userId === undefined) {
      setState({ allowed: false, isChecking: false });
      return;
    }
    const checkKey = `${userId}:${node}`;
    let cancelled = false;
    setState({ key: checkKey, allowed: false, isChecking: true });
    checkPermission(userId, node)
      .then(allowed => { if (!cancelled) setState({ key: checkKey, allowed, isChecking: false }); })
      .catch(() => { if (!cancelled) setState({ key: checkKey, allowed: false, isChecking: false }); });
    return () => { cancelled = true; };
  }, [userId, node]);

  // Until the effect for a newly logged-in user (or node) has run, report "checking" rather than "no".
  const isChecking = state.isChecking || (key !== undefined && state.key !== key);
  return { allowed: !isChecking && state.allowed, isChecking };
}

/** Whether the logged-in user is staff; `isChecking` while that is being resolved. */
export function useStaffAccess(): { isStaff: boolean; isChecking: boolean } {
  const { allowed, isChecking } = usePermission(STAFF_PERMISSION_NODE);
  return { isStaff: allowed, isChecking };
}
