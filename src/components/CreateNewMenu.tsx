import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FilePlus2, Plus } from 'lucide-react';
import { useEntityMetadata } from '../hooks/useEntityMetadata';
import { hasCreateFunctionForEntity } from '../utils/entityApiMapping';
import { dashboardPath, newFormPath } from '../utils/returnTo';

type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };

export type CreateMenuItem = { entityName: string; label: string; icon: React.ReactNode };

/**
 * The types the Create New menu offers (#177 link 2, #39 CRUD-2): every entity type in the API's
 * metadata that the app can create (a create client in `entityApiMapping`), A-Z by label. Replaces
 * the hand-kept list in `config/objectConfigs.tsx`, which offered `itemType` (no API mapping) and
 * missed about 15 types. Without metadata (loading or failed) the built-in list is the fallback,
 * with the same create check. Icons come from the built-in list where it has one.
 */
export function buildCreateMenuItems(
    metadata: ReadonlyArray<{ entityName: string; displayName?: string | null }>,
    builtIn: ReadonlyArray<ObjectType>,
    canCreate: (entityName: string) => boolean = hasCreateFunctionForEntity,
): CreateMenuItem[] {
    const iconByName = new Map(builtIn.map(type => [type.id.toLowerCase(), type.icon]));
    const source = metadata.length > 0
        ? metadata.map(meta => ({ entityName: meta.entityName, label: meta.displayName || meta.entityName }))
        : builtIn.map(type => ({ entityName: type.id, label: type.label }));
    const seen = new Set<string>();
    return source
        .filter(item => {
            const key = item.entityName.toLowerCase();
            if (seen.has(key) || !canCreate(item.entityName)) return false;
            seen.add(key);
            return true;
        })
        .map(item => ({
            ...item,
            icon: iconByName.get(item.entityName.toLowerCase()) ?? <FilePlus2 className="h-5 w-5" />,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

/** Where a Create New pick goes: the default form, back to the dashboard on that type afterwards. */
export const createMenuTarget = (entityName: string): string => newFormPath(entityName, dashboardPath(entityName));

type Props = { objectTypes: ObjectType[] };

/**
 * The navigation bar's "Create New" button (#177 link 2). One navigate per pick (the old menu
 * called navigate() twice). Keyboard: the filter box gets focus on open, ArrowUp/ArrowDown move
 * through the matches, Enter opens one, Escape closes the menu.
 */
export const CreateNewMenu: React.FC<Props> = ({ objectTypes }) => {
    const navigate = useNavigate();
    const { baseMetadata } = useEntityMetadata();
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const filterRef = useRef<HTMLInputElement>(null);
    const listId = 'create-new-menu-list';

    const items = useMemo(() => buildCreateMenuItems(baseMetadata, objectTypes), [baseMetadata, objectTypes]);
    const visible = useMemo(() => {
        const wanted = filter.trim().toLowerCase();
        if (!wanted) return items;
        return items.filter(item =>
            item.label.toLowerCase().includes(wanted) || item.entityName.toLowerCase().includes(wanted)
        );
    }, [items, filter]);

    useEffect(() => {
        if (!open) return undefined;
        filterRef.current?.focus();
        const onMouseDown = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onMouseDown);
        return () => document.removeEventListener('mousedown', onMouseDown);
    }, [open]);

    useEffect(() => {
        setActiveIndex(0);
    }, [filter, open]);

    const close = (returnFocus: boolean) => {
        setOpen(false);
        setFilter('');
        if (returnFocus) buttonRef.current?.focus();
    };

    const pick = (item: CreateMenuItem) => {
        close(false);
        navigate(createMenuTarget(item.entityName));
    };

    const onKeyDown = (event: React.KeyboardEvent) => {
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                if (visible.length > 0) setActiveIndex(index => (index + 1) % visible.length);
                break;
            case 'ArrowUp':
                event.preventDefault();
                if (visible.length > 0) setActiveIndex(index => (index - 1 + visible.length) % visible.length);
                break;
            case 'Enter':
                if (event.target === filterRef.current && visible[activeIndex]) {
                    event.preventDefault();
                    pick(visible[activeIndex]);
                }
                break;
            case 'Escape':
                event.preventDefault();
                close(true);
                break;
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => (open ? close(false) : setOpen(true))}
                className="btn-primary inline-flex items-center whitespace-nowrap"
                title="Create a new object"
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
            >
                <Plus className="h-5 w-5 sm:mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Create New</span>
                <span className="sr-only sm:hidden">Create New</span>
            </button>

            {open && (
                <div
                    className="origin-top-right absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10"
                    onKeyDown={onKeyDown}
                >
                    <div className="border-b border-gray-100 p-2">
                        <input
                            ref={filterRef}
                            type="search"
                            value={filter}
                            onChange={event => setFilter(event.target.value)}
                            placeholder="Filter types"
                            aria-label="Filter entity types to create"
                            aria-controls={listId}
                            aria-activedescendant={visible[activeIndex] ? `${listId}-${visible[activeIndex].entityName}` : undefined}
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <ul id={listId} className="max-h-80 overflow-y-auto py-1" aria-label="Entity types">
                        {visible.length === 0 && (
                            <li className="px-4 py-2 text-sm text-gray-500" role="status">
                                {items.length === 0 ? 'Loading entity types…' : 'No entity types match'}
                            </li>
                        )}
                        {visible.map((item, index) => (
                            <li key={item.entityName}>
                                <button
                                    id={`${listId}-${item.entityName}`}
                                    type="button"
                                    onClick={() => pick(item)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${
                                        index === activeIndex ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="flex min-w-0 items-center">
                                        <span className="mr-3 flex-shrink-0 text-gray-400" aria-hidden="true">{item.icon}</span>
                                        <span className="truncate">{item.label}</span>
                                    </span>
                                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default CreateNewMenu;
