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
    /** #280 rule: why Edit / Delete can't be used ("Requires knk.admin.delete"); null or absent when they can. */
    editBlocked?: string | null;
    deleteBlocked?: string | null;
    /** Still checking the nodes: the buttons wait, without a reason yet. */
    checking?: boolean;
};

/**
 * The detail page header (#81 CRUD-15): breadcrumb, entity name, Back / Edit / Delete. Delete deletes this record (red,
 * asks first); an action the viewer can't use is disabled with "Requires …" (#280, #188).
 */
export const EntityDetailHeader: React.FC<Props> = ({
    title, typeLabel, trail, onBack, onEdit, onDelete, deleting = false, editBlocked = null, deleteBlocked = null, checking = false,
}) => (
    <div className="space-y-3">
        <Breadcrumbs trail={trail} />
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-sm font-medium uppercase tracking-wide text-muted">{typeLabel}</p>
                <h2 className="break-words text-3xl font-bold text-fg">{title}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={onBack} className="btn-secondary inline-flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back
                </button>
                <button
                    type="button"
                    onClick={onEdit}
                    disabled={checking || !!editBlocked}
                    title={editBlocked ?? undefined}
                    aria-describedby={editBlocked ? 'detail-edit-hint' : undefined}
                    className="btn-primary inline-flex items-center gap-2"
                >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    disabled={deleting || checking || !!deleteBlocked}
                    title={deleteBlocked ?? undefined}
                    aria-describedby={deleteBlocked ? 'detail-delete-hint' : undefined}
                    className="btn-danger inline-flex items-center gap-2 disabled:opacity-60"
                >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {deleting ? 'Deleting…' : 'Delete'}
                </button>
            </div>
        </div>
        {(editBlocked || deleteBlocked) && (
            <div className="flex flex-wrap justify-end gap-x-4 text-xs text-muted">
                {editBlocked && <span id="detail-edit-hint">Edit: {editBlocked}</span>}
                {deleteBlocked && <span id="detail-delete-hint">Delete: {deleteBlocked}</span>}
            </div>
        )}
    </div>
);

export default EntityDetailHeader;
