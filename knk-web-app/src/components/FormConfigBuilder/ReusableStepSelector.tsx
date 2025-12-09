import React, { useState } from 'react';
import { X, Search, Copy as CopyIcon, Link as LinkIcon } from 'lucide-react';
import { FormStepDto, ReuseLinkMode } from '../../utils/domain/dto/forms/FormModels';

interface Props {
    reusableSteps: FormStepDto[];
    onSelect: (step: FormStepDto, mode: ReuseLinkMode) => void;
    onCancel: () => void;
    currentEntityType?: string;
}

export const ReusableStepSelector: React.FC<Props> = ({ 
    reusableSteps, 
    onSelect, 
    onCancel,
    currentEntityType 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStep, setSelectedStep] = useState<FormStepDto | null>(null);
    const [linkMode, setLinkMode] = useState<ReuseLinkMode>('copy');

    const filteredSteps = reusableSteps.filter(step => {
        const matchesSearch = 
            step.stepName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            step.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (step.description || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesSearch;
    });

    const handleConfirm = () => {
        if (selectedStep) {
            onSelect(selectedStep, linkMode);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                        Select Reusable Step Template
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
                            placeholder="Search by step name, title, or description..."
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
                    {filteredSteps.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            {searchTerm ? 'No steps match your search' : 'No reusable step templates available'}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredSteps.map(step => (
                                <div
                                    key={step.id}
                                    onClick={() => setSelectedStep(step)}
                                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                        selectedStep?.id === step.id
                                            ? 'border-primary bg-blue-50 ring-2 ring-primary'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h4 className="font-medium text-gray-900">{step.title}</h4>
                                            <p className="text-sm text-gray-600 mt-1">{step.stepName}</p>
                                            {step.description && (
                                                <p className="text-sm text-gray-500 mt-2">{step.description}</p>
                                            )}
                                            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                                                <span>{step.fields.length} field{step.fields.length !== 1 ? 's' : ''}</span>
                                                {step.conditions.length > 0 && (
                                                    <span>{step.conditions.length} condition{step.conditions.length !== 1 ? 's' : ''}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {selectedStep && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            How should this template be added?
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center flex-1 p-3 border rounded-lg cursor-pointer transition-all hover:bg-white">
                                <input
                                    type="radio"
                                    name="linkMode"
                                    value="copy"
                                    checked={linkMode === 'copy'}
                                    onChange={e => setLinkMode(e.target.value as ReuseLinkMode)}
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
                                    value="link"
                                    checked={linkMode === 'link'}
                                    onChange={e => setLinkMode(e.target.value as ReuseLinkMode)}
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

                <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="btn-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedStep}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Add Step
                    </button>
                </div>
            </div>
        </div>
    );
};
