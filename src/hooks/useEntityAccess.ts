import { useMemo } from 'react';
import { EntityMetadataDto } from '../types/dtos/metadata/MetadataModels';
import { editOpensFormWizard } from '../utils/returnTo';
import { useLoadedEntityMetadata } from './loadedEntityMetadata';
import { describeAllNodes, useAllNodesGate } from './useActionGate';
import {
    anyNodeStatus, CONTENT_PERMISSION_NODE, DELETE_BULK_PERMISSION_NODE, DELETE_PERMISSION_NODE, EXPORT_PERMISSION_NODE, PermissionStatus, usePermissions,
} from './useStaffAccess';

/**
 * PandiO/knk-workspace#280 (DESIGN § 4.3, § 4.7 web app): what the logged-in user may do with one dashboard type, from
 * the type's metadata (`actionNodes`, `readNodes`, `deletable`, `bulkDeletable`, `exportable`; knk-web-api
 * `DashboardAccess`), so the web app hard-codes no node per type.
 *
 * - **view:** the area node (`actionNodes.view`): the type is listed on the dashboard.
 * - **read:** any one of `readNodes` (a full read, e.g. a picker's full table, a link to the detail page).
 * - **create / edit / delete / bulkDelete / export:** every node of the action (all-of). Create and edit also need
 *   `knk.admin.content` in the web app (#371, developer 2026-11-13: area staff work with the content available and don't
 *   change forms; reverts AM3's LAM3-1), see `withContentNode`; not Edit of a user, which opens the player profile.
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

type AccessMeta = Pick<EntityMetadataDto, 'accessNode' | 'readNodes' | 'deletable' | 'bulkDeletable' | 'exportable' | 'actionNodes'>
    & Partial<Pick<EntityMetadataDto, 'entityName'>>;

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

/**
 * #371 (developer 2026-11-13): create and edit go through the form wizard, which stays on `knk.admin.content`, so the
 * web app asks for it on top of the type's own create/edit nodes. Adds it once; keeps the order of `nodes`. Since #374
 * the API lists `knk.admin.content` in `actionNodes.create`/`edit` and in a relationship's `nodes` itself, so this is a
 * no-op against it; it stays so the gates are right against an API without #374 (either can deploy first).
 */
export function withContentNode(nodes: readonly string[] | null | undefined): string[] {
    const list = (nodes ?? []).filter(Boolean);
    return list.includes(CONTENT_PERMISSION_NODE) ? list : [...list, CONTENT_PERMISSION_NODE];
}

/** The nodes Edit needs: the type's edit nodes, plus `knk.admin.content` when Edit opens the form wizard (#371). */
function editNodesOf(meta: AccessMeta | null | undefined, fallback: string[]): string[] {
    const nodes = actionNodesOf(meta, 'edit') ?? fallback;
    return editOpensFormWizard(meta?.entityName) ? withContentNode(nodes) : nodes;
}

/** The area node a type is listed under (`actionNodes.view`, else `accessNode`), or null when unknown. */
export function viewNodesOf(meta: AccessMeta | null | undefined): string[] | null {
    return actionNodesOf(meta, 'view') ?? (meta?.accessNode ? [meta.accessNode] : null);
}

/**
 * Every node the gates of these types need, for one permission request per node: the metadata's lists, plus the global
 * action nodes the gates fall back to when an action's list is missing.
 */
export function accessNodesOf(metas: readonly (AccessMeta | null | undefined)[]): string[] {
    const nodes = new Set<string>();
    metas.forEach(meta => {
        if (!meta) return;
        nodes.add(CONTENT_PERMISSION_NODE);
        if (hasAccessFields(meta)) {
            [DELETE_PERMISSION_NODE, DELETE_BULK_PERMISSION_NODE, EXPORT_PERMISSION_NODE].forEach(node => nodes.add(node));
        }
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
        // Before #280 (or no metadata yet): the API decides; bulk delete and export need its endpoints. Create and edit
        // open the form wizard, which needs knk.admin.content (#371).
        const exportNodes = [EXPORT_PERMISSION_NODE];
        const wizard = allOf([CONTENT_PERMISSION_NODE], statuses);
        return {
            known: false,
            view: OPEN,
            read: OPEN,
            create: wizard,
            edit: editOpensFormWizard(meta?.entityName) ? wizard : OPEN,
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
        create: allOf(withContentNode(actionNodesOf(meta, 'create') ?? view), statuses),
        edit: allOf(editNodesOf(meta, view), statuses),
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
        if (!hasAccessFields(meta)) list.push(EXPORT_PERMISSION_NODE, CONTENT_PERMISSION_NODE);
        return Array.from(new Set(list)).sort();
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
 * #280 DESIGN § 4.6.3: a picker's "Create new" only with the related type's create nodes, plus `knk.admin.content`
 * (#371: the wizard needs it). Hidden only on a "no"; shown while checking and after a failed check (the API decides).
 */
export function useCreateAllowed(entityTypeName: string | null | undefined): boolean {
    const baseMetadata = useLoadedEntityMetadata();
    const meta = useMemo(() => {
        if (!entityTypeName) return undefined;
        const wanted = entityTypeName.toLowerCase();
        return baseMetadata.find(candidate => candidate.entityName.toLowerCase() === wanted);
    }, [baseMetadata, entityTypeName]);
    const nodes = useMemo(
        () => withContentNode(hasAccessFields(meta) ? actionNodesOf(meta, 'create') ?? viewNodesOf(meta) ?? [] : []),
        [meta]
    );
    const statuses = usePermissions(nodes);
    return !nodes.some(node => statuses[node] === 'denied');
}

/**
 * #383 (developer 2026-11-13: grey them out): the nodes a save **outside** the form wizard needs when it goes through a
 * type's primary create or update, which #374 gates in the API (`RequireDashboardChange`): the metadata's
 * `actionNodes.create`/`edit` (else the area node), plus `knk.admin.content` (`withContentNode`). Not for a user's edit
 * (User is exempt in the API and keeps `knk.admin.user.manage`). Without access fields: `knk.admin.content` only.
 */
export function changeNodesOf(meta: AccessMeta | null | undefined, action: 'create' | 'edit', entityTypeName?: string | null): string[] {
    const own = hasAccessFields(meta) ? actionNodesOf(meta, action) ?? viewNodesOf(meta) ?? [] : [];
    const typeName = entityTypeName ?? meta?.entityName;
    return action === 'edit' && !editOpensFormWizard(typeName) ? own : withContentNode(own);
}

/**
 * #383: the gate of a non-form save (the lootbox Types tab's Enable/Disable, the roads page's Create New Street, the
 * detail page's hot edit) through `entityTypeName`'s create or update, from the loaded metadata: disabled with
 * "Requires knk.admin.content" (and any missing type node) without them, like New and Edit (#371, decision 11).
 */
export function useTypeChangeGate(entityTypeName: string | null | undefined, action: 'create' | 'edit') {
    const baseMetadata = useLoadedEntityMetadata();
    const nodes = useMemo(() => {
        const wanted = (entityTypeName ?? '').toLowerCase();
        const meta = baseMetadata.find(candidate => candidate.entityName.toLowerCase() === wanted);
        return changeNodesOf(meta, action, entityTypeName);
    }, [baseMetadata, entityTypeName, action]);
    return useAllNodesGate(nodes);
}
