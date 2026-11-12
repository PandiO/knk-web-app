import { useMemo } from 'react';
import { EntityMetadataDto } from '../types/dtos/metadata/MetadataModels';
import { useLoadedEntityMetadata } from './loadedEntityMetadata';
import { describeAllNodes } from './useActionGate';
import {
    anyNodeStatus, DELETE_BULK_PERMISSION_NODE, DELETE_PERMISSION_NODE, EXPORT_PERMISSION_NODE, PermissionStatus, usePermissions,
} from './useStaffAccess';

/**
 * PandiO/knk-workspace#280 (DESIGN § 4.3, § 4.7 web app): what the logged-in user may do with one dashboard type, from
 * the type's metadata (`actionNodes`, `readNodes`, `deletable`, `bulkDeletable`, `exportable`; knk-web-api
 * `DashboardAccess`), so the web app hard-codes no node per type.
 *
 * - **view:** the area node (`actionNodes.view`): the type is listed on the dashboard.
 * - **read:** any one of `readNodes` (a full read, e.g. a picker's full table, a link to the detail page).
 * - **create / edit / delete / bulkDelete / export:** every node of the action (all-of).
 *
 * A gate the user may not use is shown disabled with its `hint` ("Requires knk.admin.delete"), except bulk delete,
 * which is hidden (decision 11). Without access fields in the metadata (an API before #280) every action is allowed
 * (the API decides) except bulk delete and export, which need endpoints such an API doesn't have.
 *
 * Only decides what the UI offers: the API checks the same nodes on every call.
 */
export interface EntityGate {
    allowed: boolean;
    /** Still waiting for an answer (no "no" yet). */
    checking: boolean;
    /** "Requires knk.admin.world and knk.admin.delete", "Couldn't check …", why not, or null while allowed/checking. */
    hint: string | null;
    /** The nodes it needs (all of them; for `read`, any one). */
    nodes: string[];
}

export interface EntityAccess {
    /** The metadata carries the #280 access fields. */
    known: boolean;
    view: EntityGate;
    read: EntityGate;
    create: EntityGate;
    edit: EntityGate;
    delete: EntityGate;
    bulkDelete: EntityGate;
    export: EntityGate;
}

type AccessMeta = Pick<EntityMetadataDto, 'accessNode' | 'readNodes' | 'deletable' | 'bulkDeletable' | 'exportable' | 'actionNodes'>;

const OPEN: EntityGate = { allowed: true, checking: false, hint: null, nodes: [] };
const closed = (hint: string): EntityGate => ({ allowed: false, checking: false, hint, nodes: [] });

/** Whether the metadata has the #280 fields (an older API has none). */
export const hasAccessFields = (meta: AccessMeta | null | undefined): boolean =>
    !!meta && (!!meta.actionNodes || !!meta.accessNode);

/** The nodes of `action` from the metadata; null when the metadata says nothing about it. */
export function actionNodesOf(meta: AccessMeta | null | undefined, action: string): string[] | null {
    const nodes = meta?.actionNodes?.[action];
    return Array.isArray(nodes) ? nodes.filter(Boolean) : null;
}

/** The area node a type is listed under (`actionNodes.view`, else `accessNode`), or null when unknown. */
export function viewNodesOf(meta: AccessMeta | null | undefined): string[] | null {
    return actionNodesOf(meta, 'view') ?? (meta?.accessNode ? [meta.accessNode] : null);
}

/** Every node the gates of these types need, for one permission request per node. */
export function accessNodesOf(metas: readonly (AccessMeta | null | undefined)[]): string[] {
    const nodes = new Set<string>();
    metas.forEach(meta => {
        if (!meta) return;
        Object.values(meta.actionNodes ?? {}).forEach(list => list?.forEach(node => node && nodes.add(node)));
        if (meta.accessNode) nodes.add(meta.accessNode);
        meta.readNodes?.forEach(node => node && nodes.add(node));
    });
    return Array.from(nodes).sort();
}

const allOf = (nodes: string[], statuses: Record<string, PermissionStatus>): EntityGate => {
    const described = describeAllNodes(nodes, statuses);
    return { allowed: described.allowed, checking: described.checking, hint: described.hint, nodes };
};

const anyOf = (nodes: string[], statuses: Record<string, PermissionStatus>): EntityGate => {
    if (nodes.length === 0) return OPEN;
    const status = anyNodeStatus(statuses, nodes);
    return {
        allowed: status === 'allowed',
        checking: status === 'checking',
        hint: status === 'allowed' || status === 'checking'
            ? null
            : status === 'error'
                ? `Couldn't check ${nodes.join(', ')}`
                : nodes.length === 1 ? `Requires ${nodes[0]}` : `Requires one of: ${nodes.join(', ')}`,
        nodes,
    };
};

