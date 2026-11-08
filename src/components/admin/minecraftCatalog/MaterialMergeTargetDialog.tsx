import React from 'react';
import { minecraftMaterialRefClient } from '../../../apiClients/minecraftMaterialRefClient';
import { MinecraftMaterialRefListDto } from '../../../types/dtos/minecraftMaterialRef/MinecraftMaterialRefDto';
import { MinecraftCatalogAuditMaterialDto } from '../../../types/dtos/minecraftCatalog/MinecraftCatalogDtos';
import { MinecraftIcon } from '../../minecraft/MinecraftIcon';
import { Dialog } from '../../Dialog';

// KNG-200 §8 step 4: "merge A into B". The target is picked with the plain admin search
// (POST MinecraftMaterialRefs/search without the Picker flag), which lists every stored row.
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

  // Only stored rows other than the source can be a target.
  const candidates = results.filter(
    (row): row is MinecraftMaterialRefListDto & { id: number } =>
      typeof row.id === 'number' && row.id > 0 && row.id !== source.id,
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Merge ${source.namespaceKey} into…`}
      description={`Pick the material that takes over its ${source.totalReferences} reference${source.totalReferences === 1 ? '' : 's'}. You confirm before anything changes.`}
      size="lg"
      closeOnBackdrop
      closeLabel="Close"
      bodyClassName="px-6 py-4 space-y-3"
    >
      <input
        type="search"
        className="input px-3 py-2"
        aria-label="Search materials"
        placeholder="Search by key or name"
        value={term}
        data-autofocus
        onChange={(event) => setTerm(event.target.value)}
      />
      {error && <p role="alert" className="text-sm text-danger-strong">{error}</p>}
      {searching && <p className="text-sm text-muted">Searching…</p>}
      {!searching && term.trim().length >= 2 && candidates.length === 0 && !error && (
        <p className="text-sm text-muted">No other stored material matches.</p>
      )}
      <ul className="max-h-72 overflow-y-auto divide-y divide-line" aria-label="Merge targets">
        {candidates.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-2 py-2 text-left text-sm hover:bg-surface-alt"
              onClick={() => onPick({ id: row.id, namespaceKey: row.namespaceKey, displayName: row.displayName })}
            >
              <MinecraftIcon src={row.iconUrl} alt={row.displayName || row.namespaceKey} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-fg truncate">{row.displayName || row.namespaceKey}</span>
                <span className="block font-mono text-xs text-muted truncate">{row.namespaceKey} · #{row.id}</span>
              </span>
              {row.catalogStatus && row.catalogStatus !== 'Active' && (
                <span className="rounded bg-warning-muted px-1.5 py-0.5 text-xs text-warning-strong">{row.catalogStatus}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
};
