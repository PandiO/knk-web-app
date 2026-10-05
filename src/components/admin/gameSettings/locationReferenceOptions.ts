import {
    LocationReferenceDto,
    LocationReferenceSourceType,
    LocationSnapshotDto,
} from '../../../types/dtos/gameSettings/GameSettingsModels';

/**
 * A pickable spawn point for the Game Settings page (docs/specs/game-settings/DESIGN.md §3.2): a
 * Location, or a Town/District/Structure's own (default spawn) Location, with its parent domains so
 * it can be found by id, name or parent (KNG-52).
 */
export type LocationOption = {
    key: string;
    sourceType: LocationReferenceSourceType;
    sourceId: number;
    name: string;
    /** "District: Docks › Town: Kardenna" - empty for a town or a bare location. */
    parentLabel: string;
    displayLabel: string;
    location: LocationSnapshotDto;
    /** Lower-cased id, name, type and parent names, for the search box. */
    searchText: string;
};

export const SOURCE_TYPES: LocationReferenceSourceType[] = ['Location', 'Town', 'District', 'Structure'];

export const toLocationSnapshot = (location: any): LocationSnapshotDto | null => {
    if (!location) {
        return null;
    }

    const x = Number(location.x ?? location.X);
    const y = Number(location.y ?? location.Y);
    const z = Number(location.z ?? location.Z);

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return null;
    }

    return {
        locationId: location.id ?? location.Id ?? null,
        name: location.name ?? location.Name ?? null,
        x,
        y,
        z,
        yaw: Number(location.yaw ?? location.Yaw ?? 0),
        pitch: Number(location.pitch ?? location.Pitch ?? 0),
        world: String(location.world ?? location.World ?? 'world'),
    };
};

const idOf = (raw: any): number => Number(raw?.id ?? raw?.Id);
const nameOf = (raw: any, fallback: string): string => String(raw?.name ?? raw?.Name ?? fallback);

/**
 * Every Location and every Town/District/Structure that has a Location, sorted by label. Parents:
 * a district's town; a structure's district and that district's town.
 */
export const buildLocationOptions = (
    locations: any[],
    towns: any[],
    districts: any[],
    structures: any[]
): LocationOption[] => {
    const options: LocationOption[] = [];

    const locationMap = new Map<number, LocationSnapshotDto>();
    const townNames = new Map<number, string>();
    const districts_ = new Map<number, { name: string; townId: number | null }>();

    (towns || []).forEach(raw => {
        const id = idOf(raw);
        if (Number.isFinite(id)) {
            townNames.set(id, nameOf(raw, `Town #${id}`));
        }
    });
    (districts || []).forEach(raw => {
        const id = idOf(raw);
        if (Number.isFinite(id)) {
            const townId = Number(raw.townId ?? raw.TownId);
            districts_.set(id, { name: nameOf(raw, `District #${id}`), townId: Number.isFinite(townId) ? townId : null });
        }
    });

    const townLabel = (townId: number | null | undefined) =>
        townId != null && townNames.has(townId) ? `Town: ${townNames.get(townId)}` : '';
    const parentsOf = (sourceType: LocationReferenceSourceType, raw: any): string[] => {
        if (sourceType === 'District') {
            return [townLabel(Number(raw.townId ?? raw.TownId))].filter(Boolean);
        }
        if (sourceType === 'Structure') {
            const districtId = Number(raw.districtId ?? raw.DistrictId);
            const district = Number.isFinite(districtId) ? districts_.get(districtId) : undefined;
            return [district ? `District: ${district.name}` : '', townLabel(district?.townId)].filter(Boolean);
        }
        return [];
    };

    const push = (sourceType: LocationReferenceSourceType, sourceId: number, name: string, parents: string[],
                  location: LocationSnapshotDto) => {
        const parentLabel = parents.join(' › ');
        const where = `${location.world} ${location.x}, ${location.y}, ${location.z}`;
        const displayLabel = `${sourceType}: ${name}${parentLabel ? ` (${parentLabel})` : ''} - ${where}`;
        options.push({
            key: `${sourceType}-${sourceId}`,
            sourceType,
            sourceId,
            name,
            parentLabel,
            displayLabel,
            location,
            searchText: [`#${sourceId}`, String(sourceId), sourceType, name, parentLabel].join(' ').toLowerCase(),
        });
    };

    (locations || []).forEach(raw => {
        const snapshot = toLocationSnapshot(raw);
        if (!snapshot || snapshot.locationId == null) {
            return;
        }
        locationMap.set(snapshot.locationId, snapshot);
        push('Location', snapshot.locationId, snapshot.name || `#${snapshot.locationId}`, [], snapshot);
    });

    const addFromDomain = (sourceType: LocationReferenceSourceType, values: any[]) => {
        (values || []).forEach(raw => {
            const sourceId = idOf(raw);
            if (!Number.isFinite(sourceId) || sourceId <= 0) {
                return;
            }
            const direct = toLocationSnapshot(raw.location ?? raw.Location);
            const fallbackLocationId = Number(raw.locationId ?? raw.LocationId);
            const fallback = Number.isFinite(fallbackLocationId) ? locationMap.get(fallbackLocationId) : undefined;
            const location = direct ?? fallback ?? null;
            if (!location) {
                return;
            }
            push(sourceType, sourceId, nameOf(raw, `${sourceType} #${sourceId}`), parentsOf(sourceType, raw), location);
        });
    };

    addFromDomain('Town', towns);
    addFromDomain('District', districts);
    addFromDomain('Structure', structures);

    return options.sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));
};

/**
 * Options of {@code type} ('All' for every type) matching every word of {@code query} against the id
 * ("12" or "#12"), name, type or a parent domain's name. An empty query matches everything.
 */
export const filterLocationOptions = (
    options: LocationOption[],
    type: LocationReferenceSourceType | 'All',
    query: string
): LocationOption[] => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return options.filter(option =>
        (type === 'All' || option.sourceType === type)
        && words.every(word => option.searchText.includes(word)));
};

export const toReference = (option: LocationOption): LocationReferenceDto => ({
    sourceType: option.sourceType,
    sourceId: option.sourceId,
    displayLabel: option.displayLabel,
    location: option.location,
});
