import { dashboardPath, entitySetupPath, sanitizeReturnTo } from './returnTo';

/**
 * A breadcrumb trail (#177 link 2): "Dashboard › Town › Edit Cinix". The last crumb is the page
 * itself and has no `to`. Built from `returnTo`, so the trail is the way back the page was opened
 * from. Plain data, so the admin layout (#30) can render the same trail later.
 */
export type Breadcrumb = { label: string; to?: string };

/** The label of an entity type (metadata display name), for the crumbs. */
export type TypeLabelFor = (entityTypeName: string) => string;

type Known = {
    /** Fills in the name of an entity the trail passes through, when the page knows it. */
    entityTypeName?: string;
    entityId?: string | number | null;
    entityLabel?: string | null;
};

const DASHBOARD: Breadcrumb = { label: 'Dashboard', to: '/dashboard' };
const ENTITY_SETUP: Breadcrumb = { label: 'Entity setup', to: '/forms' };

const decode = (segment: string): string => {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
};

const sameType = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * The crumbs that lead back to `returnTo` (the last one links to it). Unknown same-app pages get a
 * single "Back" crumb; an unsafe or missing `returnTo` gives no crumbs.
 */
export function trailTo(returnTo: string | null | undefined, labelFor: TypeLabelFor, known: Known = {}): Breadcrumb[] {
    const safe = sanitizeReturnTo(returnTo);
    if (!safe) return [];
    const pathname = safe.split(/[?#]/)[0];
    const segments = pathname.split('/').filter(Boolean).map(decode);

    if (segments[0] === 'dashboard') {
        if (segments.length === 1) return [{ ...DASHBOARD, to: safe }];
        return [DASHBOARD, { label: labelFor(segments[1]), to: safe }];
    }
    if (segments[0] === 'display' && segments.length >= 3) {
        const [, type, id] = segments;
        const isKnown = sameType(type, known.entityTypeName) && String(known.entityId ?? '') === id && !!known.entityLabel;
        return [
            DASHBOARD,
            { label: labelFor(type), to: dashboardPath(type) },
            { label: isKnown ? known.entityLabel! : `#${id}`, to: safe },
        ];
    }
    if (segments[0] === 'forms') {
        if (segments.length === 1) return [{ ...ENTITY_SETUP, to: safe }];
        return [ENTITY_SETUP, { label: labelFor(segments[1]), to: safe }];
    }
    return [{ label: 'Back', to: safe }];
}

/**
 * The trail of an open form: the way back (`returnTo`, else the Entity setup page of the type it
 * was opened on) and then "Edit {name}" or "New {Type}".
 */
export function formTrail(options: {
    returnTo: string | null | undefined;
    entityTypeName: string;
    entityId?: string | number | null;
    entityLabel?: string | null;
    labelFor: TypeLabelFor;
}): Breadcrumb[] {
    const { returnTo, entityTypeName, entityId, entityLabel, labelFor } = options;
    const back = trailTo(returnTo, labelFor, { entityTypeName, entityId, entityLabel });
    const lead = back.length > 0
        ? back
        : [ENTITY_SETUP, { label: labelFor(entityTypeName), to: entitySetupPath(entityTypeName) }];
    const editing = entityId != null && String(entityId) !== '';
    const current = editing
        ? `Edit ${entityLabel || `#${entityId}`}`
        : `New ${labelFor(entityTypeName)}`;
    return [...lead, { label: current }];
}

/** The trail of a detail page: the way back (`returnTo`, else the dashboard on the type) and the entity. */
export function detailTrail(options: {
    returnTo: string | null | undefined;
    entityTypeName: string;
    entityLabel: string;
    labelFor: TypeLabelFor;
}): Breadcrumb[] {
    const { returnTo, entityTypeName, entityLabel, labelFor } = options;
    const back = trailTo(returnTo, labelFor);
    const lead = back.length > 0
        ? back
        : [DASHBOARD, { label: labelFor(entityTypeName), to: dashboardPath(entityTypeName) }];
    return [...lead, { label: entityLabel }];
}
