import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { FormFieldDto } from '../../types/dtos/forms/FormModels';
import { ItemBannerLayerDto } from '../../types/dtos/itemBlueprint/ItemBlueprintDtos';
import { bannerDesignClient } from '../../apiClients/bannerDesignClient';

/**
 * FieldType.BannerLayers (PandiO/knk-workspace#232): the banner pattern layers of a shield blueprint, bottom to
 * top, each a pattern (one of the API's banner pattern keys) and a dye colour. The value is the layer array the API
 * stores and returns (ItemBlueprint.shieldBannerLayers); an item scan of a shield fills it. The shield's base colour
 * is a separate Enum field (ShieldBannerBaseColor).
 */

/** org.bukkit.DyeColor names, the same list the BannerDesign/BannerLayer forms use. */
export const BANNER_DYE_COLORS = [
    'WHITE', 'ORANGE', 'MAGENTA', 'LIGHT_BLUE', 'YELLOW', 'LIME', 'PINK', 'GRAY',
    'LIGHT_GRAY', 'CYAN', 'PURPLE', 'BLUE', 'BROWN', 'GREEN', 'RED', 'BLACK'
];

/**
 * The pattern keys of knk-web-api's BannerPatternKeys, used until GET /api/BannerDesigns/pattern-keys answers (and
 * instead of it when that call fails), so the field works offline and in tests.
 */
export const FALLBACK_BANNER_PATTERN_KEYS = [
    'minecraft:base', 'minecraft:square_bottom_left', 'minecraft:square_bottom_right', 'minecraft:square_top_left',
    'minecraft:square_top_right', 'minecraft:stripe_bottom', 'minecraft:stripe_top', 'minecraft:stripe_left',
    'minecraft:stripe_right', 'minecraft:stripe_center', 'minecraft:stripe_middle', 'minecraft:stripe_downright',
    'minecraft:stripe_downleft', 'minecraft:small_stripes', 'minecraft:cross', 'minecraft:straight_cross',
    'minecraft:triangle_bottom', 'minecraft:triangle_top', 'minecraft:triangles_bottom', 'minecraft:triangles_top',
    'minecraft:diagonal_left', 'minecraft:diagonal_up_right', 'minecraft:diagonal_up_left', 'minecraft:diagonal_right',
    'minecraft:circle', 'minecraft:rhombus', 'minecraft:half_vertical', 'minecraft:half_horizontal',
    'minecraft:half_vertical_right', 'minecraft:half_horizontal_bottom', 'minecraft:border', 'minecraft:curly_border',
    'minecraft:gradient', 'minecraft:gradient_up', 'minecraft:bricks', 'minecraft:globe', 'minecraft:creeper',
    'minecraft:skull', 'minecraft:flower', 'minecraft:mojang', 'minecraft:piglin', 'minecraft:flow', 'minecraft:guster'
];

let cachedPatternKeys: string[] | null = null;

/** The layers a form value holds: only well-formed entries, in order. Anything else (the untouched default) is empty. */
export function toBannerLayers(value: unknown): ItemBannerLayerDto[] {
    if (!Array.isArray(value)) return [];
    return value
        .map(entry => {
            if (!entry || typeof entry !== 'object') return null;
            const { patternKey, color } = entry as { patternKey?: unknown; color?: unknown };
            return typeof patternKey === 'string' && patternKey.trim() !== '' && typeof color === 'string' && color.trim() !== ''
                ? { patternKey: patternKey.trim(), color: color.trim().toUpperCase() }
                : null;
        })
        .filter((layer): layer is ItemBannerLayerDto => layer !== null);
}

const prettyPattern = (key: string) => key.replace(/^minecraft:/, '').replace(/_/g, ' ');
const prettyColor = (color: string) => color.toLowerCase().replace(/_/g, ' ');

interface BannerLayersFieldProps {
    field: FormFieldDto;
    value: unknown;
    onChange: (value: ItemBannerLayerDto[]) => void;
    error?: string;
    onBlur?: () => void;
}

