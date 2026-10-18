import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownAZ, ArrowUpZA, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react';
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
  /** Remembers sort direction, group expansion and the collapsed sidebar in localStorage under this page key. */
  storageKey?: string;
};

type ExplorerItem = { id: string; label: string };
type ExpandedState = Record<string, boolean>;

const STORAGE_PREFIX = 'objectTypeExplorer';

export const getSortStorageKey = (storageKey: string) => `${STORAGE_PREFIX}.${storageKey}.sort`;
export const getExpandedStorageKey = (storageKey: string) => `${STORAGE_PREFIX}.${storageKey}.expandedGroups`;
export const getCollapsedStorageKey = (storageKey: string) => `${STORAGE_PREFIX}.${storageKey}.collapsed`;

/**
 * KNG-94: from Tailwind's `md` up the explorer sits beside the content and can be collapsed to a
 * rail; below it, it is a rail that opens the list as an overlay drawer.
 */
export const DOCKED_MEDIA_QUERY = '(min-width: 768px)';

const matchesDocked = () =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? true
    : window.matchMedia(DOCKED_MEDIA_QUERY).matches;

const useDocked = () => {
  const [docked, setDocked] = useState(matchesDocked);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(DOCKED_MEDIA_QUERY);
    const update = () => setDocked(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return docked;
};

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
  const docked = useDocked();
  // Docked: collapsed to the rail, remembered per page. Narrow screens: the drawer, always closed at first.
  const [collapsed, setCollapsed] = useState(
    () => readStorage(storageKey ? getCollapsedStorageKey(storageKey) : undefined) === 'true'
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const panelId = `object-type-explorer-panel-${useId().replace(/:/g, '')}`;
  const panelVisible = docked ? !collapsed : drawerOpen;
  // The toggle moves between the rail and the panel header; keep keyboard focus on it.
  const toggleRef = useRef<HTMLButtonElement>(null);
  const refocusToggle = useRef(false);
  useEffect(() => {
    if (!refocusToggle.current) return;
    refocusToggle.current = false;
    toggleRef.current?.focus();
  }, [panelVisible]);
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
                // On a narrow screen the drawer covers the page: picking a type closes it.
                if (!docked) setDrawerOpen(false);
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
        // The title wraps rather than being cut off in the narrow sidebar; the count always shows
        // (KNG-61 live test: "WITHOUT DISPLAY CONFIGURA..." hid the count).
        const heading = (
          <>
            <span className="min-w-0 break-words text-left">{group.title}</span>{' '}
            <span className="ml-auto flex-shrink-0 pl-1 tabular-nums">({groupItems.length})</span>
          </>
        );

        return (
          <section key={group.id} className="space-y-1" aria-label={group.title}>
            {group.collapsible ? (
              <button
                type="button"
                onClick={() => toggleGroup(group, expanded)}
                aria-expanded={expanded}
                aria-controls={listId}
                className="w-full flex items-start gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
              >
                {expanded
                  ? <ChevronDown className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  : <ChevronRight className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
                {heading}
              </button>
            ) : (
              <h3 className="flex items-start gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {heading}
              </h3>
            )}
            {expanded && renderItems(groupItems, listId)}
          </section>
        );
      });

  const SortIcon = sortDirection === 'asc' ? ArrowDownAZ : ArrowUpZA;

  const togglePanel = () => {
    refocusToggle.current = true;
    if (!docked) {
      setDrawerOpen(open => !open);
      return;
    }
    setCollapsed(previous => {
      const next = !previous;
      writeStorage(storageKey ? getCollapsedStorageKey(storageKey) : undefined, String(next));
      return next;
    });
  };

  // The drawer leaves with Escape too.
  useEffect(() => {
    if (docked || !drawerOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [docked, drawerOpen]);

  const ToggleIcon = panelVisible ? PanelLeftClose : PanelLeftOpen;
  const toggleButton = (
    <button
      ref={toggleRef}
      type="button"
      onClick={togglePanel}
      aria-expanded={panelVisible}
      aria-controls={panelId}
      aria-label={panelVisible ? 'Hide entity types' : 'Show entity types'}
      title={panelVisible ? 'Hide entity types' : 'Show entity types'}
      className="flex-shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
    >
      <ToggleIcon className="h-5 w-5" aria-hidden="true" />
    </button>
  );

  const panel = (
      <div
        id={panelId}
        hidden={!panelVisible}
        className={`${docked
          ? 'h-full'
          : 'fixed bottom-0 left-0 top-16 z-40 w-72 max-w-[85vw]'
        } ${panelVisible ? 'flex' : 'hidden'} flex-col overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Entity types</span>
          {/* One toggle at a time: here while the panel shows, on the rail otherwise. */}
          {panelVisible && toggleButton}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
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
      </div>
  );

  // KNG-94: the explorer takes its real width in the page layout (it used to be `fixed` over a
  // 30% column and covered the content below ~850px). Docked it is a panel or, collapsed, a rail;
  // on narrow screens a rail whose button opens the list as a drawer over the page.
  return (
    <aside
      aria-label="Sidebar"
      className={`relative flex h-full flex-col ${docked && panelVisible ? 'w-64' : 'w-10'}`}
    >
      {!panelVisible && (
        <div className="flex h-full flex-col items-center rounded-md bg-white py-2 shadow-sm ring-1 ring-black ring-opacity-5">
          {toggleButton}
        </div>
      )}
      {docked ? panel : createPortal(
        // The drawer goes to <body>: inside the sticky sidebar column its z-index can't lift it
        // above the page content.
        <>
          {panelVisible && (
            <div className="fixed inset-x-0 bottom-0 top-16 z-30 bg-black bg-opacity-30" aria-hidden="true" onClick={() => setDrawerOpen(false)} />
          )}
          {panel}
        </>,
        document.body
      )}
    </aside>
  );
};

export default ObjectTypeExplorer;
