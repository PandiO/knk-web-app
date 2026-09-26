import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userManagementClient } from '../apiClients/userManagementClient';

/**
 * The permission that makes someone staff for the web moderation pages - the same node that
 * opens the in-game Player manager (knk-web-api StaffPermissions.ManageUsers), so it is also
 * matched by knk.admin.* and *. The API enforces it too; this only decides what to show.
 */
export const STAFF_PERMISSION_NODE = 'knk.admin.user.manage';

// One check per logged-in user per page load, shared by the nav bar and the route guard. A
// failed check isn't cached, so the next render retries. A rank change applies after a reload.
const staffChecks = new Map<number, Promise<boolean>>();

function checkStaff(userId: number): Promise<boolean> {
  let check = staffChecks.get(userId);
  if (!check) {
    check = userManagementClient
      .checkPermission(userId, STAFF_PERMISSION_NODE)
      .then(result => result?.allowed === true)
      .catch(err => {
        staffChecks.delete(userId);
        throw err;
      });
    staffChecks.set(userId, check);
  }
  return check;
}

/** Whether the logged-in user is staff; `isChecking` while that is being resolved. */
export function useStaffAccess(): { isStaff: boolean; isChecking: boolean } {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<{ userId?: number; isStaff: boolean; isChecking: boolean }>({
    isStaff: false,
    isChecking: userId !== undefined,
  });

  useEffect(() => {
    if (userId === undefined) {
      setState({ isStaff: false, isChecking: false });
      return;
    }
    let cancelled = false;
    setState({ userId, isStaff: false, isChecking: true });
    checkStaff(userId)
      .then(isStaff => { if (!cancelled) setState({ userId, isStaff, isChecking: false }); })
      .catch(() => { if (!cancelled) setState({ userId, isStaff: false, isChecking: false }); });
    return () => { cancelled = true; };
  }, [userId]);

  // Until the effect for a newly logged-in user has run, report "checking" rather than "no".
  const isChecking = state.isChecking || (userId !== undefined && state.userId !== userId);
  return { isStaff: !isChecking && state.isStaff, isChecking };
}
