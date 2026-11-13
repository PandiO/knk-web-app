import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * PandiO/knk-workspace#406: a right-click menu (the dashboard rows' View / Edit / Delete / Export).
 *
 * - Opens at a point (the pointer, or the focused row for Shift+F10 and the context-menu key) and stays in the window.
 * - **Keyboard** (WAI-ARIA menu pattern): the first item gets the focus; ArrowDown/ArrowUp move (wrapping), Home/End
 *   jump, Enter/Space choose, Escape and Tab close. Escape gives the focus back to where the menu was opened from.
 * - A disabled item stays in the menu and can be focused, so its reason (`hint`, e.g. "Requires knk.admin.delete")
 *   is read and shown under its label; it can't be chosen.
 * - A click or right-click outside, scrolling the page, resizing the window or leaving the tab closes it.
 */
export interface ContextMenuItem {
    key: string;
    label: string;
    icon?: React.ReactNode;
    onSelect: () => void;
    disabled?: boolean;
    /** Why it is disabled, shown under the label ("Requires knk.admin.delete"). */
    hint?: string | null;
    danger?: boolean;
}

export interface ContextMenuProps {
    /** Viewport coordinates of the top-left corner (before keeping the menu in the window). */
    position: { x: number; y: number };
    items: ContextMenuItem[];
    /** The menu's accessible name, e.g. "Actions for Northwatch". */
    label: string;
    /** `returnFocus`: Escape (give the focus back to the opener); false for a click outside or a chosen item. */
    onClose: (returnFocus: boolean) => void;
}

const MARGIN = 8;

export const ContextMenu: React.FC<ContextMenuProps> = ({ position, items, label, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [placed, setPlaced] = useState(position);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    // Keep it inside the window: flip left/up when it would run off the right/bottom edge.
    useLayoutEffect(() => {
        const menu = menuRef.current;
        if (!menu) return;
        const { width, height } = menu.getBoundingClientRect();
        let x = position.x;
        let y = position.y;
        if (x + width > window.innerWidth - MARGIN) x = Math.max(MARGIN, Math.min(x - width, window.innerWidth - width - MARGIN));
        if (y + height > window.innerHeight - MARGIN) y = Math.max(MARGIN, Math.min(y - height, window.innerHeight - height - MARGIN));
        setPlaced({ x, y });
    }, [position]);

    const menuItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

    useEffect(() => {
        menuItems()[0]?.focus();
    }, [position]);

    useEffect(() => {
        const outside = (event: Event) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) onCloseRef.current(false);
        };
        const close = () => onCloseRef.current(false);
        // Capture: a row's own handlers (or a right-click on another row) must not keep it open.
        document.addEventListener('mousedown', outside, true);
        document.addEventListener('contextmenu', outside, true);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        window.addEventListener('blur', close);
        return () => {
            document.removeEventListener('mousedown', outside, true);
            document.removeEventListener('contextmenu', outside, true);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('blur', close);
        };
    }, []);

    const choose = (item: ContextMenuItem) => {
        if (item.disabled) return;
        onClose(false);
        item.onSelect();
    };

    const onKeyDown = (event: React.KeyboardEvent) => {
        const all = menuItems();
        const index = all.indexOf(document.activeElement as HTMLElement);
        const focusAt = (next: number) => all[(next + all.length) % all.length]?.focus();
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                focusAt(index + 1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                focusAt(index < 0 ? -1 : index - 1);
                break;
            case 'Home':
                event.preventDefault();
                focusAt(0);
                break;
            case 'End':
                event.preventDefault();
                focusAt(-1);
                break;
            case 'Escape':
                event.preventDefault();
                event.stopPropagation();
                onClose(true);
                break;
            case 'Tab':
                event.preventDefault();
                onClose(true);
                break;
            case 'Enter':
            case ' ': {
                event.preventDefault();
                const item = items[index];
                if (item) choose(item);
                break;
            }
            default:
                break;
        }
    };

    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            data-testid="row-context-menu"
            onKeyDown={onKeyDown}
            onContextMenu={(event) => event.preventDefault()}
            style={{ position: 'fixed', left: placed.x, top: placed.y }}
            className="z-50 min-w-[12rem] max-w-xs rounded-md border border-line bg-surface py-1 text-sm text-fg shadow-lg focus:outline-none"
        >
            {items.map(item => (
                <div
                    key={item.key}
                    role="menuitem"
                    tabIndex={-1}
                    aria-disabled={item.disabled || undefined}
                    data-testid={`context-${item.key}`}
                    onClick={() => choose(item)}
                    onMouseEnter={(event) => event.currentTarget.focus()}
                    className={`flex cursor-pointer items-start gap-2 px-3 py-2 outline-none focus:bg-surface-alt ${
                        item.disabled ? 'cursor-not-allowed text-muted' : item.danger ? 'text-danger' : 'text-fg'
                    }`}
                >
                    {item.icon && <span className={`mt-0.5 flex-shrink-0 ${item.disabled ? 'opacity-50' : ''}`} aria-hidden="true">{item.icon}</span>}
                    <span className="min-w-0">
                        <span className="block">{item.label}</span>
                        {item.disabled && item.hint && <span className="block text-xs text-muted">{item.hint}</span>}
                    </span>
                </div>
            ))}
        </div>,
        document.body
    );
};
