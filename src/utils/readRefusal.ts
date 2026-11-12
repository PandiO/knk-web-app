import { apiRefusalReason } from './apiRefusalReason';

/**
 * PandiO/knk-workspace#280 (DESIGN § 4.7, AM2): a read the API refuses answers 403 `{ code: "NoReadAccess",
 * entityType, nodes, message }` (or, for the any-area-node rules, a 403 without a code). This turns it into
 * "You don't have access to Towns. Requires one of: knk.admin.world, knk.admin.config." instead of a generic
 * "Failed to load data". Undefined for anything that isn't a 403.
 */
export function readRefusalMessage(error: unknown, typeLabel: string): string | undefined {
    const e = error as { status?: number; response?: unknown } | null;
    if (e?.status !== 403) return undefined;
    const body = e.response && typeof e.response === 'object' ? e.response as Record<string, unknown> : undefined;
    const nodes = Array.isArray(body?.nodes) ? (body!.nodes as unknown[]).filter((n): n is string => typeof n === 'string') : [];
    const what = typeLabel || 'these records';
    if (nodes.length > 0) {
        return `You don't have access to ${what}. Requires ${nodes.length === 1 ? nodes[0] : `one of: ${nodes.join(', ')}`}.`;
    }
    const reason = apiRefusalReason(error);
    return `You don't have access to ${what}.${reason && reason !== "You don't have permission to do this." ? ` ${reason}` : ''}`;
}
