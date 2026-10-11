// KNG-111: which Minecraft world a domain is in. Mirrors knk-web-api Dtos/DomainWorldDtos.cs.

export interface DomainWorldResolveRequestDto {
    entityType?: string;
    id?: number | null;
    worldName?: string | null;
    wgRegionId?: string | null;
    locationId?: number | null;
    locationWorld?: string | null;
    townId?: number | null;
    districtId?: number | null;
}

export interface DomainWorldResolutionDto {
    worldName?: string | null;
    source?: string | null;
    /** No source gives a world and nothing conflicts: the form must ask for it. */
    needsWorld: boolean;
    error?: string | null;
    errorCode?: string | null;
}

export interface DomainWorldMissingDto {
    id: number;
    name: string;
    domainType: string;
    wgRegionId?: string | null;
    candidateWorlds: string[];
}
