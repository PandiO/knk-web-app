import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { MinecraftHybridEnchantmentOptionDto } from '../../types/dtos/minecraftEnchantmentRef/MinecraftHybridEnchantmentOptionDto';
import { MinecraftEnchantmentRefDto } from '../../types/dtos/minecraftEnchantmentRef/MinecraftEnchantmentRefDto';
import { MinecraftEnchantmentRefClient } from '../../apiClients/minecraftEnchantmentRefClient';

interface HybridEnchantmentPickerProps {
    label: string;
    description?: string;
    value: MinecraftEnchantmentRefDto | null;
    onChange: (value: MinecraftEnchantmentRefDto | null) => void;
    required?: boolean;
    error?: string;
    categoryFilter?: string;
    placeholder?: string;
    disabled?: boolean;
}

export const HybridEnchantmentPicker: React.FC<HybridEnchantmentPickerProps> = ({
    label,
    description,
    value,
    onChange,
    required = false,
    error,
    categoryFilter,
    placeholder = 'Select an enchantment...',
    disabled = false
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isPersisting, setIsPersisting] = useState(false);
    const [errorState, setErrorState] = useState<string | null>(null);
    const [options, setOptions] = useState<MinecraftHybridEnchantmentOptionDto[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const client = MinecraftEnchantmentRefClient.getInstance();

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Fetch hybrid options when dropdown opens or search changes
    const fetchOptions = useCallback(async (search?: string) => {
        try {
            setIsLoading(true);
            setErrorState(null);
            const fetchedOptions = await client.getHybrid(search, categoryFilter);
            setOptions(fetchedOptions);
        } catch (err) {
            setErrorState('Failed to load enchantments');
            console.error('Error fetching hybrid enchantments:', err);
        } finally {
            setIsLoading(false);
        }
    }, [client, categoryFilter]);

    // Load options when dropdown opens
    useEffect(() => {
        if (isOpen) {
            fetchOptions(searchTerm);
        }
    }, [isOpen, fetchOptions, searchTerm]);

    // Handle search with debouncing
    const handleSearch = useCallback((newSearchTerm: string) => {
        setSearchTerm(newSearchTerm);
    }, []);

    // Handle option selection
    const handleSelect = useCallback(async (option: MinecraftHybridEnchantmentOptionDto | null) => {
        if (!option) {
            onChange(null);
            setIsOpen(false);
            return;
        }

        try {
            setIsPersisting(true);
            setErrorState(null);

            if (option.type === 'PERSISTED') {
                const selected: MinecraftEnchantmentRefDto = {
                    id: option.id ?? undefined,
                    namespaceKey: option.namespaceKey,
                    legacyName: option.legacyName,
                    category: option.category,
                    iconUrl: option.iconUrl,
                    maxLevel: option.maxLevel,
                    displayName: option.displayName,
                    isCustom: option.isCustom
                };
                onChange(selected);
            } else {
                const persisted = await client.persistFromCatalog(option.namespaceKey, option.category ?? undefined, option.legacyName ?? undefined);
                onChange(persisted);
                fetchOptions(searchTerm);
            }

            setIsOpen(false);
        } catch (err) {
            setErrorState(`Failed to select enchantment: ${err instanceof Error ? err.message : 'Unknown error'}`);
            console.error('Error selecting enchantment:', err);
        } finally {
            setIsPersisting(false);
        }
    }, [client, onChange, fetchOptions, searchTerm]);

    const renderOptionLabel = useCallback((option: MinecraftHybridEnchantmentOptionDto) => {
        return option.displayName || option.legacyName || option.namespaceKey;
    }, []);

    const selectedLabel = useMemo(() => {
        if (!value) return placeholder;
        return value.displayName || value.legacyName || value.namespaceKey || placeholder;
    }, [value, placeholder]);

    const displayError = error || errorState;

    return (
        <div className="space-y-2" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {description && <p className="text-sm text-gray-500 mb-2">{description}</p>}
            {displayError && (
                <div className="text-red-600 text-sm mb-2">{displayError}</div>
            )}

            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(prev => !prev)}
                    disabled={disabled || isPersisting}
                    className={`w-full px-3 py-2 border rounded-md text-left flex items-center justify-between ${
                        disabled || isPersisting ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:bg-gray-50'
                    } ${displayError ? 'border-red-500' : 'border-gray-300'}`}
                >
                    <span className={value ? 'text-gray-900' : 'text-gray-500'}>
                        {selectedLabel}
                    </span>
                    {(isLoading || isPersisting) && <span className="ml-2">⏳</span>}
                </button>

                {isOpen && !disabled && !isPersisting && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        <div className="p-2 border-b">
                            <input
                                type="text"
                                placeholder="Search enchantments..."
                                value={searchTerm}
                                onChange={e => handleSearch(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                autoFocus
                            />
                        </div>

                        {isLoading ? (
                            <div className="p-4 text-center text-gray-500">Loading...</div>
                        ) : options.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">No enchantments found</div>
                        ) : (
                            <ul className="py-1">
                                {value && (
                                    <li
                                        onClick={() => handleSelect(null)}
                                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-gray-500 border-b"
                                    >
                                        Clear selection
                                    </li>
                                )}
                                {options.map(option => (
                                    <li
                                        key={option.namespaceKey}
                                        onClick={() => handleSelect(option)}
                                        className={`px-3 py-2 hover:bg-blue-50 cursor-pointer ${
                                            value?.namespaceKey === option.namespaceKey ? 'bg-blue-100' : ''
                                        }`}
                                    >
                                        <div className="font-medium">{renderOptionLabel(option)}</div>
                                        {option.category && (
                                            <div className="text-xs text-gray-500">Category: {option.category}</div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>

            {value && (
                <div className="mt-2 text-sm text-gray-600">
                    {value.category && <span className="mr-3">Category: {value.category}</span>}
                    {value.maxLevel && <span>Max Level: {value.maxLevel}</span>}
                </div>
            )}
        </div>
    );
};

export default HybridEnchantmentPicker;
