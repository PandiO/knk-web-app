import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowUpZA, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';

type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };

export type ObjectTypeSortDirection = 'asc' | 'desc';

/**
 * A section of the explorer list.
 *
 * `entityNames` holds lower-cased entity names (ids) that belong to the group. A group that
 * omits `entityNames` is the fallback group: it collects every entity no explicit group
 * claimed. Without a fallback group the last group collects them. An entity matched by
 * several explicit groups lands in the first one.
 */
export type ObjectTypeExplorerGroup = {
  id: string;
  title: string;
  entityNames?: ReadonlySet<string>;
  defaultExpanded: boolean;
  collapsible: boolean;
};

type Props = {
  items?: ObjectType[];
  entityMetadata?: EntityMetadataDto[];
  onSelect?: (type: string) => void;
  selectedId?: string;
  /** Show the search box and sort toggle. Defaults to true. */
  searchable?: boolean;
  /** Split the list into sections. Omit for one flat list. */
  groups?: ObjectTypeExplorerGroup[];
  /** Remembers sort direction and group expansion in localStorage under this page key. */
  storageKey?: string;
};

type ExplorerItem = { id: string; label: string };
type ExpandedState = Record<string, boolean>;

const STORAGE_PREFIX = 'objectTypeExplorer';

export const getSortStorageKey = (storageKey: string) => `${STORAGE_PREFIX}.${storageKey}.sort`;
export const getExpandedStorageKey = (storageKey: string) => `${STORAGE_PREFIX}.${storageKey}.expandedGroups`;

const readStorage = (key: string | undefined): string | null => {
  if (!key) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string | undefined, value: string) => {
  if (!key) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the explorer works without it.
  }
};

const readSortDirection = (storageKey?: string): ObjectTypeSortDirection => {
  const stored = readStorage(storageKey ? getSortStorageKey(storageKey) : undefined);
  return stored === 'desc' ? 'desc' : 'asc';
};

const readExpandedState = (storageKey?: string): ExpandedState => {
  const stored = readStorage(storageKey ? getExpandedStorageKey(storageKey) : undefined);
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
    );
  } catch {
    return {};
  }
};

const compareLabels = (a: ExplorerItem, b: ExplorerItem) =>
  a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) ||
  a.id.localeCompare(b.id, undefined, { sensitivity: 'base' });

const findGroupIndex = (itemId: string, groups: ObjectTypeExplorerGroup[]): number => {
  const key = itemId.toLowerCase();
  const explicit = groups.findIndex(group => group.entityNames?.has(key));
  if (explicit >= 0) return explicit;
  const fallback = groups.findIndex(group => !group.entityNames);
  return fallback >= 0 ? fallback : groups.length - 1;
};

