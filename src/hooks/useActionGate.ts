import { PermissionStatus, usePermission } from './useStaffAccess';

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
