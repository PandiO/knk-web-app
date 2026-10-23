import React, { useEffect, useMemo, useState } from 'react';
import { PagedEntityTable, SelectionConfig } from '../PagedEntityTable/PagedEntityTable';
import { columnDefinitionsRegistry } from '../../config/objectConfigs';

/** Which enchantments the picker lists: every one, only vanilla (and data-pack) ones, or only knk custom ones. */
export type EnchantmentOriginFilter = 'all' | 'vanilla' | 'custom';

const ORIGIN_OPTIONS: { value: EnchantmentOriginFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'vanilla', label: 'Vanilla' },
    { value: 'custom', label: 'Custom' }
];

/** The `originFilter` setting as a filter; anything else (missing, unknown) is `all`. */
export const parseOriginFilter = (value: unknown): EnchantmentOriginFilter => {
    const origin = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return origin === 'vanilla' || origin === 'custom' ? origin : 'all';
};

/**
 * The search filters of the enchantment picker (KNG-250, IMPLEMENTATION_PLAN §12.5). `Picker: 'true'`
 * makes `POST api/MinecraftEnchantmentRefs/search` a picker search on the database: Missing rows
 * hidden, sorted by display name. `origin` narrows it to vanilla or custom enchantments (absent =
 * all), and the legacy `categoryFilter` setting still sends `category`.
 */
export const enchantmentPickerFilters = (origin: EnchantmentOriginFilter, categoryFilter?: string | null): Record<string, string> => {
    const filters: Record<string, string> = { Picker: 'true' };
    if (origin !== 'all') {
        filters.origin = origin;
    }
    const category = categoryFilter?.trim();
    if (category) {
        filters.category = category;
    }
    return filters;
};

interface MinecraftEnchantmentPickerProps {
    label: string;
    description?: string;
    value: any | any[] | null;
    onChange: (value: any | any[] | null) => void;
    required?: boolean;
    error?: string;
    categoryFilter?: string;
    /** Initial All / Vanilla / Custom filter (the field's `originFilter` setting). */
    originFilter?: EnchantmentOriginFilter;
    disabled?: boolean;
    multiSelect?: boolean;
}

/**
 * Picks saved Minecraft enchantments, vanilla and knk custom ones together, from the database
 * catalogue a server scan fills (KNG-250). It replaces the hybrid picker that merged in a static
 * catalogue and created the ref and its EnchantmentDefinition on select: the scan now makes sure
 * every enchantment has both, so picking a row only selects it. Stored form fields still use the
 * field type `HybridMinecraftEnchantmentRefPicker`, which renders this component.
 */
export const MinecraftEnchantmentPicker: React.FC<MinecraftEnchantmentPickerProps> = ({
    label,
    description,
    value,
    onChange,
    required = false,
    error,
    categoryFilter,
    originFilter,
    disabled = false,
    multiSelect = false
}) => {
    const [origin, setOrigin] = useState<EnchantmentOriginFilter>(() => parseOriginFilter(originFilter));

    useEffect(() => {
        setOrigin(parseOriginFilter(originFilter));
    }, [originFilter]);

    const selectionConfig: SelectionConfig = {
        mode: multiSelect ? 'multiple' : 'single'
    };

    const selectedItems = useMemo(() => {
        if (!value) return [];

        // Handle both array and single values
        const items = Array.isArray(value) ? value : [value];

        // Map to objects, handling both full objects and plain IDs
        return items.map(item => {
            if (typeof item === 'object' && item !== null) {
                // Already an object with properties
                return item;
            } else {
                // Just an ID - create minimal object
                return { id: item };
            }
        });
    }, [value]);

    const handleSelectionChange = (selected: any[]) => {
        if (disabled) return;

        if (multiSelect) {
            // Return full objects array
            onChange(selected);
        } else {
            // Return single full object or null
            onChange(selected.length > 0 ? selected[0] : null);
        }
    };

    const originControl = (
        <div role="group" aria-label="Enchantment origin" className="inline-flex rounded-md shadow-sm">
            {ORIGIN_OPTIONS.map((option, index) => {
                const active = origin === option.value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        disabled={disabled}
                        onClick={() => setOrigin(option.value)}
                        className={`px-3 py-1.5 text-sm font-medium border ${
                            index === 0 ? 'rounded-l-md' : '-ml-px'
                        } ${index === ORIGIN_OPTIONS.length - 1 ? 'rounded-r-md' : ''} ${
                            active
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className={`space-y-2 ${disabled ? 'pointer-events-none' : ''}`} aria-disabled={disabled}>
            <div>
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
            </div>

            <PagedEntityTable
                // Remount when the origin filter changes - the table reads initialQuery once.
                key={origin}
                entityTypeName="MinecraftEnchantmentRef"
                columns={columnDefinitionsRegistry.minecraftenchantmentref?.default || []}
                initialQuery={{
                    page: 1,
                    pageSize: 10,
                    filters: enchantmentPickerFilters(origin, categoryFilter)
                }}
                selectionConfig={selectionConfig}
                selectedItems={selectedItems}
                onSelectionChange={handleSelectionChange}
                showSelectionBanner={false}
                toolbarActions={originControl}
            />

            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>
    );
};

export default MinecraftEnchantmentPicker;
