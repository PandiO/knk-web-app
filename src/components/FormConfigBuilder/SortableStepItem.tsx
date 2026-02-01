import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, AlertTriangle, Link as LinkIcon, Copy as CopyIcon } from 'lucide-react';
import { FormStepDto } from '../../types/dtos/forms/FormModels';

interface Props {
    step: FormStepDto;
    index: number;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: () => void;
}

export const SortableStepItem: React.FC<Props> = ({ step, index, isSelected, onSelect, onDelete }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: step.id! });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center p-3 border rounded-md cursor-pointer ${
                step.hasCompatibilityIssues
                    ? 'border-red-300 bg-red-50'
                    : isSelected
                    ? 'border-primary bg-indigo-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
            onClick={onSelect}
        >
            <div {...attributes} {...listeners} className="mr-2 cursor-grab active:cursor-grabbing">
                <GripVertical className="h-5 w-5 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-900 truncate">
                        {index + 1}. {step.title || step.stepName}
                    </div>
                    {step.hasCompatibilityIssues && (
                        <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" title="Has compatibility issues" />
                    )}
                    {step.isReusable && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 flex-shrink-0">
                            Template
                        </span>
                    )}
                    {step.sourceStepId && (
                        step.isLinkedToSource ? (
                            <LinkIcon className="h-3 w-3 text-blue-600 flex-shrink-0" title="Linked to template" />
                        ) : (
                            <CopyIcon className="h-3 w-3 text-gray-600 flex-shrink-0" title="Copied from template" />
                        )
                    )}
                </div>
                <div className="text-xs text-gray-500">
                    {step.fields.length} field{step.fields.length !== 1 ? 's' : ''}
                </div>
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
                className="ml-2 p-1 text-gray-400 hover:text-red-600"
            >
                <Trash2 className="h-4 w-4" />
            </button>
        </div>
    );
};

