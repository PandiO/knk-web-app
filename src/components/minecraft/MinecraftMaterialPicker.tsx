import React, { useMemo } from 'react';
import { PagedEntityTable, SelectionConfig } from '../PagedEntityTable/PagedEntityTable';
import { columnDefinitionsRegistry } from '../../config/objectConfigs';

interface MinecraftMaterialPickerProps {
    label: string;
    description?: string;
    value: any | any[] | null;
    onChange: (value: any | any[] | null) => void;
    required?: boolean;
    error?: string;
    categoryFilter?: string;
    disabled?: boolean;
    multiSelect?: boolean;
}

/**
 * The search filters of a material picker for its `categoryFilter` setting (KNG-200 phases 4-5).
 * `Picker: 'true'` makes `POST api/MinecraftMaterialRefs/search` a picker search: database rows
 * only, Missing rows hidden, sorted by display name, with display name and effective icon. It
 * filters on `kind`; a legacy `category` sent too overrides it there (BANNER picks keys with
 * `_banner`). BLOCK picks blocks, ANY everything, and anything else - no setting, ITEM, ICON,
 * BANNER - picks items: item blueprints, menus and icons are items (decision D9).
 */
export const materialPickerFilters = (categoryFilter?: string | null): Record<string, string> => {
    const category = categoryFilter?.trim();
    const filters: Record<string, string> = { Picker: 'true' };
    if (category) {
        filters.category = category;
    }
    switch (category?.toUpperCase()) {
        case 'BLOCK':
            filters.kind = 'block';
            break;
        case 'ANY':
            break;
        default:
            filters.kind = 'item';
    }
    return filters;
};

/**
 * Picks saved Minecraft materials from the database catalogue (filled by a server scan). It used to
 * be the hybrid picker that merged in a static catalogue and saved rows on select; since KNG-200
 * phase 5 every row is a saved one. Stored form fields still use the field type
 * `HybridMinecraftMaterialRefPicker`, which renders this component.
 */
export const MinecraftMaterialPicker: React.FC<MinecraftMaterialPickerProps> = ({
    label,
    description,
    value,
    onChange,
    required = false,
    error,
    categoryFilter,
    disabled = false,
    multiSelect = false
}) => {
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
                entityTypeName="MinecraftMaterialRef"
                columns={columnDefinitionsRegistry.minecraftmaterialref?.default || []}
                initialQuery={{
                    page: 1,
                    pageSize: 10,
                    filters: materialPickerFilters(categoryFilter)
                }}
                selectionConfig={selectionConfig}
                selectedItems={selectedItems}
                onSelectionChange={handleSelectionChange}
                showSelectionBanner={false}
            />

            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>
    );
};
