import React, { useState } from 'react';
import { X, Search, Copy as CopyIcon, Link as LinkIcon } from 'lucide-react';
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                        Select Reusable Section Template
                    </h3>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search by section name or description..."
                            className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        />
                    </div>
                    {currentEntityType && (
                        <p className="mt-2 text-xs text-gray-500">
                            Current entity: <span className="font-medium">{currentEntityType}</span>
                        </p>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {filteredSections.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            {searchTerm ? 'No sections match your search' : 'No reusable section templates available'}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredSections.map(section => (
                                <div
                                    key={section.id}
                                    onClick={() => setSelectedSection(section)}
                                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                        selectedSection?.id === section.id
                                            ? 'border-primary bg-blue-50 ring-2 ring-primary'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium text-gray-900">{section.sectionName}</h4>
                                                {section.isCollection && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                        Collection
                                                    </span>
                                                )}
                                            </div>
                                            {section.description && (
                                                <p className="text-sm text-gray-500 mt-2">{section.description}</p>
                                            )}
                                            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
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
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            How should this template be added?
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center flex-1 p-3 border rounded-lg cursor-pointer transition-all hover:bg-white">
                                <input
                                    type="radio"
                                    name="linkMode"
                                    value={ReuseLinkMode.Copy}
                                    checked={linkMode === ReuseLinkMode.Copy}
                                    onChange={() => setLinkMode(ReuseLinkMode.Copy)}
                                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                                />
                                <div className="ml-3">
                                    <div className="flex items-center">
                                        <CopyIcon className="h-4 w-4 mr-1 text-gray-500" />
                                        <span className="font-medium text-sm">Copy</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Create an independent copy (recommended)
                                    </p>
                                </div>
                            </label>
                            <label className="flex items-center flex-1 p-3 border rounded-lg cursor-pointer transition-all hover:bg-white">
                                <input
                                    type="radio"
                                    name="linkMode"
                                    value={ReuseLinkMode.Link}
                                    checked={linkMode === ReuseLinkMode.Link}
                                    onChange={() => setLinkMode(ReuseLinkMode.Link)}
                                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                                />
                                <div className="ml-3">
                                    <div className="flex items-center">
                                        <LinkIcon className="h-4 w-4 mr-1 text-gray-500" />
                                        <span className="font-medium text-sm">Link</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Link to template (updates with source)
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>
                )}

                <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedSection}
                        className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        Add Section
                    </button>
                </div>
            </div>
        </div>
    );
};

