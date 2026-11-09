import React, { useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * The one modal dialog of the web app (PandiO/knk-workspace#33, X-3). Every overlay builds on it, so
 * they all behave the same way:
 * - `role="dialog"` (or `alertdialog` for a question that needs an answer) with `aria-modal`, labelled by
 *   its title (`aria-labelledby`) and described by `description` (`aria-describedby`);
 * - focus moves into the dialog when it opens (`initialFocusRef`, else an element marked `data-autofocus`,
 *   else the first field or button of the body, else the panel itself), Tab and Shift+Tab stay inside, and
 *   focus returns to the element that opened it when it closes;
 * - Escape and the × close it; a click on the backdrop only when `closeOnBackdrop` (forms keep it off,
 *   so a stray click doesn't throw away what was typed); `dismissible={false}` turns all three off while
 *   something is being saved;
 * - only the topmost of nested dialogs (a child form's error message) reacts to Escape and keeps focus;
 * - rendered in a portal on <body>, with the page behind it not scrolling.
 *
 * Styling uses the theme tokens (#95). With the page background on (#231) the panel stays solid
 * (pageBackground.css keeps `[aria-modal]` and `.fixed` surfaces opaque).
 */

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full';

export interface DialogProps {
    open: boolean;
    /** Called on Escape, the ×, and a backdrop click when `closeOnBackdrop`. */
    onClose: () => void;
    /** The visible heading; it names the dialog. */
    title: React.ReactNode;
    /** A line under the title; it describes the dialog (aria-describedby). */
    description?: React.ReactNode;
    /** Shown left of the title (a status icon). */
    icon?: React.ReactNode;
    /** `alertdialog` for a question the user must answer (a confirm), `dialog` otherwise. */
    role?: 'dialog' | 'alertdialog';
    size?: DialogSize;
    /** `right`: a panel along the right edge (a details drawer) instead of a centred box. */
    placement?: 'center' | 'right';
    /** A backdrop click closes it (default false: forms and editors keep what was typed). */
    closeOnBackdrop?: boolean;
    /** False while something is saving: Escape, the × and the backdrop do nothing. Default true. */
    dismissible?: boolean;
    /** Hides the × (the footer has its own way out). */
    hideCloseButton?: boolean;
    /** The accessible name of the ×. */
    closeLabel?: string;
    /** Receives focus when the dialog opens. */
    initialFocusRef?: React.RefObject<HTMLElement>;
    /** Buttons along the bottom; they stay visible while the body scrolls. */
    footer?: React.ReactNode;
    /** Extra classes for the panel (a status border or tint). */
    panelClassName?: string;
    /** Classes for the header row (default: a bottom border). */
    headerClassName?: string;
    /** Classes for the scrolling body (default `px-6 py-4`). */
    bodyClassName?: string;
    /** Classes for the footer row (default: a top border). */
    footerClassName?: string;
    /** Extra id(s) for aria-describedby. */
    describedBy?: string;
    'data-testid'?: string;
    children?: React.ReactNode;
}

const SIZE: Record<DialogSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    full: 'max-w-none',
};

const FOCUSABLE = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'iframe',
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

/** The focusable elements inside `root`, in tab order of the document. */
export function focusableIn(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        element => !element.closest('[hidden], [inert], [aria-hidden="true"]') && element.tabIndex >= 0
    );
}

// Open dialogs, innermost last: only the last one handles Escape and keeps focus.
const openDialogs: symbol[] = [];
let scrollLocks = 0;
let savedOverflow = '';

function lockScroll() {
    if (scrollLocks++ === 0) {
        savedOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }
}

function unlockScroll() {
    if (--scrollLocks === 0) {
        document.body.style.overflow = savedOverflow;
    }
}

const isTopmost = (id: symbol) => openDialogs[openDialogs.length - 1] === id;

export const Dialog: React.FC<DialogProps> = ({
    open,
    onClose,
    title,
    description,
    icon,
    role = 'dialog',
    size = 'md',
    placement = 'center',
    closeOnBackdrop = false,
    dismissible = true,
    hideCloseButton = false,
    closeLabel = 'Close dialog',
    initialFocusRef,
    footer,
    panelClassName = '',
    headerClassName = 'border-b border-line',
    bodyClassName = 'px-6 py-4',
    footerClassName = 'border-t border-line',
    describedBy,
    'data-testid': testId,
    children,
}) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const idRef = useRef<symbol>(Symbol('dialog'));
    const titleId = useId();
    const descriptionId = useId();
    // The latest props, so the open/close effect doesn't re-run (and refocus) on every render.
    const latest = useRef({ onClose, dismissible, initialFocusRef });
    latest.current = { onClose, dismissible, initialFocusRef };

    // Register, focus in, trap, restore. A layout effect so focus moves before the browser paints.
    useLayoutEffect(() => {
        if (!open) return undefined;
        const id = idRef.current;
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        openDialogs.push(id);
        lockScroll();

        const panel = panelRef.current;
        if (panel && !panel.contains(document.activeElement)) {
            const footer = panel.querySelector<HTMLElement>('[data-dialog-footer]');
            // The × comes last: the body's first field, else the footer's first button (Cancel, the safe answer).
            const target =
                latest.current.initialFocusRef?.current ??
                panel.querySelector<HTMLElement>('[data-autofocus]') ??
                (bodyRef.current ? focusableIn(bodyRef.current)[0] : undefined) ??
                (footer ? focusableIn(footer)[0] : undefined) ??
                panel;
            target.focus();
        }

        return () => {
            const index = openDialogs.lastIndexOf(id);
            if (index >= 0) openDialogs.splice(index, 1);
            unlockScroll();
            // Back to the opener, unless focus already went somewhere on purpose (a next dialog).
            const active = document.activeElement;
            const focusLeftWithDialog = !active || active === document.body || !document.body.contains(active)
                || (panel?.contains(active) ?? false);
            if (opener && document.body.contains(opener) && focusLeftWithDialog) {
                opener.focus();
            }
        };
    }, [open]);

    // Escape on the topmost dialog; focus that leaves the topmost dialog (a click on the page behind a
    // drawer, a programmatic focus) comes back to it.
    useEffect(() => {
        if (!open) return undefined;
        const id = idRef.current;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.defaultPrevented || !isTopmost(id)) return;
            event.preventDefault();
            if (latest.current.dismissible) latest.current.onClose();
        };
        const onFocusIn = (event: FocusEvent) => {
            const panel = panelRef.current;
            const target = event.target as Node | null;
            if (!panel || !isTopmost(id) || !target || panel.contains(target)) return;
            // Another portal-rendered layer above (a toast, a dropdown list box) may take focus.
            if (target instanceof Element && target.closest('[data-dialog-allow-focus]')) return;
            (focusableIn(panel)[0] ?? panel).focus();
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('focusin', onFocusIn);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('focusin', onFocusIn);
        };
    }, [open]);

    const onPanelKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Tab' || !panelRef.current || !isTopmost(idRef.current)) return;
        const items = focusableIn(panelRef.current);
        if (items.length === 0) {
            event.preventDefault();
            panelRef.current.focus();
            return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || active === panelRef.current)) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    }, []);

    if (!open) return null;

    const describedByIds = [description ? descriptionId : null, describedBy ?? null].filter(Boolean).join(' ') || undefined;
    const isDrawer = placement === 'right';

    const overlay = (
        <div
            className={`fixed inset-0 z-[60] flex ${isDrawer ? 'justify-end' : 'items-center justify-center p-4'}`}
            data-testid={testId ? `${testId}-overlay` : undefined}
        >
            <div
                className="absolute inset-0 bg-black/50"
                aria-hidden="true"
                data-testid="dialog-backdrop"
                onMouseDown={event => {
                    if (event.target === event.currentTarget && closeOnBackdrop && dismissible) onClose();
                }}
            />
            <div
                ref={panelRef}
                role={role}
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={describedByIds}
                tabIndex={-1}
                data-testid={testId}
                onKeyDown={onPanelKeyDown}
                className={`relative flex w-full flex-col bg-surface text-fg shadow-2xl focus:outline-none ${
                    isDrawer
                        ? `h-full ${size === 'full' ? '' : SIZE[size]} border-l border-line`
                        : `max-h-[90vh] rounded-lg border border-line ${SIZE[size]}`
                } ${panelClassName}`}
            >
                <div className={`flex items-start justify-between gap-3 px-6 py-4 ${headerClassName}`}>
                    <div className="flex min-w-0 items-start gap-3">
                        {icon && <span className="mt-0.5 flex-shrink-0" aria-hidden="true">{icon}</span>}
                        <div className="min-w-0">
                            <h2 id={titleId} className="text-lg font-semibold text-fg">{title}</h2>
                            {description && (
                                <div id={descriptionId} className="mt-1 text-sm text-muted">{description}</div>
                            )}
                        </div>
                    </div>
                    {!hideCloseButton && (
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={!dismissible}
                            aria-label={closeLabel}
                            title={closeLabel}
                            className="-mr-2 -mt-1 rounded-md p-1.5 text-muted hover:bg-surface-alt hover:text-fg focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                    )}
                </div>
                {children !== undefined && children !== null && children !== false && (
                    <div ref={bodyRef} className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>
                        {children}
                    </div>
                )}
                {footer && (
                    <div data-dialog-footer className={`flex flex-wrap justify-end gap-3 px-6 py-3 ${footerClassName}`}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
};
