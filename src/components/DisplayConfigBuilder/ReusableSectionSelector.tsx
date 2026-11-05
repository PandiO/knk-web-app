import React, { useState } from 'react';
import { Search, Copy as CopyIcon, Link as LinkIcon } from 'lucide-react';
import { Dialog } from '../Dialog';
import { DisplaySectionDto, ReuseLinkMode } from '../../types/dtos/displayConfig/DisplayModels';

interface Props {
    reusableSections: DisplaySectionDto[];
    onSelect: (section: DisplaySectionDto, mode: ReuseLinkMode) => void;
    onCancel: () => void;
    currentEntityType?: string;
}

export const ReusableSectionSelector: React.FC<Props> = ({ 
    reusableSections, 
    onSelect, 
    onCancel,
    currentEntityType 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSection, setSelectedSection] = useState<DisplaySectionDto | null>(null);
    const [linkMode, setLinkMode] = useState<ReuseLinkMode>(ReuseLinkMode.Copy);

    const filteredSections = reusableSections.filter(section => {
        const matchesSearch = 
            section.sectionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (section.description || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesSearch;
    });

    const handleConfirm = () => {
        if (selectedSection) {
            onSelect(selectedSection, linkMode);
        }
    };

    return (
        <Dialog
            open
            onClose={onCancel}
            title="Select Reusable Section Template"
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
                        disabled={!selectedSection}
                        className="btn-primary"
                    >
                        Add Section
                    </button>
                </>
            }
        >
            <div className="px-6 py-4 border-b border-line">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search by section name or description..."
                        className="pl-10 block w-full rounded-md border-field shadow-sm focus:border-primary focus:ring-focus sm:text-sm"
                    />
                </div>
                {currentEntityType && (
                    <p className="mt-2 text-xs text-muted">
                        Current entity: <span className="font-medium">{currentEntityType}</span>
                    </p>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
                {filteredSections.length === 0 ? (
                    <div className="text-center py-8 text-muted">
                        {searchTerm ? 'No sections match your search' : 'No reusable section templates available'}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredSections.map(section => (
                            <div
                                key={section.id}
                                role="button"
                                tabIndex={0}
                                aria-pressed={selectedSection?.id === section.id}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedSection(section); } }}
                                onClick={() => setSelectedSection(section)}
                                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                    selectedSection?.id === section.id
                                        ? 'border-primary bg-primary/10 ring-2 ring-primary'
                                        : 'border-line hover:border-field hover:bg-surface-alt'
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-fg">{section.sectionName}</h4>
                                            {section.isCollection && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                    Collection
                                                </span>
                                            )}
                                        </div>
                                        {section.description && (
                                            <p className="text-sm text-muted mt-2">{section.description}</p>
                                        )}
                                        <div className="mt-2 flex items-center gap-4 text-xs text-muted">
                                            <span>{section.fields.length} field{section.fields.length !== 1 ? 's' : ''}</span>
                                            {section.relatedEntityTypeName && (
                                                <span>Related: {section.relatedEntityTypeName}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedSection && (
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

