import { LocationDto } from '../locations/LocationModels';

/**
 * Landmarks, staff-made named places for /navigate (off-road navigation phase 5.1, PandiO/knk-workspace#708;
 * knk-workspace docs/specs/navigation-offroad/DESIGN.md § 6). Matches knk-web-api `Dtos/LandmarkDtos.cs`.
 */
export type LandmarkExtentKind = 'None' | 'Region' | 'Radius';

export type LandmarkKind = 'General';

/** The domain a landmark is linked to, as the API nests it. */
export interface LandmarkDomainNavDto {
    id: number;
    name: string;
    /** `Town`, `District`, `Structure`, `GateStructure`, ... */
    domainType: string;
    worldName?: string | null;
}

/** `GET api/landmarks`, `GET api/landmarks/{id}` and create/update. */
export interface LandmarkDto {
    id?: number;
    name: string;
    locationId?: number | null;
    location?: LocationDto | null;
    world?: string | null;
    domainId?: number | null;
    domain?: LandmarkDomainNavDto | null;
    domainName?: string | null;
    extentKind?: LandmarkExtentKind;
    regionId?: string | null;
    radius?: number | null;
    /** 0.25 to 4.0, default 1. */
    preference?: number;
    navigationEnabled?: boolean;
    kind?: LandmarkKind;
    createdAt?: string;
}

/** A row of `POST api/landmarks/search`. */
export interface LandmarkListDto {
    id: number;
    name: string;
    world?: string | null;
    x?: number | null;
    y?: number | null;
    z?: number | null;
    domainId?: number | null;
    domainName?: string | null;
    domainType?: string | null;
    extentKind: LandmarkExtentKind;
    preference: number;
    navigationEnabled: boolean;
    kind: LandmarkKind;
}
