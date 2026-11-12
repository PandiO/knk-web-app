import React, { useState, useRef, useEffect } from 'react';
import { Play, Star, Pencil, StarOff, MoreVertical, Trash2, Download, Upload, CopyPlus } from 'lucide-react';
import { FormConfigurationDto } from '../../types/dtos/forms/FormModels';

interface Props {
    configurations: FormConfigurationDto[];
    onOpen: (config: FormConfigurationDto) => void;
    onSetDefault: (config: FormConfigurationDto) => void;
    onRemoveDefault: (config: FormConfigurationDto) => void;
    onEdit: (config: FormConfigurationDto) => void;
    /** #71: a copy of the published version as a new draft. */
    onDuplicate?: (config: FormConfigurationDto) => void;
    onDelete?: (config: FormConfigurationDto) => void;
    onCreate: () => void;
    onCreateDefault: () => void;
    /** KNG-138: download the configuration as a portable JSON file. */
    onExport?: (config: FormConfigurationDto) => void;
    /** KNG-138: open the import / bundled seeds dialog. */
    onImport?: () => void;
}

export const FormConfigurationTable: React.FC<Props> = ({
    configurations,
    onOpen,
    onSetDefault,
    onRemoveDefault,
    onEdit,
    onDuplicate,
    onDelete,
    onCreate,
    onCreateDefault,
    onExport,
    onImport
}) => {
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
    // A menu item that opens a dialog (a confirm) closes the menu first: focus goes back to the ⋯ button,
    // so the dialog can return it there (#33) instead of to the page.
    const closeMenuToTrigger = (configId: string) => {
        buttonRefs.current[configId]?.focus();
        setActiveMenu(null);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenu(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDeleteClick = (config: FormConfigurationDto) => {
        // The page asks for confirmation (a FeedbackModal), so the menu only hands the config over.
        closeMenuToTrigger(config.id!);
        onDelete?.(config);
    };

    const getMenuPosition = (configId: string) => {
        const button = buttonRefs.current[configId];
        if (!button) return 'bottom';

        const rect = button.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const menuHeight = 200; // approximate menu height

        return spaceBelow < menuHeight ? 'top' : 'bottom';
    };

    return (
        <div className="bg-surface rounded-lg shadow-sm overflow-hidden">
            {/* #266: below sm the title and the buttons stack and the buttons wrap, so the row never grows wider
                than the card (at 390 px the buttons used to be cut off and the page scrolled sideways). */}
            <div className="px-6 py-4 border-b border-line flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-medium text-fg">Available Form Configurations</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={onCreate}
                        className="btn-primary text-sm"
                    >
                        Create Form
                    </button>
                    <button
                        onClick={onCreateDefault}
                        className="btn-secondary text-sm"
                    >
                        Create Form as Default
                    </button>
                    {onImport && (
                        <button
                            onClick={onImport}
                            className="btn-secondary text-sm inline-flex items-center"
                        >
                            <Upload className="h-4 w-4 mr-1" />
                            Import / Seeds
                        </button>
                    )}
                </div>
            </div>
            {configurations.length === 0 ? (
                <div className="text-center py-12 bg-surface">
                    <p className="text-muted">No form configurations found for this entity.</p>
                </div>
            ) : (
                <div className="relative overflow-x-auto">
                    {/* #266: `relative` makes this box the containing block of the head's absolutely positioned
                        sr-only "Actions" label, so the box clips it; without it the label sat at the table's right
                        edge in page coordinates and made the whole page 785 px wide at 390 px. */}
                    <table className="min-w-full table-fixed divide-y divide-line">
                    <thead className="bg-surface-alt">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                                Configuration Name
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-20">
                                Id
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                                Description
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-28">
                                Default
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-32">
                                Created
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider w-32">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-surface divide-y divide-line">
                        {configurations.map((config) => {
                            const menuPosition = activeMenu === config.id ? getMenuPosition(config.id!) : 'bottom';
                            
                            return (
                                <tr key={config.id} className="hover:bg-surface-alt group">
                                    <td 
                                        className="px-6 py-4 text-sm text-fg max-w-xs truncate"
                                        title={config.configurationName}
                                    >
                                        <div className="flex items-center">
                                            <span className="truncate">{config.configurationName}</span>
                                            {config.isDefault && (
                                                <Star className="ml-2 h-4 w-4 text-yellow-400 fill-current flex-shrink-0" />
                                            )}
                                            {/* #71: where the configuration stands; the wizard only uses what is published. */}
                                            {config.isDraft ? (
                                                <span className="ml-2 flex-shrink-0 rounded-full bg-warning-muted px-2 py-0.5 text-xs font-medium text-warning-strong">Draft</span>
                                            ) : config.hasUnpublishedChanges ? (
                                                <span className="ml-2 flex-shrink-0 rounded-full bg-info-muted px-2 py-0.5 text-xs font-medium text-info-strong" title="Saved in the builder, not published yet">Unpublished changes</span>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td 
                                        className="px-6 py-4 text-sm text-muted w-20 truncate"
                                        title={config.id || 'N/A'}
                                    >
                                        {config.id || 'N/A'}
                                    </td>
                                    <td 
                                        className="px-6 py-4 text-sm text-muted max-w-md truncate"
                                        title={config.description || 'N/A'}
                                    >
                                        {config.description || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap w-28">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            config.isDefault
                                                ? 'bg-success-muted text-success-strong'
                                                : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {config.isDefault ? 'Default' : 'Not Default'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted w-32">
                                        {config.createdAt ? new Date(config.createdAt).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium w-32">
                                        <div className="flex items-center justify-end space-x-2">
                                            <button
                                                onClick={() => onOpen(config)}
                                                disabled={config.isDraft}
                                                title={config.isDraft ? 'Publish it in the builder first' : undefined}
                                                className="disabled:opacity-50 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-primary-fg bg-primary hover:bg-primary-dark"
                                            >
                                                <Play className="h-3 w-3 mr-1" />
                                                Use
                                            </button>
                                            <div className="relative">
                                                <button
                                                    ref={(el) => buttonRefs.current[config.id!] = el}
                                                    onClick={() => setActiveMenu(activeMenu === config.id ? null : config.id!)}
                                                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                                    aria-label={`More actions for ${config.configurationName}`}
                                                >
                                                    <MoreVertical className="h-4 w-4 text-muted" />
                                                </button>
                                                {activeMenu === config.id && (
                                                    <div 
                                                        ref={menuRef}
                                                        className={`fixed w-48 rounded-md shadow-lg bg-surface ring-1 ring-black ring-opacity-5 z-50 ${
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
                                                            {!config.isDefault && !config.isDraft && (
                                                                <button
                                                                    onClick={() => {
                                                                        closeMenuToTrigger(config.id!);
                                                                        onSetDefault(config);
                                                                    }}
                                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-surface-alt flex items-center space-x-2"
                                                                    role="menuitem"
                                                                >
                                                                    <Star className="h-4 w-4 text-muted" />
                                                                    <span>Set Default</span>
                                                                </button>
                                                            )} 
                                                            {config.isDefault && (
                                                                <button
                                                                    onClick={() => {
                                                                        closeMenuToTrigger(config.id!);
                                                                        onRemoveDefault(config);
                                                                    }}
                                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-surface-alt flex items-center space-x-2"
                                                                    role="menuitem"
                                                                >
                                                                    <StarOff className="h-4 w-4 text-muted" />
                                                                    <span>Remove as Default</span>
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    closeMenuToTrigger(config.id!);
                                                                    onEdit(config);
                                                                }}
                                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-surface-alt flex items-center space-x-2"
                                                                role="menuitem"
                                                            >
                                                                <Pencil className="h-4 w-4 text-muted" />
                                                                <span>Edit</span>
                                                            </button>
                                                            {onDuplicate && (
                                                                <button
                                                                    onClick={() => {
                                                                        closeMenuToTrigger(config.id!);
                                                                        onDuplicate(config);
                                                                    }}
                                                                    disabled={config.isDraft}
                                                                    title={config.isDraft ? 'Publish it first: a copy starts from the published version.' : undefined}
                                                                    className="w-full text-left px-4 py-2 text-sm text-fg hover:bg-surface-alt flex items-center space-x-2 disabled:opacity-50"
                                                                    role="menuitem"
                                                                >
                                                                    <CopyPlus className="h-4 w-4 text-muted" />
                                                                    <span>Duplicate</span>
                                                                </button>
                                                            )}
                                                            {onExport && (
                                                                <button
                                                                    onClick={() => {
                                                                        closeMenuToTrigger(config.id!);
                                                                        onExport(config);
                                                                    }}
                                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-surface-alt flex items-center space-x-2"
                                                                    role="menuitem"
                                                                >
                                                                    <Download className="h-4 w-4 text-muted" />
                                                                    <span>Export JSON</span>
                                                                </button>
                                                            )}
                                                            {onDelete && (
                                                                <button
                                                                    onClick={() => handleDeleteClick(config)}
                                                                    className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger-soft flex items-center space-x-2"
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
            )}
        </div>
    );
};