/** The gates of one type, from its metadata and the answers to its nodes (pure; see useEntityAccess). */
export function entityAccessOf(meta: AccessMeta | null | undefined, statuses: Record<string, PermissionStatus>, typeLabel = 'This type'): EntityAccess {
    if (!hasAccessFields(meta)) {
        // Before #280 (or no metadata yet): the API decides; bulk delete and export need its endpoints.
        const exportNodes = [EXPORT_PERMISSION_NODE];
        return {
            known: false,
            view: OPEN,
            read: OPEN,
            create: OPEN,
            edit: OPEN,
            delete: OPEN,
            bulkDelete: closed('Bulk delete needs a newer API.'),
            export: allOf(exportNodes, statuses),
        };
    }
    const gate = (action: string, fallback: string[]) => allOf(actionNodesOf(meta, action) ?? fallback, statuses);
    const view = viewNodesOf(meta) ?? [];
    return {
        known: true,
        view: allOf(view, statuses),
        read: anyOf((meta!.readNodes ?? view).filter(Boolean), statuses),
        create: gate('create', view),
        edit: gate('edit', view),
        delete: meta!.deletable === false
            ? closed(`${typeLabel} records can't be deleted from the dashboard.`)
            : gate('delete', [...view, DELETE_PERMISSION_NODE]),
        bulkDelete: meta!.bulkDeletable === true
            ? gate('bulkDelete', [...view, DELETE_PERMISSION_NODE, DELETE_BULK_PERMISSION_NODE])
            : closed(`${typeLabel} records can only be deleted one at a time.`),
        export: meta!.exportable === false
            ? closed(`${typeLabel} has no list to export.`)
            : gate('export', [...view, EXPORT_PERMISSION_NODE]),
    };
}

/**
 * The gates of `meta`'s type for the logged-in user (one cached check per node, shared with every other
 * usePermission(s) caller). `typeLabel` words the "can't" hints.
 */
export function useEntityAccess(meta: AccessMeta | null | undefined, typeLabel?: string): EntityAccess {
    const nodes = useMemo(() => {
        const list = accessNodesOf([meta]);
        if (!hasAccessFields(meta)) list.push(EXPORT_PERMISSION_NODE);
        return list;
    }, [meta]);
    const statuses = usePermissions(nodes);
    return useMemo(() => entityAccessOf(meta, statuses, typeLabel), [meta, statuses, typeLabel]);
}

/**
 * The types of `metadata` the user may view (#280 decision 8: the dashboard lists only the types whose area node is
 * held); types without access fields stay. `checking` while an answer is out.
 */
export function useViewableTypes<M extends AccessMeta>(metadata: readonly M[]): { types: M[]; checking: boolean } {
    const nodes = useMemo(() => {
        const set = new Set<string>();
        metadata.forEach(meta => viewNodesOf(meta)?.forEach(node => set.add(node)));
        return Array.from(set).sort();
    }, [metadata]);
    const statuses = usePermissions(nodes);
    return useMemo(() => {
        const checking = nodes.some(node => (statuses[node] ?? 'checking') === 'checking');
        const types = metadata.filter(meta => {
            const view = viewNodesOf(meta);
            if (!view || view.length === 0) return true;
            // A failed check keeps the type (the API decides); a "no" hides it.
            return view.every(node => statuses[node] === 'allowed' || statuses[node] === 'error');
        });
        return { types, checking };
    }, [metadata, nodes, statuses]);
}

/**
 * #280 DESIGN § 4.6.3: a picker's "Create new" only with the related type's create nodes. Hidden only on a "no";
 * shown while checking, after a failed check and for a type without access fields (the API decides).
 */
export function useCreateAllowed(entityTypeName: string | null | undefined): boolean {
    const baseMetadata = useLoadedEntityMetadata();
    const meta = useMemo(() => {
        if (!entityTypeName) return undefined;
        const wanted = entityTypeName.toLowerCase();
        return baseMetadata.find(candidate => candidate.entityName.toLowerCase() === wanted);
    }, [baseMetadata, entityTypeName]);
    const nodes = useMemo(() => (hasAccessFields(meta) ? actionNodesOf(meta, 'create') ?? viewNodesOf(meta) ?? [] : []), [meta]);
    const statuses = usePermissions(nodes);
    return !nodes.some(node => statuses[node] === 'denied');
}
