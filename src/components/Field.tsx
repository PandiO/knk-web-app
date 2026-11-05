import React, { useId } from 'react';

/**
 * PandiO/knk-workspace#187 (X-5): a label tied to its control. The control gets an id (`useId`, or `id` when
 * given), the label's `htmlFor`, `aria-describedby` for the hint and the error, `aria-invalid` with an error and
 * `required`. The error is announced (`role="alert"`).
 *
 * The control is the only child element, and the props are added to it:
 *
 *     <Field label="Search username / email / UUID" hint="Leave blank to list everyone">
 *       <input type="text" className="input px-3 py-2" value={term} onChange={…} />
 *     </Field>
 *
 * or a function that spreads them where they belong (a control inside a wrapper, a custom component):
 *
 *     <Field label="Clear weight" error={errors.clear}>
 *       {control => <div className="relative"><input {...control} type="number" … /><Icon /></div>}
 *     </Field>
 *
 * A checkbox or radio goes with `inline`: the control first, the label after it on the same line.
 */
export interface FieldControlProps {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: true;
    required?: boolean;
}

export interface FieldProps {
    label: React.ReactNode;
    children: React.ReactElement | ((control: FieldControlProps) => React.ReactNode);
    /** Help under the control, read with it. */
    hint?: React.ReactNode;
    /** An error message; marks the control invalid. */
    error?: React.ReactNode;
    /** Marks the control required and shows `*` after the label. */
    required?: boolean;
    /** A fixed id for the control (e.g. a form field name other code looks up); default a generated one. */
    id?: string;
    /** Control first, then the label on the same line (checkboxes, radios). */
    inline?: boolean;
    /** Classes on the wrapper. */
    className?: string;
    labelClassName?: string;
}

const joinIds = (...ids: Array<string | undefined | false>): string | undefined => {
    const list = ids.filter(Boolean) as string[];
    return list.length > 0 ? list.join(' ') : undefined;
};

export const Field: React.FC<FieldProps> = ({
    label,
    children,
    hint,
    error,
    required = false,
    id,
    inline = false,
    className = '',
    labelClassName,
}) => {
    const generated = useId();
    const controlId = id ?? `field-${generated.replace(/:/g, '')}`;
    const hintId = hint ? `${controlId}-hint` : undefined;
    const errorId = error ? `${controlId}-error` : undefined;

    const control: FieldControlProps = {
        id: controlId,
        'aria-describedby': joinIds(hintId, errorId),
        ...(error ? { 'aria-invalid': true as const } : {}),
        ...(required ? { required: true } : {}),
    };

    let rendered: React.ReactNode;
    if (typeof children === 'function') {
        rendered = children(control);
    } else {
        const own = children.props as Record<string, unknown>;
        rendered = React.cloneElement(children, {
            ...control,
            id: (own.id as string | undefined) ?? controlId,
            'aria-describedby': joinIds(own['aria-describedby'] as string | undefined, hintId, errorId),
        } as Partial<unknown>);
    }
    const ownId = typeof children !== 'function' ? (children.props as { id?: string }).id : undefined;
    const htmlFor = ownId ?? controlId;

    const labelElement = (
        <label
            htmlFor={htmlFor}
            className={labelClassName ?? (inline ? 'text-sm text-fg' : 'block text-sm font-medium text-fg mb-1')}
        >
            {label}
            {required && <span className="text-danger ml-1" aria-hidden="true">*</span>}
        </label>
    );

    const hintElement = hint ? <p id={hintId} className="mt-1 text-xs text-muted">{hint}</p> : null;
    const errorElement = error ? <p id={errorId} className="mt-1 text-sm field-error" role="alert">{error}</p> : null;

    if (inline) {
        return (
            <div className={className}>
                <div className="flex items-center gap-2">
                    {rendered}
                    {labelElement}
                </div>
                {hintElement}
                {errorElement}
            </div>
        );
    }

    return (
        <div className={className}>
            {labelElement}
            {rendered}
            {hintElement}
            {errorElement}
        </div>
    );
};
