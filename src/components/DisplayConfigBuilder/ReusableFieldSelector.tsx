import React, { useState } from 'react';
import { Search, Copy as CopyIcon, Link as LinkIcon } from 'lucide-react';
import { Dialog } from '../Dialog';
import { DisplayFieldDto, ReuseLinkMode } from '../../types/dtos/displayConfig/DisplayModels';

interface Props {
    reusableFields: DisplayFieldDto[];
    onSelect: (field: DisplayFieldDto, mode: ReuseLinkMode) => void;
    onCancel: () => void;
}

export const ReusableFieldSelector: React.FC<Props> = ({ 
    reusableFields, 
    onSelect, 
    onCancel 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedField, setSelectedField] = useState<DisplayFieldDto | null>(null);
    const [linkMode, setLinkMode] = useState<ReuseLinkMode>(ReuseLinkMode.Copy);
    const [filterType, setFilterType] = useState<string>('all');

    const filteredFields = reusableFields.filter(field => {
        const matchesSearch = 
            (field.fieldName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            field.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (field.description || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesType = filterType === 'all' || field.fieldType === filterType;
        
        return matchesSearch && matchesType;
    });

    const uniqueFieldTypes = Array.from(new Set(reusableFields.map(f => f.fieldType).filter(Boolean)));

    const handleConfirm = () => {
        if (selectedField) {
            onSelect(selectedField, linkMode);
        }
    };

    return (
        <Dialog
            open
            onClose={onCancel}
            title="Select Reusable Field Template"
            size="3xl"
            bodyClassName="flex flex-col p-0"
            footer={
                <>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="btn-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!selectedField}
                        className="btn-primary"
                    >
                        Add Field
                    </button>
                </>
            }
        >
            <div className="px-6 py-4 border-b border-line space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search by field name, label, or description..."
                        className="pl-10 block w-full rounded-md border-field shadow-sm focus:border-primary focus:ring-focus sm:text-sm"
                    />
                </div>
                {uniqueFieldTypes.length > 1 && (
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-fg">Filter by type:</label>
                        <select
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                            className="rounded-md border-field shadow-sm focus:border-primary focus:ring-focus text-sm"
                        >
                            <option value="all">All Types</option>
                            {uniqueFieldTypes.map(type => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
                {filteredFields.length === 0 ? (
                    <div className="text-center py-8 text-muted">
                        {searchTerm || filterType !== 'all' ? 'No fields match your filters' : 'No reusable field templates available'}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredFields.map(field => (
                            <div
                                key={field.id}
                                role="button"
                                tabIndex={0}
                                aria-pressed={selectedField?.id === field.id}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedField(field); } }}
                                onClick={() => setSelectedField(field)}
                                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                    selectedField?.id === field.id
                                        ? 'border-primary bg-primary/10 ring-2 ring-primary'
                                        : 'border-line hover:border-field hover:bg-surface-alt'
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-fg">{field.label}</h4>
                                            {field.fieldType && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-alt text-fg">
                                                    {field.fieldType}
                                                </span>
                                            )}
                                        </div>
                                        {field.fieldName && (
                                            <p className="text-sm text-muted mt-1">{field.fieldName}</p>
                                        )}
                                        {field.description && (
                                            <p className="text-sm text-muted mt-2">{field.description}</p>
                                        )}
                                        {field.templateText && (
                                            <p className="text-xs text-muted mt-1 font-mono bg-surface-alt p-1 rounded">
                                                {field.templateText}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedField && (
                <div className="px-6 py-4 border-t border-line bg-surface-alt">
                    <label className="block text-sm font-medium text-fg mb-2">
                        How should this template be added?
                    </label>
                    <div className="flex gap-4">
                        <label className="flex items-center flex-1 p-3 border rounded-lg cursor-pointer transition-all hover:bg-surface">
                            <input
                                type="radio"
                                name="linkMode"
                                value={ReuseLinkMode.Copy}
                                checked={linkMode === ReuseLinkMode.Copy}
                                onChange={() => setLinkMode(ReuseLinkMode.Copy)}
                                className="h-4 w-4 text-primary focus:ring-primary border-field"
                            />
                            <div className="ml-3">
                                <div className="flex items-center">
                                    <CopyIcon className="h-4 w-4 mr-1 text-muted" />
                                    <span className="font-medium text-sm">Copy</span>
                                </div>
                                <p className="text-xs text-muted mt-1">
                                    Create an independent copy (recommended)
                                </p>
                            </div>
                        </label>
                        <label className="flex items-center flex-1 p-3 border rounded-lg cursor-pointer transition-all hover:bg-surface">
                            <input
                                type="radio"
                                name="linkMode"
                                value={ReuseLinkMode.Link}
                                checked={linkMode === ReuseLinkMode.Link}
                                onChange={() => setLinkMode(ReuseLinkMode.Link)}
                                className="h-4 w-4 text-primary focus:ring-primary border-field"
                            />
                            <div className="ml-3">
                                <div className="flex items-center">
                                    <LinkIcon className="h-4 w-4 mr-1 text-muted" />
                                    <span className="font-medium text-sm">Link</span>
                                </div>
                                <p className="text-xs text-muted mt-1">
                                    Link to template (updates with source)
                                </p>
                            </div>
                        </label>
                    </div>
                </div>
            )}

        </Dialog>
    );
};

