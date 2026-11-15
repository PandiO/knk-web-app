import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from '../Dialog';
import { useReferenceDetailsToggle } from '../ReferenceDetails';
import { BulkDeleteRefusalDto } from '../../apiClients/dashboardClient';
import { BulkDeleteOutcome, countOf } from '../../utils/bulkDelete';
import { formatNumber } from '../../utils/format';

/**
 * PandiO/knk-workspace#205 bulk delete: what happened to the rows that weren't deleted. Shown only when something was
 * refused or not tried (an all-deleted run ends with a toast). Each refused row gets its reason, as the single delete
 * would give it; a row refused because other records still use it (`code: "InUse"`) offers "Show what uses it" (#44),
 * loaded on request. The refused rows stay selected on the dashboard.
 */
export interface BulkDeleteResultDialogProps {
    open: boolean;
    onClose: () => void;
    entityTypeName: string;
    typeLabel: string;
    outcome: BulkDeleteOutcome | null;
    /** The row's name as the table shows it ("Cinix"), by id. */
    rowLabel: (id: number) => string;
    /** The metadata's display name of a type, for the "what uses it" groups. */
    referenceTypeLabel?: (entityType: string) => string;
    returnTo?: string | null;
}

export const BulkDeleteResultDialog: React.FC<BulkDeleteResultDialogProps> = ({
    open, onClose, entityTypeName, typeLabel, outcome, rowLabel, referenceTypeLabel, returnTo,
}) => {
    if (!outcome) return null;
    const { deleted, refused, notRun } = outcome;
    const total = deleted.length + refused.length + (notRun?.ids.length ?? 0);
    const title = deleted.length > 0
        ? `Deleted ${formatNumber(deleted.length)} of ${countOf(total, typeLabel)}`
        : `No ${typeLabel} was deleted`;
    return (
        <Dialog
            open={open}
            onClose={onClose}
            role="alertdialog"
            size="lg"
            title={title}
            icon={<AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />}
            description={refused.length > 0
                ? `${countOf(refused.length, typeLabel)} couldn't be deleted. ${refused.length === 1 ? 'It stays' : 'They stay'} selected.`
                : undefined}
            footer={<button type="button" className="btn-primary" onClick={onClose}>Close</button>}
        >
            <div className="space-y-4" data-testid="bulk-delete-result">
                {refused.length > 0 && (
                    <ul className="divide-y divide-line rounded-md border border-line" aria-label={`${typeLabel} rows that weren't deleted`}>
                        {refused.map(row => (
                            <RefusedRow
                                key={row.id}
                                row={row}
                                label={rowLabel(row.id)}
                                entityTypeName={entityTypeName}
                                referenceTypeLabel={referenceTypeLabel}
                                returnTo={returnTo}
                                onFollow={onClose}
                            />
                        ))}
                    </ul>
                )}
                {notRun && notRun.ids.length > 0 && (
                    <p className="rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-sm text-warning-strong" data-testid="bulk-delete-not-run">
                        {countOf(notRun.ids.length, typeLabel)} {notRun.ids.length === 1 ? "wasn't" : "weren't"} tried: {notRun.reason}
                        {' '}{notRun.ids.length === 1 ? 'It stays' : 'They stay'} selected.
                    </p>
                )}
            </div>
        </Dialog>
    );
};

const RefusedRow: React.FC<{
    row: BulkDeleteRefusalDto;
    label: string;
    entityTypeName: string;
    referenceTypeLabel?: (entityType: string) => string;
    returnTo?: string | null;
    onFollow: () => void;
}> = ({ row, label, entityTypeName, referenceTypeLabel, returnTo, onFollow }) => {
    const uses = useReferenceDetailsToggle(entityTypeName, row.id, { typeLabel: referenceTypeLabel, returnTo, onFollow });
    return (
        <li className="px-3 py-2 text-sm">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="min-w-0 break-words font-medium text-fg">{label}</span>
                {row.code === 'InUse' && uses.button}
            </div>
            <p className="mt-0.5 break-words text-muted">{row.reason}</p>
            {row.code === 'InUse' && uses.panel}
        </li>
    );
};
