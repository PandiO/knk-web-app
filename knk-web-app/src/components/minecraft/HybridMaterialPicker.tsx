import React, { useMemo } from 'react';
import { PagedEntityTable, SelectionConfig } from '../PagedEntityTable/PagedEntityTable';
import { columnDefinitionsRegistry } from '../../config/objectConfigs';

interface HybridMaterialPickerProps {
    label: string;
    description?: string;
    value: number | number[] | null;
    onChange: (value: number | number[] | null) => void;
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
        const ids = Array.isArray(value) ? value : [value];
        return ids.map(id => ({ id }));
    }, [value]);

    const handleSelectionChange = (selected: any[]) => {
        if (multiSelect) {
            onChange(selected.map(item => item.id));
        } else {
            onChange(selected.length > 0 ? selected[0].id : null);
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
