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
    /** Parent domain names, outermost first: ["Kardenna", "Docks"] for a structure in Docks. */
    parents: string[];
    /** "District: Docks › Town: Kardenna" - empty for a town or a bare location. */
    parentLabel: string;
    displayLabel: string;
    location: LocationSnapshotDto;
    /** Lower-cased id, name, type and parent names, for the search box. */
    searchText: string;
};

export const SOURCE_TYPES: LocationReferenceSourceType[] = ['Location', 'Town', 'District', 'Structure'];

/** Names from the API can carry stray whitespace or newlines ("Residential District\n"). */
export const cleanText = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim();

/** At most one decimal: 1418.2067 -> "1418.2", 43 -> "43". */
export const formatCoordinate = (value: number): string => String(Math.round(value * 10) / 10);

export const formatPosition = (location: LocationSnapshotDto): string =>
    `${cleanText(location.world)} ${formatCoordinate(location.x)}, ${formatCoordinate(location.y)}, ${formatCoordinate(location.z)}`;

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

    const name = location.name ?? location.Name;
    return {
        locationId: location.id ?? location.Id ?? null,
        name: name == null ? null : cleanText(name),
        x,
        y,
        z,
        yaw: Number(location.yaw ?? location.Yaw ?? 0),
        pitch: Number(location.pitch ?? location.Pitch ?? 0),
        world: String(location.world ?? location.World ?? 'world'),
    };
};

const idOf = (raw: any): number => Number(raw?.id ?? raw?.Id);
const nameOf = (raw: any, fallback: string): string => cleanText(raw?.name ?? raw?.Name) || fallback;

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

    type Parent = { type: 'Town' | 'District'; name: string };
    const townOf = (townId: number | null | undefined): Parent[] =>
        townId != null && townNames.has(townId) ? [{ type: 'Town', name: townNames.get(townId)! }] : [];
    /** Outermost first. */
    const parentsOf = (sourceType: LocationReferenceSourceType, raw: any): Parent[] => {
        if (sourceType === 'District') {
            return townOf(Number(raw.townId ?? raw.TownId));
        }
        if (sourceType === 'Structure') {
            const districtId = Number(raw.districtId ?? raw.DistrictId);
            const district = Number.isFinite(districtId) ? districts_.get(districtId) : undefined;
            return district ? [...townOf(district.townId), { type: 'District', name: district.name }] : [];
        }
        return [];
    };

    const push = (sourceType: LocationReferenceSourceType, sourceId: number, name: string, parents: Parent[],
                  location: LocationSnapshotDto) => {
        // Innermost first, as saved labels have always read: "District: Docks › Town: Kardenna".
        const parentLabel = [...parents].reverse().map(p => `${p.type}: ${p.name}`).join(' › ');
        const displayLabel = `${sourceType}: ${name}${parentLabel ? ` (${parentLabel})` : ''} - ${formatPosition(location)}`;
        options.push({
            key: `${sourceType}-${sourceId}`,
            sourceType,
            sourceId,
            name,
            parents: parents.map(p => p.name),
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
        push('Location', snapshot.locationId, snapshot.name || `Location #${snapshot.locationId}`, [], snapshot);
    });

    const addFromDomain = (sourceType: LocationReferenceSourceType, values: any[]) => {
        (values || []).forEach(raw => {
            const sourceId = idOf(raw);
            if (!Number.isFinite(sourceId) || sourceId <= 0) {
                return;
            }
            // Towns and districts embed their Location; structures only carry a locationId.
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

/** The words of a search; every one must match. */
export const searchWords = (query: string): string[] => query.trim().toLowerCase().split(/\s+/).filter(Boolean);

/**
 * Options of {@code type} ('All' for every type) matching every word of {@code query} against the id
 * ("12" or "#12"), name, type or a parent domain's name. An empty query matches everything.
 */
export const filterLocationOptions = (
    options: LocationOption[],
    type: LocationReferenceSourceType | 'All',
    query: string
): LocationOption[] => {
    const words = searchWords(query);
    return options.filter(option =>
        (type === 'All' || option.sourceType === type)
        && words.every(word => option.searchText.includes(word)));
};

export const toReference = (option: LocationOption): LocationReferenceDto => ({
    sourceType: option.sourceType,
    sourceId: option.sourceId,
    displayLabel: cleanText(option.displayLabel),
    location: option.location,
});
