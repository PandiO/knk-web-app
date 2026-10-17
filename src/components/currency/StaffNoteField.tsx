import React from 'react';
import { MIN_STAFF_NOTE_LENGTH } from '../../types/dtos/currency/CurrencyDtos';

/** The note's length as the API counts it (surrounding spaces don't count). */
export const staffNoteLength = (note: string): number => note.trim().length;

/** Whether a staff note (adjustment, reversal) is long enough to send. */
export const isStaffNoteValid = (note: string): boolean => staffNoteLength(note) >= MIN_STAFF_NOTE_LENGTH;

export interface StaffNoteFieldProps {
    id: string;
    label: React.ReactNode;
    value: string;
    onChange: (value: string) => void;
    /** A textarea instead of a one-line input. */
    multiline?: boolean;
    rows?: number;
    placeholder?: string;
    maxLength?: number;
    /**
     * Set by the form after a submit with a too-short note: shows why it wasn't sent and marks the
     * field invalid. The message goes away by itself once the note is long enough.
     */
    showError?: boolean;
    className?: string;
}

/**
 * The reason field of a staff form that needs a note of at least MIN_STAFF_NOTE_LENGTH characters
 * (KNG-126): a live "4 / 10 characters" counter under the field, and - after a submit attempt with
 * a short note - a message in an aria-live region. Forms keep their submit button enabled and check
 * isStaffNoteValid on submit, so a click always explains itself instead of doing nothing.
 */
export const StaffNoteField: React.FC<StaffNoteFieldProps> = ({
    id, label, value, onChange, multiline = false, rows = 2, placeholder, maxLength = 450, showError = false, className,
}) => {
    const length = staffNoteLength(value);
    const valid = length >= MIN_STAFF_NOTE_LENGTH;
    const invalid = showError && !valid;
    const countId = `${id}-count`;
    const errorId = `${id}-error`;
    const fieldClass = `border rounded-md px-2 py-1.5 text-sm w-full ${invalid ? 'border-red-500' : 'border-gray-300'}`;
    const fieldProps = {
        id,
        className: fieldClass,
        value,
        maxLength,
        placeholder,
        'aria-describedby': `${countId} ${errorId}`,
        'aria-invalid': invalid || undefined,
    };

    return (
        <div className={className}>
            <label htmlFor={id} className="block text-xs text-gray-500 mb-1">{label}</label>
            {multiline
                ? <textarea {...fieldProps} rows={rows} onChange={e => onChange(e.target.value)} />
                : <input {...fieldProps} type="text" onChange={e => onChange(e.target.value)} />}
            <p id={countId} className={`mt-1 text-xs ${valid ? 'text-green-700' : 'text-gray-500'}`}>
                {length} / {MIN_STAFF_NOTE_LENGTH} characters
            </p>
            <p id={errorId} aria-live="polite" className="text-xs text-red-600">
                {invalid
                    ? `Write a reason of at least ${MIN_STAFF_NOTE_LENGTH} characters (${MIN_STAFF_NOTE_LENGTH - length} more).`
                    : null}
            </p>
        </div>
    );
};

export default StaffNoteField;
