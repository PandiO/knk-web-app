import { useMemo } from 'react';
import { PermissionStatus, usePermission, usePermissions } from './useStaffAccess';

/**
 * The #280 rule for buttons (DESIGN § 4.3, § 4.8; first used by V2's Export): an action the user may not take is
 * shown **disabled with "Requires <node>"**, not hidden, so staff can see what exists and what to ask for. Only
 * decides what the UI offers: the API checks the node on its own.
 */
export interface ActionGate {
    node: string;
    allowed: boolean;
    checking: boolean;
    /** "Requires knk.freeze", "Couldn't check knk.freeze", or null while allowed or checking. */
    hint: string | null;
}

export const gateHint = (node: string, status: PermissionStatus): string | null => {
    if (status === 'error') return `Couldn't check ${node}`;
    if (status === 'denied' || status === 'unauthenticated') return `Requires ${node}`;
    return null;
};

export function useActionGate(node: string): ActionGate {
    const { allowed, isChecking, status } = usePermission(node);
    return { node, allowed, checking: isChecking, hint: gateHint(node, status) };
}

/**
 * The same rule for an action that needs **every** node of a list (the metadata's `actionNodes` and a relationship's
 * `nodes` are all-of, PandiO/knk-workspace#188): allowed once all are held; the hint names the missing ones
 * ("Requires knk.admin.world and knk.admin.delete"). An empty list is allowed (the API decides).
 */
export function useAllNodesGate(nodes: readonly string[] | null | undefined): Omit<ActionGate, 'node'> & { nodes: string[] } {
    const list = useMemo(() => (nodes ?? []).filter(Boolean), [nodes]);
    const statuses = usePermissions(list);
    return useMemo(() => describeAllNodes(list, statuses), [list, statuses]);
}

export function describeAllNodes(nodes: string[], statuses: Record<string, PermissionStatus>) {
    const checking = nodes.some(node => (statuses[node] ?? 'checking') === 'checking');
    const errored = nodes.filter(node => statuses[node] === 'error');
    const missing = nodes.filter(node => statuses[node] === 'denied' || statuses[node] === 'unauthenticated');
    const allowed = nodes.every(node => statuses[node] === 'allowed');
    const hint = missing.length > 0
        ? `Requires ${missing.join(' and ')}`
        : errored.length > 0 ? `Couldn't check ${errored.join(' and ')}` : null;
    return { nodes, allowed, checking: checking && missing.length === 0, hint };
}
