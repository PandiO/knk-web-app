import React from 'react';
import { X } from 'lucide-react';
import { minecraftMaterialRefClient } from '../../../apiClients/minecraftMaterialRefClient';
import { MinecraftMaterialRefListDto } from '../../../types/dtos/minecraftMaterialRef/MinecraftMaterialRefDto';
import { MinecraftCatalogAuditMaterialDto } from '../../../types/dtos/minecraftCatalog/MinecraftCatalogDtos';
import { MinecraftIcon } from '../../minecraft/MinecraftIcon';

// KNG-200 §8 step 4: "merge A into B". The target is picked from the stored materials only
// (POST MinecraftMaterialRefs/search without SearchHybrid), since a merge needs a real row id.
// Picking only chooses: the card asks for confirmation and runs the merge.

export const MERGE_SEARCH_PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 250;

export interface MergeTarget {
  id: number;
  namespaceKey: string;
  displayName?: string | null;
}

export const MaterialMergeTargetDialog: React.FC<{
  source: MinecraftCatalogAuditMaterialDto;
  onPick: (target: MergeTarget) => void;
  onClose: () => void;
}> = ({ source, onPick, onClose }) => {
  // Start from the material's own name: the replacement usually shares it.
  const initialTerm = (source.normalizedKey ?? source.namespaceKey).replace(/^minecraft:/, '');
  const [term, setTerm] = React.useState(initialTerm);
  const [results, setResults] = React.useState<MinecraftMaterialRefListDto[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      setError(null);
      minecraftMaterialRefClient
        .searchPaged({ page: 1, pageSize: MERGE_SEARCH_PAGE_SIZE, searchTerm: query })
        .then((page) => {
          if (!cancelled) setResults(page?.items ?? []);
        })
        .catch((err: unknown) => {
          console.error('Failed to search materials:', err);
          if (!cancelled) setError('Could not search the materials.');
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Only stored rows other than the source can be a target.
  const candidates = results.filter(
    (row): row is MinecraftMaterialRefListDto & { id: number } =>
      typeof row.id === 'number' && row.id > 0 && row.id !== source.id,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-target-title"
        className="w-full max-w-lg rounded-lg bg-white shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="merge-target-title" className="text-lg font-semibold">Merge {source.namespaceKey} into…</h2>
            <p className="mt-1 text-sm text-gray-500">
              Pick the material that takes over its {source.totalReferences} reference{source.totalReferences === 1 ? '' : 's'}. You confirm before anything changes.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <input
            type="search"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            aria-label="Search materials"
            placeholder="Search by key or name"
            value={term}
            autoFocus
            onChange={(event) => setTerm(event.target.value)}
          />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {searching && <p className="text-sm text-gray-500">Searching…</p>}
          {!searching && term.trim().length >= 2 && candidates.length === 0 && !error && (
            <p className="text-sm text-gray-500">No other stored material matches.</p>
          )}
          <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100" aria-label="Merge targets">
            {candidates.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-2 py-2 text-left text-sm hover:bg-gray-50"
                  onClick={() => onPick({ id: row.id, namespaceKey: row.namespaceKey, displayName: row.displayName })}
                >
                  <MinecraftIcon src={row.iconUrl} alt={row.displayName || row.namespaceKey} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-gray-900 truncate">{row.displayName || row.namespaceKey}</span>
                    <span className="block font-mono text-xs text-gray-500 truncate">{row.namespaceKey} · #{row.id}</span>
                  </span>
                  {row.catalogStatus && row.catalogStatus !== 'Active' && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">{row.catalogStatus}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
