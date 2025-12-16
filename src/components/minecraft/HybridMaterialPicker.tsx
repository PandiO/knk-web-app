import React, { useMemo } from 'react';
import { PagedEntityTable, SelectionConfig } from '../PagedEntityTable/PagedEntityTable';
import { columnDefinitionsRegistry } from '../../config/objectConfigs';

interface HybridMaterialPickerProps {
    label: string;
    description?: string;
    value: any | any[] | null;
    onChange: (value: any | any[] | null) => void;
    required?: boolean;
    error?: string;
    categoryFilter?: string;
    multiSelect?: boolean;
}

export const HybridMaterialPicker: React.FC<HybridMaterialPickerProps> = ({
    label,
    description,
    value,
    onChange,
    required = false,
    error,
    categoryFilter,
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
        if (multiSelect) {
            // Return full objects array
            onChange(selected);
        } else {
            // Return single full object or null
            onChange(selected.length > 0 ? selected[0] : null);
        }
    };

    return (
        <div className="space-y-2">
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
                    pageSize: 50,
                    filters: categoryFilter ? { category: categoryFilter } : {}
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
