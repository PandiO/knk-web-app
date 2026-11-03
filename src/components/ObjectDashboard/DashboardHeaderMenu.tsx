import React, { useEffect, useId, useRef, useState } from 'react';

export type DashboardMenuItem = {
    key: string;
    label: React.ReactNode;
    /** A second, muted line (e.g. a draft's step and date). */
    detail?: React.ReactNode;
    /** Hover text; defaults to the label and detail when they are strings. */
    title?: string;
    onSelect: () => void;
};

type Props = {
    /** The button's content. */
    button: React.ReactNode;
    buttonClassName: string;
    /** Accessible name and tooltip of the button. */
    buttonLabel: string;
    /** Shown above the items, e.g. "New with". */
    heading: string;
    items: DashboardMenuItem[];
    /** Below the items, e.g. a link to the Entity setup page. */
    footer?: { label: string; onSelect: () => void };
    testId?: string;
};

/**
 * #177 follow-up: a small menu next to the dashboard's "New {Type}" button ("Drafts (n)", "New with").
 * A list of buttons in a popover: ArrowUp/ArrowDown move between them, Escape and a click outside
 * close it (Escape gives the focus back to the button).
 * Labels wrap instead of being cut off (configuration names often differ only at the end) and every
 * item carries its full text as a hover title (developer test 2026-11-03).
 */
export const DashboardHeaderMenu: React.FC<Props> = ({ button, buttonClassName, buttonLabel, heading, items, footer, testId }) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const menuId = useId();

    const itemTitle = (item: DashboardMenuItem) => item.title
        ?? ([item.label, item.detail].filter(part => typeof part === 'string' && part !== '').join('\n') || undefined);

    const focusables = () => Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);

    useEffect(() => {
        if (!open) return undefined;
        focusables()[0]?.focus();
        const onMouseDown = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onMouseDown);
        return () => document.removeEventListener('mousedown', onMouseDown);
    }, [open]);

    const close = (returnFocus: boolean) => {
        setOpen(false);
        if (returnFocus) buttonRef.current?.focus();
    };

    const select = (onSelect: () => void) => {
        close(false);
        onSelect();
    };

    const onKeyDown = (event: React.KeyboardEvent) => {
        const buttons = focusables();
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                buttons[(index + 1) % buttons.length]?.focus();
                break;
            case 'ArrowUp':
                event.preventDefault();
                buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
                break;
            case 'Escape':
                event.preventDefault();
                close(true);
                break;
        }
    };

    return (
        <div className="relative flex-shrink-0" ref={containerRef} data-testid={testId}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => (open ? close(false) : setOpen(true))}
                className={buttonClassName}
                aria-label={buttonLabel}
                title={buttonLabel}
                aria-haspopup="true"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
            >
                {button}
            </button>
            {open && (
                <div
                    id={menuId}
                    ref={listRef}
                    onKeyDown={onKeyDown}
                    className="absolute right-0 z-20 mt-2 w-max min-w-[18rem] max-w-[min(28rem,calc(100vw-2rem))] rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
                >
                    <p className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {heading}
                    </p>
                    <ul className="max-h-80 overflow-y-auto py-1" aria-label={heading}>
                        {items.map(item => (
                            <li key={item.key}>
                                <button
                                    type="button"
                                    onClick={() => select(item.onSelect)}
                                    title={itemTitle(item)}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:bg-gray-100 focus:outline-none"
                                >
                                    <span className="block whitespace-normal break-words font-medium text-gray-900">{item.label}</span>
                                    {item.detail && <span className="block whitespace-normal break-words text-xs text-gray-500">{item.detail}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {footer && (
                        <div className="border-t border-gray-100 py-1">
                            <button
                                type="button"
                                onClick={() => select(footer.onSelect)}
                                className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-gray-50 focus:bg-gray-100 focus:outline-none"
                            >
                                {footer.label}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DashboardHeaderMenu;