const ObjectTypeExplorer = ({
  items = [],
  entityMetadata = [],
  onSelect,
  selectedId,
  searchable = true,
  groups,
  storageKey,
}: Props) => {
  const [query, setQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<ObjectTypeSortDirection>(() => readSortDirection(storageKey));
  const [expandedState, setExpandedState] = useState<ExpandedState>(() => readExpandedState(storageKey));
  // Collapsed groups opened to show the selected entity; transient, never persisted.
  const [revealedGroupIds, setRevealedGroupIds] = useState<ReadonlySet<string>>(() => new Set());
  // Groups the user collapsed while the current search had auto-expanded them.
  const [searchCollapsedGroupIds, setSearchCollapsedGroupIds] = useState<ReadonlySet<string>>(() => new Set());

  const sourceItems = useMemo<ExplorerItem[]>(() => {
    if (entityMetadata.length > 0) {
      return entityMetadata.map(meta => ({
        id: meta.entityName,
        label: meta.displayName || meta.entityName,
      }));
    }

    return items.map(type => ({
      id: type.id,
      label: type.label,
    }));
  }, [entityMetadata, items]);

  const normalizedQuery = searchable ? query.trim().toLowerCase() : '';
  const searchActive = normalizedQuery.length > 0;
  const normalizedSelectedId = selectedId?.toLowerCase();

  const visibleItems = useMemo(() => {
    const filtered = searchActive
      ? sourceItems.filter(item =>
          item.label.toLowerCase().includes(normalizedQuery) || item.id.toLowerCase().includes(normalizedQuery)
        )
      : sourceItems;
    const sorted = [...filtered].sort(compareLabels);
    return sortDirection === 'desc' ? sorted.reverse() : sorted;
  }, [sourceItems, normalizedQuery, searchActive, sortDirection]);

  const activeGroups = groups && groups.length > 0 ? groups : undefined;

  const groupedItems = useMemo(() => {
    if (!activeGroups) return [];
    const buckets: ExplorerItem[][] = activeGroups.map(() => []);
    visibleItems.forEach(item => buckets[findGroupIndex(item.id, activeGroups)].push(item));
    return activeGroups.map((group, index) => ({ group, items: buckets[index] }));
  }, [activeGroups, visibleItems]);

  const isBaseExpanded = useCallback(
    (group: ObjectTypeExplorerGroup) => !group.collapsible || (expandedState[group.id] ?? group.defaultExpanded),
    [expandedState]
  );

  // The group holding the selection, if the selection exists in the list at all.
  const selectedGroupId = useMemo(() => {
    if (!activeGroups || !normalizedSelectedId) return undefined;
    const selectedItem = sourceItems.find(item => item.id.toLowerCase() === normalizedSelectedId);
    return selectedItem ? activeGroups[findGroupIndex(selectedItem.id, activeGroups)].id : undefined;
  }, [activeGroups, normalizedSelectedId, sourceItems]);

  useEffect(() => {
    if (!selectedGroupId || !activeGroups) return;
    const group = activeGroups.find(candidate => candidate.id === selectedGroupId);
    if (!group || isBaseExpanded(group)) return;
    setRevealedGroupIds(previous => {
      if (previous.has(selectedGroupId)) return previous;
      const next = new Set(previous);
      next.add(selectedGroupId);
      return next;
    });
    // Only react to the selection moving into a group, not to every expand/collapse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, activeGroups]);

  const isExpanded = (group: ObjectTypeExplorerGroup, matchCount: number) => {
    if (isBaseExpanded(group)) return true;
    if (revealedGroupIds.has(group.id)) return true;
    return searchActive && matchCount > 0 && !searchCollapsedGroupIds.has(group.id);
  };

  const toggleGroup = (group: ObjectTypeExplorerGroup, currentlyExpanded: boolean) => {
    const nextExpanded = !currentlyExpanded;
    setExpandedState(previous => {
      const next = { ...previous, [group.id]: nextExpanded };
      writeStorage(storageKey ? getExpandedStorageKey(storageKey) : undefined, JSON.stringify(next));
      return next;
    });
    setRevealedGroupIds(previous => {
      if (!previous.has(group.id)) return previous;
      const next = new Set(previous);
      next.delete(group.id);
      return next;
    });
    setSearchCollapsedGroupIds(previous => {
      const next = new Set(previous);
      if (nextExpanded) {
        next.delete(group.id);
      } else if (searchActive) {
        next.add(group.id);
      }
      return next;
    });
  };

  const toggleSort = () => {
    setSortDirection(previous => {
      const next: ObjectTypeSortDirection = previous === 'asc' ? 'desc' : 'asc';
      writeStorage(storageKey ? getSortStorageKey(storageKey) : undefined, next);
      return next;
    });
  };

  const updateQuery = (value: string) => {
    setQuery(value);
    setSearchCollapsedGroupIds(previous => (previous.size === 0 ? previous : new Set()));
  };

  const renderItems = (list: ExplorerItem[], listId?: string) => (
    <ul id={listId} className="space-y-1 font-medium">
      {list.map(type => {
        const selected = normalizedSelectedId !== undefined && type.id.toLowerCase() === normalizedSelectedId;
        return (
          <li key={type.id}>
            <button
              type="button"
              onClick={() => {
                onSelect?.(type.id);
              }}
              aria-current={selected ? 'true' : undefined}
              title={type.label !== type.id ? type.id : undefined}
              className={`
                w-full text-left px-4 py-2 text-sm flex items-center justify-between rounded-md
                ${selected
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <span className="flex items-center truncate">
                {type.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const renderGroups = () =>
    groupedItems
      .filter(({ items: groupItems }) => groupItems.length > 0)
      .map(({ group, items: groupItems }) => {
        const expanded = isExpanded(group, groupItems.length);
        const listId = `object-type-explorer-group-${group.id}`;
        const heading = (
          <span className="truncate">
            {group.title} ({groupItems.length})
          </span>
        );

        return (
          <section key={group.id} className="space-y-1" aria-label={group.title}>
            {group.collapsible ? (
              <button
                type="button"
                onClick={() => toggleGroup(group, expanded)}
                aria-expanded={expanded}
                aria-controls={listId}
                className="w-full flex items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
              >
                {expanded
                  ? <ChevronDown className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  : <ChevronRight className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
                {heading}
              </button>
            ) : (
              <h3 className="flex items-center px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {heading}
              </h3>
            )}
            {expanded && renderItems(groupItems, listId)}
          </section>
        );
      });

  const SortIcon = sortDirection === 'asc' ? ArrowDownAZ : ArrowUpZA;

  return (
    <>
      {/* offset from top by the navbar height (h-16) */}
      <aside className="ObjectTypeExplorer-component fixed top-16 left-0 z-40 w-64 h-screen transition-transform -translate-x-full sm:translate-x-0" aria-label="Sidebar">
        <div className="h-full px-3 pb-20 overflow-y-auto rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-nones">
          {searchable && (
            <div className="sticky top-0 z-10 bg-white pt-4 pb-2 flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={event => updateQuery(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Escape' && query) {
                      event.preventDefault();
                      updateQuery('');
                    }
                  }}
                  placeholder="Search entity types"
                  aria-label="Search entity types"
                  className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-7 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => updateQuery('')}
                    aria-label="Clear search"
                    title="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={toggleSort}
                aria-label="Sort Z to A"
                aria-pressed={sortDirection === 'desc'}
                title={sortDirection === 'asc' ? 'Sorted A–Z (click for Z–A)' : 'Sorted Z–A (click for A–Z)'}
                className="flex-shrink-0 rounded-md border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              >
                <SortIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
          <div className={searchable ? 'pt-1' : 'pt-4'}>
            {visibleItems.length === 0 && searchActive ? (
              <p className="px-2 py-4 text-sm text-gray-500" role="status">
                No entity types match
              </p>
            ) : activeGroups ? (
              <div className="space-y-3">{renderGroups()}</div>
            ) : (
              renderItems(visibleItems)
            )}
          </div>
        </div>
        <div className="sidebar-separator" />
      </aside>
    </>
  );
};

export default ObjectTypeExplorer;
