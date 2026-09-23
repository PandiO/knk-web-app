import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={onCancel}>
            <div
                role="dialog"
                aria-label="Scan result conflicts with existing values"
                className="w-full max-w-lg rounded-lg shadow-lg border border-yellow-200 bg-white relative"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start space-x-3 px-5 py-4 border-b border-gray-100">
                    <AlertTriangle className="h-6 w-6 text-yellow-600 shrink-0" />
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Scan result conflicts with existing values</h3>
                        <p className="mt-1 text-sm text-gray-600">
                            These fields already have a value. Choose which value to keep for each one.
                        </p>
                    </div>
                </div>

                <div className="px-5 py-4 space-y-4 max-h-96 overflow-y-auto">
                    {fields.map(field => (
                        <div key={field.key} className="border border-gray-200 rounded-md p-3">
                            <p className="text-sm font-medium text-gray-900 mb-2">{field.label}</p>
                            <div className="space-y-2">
                                <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                                    <input
                                        type="radio"
                                        name={`scan-conflict-${field.key}`}
                                        checked={choices[field.key] === 'scan'}
                                        onChange={() => setChoices(prev => ({ ...prev, [field.key]: 'scan' }))}
                                        className="mt-1"
                                    />
                                    <span>
                                        <span className="font-medium text-green-700">Use scan result:</span>{' '}
                                        <span className="font-mono text-xs break-words">{field.scannedValueLabel}</span>
                                    </span>
                                </label>
                                <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                                    <input
                                        type="radio"
                                        name={`scan-conflict-${field.key}`}
                                        checked={choices[field.key] === 'current'}
                                        onChange={() => setChoices(prev => ({ ...prev, [field.key]: 'current' }))}
                                        className="mt-1"
                                    />
                                    <span>
                                        <span className="font-medium text-gray-700">Keep current value:</span>{' '}
                                        <span className="font-mono text-xs break-words">{field.currentValueLabel}</span>
                                    </span>
                                </label>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="px-5 pb-4 flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Cancel scan
                    </button>
                    <button
                        onClick={() => onResolve(choices)}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
};
