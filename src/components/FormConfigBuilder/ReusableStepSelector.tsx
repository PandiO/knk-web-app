import React, { useState } from 'react';
import { Search, Copy as CopyIcon, Link as LinkIcon } from 'lucide-react';
import { Dialog } from '../Dialog';
import { FormStepDto, ReuseLinkMode } from '../../types/dtos/forms/FormModels';

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
            (step.description || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesSearch;
    });

    const handleConfirm = () => {
        if (selectedStep) {
            onSelect(selectedStep, linkMode);
        }
    };

    return (
        <Dialog
            open
            onClose={onCancel}
            title="Select Reusable Step Template"
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
                        disabled={!selectedStep}
                        className="btn-primary"
                    >
                        Add Step
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
                        placeholder="Search by step name, title, or description..."
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
                {filteredSteps.length === 0 ? (
                    <div className="text-center py-8 text-muted">
                        {searchTerm ? 'No steps match your search' : 'No reusable step templates available'}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredSteps.map(step => (
                            <div
                                key={step.id}
                                role="button"
                                tabIndex={0}
                                aria-pressed={selectedStep?.id === step.id}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedStep(step); } }}
                                onClick={() => setSelectedStep(step)}
                                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                    selectedStep?.id === step.id
                                        ? 'border-primary bg-primary/10 ring-2 ring-primary'
                                        : 'border-line hover:border-field hover:bg-surface-alt'
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h4 className="font-medium text-fg">{step.stepName}</h4>
                                        {step.description && (
                                            <p className="text-sm text-muted mt-2">{step.description}</p>
                                        )}
                                        <div className="mt-2 flex items-center gap-4 text-xs text-muted">
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
                <div className="px-6 py-4 border-t border-line bg-surface-alt">
                    <label className="block text-sm font-medium text-fg mb-2">
                        How should this template be added?
                    </label>
                    <div className="flex gap-4">
                        <label className="flex items-center flex-1 p-3 border rounded-lg cursor-pointer transition-all hover:bg-surface">
                            <input
                                type="radio"
                                name="linkMode"
                                value="copy"
                                checked={linkMode === 'copy'}
                                onChange={e => setLinkMode(e.target.value as ReuseLinkMode)}
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
                                value="link"
                                checked={linkMode === 'link'}
                                onChange={e => setLinkMode(e.target.value as ReuseLinkMode)}
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

