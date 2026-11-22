import { DomainBaseDto } from '../domain/DomainDtos';
import { LocationDto } from '../locations/LocationModels';

/**
 * Landmarks, staff-made named places for /navigate (off-road navigation phase 5.1, PandiO/knk-workspace#708), a domain
 * subtype since landmark-domain phase 1 (knk-workspace docs/specs/landmark-domain/DESIGN.md § 6, PandiO/knk-workspace#983;
 * web app #986). Matches knk-web-api `Dtos/LandmarkDtos.cs`.
 */

/** The landmark's area (LD16): the pin only, its own region with sub-regions, or the parent's area. */
export type LandmarkAreaKind = 'None' | 'OwnRegion' | 'LinkedDomain';

export const LANDMARK_AREA_KINDS: readonly LandmarkAreaKind[] = ['None', 'OwnRegion', 'LinkedDomain'];

/** The #708 area names the API still sends next to `areaKind` until a later change drops them. */
export type LandmarkExtentKind = 'None' | 'Region' | 'Radius';

export type LandmarkKind = 'General';

/** The parent domain (the linked domain, LD09) as the API nests it. */
export interface LandmarkDomainNavDto {
    id: number;
    name: string;
    /** `Town`, `District`, `Structure`, `GateStructure`, `Landmark`, ... */
    domainType: string;
    worldName?: string | null;
    /** The parent's main region; null for a parent without one (then `LinkedDomain` isn't possible). */
    wgRegionId?: string | null;
}

/** `GET api/landmarks`, `GET api/landmarks/{id}` and create/update: the domain fields plus the landmark's own. */
export interface LandmarkDto extends DomainBaseDto {
    /** Always `Landmark`. */
    domainType?: 'Landmark';
    locationId?: number | null;
    location?: LocationDto | null;
    world?: string | null;
    areaKind?: LandmarkAreaKind;
    subRegionIds?: string[];
    parentDomainId?: number | null;
    parentDomain?: LandmarkDomainNavDto | null;
    parentDomainName?: string | null;
    showEnterLeaveMessages?: boolean;
    /** 0.25 to 4.0, default 1. */
    preference?: number;
    navigationEnabled?: boolean;
    kind?: LandmarkKind;
    /** @deprecated #708 name of `parentDomainId`, kept by the API for the plugin until L3 (#985). */
    domainId?: number | null;
    /** @deprecated #708 name of `parentDomain`. */
    domain?: LandmarkDomainNavDto | null;
    /** @deprecated #708 name of `parentDomainName`. */
    domainName?: string | null;
    /** @deprecated #708 projection of `areaKind`. */
    extentKind?: LandmarkExtentKind;
    /** @deprecated #708 projection of the area's main region. */
    regionId?: string | null;
    /** @deprecated always null since LD08. */
    radius?: number | null;
}

/** A row of `POST api/landmarks/search`. */
export interface LandmarkListDto {
    id: number;
    name: string;
    world?: string | null;
    x?: number | null;
    y?: number | null;
    z?: number | null;
    areaKind: LandmarkAreaKind;
    wgRegionId?: string | null;
    parentDomainId?: number | null;
    parentDomainName?: string | null;
    parentDomainType?: string | null;
    preference: number;
    navigationEnabled: boolean;
    kind: LandmarkKind;
}
