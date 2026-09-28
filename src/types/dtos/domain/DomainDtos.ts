// Warp destination settings of a Domain (knk-web-api Models/Domain.cs, docs/specs/teleport
// DESIGN.md §3.7.1, Phase 5) - on the Town/District/Structure DTOs and forms. Sending
// teleportEnabled means "these are on the form": the API then sets all five (a missing id = no
// requirement); leaving it out keeps the stored values.
export interface DomainTeleportSettingsDto {
    teleportEnabled?: boolean;
    // 0 = free; charged in gems after the warmup.
    teleportPriceGems?: number;
    teleportMinTitleBracketId?: number | null;
    // Must be a premium-tier PermissionGroup (the API refuses others).
    teleportMinPremiumGroupId?: number | null;
    teleportRequiresDiscovery?: boolean;
}

export interface DomainDto extends DomainTeleportSettingsDto {
    id?: number;
    name: string;
    description: string;
    createdAt?: string;
    allowEntry?: boolean;
    allowExit?: boolean;
    wgRegionId: string;
    locationId?: number;
    parentDomainId?: number;
    parentDomain?: ParentDomainDto;
}

export interface ParentDomainDto {
    id: number;
    name: string;
    parentDomainId?: number;
    parentDomain?: ParentDomainDto;
    domainSubType: string;
}

// Concrete Domain subtype (Town/District/Structure/...) - lets a picker show "Ironhaven (Town)"
// rather than an ambiguous bare name (docs/specs/items/IMPLEMENTATION_PLAN.md §3.2).
export interface DomainListDto {
    id?: number;
    name: string;
    description: string;
    wgRegionId: string;
    parentDomainId?: number;
    parentDomain?: ParentDomainDto;
    domainType: string;
}