export const BannerLayersField: React.FC<BannerLayersFieldProps> = ({ field, value, onChange, error, onBlur }) => {
    const layers = toBannerLayers(value);
    const [patternKeys, setPatternKeys] = useState<string[]>(cachedPatternKeys ?? FALLBACK_BANNER_PATTERN_KEYS);

    useEffect(() => {
        if (cachedPatternKeys) return;
        let cancelled = false;
        // Any failure (offline, an older API, a test double) leaves the bundled list in place.
        Promise.resolve()
            .then(() => bannerDesignClient.getPatternKeys())
            .then(keys => {
                if (cancelled || !Array.isArray(keys) || keys.length === 0) return;
                cachedPatternKeys = keys;
                setPatternKeys(keys);
            })
            .catch(() => { /* the bundled list stays */ });
        return () => { cancelled = true; };
    }, []);

    const update = (next: ItemBannerLayerDto[]) => onChange(next);
    const setLayer = (index: number, patch: Partial<ItemBannerLayerDto>) =>
        update(layers.map((layer, i) => (i === index ? { ...layer, ...patch } : layer)));
    const move = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= layers.length) return;
        const next = [...layers];
        [next[index], next[target]] = [next[target], next[index]];
        update(next);
    };
    const remove = (index: number) => update(layers.filter((_, i) => i !== index));
    const add = () => update([...layers, { patternKey: patternKeys[0] ?? 'minecraft:base', color: 'WHITE' }]);

    const selectClass = `block w-full rounded-md shadow-sm sm:text-sm ${
        error ? 'border-danger focus:border-danger focus:ring-danger' : 'border-field focus:border-primary focus:ring-primary'
    } ${field.isReadOnly ? 'bg-surface-alt cursor-not-allowed' : ''}`;
    const iconButton = 'p-1.5 rounded-md border border-field hover:bg-surface-alt disabled:opacity-40';

    return (
        <div>
            <label className="block text-sm font-medium text-fg mb-1">
                {field.label}
                {field.isRequired && <span className="text-danger ml-1">*</span>}
            </label>
            {field.description && <p className="text-xs text-muted mb-2">{field.description}</p>}

            {layers.length === 0 ? (
                <p className="text-sm text-muted mb-2">No pattern layers: a plain shield.</p>
            ) : (
                <ol className="space-y-2 mb-2" aria-label={`${field.label} layers, bottom to top`}>
                    {layers.map((layer, index) => {
                        const options = patternKeys.includes(layer.patternKey) ? patternKeys : [layer.patternKey, ...patternKeys];
                        const colors = BANNER_DYE_COLORS.includes(layer.color) ? BANNER_DYE_COLORS : [layer.color, ...BANNER_DYE_COLORS];
                        return (
                            <li key={index} className="flex flex-wrap items-center gap-2 rounded-md border border-line p-2">
                                <span className="text-xs text-muted w-14 shrink-0">Layer {index + 1}</span>
                                <select
                                    aria-label={`Layer ${index + 1} pattern`}
                                    value={layer.patternKey}
                                    onChange={e => setLayer(index, { patternKey: e.target.value })}
                                    onBlur={onBlur}
                                    disabled={field.isReadOnly}
                                    className={`${selectClass} flex-1 min-w-[10rem]`}
                                >
                                    {options.map(key => <option key={key} value={key}>{prettyPattern(key)}</option>)}
                                </select>
                                <select
                                    aria-label={`Layer ${index + 1} colour`}
                                    value={layer.color}
                                    onChange={e => setLayer(index, { color: e.target.value })}
                                    onBlur={onBlur}
                                    disabled={field.isReadOnly}
                                    className={`${selectClass} w-36`}
                                >
                                    {colors.map(color => <option key={color} value={color}>{prettyColor(color)}</option>)}
                                </select>
                                {!field.isReadOnly && (
                                    <span className="inline-flex items-center gap-1">
                                        <button type="button" onClick={() => move(index, -1)} disabled={index === 0}
                                            className={iconButton} aria-label={`Move layer ${index + 1} down (towards the bottom)`} title="Lower layer">
                                            <ArrowUp className="h-4 w-4" />
                                        </button>
                                        <button type="button" onClick={() => move(index, 1)} disabled={index === layers.length - 1}
                                            className={iconButton} aria-label={`Move layer ${index + 1} up (towards the top)`} title="Raise layer">
                                            <ArrowDown className="h-4 w-4" />
                                        </button>
                                        <button type="button" onClick={() => remove(index)}
                                            className="text-danger hover:text-danger-strong hover:bg-danger-muted rounded-full p-1"
                                            aria-label={`Remove layer ${index + 1}`} title="Remove layer">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}

            {!field.isReadOnly && (
                <button type="button" onClick={add} className="btn-secondary inline-flex items-center gap-1 text-sm">
                    <Plus className="h-4 w-4" /> Add layer
                </button>
            )}
            {layers.length > 0 && (
                <p className="mt-1 text-xs text-muted">Layer 1 is the bottom layer, like the first pattern on a loom.</p>
            )}
            {error && <p className="mt-1 text-sm field-error">{error}</p>}
        </div>
    );
};

export default BannerLayersField;
