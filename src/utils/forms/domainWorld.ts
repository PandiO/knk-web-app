import { DomainWorldResolveRequestDto } from '../../types/dtos/domain/DomainWorldDtos';

// KNG-111: every domain (Town, District, Structure, GateStructure, or a plain Domain) is in one Minecraft world. The API
// works the world out from the region world task, the Location or the parent; when none gives one the form asks.

const DOMAIN_ENTITY_TYPES = ['domain', 'town', 'district', 'structure', 'gatestructure'];

export const isDomainEntityType = (entityTypeName?: string | null): boolean =>
    !!entityTypeName && DOMAIN_ENTITY_TYPES.includes(entityTypeName.toLowerCase());

const read = (payload: Record<string, any>, key: string): any => {
    if (payload == null) return undefined;
    if (payload[key] !== undefined) return payload[key];
    const match = Object.keys(payload).find(existing => existing.toLowerCase() === key.toLowerCase());
    return match ? payload[match] : undefined;
};

const positiveNumber = (value: unknown): number | null => {
    const numeric = typeof value === 'string' ? Number(value) : value;
    return typeof numeric === 'number' && Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const text = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/** The fields of a submitted domain payload that tell the API which world the domain is in. */
export const buildDomainWorldResolveRequest = (
    entityTypeName: string,
    payload: Record<string, any>,
    entityId?: number | string | null
): DomainWorldResolveRequestDto => {
    const location = read(payload, 'location');
    return {
        entityType: entityTypeName,
        id: positiveNumber(entityId ?? read(payload, 'id')),
        worldName: text(read(payload, 'worldName')),
        wgRegionId: text(read(payload, 'wgRegionId')),
        locationId: positiveNumber(read(payload, 'locationId')) ?? (location ? positiveNumber(read(location, 'id')) : null),
        locationWorld: location ? text(read(location, 'world')) : null,
        townId: positiveNumber(read(payload, 'townId')),
        districtId: positiveNumber(read(payload, 'districtId')),
    };
};
