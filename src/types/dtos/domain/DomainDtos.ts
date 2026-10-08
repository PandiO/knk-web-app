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

// Where `/navigate <domain>` leads when the player names no mode (KNG-73, docs/specs/navigation
// DESIGN.md §6.1). The domain's own choice on its form; null/absent = its type's default (set on
// the road admin page). Sending "" (or "TypeDefault") clears it; leaving the field out keeps it.
export interface DomainNavigationDefaultSettingsDto {
    navigationDefaultOverride?: 'Spawn' | 'Region' | '' | null;
}

export interface DomainDto extends DomainTeleportSettingsDto, DomainNavigationDefaultSettingsDto {
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
    // The effective /navigate default (the domain's override, else its type's) - what the game server uses.
    navigationDefault?: 'Spawn' | 'Region';
}
