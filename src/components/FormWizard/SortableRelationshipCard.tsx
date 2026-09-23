import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface Props {
    id: string;
    children: React.ReactNode;
}

/**
 * Thin drag handle wrapper for one relationship card in a reorderable
 * ManyToManyRelationshipEditor step (e.g. ItemBlueprint's Origin step, ordered by
 * SequenceNumber) - mirrors FormConfigBuilder/SortableStepItem's exact @dnd-kit pattern, per
 * developer request (2026-09-23) to reuse the same drag interaction already used there for
 * ordering FormStep instances.
 */
export const SortableRelationshipCard: React.FC<Props> = ({ id, children }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="relative">
            <div
                {...attributes}
                {...listeners}
                className="absolute top-4 left-2 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 z-10"
                title="Drag to reorder"
            >
                <GripVertical className="h-4 w-4" />
            </div>
            <div className="pl-6">
                {children}
            </div>
        </div>
    );
};
