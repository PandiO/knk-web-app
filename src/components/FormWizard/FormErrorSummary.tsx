import React, { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

export interface FormErrorSummaryItem {
    key: string;
    /** The field the item links to; without one (a condition that reads no field of this step) it is text. */
    fieldName?: string;
    message: string;
}

/** The id of the box around a wizard field; the summary's links point at it. */
export const wizardFieldContainerId = (fieldName: string) => `wizard-field-${fieldName}`;

/** Moves the focus to a field's first control (and shows it), else to its box. */
export function focusWizardField(fieldName: string): void {
    const container = document.getElementById(wizardFieldContainerId(fieldName));
    if (!container) return;
    const control = container.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
    );
    const target = control ?? container;
    if (!control) container.setAttribute('tabindex', '-1');
    container.scrollIntoView?.({ block: 'center' });
    target.focus();
}

interface Props {
    items: FormErrorSummaryItem[];
    /** Changes on every failed Next/Save, so the summary takes the focus again. */
    focusKey?: number;
}

/**
 * #109 (CRUD-8): what keeps the step from going on, each item a link to its field. PandiO/knk-workspace#488: every
 * kind of problem is listed here once (a field's message, a failed step condition, a many-to-many entry). Takes the focus
 * when a Next or Save was refused, so a screen reader reads it and the page scrolls to it.
 */
export const FormErrorSummary: React.FC<Props> = ({ items, focusKey }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (items.length > 0) {
            ref.current?.scrollIntoView?.({ block: 'nearest' });
            ref.current?.focus();
        }
        // Only a new refusal moves the focus, not every change of the list while typing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusKey]);

    if (items.length === 0) return null;

    return (
        <div
            ref={ref}
            tabIndex={-1}
            role="alert"
            aria-labelledby="wizard-error-summary-title"
            className="rounded-md border border-danger-line bg-danger-soft p-4 focus:outline-none focus:ring-2 focus:ring-red-400"
        >
            <div className="flex items-start">
                <AlertCircle className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-danger" aria-hidden="true" />
                <div>
                    <h2 id="wizard-error-summary-title" className="text-sm font-semibold text-danger-strong">
                        {items.length === 1 ? 'Fix this problem to continue' : `Fix these ${items.length} problems to continue`}
                    </h2>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-danger-strong">
                        {items.map(({ key, fieldName, message }) => (
                            <li key={key}>
                                {fieldName ? (
                                    <a
                                        href={`#${wizardFieldContainerId(fieldName)}`}
                                        className="underline hover:text-red-900"
                                        onClick={event => {
                                            event.preventDefault();
                                            focusWizardField(fieldName);
                                        }}
                                    >
                                        {message}
                                    </a>
                                ) : (
                                    message
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};
