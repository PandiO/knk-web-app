import React, { useEffect, useRef, useState } from 'react';
import { Eye, MoreVertical, Pencil, Rocket, Star, StarOff, Trash2 } from 'lucide-react';
import { DisplayConfigurationDto } from '../../utils/domain/dto/displayConfig/DisplayModels';

interface Props {
    configurations: DisplayConfigurationDto[];
    onEdit: (config: DisplayConfigurationDto) => void;
    onSetDefault: (config: DisplayConfigurationDto) => void;
    onRemoveDefault: (config: DisplayConfigurationDto) => void;
    onPublish?: (config: DisplayConfigurationDto) => void;
    onDelete?: (config: DisplayConfigurationDto) => void;
}

export const DisplayConfigurationTable: React.FC<Props> = ({
    configurations,
    onEdit,
    onSetDefault,
    onRemoveDefault,
    onPublish,
    onDelete
}) => {
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenu(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDeleteClick = (config: DisplayConfigurationDto) => {
        if (confirm(`Are you sure you want to delete "${config.name}"?`)) {
            onDelete?.(config);
            setActiveMenu(null);
        }
    };

    const getMenuPosition = (configId: string) => {
        const button = buttonRefs.current[configId];
        if (!button) return 'bottom';

        const rect = button.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const menuHeight = 200;

        return spaceBelow < menuHeight ? 'top' : 'bottom';
    };

    if (configurations.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <p className="text-gray-500">No display configurations found for this entity.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">Display Configurations</h2>
                <span className="text-xs text-gray-500">{configurations.length} total</span>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full table-fixed divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Name
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                                Id
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Description
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                                Default
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                                Draft
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                                Created
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {configurations.map((config) => {
                            const menuPosition = activeMenu === config.id ? getMenuPosition(config.id!) : 'bottom';

                            return (
                                <tr key={config.id} className="hover:bg-gray-50 group">
                                    <td
                                        className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate"
                                        title={config.name}
                                    >
                                        <div className="flex items-center">
                                            <span className="truncate">{config.name}</span>
                                            {config.isDefault && (
                                                <Star className="ml-2 h-4 w-4 text-yellow-400 fill-current flex-shrink-0" />
                                            )}
                                        </div>
                                    </td>
                                    <td
                                        className="px-6 py-4 text-sm text-gray-500 w-24 truncate"
                                        title={config.id || 'N/A'}
                                    >
                                        {config.id || 'N/A'}
                                    </td>
                                    <td
                                        className="px-6 py-4 text-sm text-gray-500 max-w-md truncate"
                                        title={config.description || 'N/A'}
                                    >
                                        {config.description || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap w-28">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            config.isDefault
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {config.isDefault ? 'Default' : 'Not Default'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap w-20">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            config.isDraft
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-green-50 text-green-800'
                                        }`}>
                                            {config.isDraft ? 'Draft' : 'Published'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 w-32">
                                        {config.createdAt ? new Date(config.createdAt).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium w-28">
                                        <div className="flex items-center justify-end space-x-2">
                                            <button
                                                onClick={() => onEdit(config)}
                                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-primary hover:bg-primary-dark"
                                            >
                                                <Pencil className="h-3 w-3 mr-1" />
                                                Edit
                                            </button>
                                            <div className="relative">
                                                <button
                                                    ref={(el) => buttonRefs.current[config.id!] = el}
                                                    onClick={() => setActiveMenu(activeMenu === config.id ? null : config.id!)}
                                                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                                >
                                                    <MoreVertical className="h-4 w-4 text-gray-400" />
                                                </button>
                                                {activeMenu === config.id && (
                                                    <div
                                                        ref={menuRef}
                                                        className={`fixed w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 ${
                                                            menuPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                                                        }`}
                                                        style={{
                                                            left: buttonRefs.current[config.id!]?.getBoundingClientRect().right! - 192 + 'px',
                                                            top: menuPosition === 'bottom'
                                                                ? buttonRefs.current[config.id!]?.getBoundingClientRect().bottom! + 'px'
                                                                : 'auto',
                                                            bottom: menuPosition === 'top'
                                                                ? (window.innerHeight - buttonRefs.current[config.id!]?.getBoundingClientRect().top!) + 'px'
                                                                : 'auto'
                                                        }}
                                                    >
                                                        <div className="py-1" role="menu">
                                                            {!config.isDefault && (
                                                                <button
                                                                    onClick={() => {
                                                                        onSetDefault(config);
                                                                        setActiveMenu(null);
                                                                    }}
                                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                                                    role="menuitem"
                                                                >
                                                                    <Star className="h-4 w-4 text-gray-400" />
                                                                    <span>Set Default</span>
                                                                </button>
                                                            )}
                                                            {config.isDefault && (
                                                                <button
                                                                    onClick={() => {
                                                                        onRemoveDefault(config);
                                                                        setActiveMenu(null);
                                                                    }}
                                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                                                    role="menuitem"
                                                                >
                                                                    <StarOff className="h-4 w-4 text-gray-400" />
                                                                    <span>Remove Default</span>
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    onEdit(config);
                                                                    setActiveMenu(null);
                                                                }}
                                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                                                role="menuitem"
                                                            >
                                                                <Eye className="h-4 w-4 text-gray-400" />
                                                                <span>Open in Builder</span>
                                                            </button>
                                                            {config.isDraft && onPublish && (
                                                                <button
                                                                    onClick={() => {
                                                                        onPublish(config);
                                                                        setActiveMenu(null);
                                                                    }}
                                                                    className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center space-x-2"
                                                                    role="menuitem"
                                                                >
                                                                    <Rocket className="h-4 w-4" />
                                                                    <span>Publish</span>
                                                                </button>
                                                            )}
                                                            {onDelete && (
                                                                <button
                                                                    onClick={() => handleDeleteClick(config)}
                                                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                                                                    role="menuitem"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    <span>Delete</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
