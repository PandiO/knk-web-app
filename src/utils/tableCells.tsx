import React from 'react';
import { ColumnDefinition } from '../types/common';

/**
 * How an entity table cell shows a row's value (PagedEntityTable, moved here for #205), and the same value as
 * plain text for a CSV export, so the file holds what the table showed.
 *
 * - `renderCellValue(row, column)`: the column's `render`, else the value at `column.key` (a dotted path, matched
 *   ignoring case): booleans as a Yes/No pill, a Date as its local date, an object by its name/title/label/id,
 *   anything missing as `-`.
 * - `cellText(row, column)`: the text of that cell. A `render` result is read as text (`reactNodeToText`: strings,
 *   numbers, elements' children, an image's `alt`, plain function components called with their props); the default
 *   cell gives the same words as the table, except that a missing value is empty rather than `-` (LV2-4).
 */

/** The value at a dotted key path (`category.name`), each segment matched exactly first, then ignoring case. */
export const getValueByKeyPath = (source: any, keyPath: string): any => {
    if (!source || !keyPath) {
        return undefined;
    }

    const segments = keyPath.split('.').filter(Boolean);
    let current: any = source;

    for (const segment of segments) {
        if (current == null || typeof current !== 'object') {
            return undefined;
        }

        if (Object.prototype.hasOwnProperty.call(current, segment)) {
            current = current[segment];
            continue;
        }

        const matchedKey = Object.keys(current).find(
            key => key.toLowerCase() === segment.toLowerCase()
        );

        if (!matchedKey) {
            return undefined;
        }

        current = current[matchedKey];
    }

    return current;
};

/** An object's display text (name, title, label, id), or undefined when it has none of those. */
const objectLabel = (value: Record<string, any>): string | undefined => {
    if ('name' in value && value.name) return String(value.name);
    if ('Name' in value && value.Name) return String(value.Name);
    if ('title' in value && value.title) return String(value.title);
    if ('label' in value && value.label) return String(value.label);
    if ('id' in value) return String(value.id);
    return undefined;
};

/** The table cell for `column` of `row`. */
export function renderCellValue<T>(row: T, column: ColumnDefinition<T>): React.ReactNode {
    if (column.render) {
        return column.render(row);
    }

    const value = getValueByKeyPath(row, column.key);

    if (value === null || value === undefined) {
        return <span className="text-muted">-</span>;
    }

    if (typeof value === 'boolean') {
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                value ? 'bg-success-muted text-success-strong' : 'bg-danger-muted text-danger-strong'
            }`}>
                {value ? 'Yes' : 'No'}
            </span>
        );
    }

    if (value instanceof Date) {
        return value.toLocaleDateString();
    }

    // Objects: try common property names for display; otherwise a placeholder, never the object.
    if (typeof value === 'object') {
        const label = objectLabel(value);
        return label ?? <span className="text-muted">-</span>;
    }

    return String(value);
}

type AnyComponent = ((props: any) => React.ReactNode) & { prototype?: { isReactComponent?: unknown } };

/**
 * The visible text of a React node: strings and numbers as they are, elements by their children (an `img` by its
 * `alt`), fragments, `memo` and `forwardRef` unwrapped, and plain function components called with their props.
 * A component that can't be called outside rendering (hooks, a class) gives ''.
 */
export const reactNodeToText = (node: React.ReactNode): string => {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') return String(node);
    if (Array.isArray(node)) return node.map(reactNodeToText).join('');
    if (!React.isValidElement(node)) return '';

    const element = node as React.ReactElement<any>;
    const { type, props } = element;
    if (typeof type === 'string') {
        if (type === 'img') return props?.alt ? String(props.alt) : '';
        if (type === 'br') return ' ';
        return reactNodeToText(props?.children);
    }
    if (type === React.Fragment) return reactNodeToText(props?.children);

    const inner = (type as any)?.$$typeof === Symbol.for('react.memo') ? (type as any).type : type;
    try {
        if ((inner as any)?.$$typeof === Symbol.for('react.forward_ref')) {
            return reactNodeToText((inner as any).render(props, null));
        }
        if (typeof inner === 'function' && !(inner as AnyComponent).prototype?.isReactComponent) {
            return reactNodeToText((inner as AnyComponent)(props));
        }
    } catch {
        // A component with hooks only runs while React renders.
        return '';
    }
    return '';
};

/** Collapses runs of white space (line breaks from nested elements) to one space. */
const tidy = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** The text of `column`'s cell of `row`, for a CSV export (see the header). */
export function cellText<T>(row: T, column: ColumnDefinition<T>): string {
    if (column.render) {
        return tidy(reactNodeToText(column.render(row)));
    }
    const value = getValueByKeyPath(row, column.key);
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date) return value.toLocaleDateString();
    if (typeof value === 'object') return objectLabel(value) ?? '';
    return String(value);
}
