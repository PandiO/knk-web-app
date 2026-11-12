import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userManagementClient } from '../apiClients/userManagementClient';
import { EXACT_GRANT_OWNER_NODES } from '../types/dtos/telemetry/TelemetryDtos';

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
 * The permission for the Game Settings page - knk-web-api StaffPermissions.ServerConfig, which the
 * API checks on every Game Settings write and on the hub-domain list the page loads (#185). Also
 * matched by knk.admin.* and *.
 */
export const SERVER_CONFIG_PERMISSION_NODE = 'knk.admin.config';

/**
 * The permission for the Siege settings page - knk-web-api StaffPermissions.SiegeManage, which the
 * API checks on the siege configuration save (#185). Also matched by knk.siege.admin.*, knk.siege.*
 * and *, not by knk.admin.*.
 */
export const SIEGE_ADMIN_PERMISSION_NODE = 'knk.siege.admin.manage';

/**
 * Export rows of a dashboard type as CSV (PandiO/knk-workspace#205, #280 DESIGN § 4.8): knk-web-api
 * StaffPermissions.Export from link AM1. Until the API knows the node, only `*` and `knk.admin.*` match it
 * (the owner and Admin); the AM1 migration also grants it to the area-node holders.
 */
export const EXPORT_PERMISSION_NODE = 'knk.admin.export';

/**
 * Delete one record of a dashboard type (PandiO/knk-workspace#280 DESIGN § 4.1): knk-web-api StaffPermissions.Delete,
 * needed on top of the type's area node. Matched by knk.admin.delete.*, knk.admin.* and *.
 */
export const DELETE_PERMISSION_NODE = 'knk.admin.delete';

/**
 * Delete several records in one action (#280 DESIGN § 4.1, #205): knk-web-api StaffPermissions.DeleteBulk, needed on
 * top of knk.admin.delete and the area node. Only the owner hands it out.
 */
export const DELETE_BULK_PERMISSION_NODE = 'knk.admin.delete.bulk';

/**
 * The area nodes of the dashboard access model (#280 DESIGN § 4.1, knk-web-api `DashboardAccess.AreaNodes`, LAM2-4):
 * each one means view, create and edit of its area's types. Holding **any** of them opens the dashboard, the detail
 * page and the form wizard (decision 8), and the API's form-runtime reads (metadata, configurations) answer for it.
 * The API doesn't list them; keep this in step with the registry.
 */
export const AREA_NODES: readonly string[] = [
  CONTENT_PERMISSION_NODE,
  'knk.admin.world',
  'knk.kit.manage',
  'knk.admin.lootbox.manage',
  SIEGE_ADMIN_PERMISSION_NODE,
  'knk.admin.road',
  STAFF_PERMISSION_NODE,
];

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
      // The API refuses wildcards for these owner nodes (D24), so a knk.* holder isn't shown them.
      .then((result): CheckResult =>
        result?.allowed === true && (!EXACT_GRANT_OWNER_NODES.has(node) || result.matchedNode === node)
          ? 'allowed'
          : 'denied')
      .catch((err): CheckResult => {
        const status = classifyPermissionError(err);
        if (status !== 'denied') permissionChecks.delete(key);
        return status;
      });
    permissionChecks.set(key, check);
  }
  return check;
}

/**
 * The logged-in user's id, or undefined outside an AuthProvider (a component rendered on its own, e.g. in a test): such
 * a component acts as logged out instead of throwing. useAuth always calls useContext first, so the hook order stays
 * the same either way.
 */
export function useAuthUserId(): number | undefined {
  try {
    return useAuth().user?.id;
  } catch {
    return undefined;
  }
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
 * included, except for EXACT_GRANT_OWNER_NODES); `isChecking` while that is being resolved.
 * `status` tells a real "no" (denied) apart from an expired session or a failed check. Only
 * decides what the UI shows - the API enforces the node on its own.
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

/**
 * The status of several nodes at once (the admin sidebar, the /admin overview and the bar's Admin link,
 * PandiO/knk-workspace#30): one entry per node, `checking` until its answer is in. Shares the per-login cache
 * with usePermission, so the sidebar and the route guard ask the API once per node.
 */
export function usePermissions(nodes: readonly string[]): Record<string, PermissionStatus> {
  const userId = useAuthUserId();
  const nodesKey = nodes.join('\n');
  const forKey = userId === undefined ? undefined : `${userId}\n${nodesKey}`;
  const [state, setState] = useState<{ key?: string; statuses: Record<string, PermissionStatus> }>({ statuses: {} });

  useEffect(() => {
    if (userId === undefined) return;
    const key = `${userId}\n${nodesKey}`;
    let cancelled = false;
    setState({ key, statuses: {} });
    nodesKey.split('\n').filter(Boolean).forEach(node => {
      checkPermission(userId, node).then(status => {
        if (cancelled) return;
        setState(previous => previous.key === key
          ? { key, statuses: { ...previous.statuses, [node]: status } }
          : previous);
      });
    });
    return () => { cancelled = true; };
  }, [userId, nodesKey]);

  return useMemo(() => {
    const result: Record<string, PermissionStatus> = {};
    nodesKey.split('\n').filter(Boolean).forEach(node => {
      result[node] = forKey === undefined
        ? 'unauthenticated'
        : state.key === forKey ? (state.statuses[node] ?? 'checking') : 'checking';
    });
    return result;
  }, [nodesKey, forKey, state]);
}

/**
 * Whether the logged-in user holds **any** of `nodes` (#280: the dashboard's area nodes): `allowed` as soon as one
 * check says yes, `denied` once every check said no, `error` when none said yes and a check failed, `checking`
 * otherwise. Shares usePermissions' per-login cache.
 */
export function anyNodeStatus(statuses: Record<string, PermissionStatus>, nodes: readonly string[]): PermissionStatus {
  const list = nodes.map(node => statuses[node] ?? 'checking');
  if (list.some(status => status === 'allowed')) return 'allowed';
  if (list.some(status => status === 'checking')) return 'checking';
  if (list.length > 0 && list.every(status => status === 'unauthenticated')) return 'unauthenticated';
  if (list.some(status => status === 'error')) return 'error';
  return 'denied';
}

export function useAnyNode(nodes: readonly string[]): PermissionStatus {
  const statuses = usePermissions(nodes);
  return anyNodeStatus(statuses, nodes);
}

/** Whether the logged-in user holds any dashboard area node (#280 decision 8; LAM2-9: metadata only for them). */
export function useAnyAreaNode(): PermissionStatus {
  return useAnyNode(AREA_NODES);
}
