// Siege Phase 1 - mirrors knk-web-api Dtos/ClanDtos.cs (docs/specs/siege-minigame/DESIGN.md §3.1-3.2).

// org.bukkit.DyeColor names.
export type BannerDyeColor =
    | 'WHITE' | 'ORANGE' | 'MAGENTA' | 'LIGHT_BLUE' | 'YELLOW' | 'LIME' | 'PINK' | 'GRAY'
    | 'LIGHT_GRAY' | 'CYAN' | 'PURPLE' | 'BLUE' | 'BROWN' | 'GREEN' | 'RED' | 'BLACK';

export interface BannerLayerDto {
    id?: number;
    bannerDesignId: number;
    sortOrder?: number;
    patternKey: string;
    color: BannerDyeColor;
}

export interface BannerDesignDto {
    id?: number;
    name: string;
    baseColor: BannerDyeColor;
    // Bottom -> top. Read-only here: layers are created/edited through the layer endpoints.
    layers?: BannerLayerDto[];
    exceedsSurvivalLoomLimit?: boolean;
}

export interface BannerDesignListDto {
    id: number;
    name: string;
    baseColor: BannerDyeColor;
    layerCount: number;
}

export interface ClanDto {
    id?: number;
    name: string;
    isNpc: boolean;
    chatColor: string;
    bannerDesignId: number;
    bannerDesign?: BannerDesignDto;
    defaultForTownId?: number | null;
    defaultForTownName?: string | null;
}

export interface ClanListDto {
    id: number;
    name: string;
    isNpc: boolean;
    chatColor: string;
    bannerDesignId: number;
    bannerDesignName?: string | null;
    defaultForTownId?: number | null;
    defaultForTownName?: string | null;
}
