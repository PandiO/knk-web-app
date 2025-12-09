import React, { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, CheckCircle, PlusCircle, AlertCircle } from 'lucide-react';
import { MinecraftHybridMaterialOptionDto } from '../../utils/domain/dto/minecraftMaterialRef/MinecraftHybridMaterialOptionDto';
import { minecraftMaterialRefClient } from '../../apiClients/minecraftMaterialRefClient';

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

const searchDebounceMs = 250;

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
    const [options, setOptions] = useState<MinecraftHybridMaterialOptionDto[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [creatingKey, setCreatingKey] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const selectedIds: number[] = useMemo(() => {
        if (multiSelect) {
            return Array.isArray(value) ? value.filter(v => v !== null && v !== undefined) as number[] : [];
        }
        if (value === null || value === undefined) return [];
        return [value as number];
    }, [value, multiSelect]);

    useEffect(() => {
        let active = true;
        const timer = setTimeout(async () => {
            setLoading(true);
            setActionError(null);
            try {
                const result = await minecraftMaterialRefClient.getHybridOptions({
                    search: searchTerm || '',
                    category: categoryFilter || '',
                });
                if (active) {
                    setOptions(result || []);
                }
            } catch (err: any) {
                if (active) {
                    setActionError(err?.message || 'Failed to load materials');
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }, searchDebounceMs);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [searchTerm, categoryFilter]);

    const handlePersistedSelect = (id: number | null) => {
        if (!multiSelect) {
            onChange(id);
            return;
        }

        if (id === null || id === undefined) return;
        const alreadySelected = selectedIds.includes(id);
        const next = alreadySelected
            ? selectedIds.filter(existing => existing !== id)
            : [...selectedIds, id];
        onChange(next);
    };

    const handleCreateAndSelect = async (option: MinecraftHybridMaterialOptionDto) => {
        if (creatingKey) return;
        setCreatingKey(option.namespaceKey);
        setActionError(null);
        try {
            const created = await minecraftMaterialRefClient.create({
                namespaceKey: option.namespaceKey,
                category: option.category,
                legacyName: option.legacyName
            });

            const createdId = created?.id ?? null;
            setOptions(prev => prev.map(o =>
                o.namespaceKey === option.namespaceKey
                    ? { ...o, id: createdId, isPersisted: true }
                    : o
            ));

            if (createdId !== null) {
                handlePersistedSelect(createdId);
            }
        } catch (err: any) {
            setActionError(err?.message || 'Failed to create material');
        } finally {
            setCreatingKey(null);
        }
    };

    const renderBadge = (isPersisted: boolean) => {
        if (isPersisted) {
            return (
                <span className="inline-flex items-center text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Existing
                </span>
            );
        }
        return (
            <span className="inline-flex items-center text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <PlusCircle className="h-3 w-3 mr-1" />
                New
            </span>
        );
    };

    const renderCard = (option: MinecraftHybridMaterialOptionDto) => {
        const isSelected = option.id ? selectedIds.includes(option.id) : false;
        const selecting = creatingKey === option.namespaceKey;

        const handleClick = () => {
            if (option.isPersisted) {
                handlePersistedSelect(option.id ?? null);
            } else {
                handleCreateAndSelect(option);
            }
        };

        return (
            <button
                key={option.namespaceKey}
                type="button"
                onClick={handleClick}
                disabled={selecting}
                className={`w-full text-left border rounded-lg p-3 hover:border-primary hover:shadow-sm transition relative ${
                    isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'
                } ${selecting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{option.displayName}</p>
                        <p className="text-xs text-gray-500 truncate">{option.namespaceKey}</p>
                        <p className="text-[11px] text-gray-400 uppercase tracking-wide">{option.category}</p>
                    </div>
                    {renderBadge(option.isPersisted)}
                </div>
                {!option.isPersisted && (
                    <p className="mt-2 text-xs text-gray-500">Will be created and linked on select.</p>
                )}
                {selecting && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-lg">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                )}
            </button>
        );
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

            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                    type="search"
                    placeholder="Search materials"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary text-sm"
                />
            </div>

            {actionError && (
                <div className="flex items-start text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                    <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                    <span>{actionError}</span>
                </div>
            )}

            <div className="min-h-[120px] border border-gray-200 rounded-lg p-3 bg-gray-50">
                {loading ? (
                    <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Loading materials...
                    </div>
                ) : options.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No materials match your search.</p>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {options.map(renderCard)}
                    </div>
                )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    );
};
