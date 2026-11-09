import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from '../Dialog';

export interface ScanConflictField {
    key: string;
    label: string;
    currentValueLabel: string;
    scannedValueLabel: string;
}

export type ScanConflictChoice = 'scan' | 'current';

interface ScanConflictModalProps {
    open: boolean;
    fields: ScanConflictField[];
    onResolve: (choices: Record<string, ScanConflictChoice>) => void;
    onCancel: () => void;
}

/**
 * Shown when a WorldTask scan (docs/specs/items/IMPLEMENTATION_PLAN.md §5.2) would overwrite a
 * field that's already filled in - developer-requested confirmation (2026-09-23 live-testing
 * feedback) so a rescan can't silently clobber a value the admin already set on purpose. Defaults
 * every field to "use scan result", since triggering a (re)scan is itself an explicit request for
 * fresh data - the admin flips individual fields back to "keep current" rather than the reverse.
 */
export const ScanConflictModal: React.FC<ScanConflictModalProps> = ({ open, fields, onResolve, onCancel }) => {
    const [choices, setChoices] = useState<Record<string, ScanConflictChoice>>({});

    useEffect(() => {
        if (open) {
            setChoices(Object.fromEntries(fields.map(f => [f.key, 'scan' as ScanConflictChoice])));
        }
    }, [open, fields]);

    if (!open) return null;

    return (
        <Dialog
            open
            onClose={onCancel}
            title="Scan result conflicts with existing values"
            description="These fields already have a value. Choose which value to keep for each one."
            icon={<AlertTriangle className="h-6 w-6 text-warning" />}
            role="alertdialog"
            size="lg"
            closeLabel="Cancel scan"
            panelClassName="border-t-4 border-t-warning"
            footer={
                <>
                    <button type="button" onClick={onCancel} className="btn-secondary">
                        Cancel scan
                    </button>
                    <button type="button" onClick={() => onResolve(choices)} className="btn-primary">
                        Apply
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                {fields.map(field => (
                    <fieldset key={field.key} className="border border-line rounded-md p-3">
                        <legend className="px-1 text-sm font-medium text-fg">{field.label}</legend>
                        <div className="space-y-2">
                            <label className="flex items-start gap-2 text-sm text-fg cursor-pointer">
                                <input
                                    type="radio"
                                    name={`scan-conflict-${field.key}`}
                                    checked={choices[field.key] === 'scan'}
                                    onChange={() => setChoices(prev => ({ ...prev, [field.key]: 'scan' }))}
                                    className="mt-1"
                                />
                                <span>
                                    <span className="font-medium text-success">Use scan result:</span>{' '}
                                    <span className="font-mono text-xs break-words">{field.scannedValueLabel}</span>
                                </span>
                            </label>
                            <label className="flex items-start gap-2 text-sm text-fg cursor-pointer">
                                <input
                                    type="radio"
                                    name={`scan-conflict-${field.key}`}
                                    checked={choices[field.key] === 'current'}
                                    onChange={() => setChoices(prev => ({ ...prev, [field.key]: 'current' }))}
                                    className="mt-1"
                                />
                                <span>
                                    <span className="font-medium text-fg">Keep current value:</span>{' '}
                                    <span className="font-mono text-xs break-words">{field.currentValueLabel}</span>
                                </span>
                            </label>
                        </div>
                    </fieldset>
                ))}
            </div>
        </Dialog>
    );
};
