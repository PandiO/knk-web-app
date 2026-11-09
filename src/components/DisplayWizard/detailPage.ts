// Helpers of the entity detail page (PandiO/knk-workspace#188 relationships, #189 readability).
import React, { createContext, useContext } from 'react';
import { EntityMetadataDto, RelationshipMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { entityDisplayLabel } from '../../utils/entityLabel';
import { apiRefusalReason } from '../../utils/apiRefusalReason';

/** The relationship a section shows (`relatedEntityPropertyName`), from the page type's metadata; case-insensitive. */
export function findRelationship(
    metadata: EntityMetadataDto | undefined,
    property: string | undefined | null
): RelationshipMetadataDto | undefined {
    if (!metadata?.relationships || !property) return undefined;
    const wanted = property.trim().toLowerCase();
    return metadata.relationships.find(r => r.property.toLowerCase() === wanted);
}

export function metadataFor(all: EntityMetadataDto[] | undefined, typeName: string | undefined | null): EntityMetadataDto | undefined {
    if (!all || !typeName) return undefined;
    const wanted = typeName.toLowerCase();
    return all.find(m => m.entityName.toLowerCase() === wanted);
}

const read = (record: unknown, key: string | undefined): unknown => {
    if (!record || typeof record !== 'object' || !key) return undefined;
    const r = record as Record<string, unknown>;
    return r[key] ?? r[key.charAt(0).toUpperCase() + key.slice(1)] ?? r[key.charAt(0).toLowerCase() + key.slice(1)];
};

const asId = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
    return undefined;
};

/**
 * The id of the record a collection item (or a single relation's data) stands for: the other side of a link row
 * (`tagId`, or `tag.id`), else the item's own id.
 */
export function relatedIdOf(item: unknown, relationship?: RelationshipMetadataDto): number | undefined {
    if (relationship?.storage === 'linkRow') {
        return asId(read(item, relationship.relatedIdField)) ?? asId(read(read(item, relationship.relatedNavigation), 'id'));
    }
    return asId(read(item, 'id'));
}

/** The related record itself (the embedded other side of a link row). */
export function relatedRecordOf(item: unknown, relationship?: RelationshipMetadataDto): unknown {
    if (relationship?.storage === 'linkRow') return read(item, relationship.relatedNavigation) ?? item;
    return item;
}

/** The name a person knows the related record by ("Main Street"), else "#7". */
export function relatedLabelOf(item: unknown, relationship?: RelationshipMetadataDto): string {
    const record = relatedRecordOf(item, relationship);
    return entityDisplayLabel(record, entityDisplayLabel(record) ? undefined : relatedIdOf(item, relationship));
}

/** Why a load failed, in words for the page: what happened, what to do, and the nodes when access was refused. */
export interface LoadProblem {
    kind: 'noAccess' | 'notFound' | 'noConfiguration' | 'failed';
    title: string;
    detail?: string;
    /** For noAccess: "Requires one of: …" from the API's 403. */
    nodes?: string[];
    /** Worth a retry (network, server error, timeout). */
    retry: boolean;
}

const statusOf = (error: unknown): number | undefined => (error as { status?: number } | null)?.status;
const bodyOf = (error: unknown): Record<string, unknown> | undefined => {
    const response = (error as { response?: unknown } | null)?.response;
    return response && typeof response === 'object' ? response as Record<string, unknown> : undefined;
};

/**
 * #189: a readable message instead of "Error: HTTP 403: Forbidden". The API's #280 read refusal (`code: "NoReadAccess"`,
 * `nodes`) becomes "You don't have access to Towns"; a 404 says the record or configuration doesn't exist (any more).
 */
export function describeLoadProblem(
    error: unknown,
    what: 'entity' | 'configuration',
    typeLabel: string,
    id?: string | number
): LoadProblem {
    const status = statusOf(error);
    const body = bodyOf(error);
    const thing = typeLabel || 'record';
    if (status === 403) {
        const nodes = Array.isArray(body?.nodes) ? (body!.nodes as unknown[]).filter((n): n is string => typeof n === 'string') : undefined;
        return {
            kind: 'noAccess',
            title: `You don't have access to this ${thing}.`,
            detail: nodes?.length ? `Requires one of: ${nodes.join(', ')}.` : apiRefusalReason(error) ?? 'Ask an admin for the permission.',
            nodes,
            retry: false,
        };
    }
    if (status === 404) {
        return what === 'configuration'
            ? { kind: 'noConfiguration', title: `There is no detail page set up for ${thing} yet.`, detail: 'An admin can add one under Entity setup (the ⚙ on the dashboard).', retry: false }
            : { kind: 'notFound', title: `This ${thing}${id != null ? ` (#${id})` : ''} doesn't exist.`, detail: 'It may have been deleted.', retry: false };
    }
    const reason = apiRefusalReason(error);
    if (reason) return { kind: 'failed', title: `This ${thing} couldn't be loaded.`, detail: reason, retry: false };
    return {
        kind: 'failed',
        title: `This ${thing} couldn't be loaded.`,
        detail: "The server didn't answer or had a problem. Check your connection and try again.",
        retry: true,
    };
}

/**
 * Links from the detail page to other detail pages (#189): the page provides where a type's record opens and whether
 * the viewer may read that type (#280 read nodes). Without a provider values stay plain text.
 */
export interface DetailLinks {
    /** `/display/Town/4?returnTo=…`, or null when the type can't be opened (or isn't readable). */
    hrefFor: (typeName: string | undefined, id: number | undefined) => string | null;
    /** Whether the viewer can open that type's records ("no" with the nodes). */
    access: (typeName: string | undefined) => { readable: boolean; hint: string | null };
    /** A plain click navigates inside the app; new-tab clicks are left to the browser. */
    follow: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}

export const DetailLinksContext = createContext<DetailLinks | null>(null);

export const useDetailLinks = (): DetailLinks | null => useContext(DetailLinksContext);
