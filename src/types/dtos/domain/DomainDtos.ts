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
    // Rev. 7 Part C (KNG-92): whether this domain's entry rule keeps routes off its roads; null/absent =
    // its type's choice. Same "" / leave-out rules as above.
    roadAccessOverride?: 'Applies' | 'Ignored' | '' | null;
}

/**
 * The fields every domain type has (knk-web-api `Models/Domain.cs`). A landmark is a domain too (landmark-domain DESIGN
 * § 6.3 item 1, PandiO/knk-workspace#986) and builds on this base, with an optional region (LD02, LD11) and its own
 * parent shape; the other types keep the required region of {@link DomainDto}.
 */
export interface DomainBaseDto extends DomainTeleportSettingsDto {
    id?: number;
    name: string;
    description?: string | null;
    createdAt?: string;
    allowEntry?: boolean;
    allowExit?: boolean;
    /** The main WorldGuard region; null for a landmark without its own region. */
    wgRegionId?: string | null;
    /** KNG-111: the Minecraft world of the domain and its region. */
    worldName?: string | null;
    locationId?: number | null;
    /** KNG-254: the domain's sub-regions (read-only here; saved through DomainSubRegionClient). */
    subRegions?: DomainSubRegionDto[] | null;
}

export interface DomainDto extends DomainBaseDto, DomainNavigationDefaultSettingsDto {
    description: string;
    wgRegionId: string;
    locationId?: number;
    parentDomainId?: number;
    parentDomain?: ParentDomainDto;
    subRegions?: DomainSubRegionDto[];
}

/**
 * One of a domain's extra WorldGuard regions (KNG-254, knk-workspace docs/specs/domain-subregions/DESIGN.md). Drawn
 * through its own world task; the API renames it to domain_<domainId>_sub_<id> when it is saved.
 */
export interface DomainSubRegionDto {
    id?: number;
    domainId: number;
    wgRegionId: string;
    name?: string | null;
    createdAt?: string;
}

export interface ParentDomainDto {
    id: number;
    name: string;
    parentDomainId?: number;
    parentDomain?: ParentDomainDto;
    domainSubType: string;
}

// Concrete Domain subtype (Town/District/Structure/GateStructure/Landmark/...) - lets a picker show "Ironhaven (Town)"
// rather than an ambiguous bare name (docs/specs/items/IMPLEMENTATION_PLAN.md §3.2). A landmark row has no region when
// it has none of its own (landmark-domain LD02).
export interface DomainListDto {
    id?: number;
    name: string;
    description: string;
    wgRegionId: string | null;
    /** KNG-111: the Minecraft world of the domain and its region. */
    worldName?: string | null;
    parentDomainId?: number;
    parentDomain?: ParentDomainDto;
    domainType: string;
    // The effective /navigate default (the domain's override, else its type's) - what the game server uses.
    navigationDefault?: 'Spawn' | 'Region';
    // The effective road access (the domain's override, else its type's) - what the game server's router uses.
    roadAccess?: 'Applies' | 'Ignored';
}
