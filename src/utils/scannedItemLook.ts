import { ItemBannerLayerDto } from '../types/dtos/itemBlueprint/ItemBlueprintDtos';

/**
 * The look an ItemScan / KitScan result offers for an item blueprint (PandiO/knk-workspace#232).
 *
 * The plugin's scan sends `shieldBanner` ({ baseColor, layers: [{ patternKey, color }] }, layers bottom to
 * top; baseColor null for a banner item) only for a shield or banner with a pattern, and `armorTrim`
 * ({ pattern, material }) only for trimmed armour. Anything else, and a plugin from before #232, sends
 * neither: the blueprint then keeps whatever the form holds.
 */
export interface ScannedShieldBanner {
    baseColor: string | null;
    layers: ItemBannerLayerDto[];
}

export interface ScannedArmorTrim {
    pattern: string;
    material: string;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

export function scannedShieldBanner(scan: unknown): ScannedShieldBanner | null {
    if (!scan || typeof scan !== 'object') return null;
    const banner = (scan as { shieldBanner?: unknown }).shieldBanner;
    if (!banner || typeof banner !== 'object') return null;
    const { baseColor, layers } = banner as { baseColor?: unknown; layers?: unknown };
    const parsedLayers: ItemBannerLayerDto[] = (Array.isArray(layers) ? layers : [])
        .map(layer => {
            if (!layer || typeof layer !== 'object') return null;
            const patternKey = text((layer as { patternKey?: unknown }).patternKey);
            const color = text((layer as { color?: unknown }).color);
            return patternKey && color ? { patternKey, color } : null;
        })
        .filter((layer): layer is ItemBannerLayerDto => layer !== null);
    const parsedBase = text(baseColor);
    if (!parsedBase && parsedLayers.length === 0) return null;
    return { baseColor: parsedBase, layers: parsedLayers };
}

export function scannedArmorTrim(scan: unknown): ScannedArmorTrim | null {
    if (!scan || typeof scan !== 'object') return null;
    const trim = (scan as { armorTrim?: unknown }).armorTrim;
    if (!trim || typeof trim !== 'object') return null;
    const pattern = text((trim as { pattern?: unknown }).pattern);
    const material = text((trim as { material?: unknown }).material);
    return pattern && material ? { pattern, material } : null;
}

/** "RED | stripe_top:YELLOW, border:BLACK" - the layers as one readable line (conflict prompts, details). */
export function describeShieldBanner(baseColor: string | null | undefined, layers: ItemBannerLayerDto[] | undefined): string {
    const layerText = (layers ?? []).map(l => `${l.patternKey.replace(/^minecraft:/, '')}:${l.color}`).join(', ');
    if (!baseColor && !layerText) return '(none)';
    return `${baseColor ?? 'banner'} | ${layerText || 'no layers'}`;
}
