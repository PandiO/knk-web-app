import React from 'react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Breadcrumbs } from '../Breadcrumbs';
import type { Breadcrumb } from '../../utils/breadcrumbs';

type Props = {
    /** The entity's own name (not the display configuration's, #81 / N4). */
    title: string;
    /** The entity type's label, shown above the name. */
    typeLabel: string;
    trail: Breadcrumb[];
    onBack: () => void;
    onEdit: () => void;
    onDelete: () => void;
    deleting?: boolean;
};

/** The detail page header (#81 CRUD-15): breadcrumb, entity name, Back / Edit / Delete. */
export const EntityDetailHeader: React.FC<Props> = ({ title, typeLabel, trail, onBack, onEdit, onDelete, deleting = false }) => (
    <div className="space-y-3">
        <Breadcrumbs trail={trail} />
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-sm font-medium uppercase tracking-wide text-gray-500">{typeLabel}</p>
                <h2 className="break-words text-3xl font-bold text-gray-900">{title}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={onBack} className="btn-secondary inline-flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back
                </button>
                <button type="button" onClick={onEdit} className="btn-primary inline-flex items-center gap-2">
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    disabled={deleting}
                    className="btn-danger inline-flex items-center gap-2 disabled:opacity-60"
                >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {deleting ? 'Deleting…' : 'Delete'}
                </button>
            </div>
        </div>
    </div>
);

export default EntityDetailHeader;
