import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userManagementClient } from '../apiClients/userManagementClient';

/**
 * The permission that makes someone staff for the web moderation pages - the same node that
 * opens the in-game Player manager (knk-web-api StaffPermissions.ManageUsers), so it is also
 * matched by knk.admin.* and *. The API enforces it too; this only decides what to show.
 */
export const STAFF_PERMISSION_NODE = 'knk.admin.user.manage';

/**
 * The permission for the content tools (dashboard, forms, displays, form/display builders) -
 * knk-web-api StaffPermissions.ManageContent, also matched by knk.admin.* and *.
 */
export const CONTENT_PERMISSION_NODE = 'knk.admin.content';

/**
 * The outcome of a permission check:
 * - `allowed` / `denied`: the API answered (a 403 counts as denied);
 * - `unauthenticated`: 401 - not logged in, or the session expired and couldn't be refreshed;
 * - `error`: anything else (network, timeout, 5xx). Not a "no": the page offers a retry.
 */
export type PermissionStatus = 'checking' | 'allowed' | 'denied' | 'unauthenticated' | 'error';

type CheckResult = Exclude<PermissionStatus, 'checking'>;

export function classifyPermissionError(err: unknown): CheckResult {
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 403) return 'denied';
  if (status === 401) return 'unauthenticated';
  return 'error';
}

// One check per logged-in user and node per page load, shared by every component asking (nav
// bar, route guard, panels). Only an answer (allowed/denied) is cached: after a 401 or an error
// the next render asks again. A rank change applies after a reload.
const permissionChecks = new Map<string, Promise<CheckResult>>();

function checkPermission(userId: number, node: string): Promise<CheckResult> {
  const key = `${userId}:${node}`;
  let check = permissionChecks.get(key);
  if (!check) {
    check = userManagementClient
      .checkPermission(userId, node)
      .then((result): CheckResult => (result?.allowed === true ? 'allowed' : 'denied'))
      .catch((err): CheckResult => {
        const status = classifyPermissionError(err);
        if (status !== 'denied') permissionChecks.delete(key);
        return status;
      });
    permissionChecks.set(key, check);
  }
  return check;
}

export interface PermissionState {
  allowed: boolean;
  isChecking: boolean;
  status: PermissionStatus;
  /** Ask again (after an error). */
  retry: () => void;
}

/**
 * Whether the logged-in user holds `node` in the in-house permission system (wildcards
 * included); `isChecking` while that is being resolved. `status` tells a real "no" (denied)
 * apart from an expired session or a failed check. Only decides what the UI shows - the API
 * enforces the node on its own.
 */
export function usePermission(node: string): PermissionState {
  const { user } = useAuth();
  const userId = user?.id;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key?: string; status: PermissionStatus }>({
    status: userId !== undefined ? 'checking' : 'unauthenticated',
  });
  const key = userId === undefined ? undefined : `${userId}:${node}:${attempt}`;

  useEffect(() => {
    if (userId === undefined) {
      setState({ status: 'unauthenticated' });
      return;
    }
    const checkKey = `${userId}:${node}:${attempt}`;
    let cancelled = false;
    setState({ key: checkKey, status: 'checking' });
    checkPermission(userId, node).then(status => {
      if (!cancelled) setState({ key: checkKey, status });
    });
    return () => { cancelled = true; };
  }, [userId, node, attempt]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);

  // Until the effect for a newly logged-in user (or node) has run, report "checking" rather than "no".
  const status: PermissionStatus = key !== undefined && state.key !== key ? 'checking' : state.status;
  const isChecking = status === 'checking';
  return { allowed: status === 'allowed', isChecking, status, retry };
}

/** Whether the logged-in user is staff; `isChecking` while that is being resolved. */
export function useStaffAccess(): { isStaff: boolean; isChecking: boolean; status: PermissionStatus } {
  const { allowed, isChecking, status } = usePermission(STAFF_PERMISSION_NODE);
  return { isStaff: allowed, isChecking, status };
}
