import React from 'react';
import { AlertTriangle, CheckCircle2, GitMerge, Loader2, RefreshCcw, Wrench } from 'lucide-react';
import { minecraftCatalogClient } from '../../../apiClients/minecraftCatalogClient';
import {
  MinecraftCatalogAuditBlockDto,
  MinecraftCatalogAuditDto,
  MinecraftCatalogAuditEnchantmentDto,
  MinecraftCatalogAuditMaterialDto,
  MinecraftCatalogBackfillResultDto,
} from '../../../types/dtos/minecraftCatalog/MinecraftCatalogDtos';
import { useConfirm } from '../../../hooks/useConfirm';
import { apiRefusalReason } from '../../../utils/apiRefusalReason';
import { describeReferences, sumCounts } from './minecraftCatalogFormat';
import { MaterialMergeTargetDialog, MergeTarget } from './MaterialMergeTargetDialog';

// KNG-200 §8 steps 3-4: what the audit says needs a person. Materials the latest scan no longer
// has but something still references get "Merge into…"; notation collisions merge into the row
// that is kept. Block refs have no referrers and are listed read-only. The backfill is idempotent.

/** The row of a collision group that is kept by default: the one already in normal form, else the most used. */
export const defaultKeptRow = (group: MinecraftCatalogAuditMaterialDto[]): MinecraftCatalogAuditMaterialDto | undefined =>
  group.find((row) => row.normalizedKey !== null && row.namespaceKey === row.normalizedKey)
  ?? [...group].sort((a, b) => b.totalReferences - a.totalReferences)[0];

const groupKey = (group: MinecraftCatalogAuditMaterialDto[]): string =>
  group[0]?.normalizedKey ?? group.map((row) => row.id).join('-');

export const MinecraftCatalogAuditCard: React.FC<{
  audit: MinecraftCatalogAuditDto | null;
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void> | void;
}> = ({ audit, loading, error, onReload }) => {
  const [confirm, confirmModal] = useConfirm();
  const [mergeSource, setMergeSource] = React.useState<MinecraftCatalogAuditMaterialDto | null>(null);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [kept, setKept] = React.useState<Record<string, number>>({});
  const [backfilling, setBackfilling] = React.useState(false);
  const [backfillResult, setBackfillResult] = React.useState<MinecraftCatalogBackfillResultDto | null>(null);

  const merge = async (source: MinecraftCatalogAuditMaterialDto, target: MergeTarget) => {
    const refs = source.totalReferences;
    const targetLabel = `${target.namespaceKey} (#${target.id})`;
    if (!(await confirm({
      title: 'Merge this material?',
      message: `Merge ${source.namespaceKey} (#${source.id}) into ${targetLabel}? Its ${refs} reference${refs === 1 ? '' : 's'} move to ${target.namespaceKey} and ${source.namespaceKey} is deleted. This can't be undone.`,
      confirmLabel: 'Merge',
      danger: true,
    }))) {
      return;
    }
    setBusyId(source.id);
    setMessage(null);
    setActionError(null);
    try {
      const result = await minecraftCatalogClient.mergeMaterial(source.id, target.id);
      const moved = sumCounts(result?.repointed);
      setMessage(`Merged ${source.namespaceKey} into ${target.namespaceKey}: ${moved} reference${moved === 1 ? '' : 's'} repointed.`);
      await onReload();
    } catch (err) {
      console.error('Failed to merge the material:', err);
      setActionError(apiRefusalReason(err) ?? `Could not merge ${source.namespaceKey}.`);
    } finally {
      setBusyId(null);
    }
  };

  const pickTarget = (target: MergeTarget) => {
    const source = mergeSource;
    setMergeSource(null);
    if (source) void merge(source, target);
  };

  const runBackfill = async () => {
    setBackfilling(true);
    setMessage(null);
    setActionError(null);
    try {
      setBackfillResult(await minecraftCatalogClient.runBackfill());
      await onReload();
    } catch (err) {
      console.error('Failed to run the catalogue backfill:', err);
      setActionError(apiRefusalReason(err) ?? 'Could not run the backfill.');
    } finally {
      setBackfilling(false);
    }
  };

  const mergeButton = (row: MinecraftCatalogAuditMaterialDto) => (
    <button
      type="button"
      className="btn-secondary !px-2 !py-1 text-xs"
      onClick={() => setMergeSource(row)}
      disabled={busyId !== null}
      aria-label={`Merge ${row.namespaceKey} into another material`}
    >
      <GitMerge className="h-3.5 w-3.5 mr-1 inline" aria-hidden="true" />
      {busyId === row.id ? 'Merging…' : 'Merge into…'}
    </button>
  );

  const blockIssues = audit
    ? audit.duplicateBlockStates.length + audit.invalidBlockStates.length + audit.unlinkedBlockRefs.length + audit.notCanonicalBlockRefs.length
    : 0;
  const materialIssues = audit
    ? audit.missingButReferenced.length + audit.materialKeyCollisions.length + audit.invalidMaterialKeys.length + audit.notNormalizedMaterialKeys.length
    : 0;
  // KNG-250: an older API sends no enchantment section.
  const missingEnchantments = audit?.missingEnchantmentsReferenced ?? [];

  return (
    <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-4" aria-labelledby="catalog-audit-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="catalog-audit-heading" className="text-lg font-semibold flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" aria-hidden="true" />
            Needs attention
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            From the catalogue audit. A merge points everything that uses a material at another one and then deletes it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => void onReload()} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2 inline" aria-hidden="true" />
            Reload audit
          </button>
          <button type="button" className="btn-secondary" onClick={() => void runBackfill()} disabled={backfilling}>
            <Wrench className="h-4 w-4 mr-2 inline" aria-hidden="true" />
            {backfilling ? 'Running backfill…' : 'Run backfill'}
          </button>
        </div>
      </div>

      {message && <p role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>}
      {actionError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{actionError}</p>}
      {backfillResult && <BackfillSummary result={backfillResult} />}
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      {loading && audit === null ? (
        <div className="flex items-center text-sm text-gray-500"><Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />Loading audit…</div>
      ) : audit && (
        <>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
            <div><dt className="inline">Materials: </dt><dd className="inline font-medium text-gray-900">{audit.materialCount}</dd></div>
            <div><dt className="inline">Unverified: </dt><dd className="inline font-medium text-gray-900">{audit.unverifiedCount}</dd></div>
            <div><dt className="inline">Block refs: </dt><dd className="inline font-medium text-gray-900">{audit.blockRefCount}</dd></div>
            {audit.enchantmentCount !== undefined && (
              <div><dt className="inline">Enchantments: </dt><dd className="inline font-medium text-gray-900">{audit.enchantmentCount}</dd></div>
            )}
            {audit.unverifiedEnchantmentCount !== undefined && (
              <div><dt className="inline">Unverified enchantments: </dt><dd className="inline font-medium text-gray-900">{audit.unverifiedEnchantmentCount}</dd></div>
            )}
            <div className="flex items-center">
              <dt className="inline mr-1">Ready for the phase 4 constraints: </dt>
              <dd className={`inline font-medium ${audit.readyForConstraints ? 'text-green-700' : 'text-amber-700'}`}>
                {audit.readyForConstraints ? 'yes' : 'no'}
              </dd>
            </div>
          </dl>

          {materialIssues === 0 && blockIssues === 0 && missingEnchantments.length === 0 && (
            <p className="flex items-center text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 mr-2" aria-hidden="true" />
              Nothing needs attention.
            </p>
          )}

          {audit.missingButReferenced.length > 0 && (
            <AuditGroup title="Missing from the server but still used" count={audit.missingButReferenced.length}
              hint="The latest scan doesn't have these materials, but something still references them. Merge each into its replacement.">
              <MaterialTable label="Missing but referenced materials" rows={audit.missingButReferenced} showReferences action={mergeButton} />
            </AuditGroup>
          )}

          {missingEnchantments.length > 0 && (
            <AuditGroup title="Missing enchantments still used" count={missingEnchantments.length}
              hint="The latest scan doesn't have these enchantments, but enchantment definitions still use them. Point each definition at another enchantment, or delete it.">
              <EnchantmentTable label="Missing enchantments still used" rows={missingEnchantments} />
            </AuditGroup>
          )}

          {audit.materialKeyCollisions.length > 0 && (
            <AuditGroup title="Key collisions" count={audit.materialKeyCollisions.length}
              hint="These rows have the same key once normalised. Choose the row to keep and merge the others into it.">
              <div className="space-y-3">
                {audit.materialKeyCollisions.map((group) => {
                  const key = groupKey(group);
                  const keptRow = group.find((row) => row.id === kept[key]) ?? defaultKeptRow(group);
                  return (
                    <div key={key} className="rounded border border-gray-200" role="group" aria-label={`Collision ${key}`}>
                      <div className="px-3 py-1.5 bg-gray-50 text-xs font-mono text-gray-600 border-b border-gray-200">{key}</div>
                      <table className="min-w-full text-sm">
                        <tbody>
                          {group.map((row) => {
                            const isKept = keptRow?.id === row.id;
                            return (
                              <tr key={row.id} className="border-b border-gray-100 last:border-0">
                                <td className="px-3 py-1.5 w-20">
                                  <label className="inline-flex items-center gap-1 text-xs text-gray-600">
                                    <input
                                      type="radio"
                                      name={`keep-${key}`}
                                      checked={isKept}
                                      onChange={() => setKept((previous) => ({ ...previous, [key]: row.id }))}
                                      aria-label={`Keep ${row.namespaceKey} (#${row.id})`}
                                    />
                                    Keep
                                  </label>
                                </td>
                                <td className="px-3 py-1.5 font-mono">{row.namespaceKey}</td>
                                <td className="px-3 py-1.5 text-gray-500">#{row.id}</td>
                                <td className="px-3 py-1.5 text-gray-600">{describeReferences(row.references)}</td>
                                <td className="px-3 py-1.5 text-right">
                                  {!isKept && keptRow && (
                                    <button
                                      type="button"
                                      className="btn-secondary !px-2 !py-1 text-xs"
                                      disabled={busyId !== null}
                                      onClick={() => void merge(row, keptRow)}
                                      aria-label={`Merge ${row.namespaceKey} (#${row.id}) into ${keptRow.namespaceKey} (#${keptRow.id})`}
                                    >
                                      <GitMerge className="h-3.5 w-3.5 mr-1 inline" aria-hidden="true" />
                                      {busyId === row.id ? 'Merging…' : `Merge into #${keptRow.id}`}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </AuditGroup>
          )}

          {audit.invalidMaterialKeys.length > 0 && (
            <AuditGroup title="Invalid material keys" count={audit.invalidMaterialKeys.length}
              hint="Not a valid namespaced key. Merge them into the material they were meant to be.">
              <MaterialTable label="Invalid material keys" rows={audit.invalidMaterialKeys} showReferences action={mergeButton} />
            </AuditGroup>
          )}

          {audit.notNormalizedMaterialKeys.length > 0 && (
            <AuditGroup title="Keys not in normal form" count={audit.notNormalizedMaterialKeys.length}
              hint="The backfill normalises these unless the normal form is already taken.">
              <MaterialTable label="Keys not in normal form" rows={audit.notNormalizedMaterialKeys} />
            </AuditGroup>
          )}

          {audit.duplicateBlockStates.length > 0 && (
            <AuditGroup title="Duplicate block states" count={audit.duplicateBlockStates.length}
              hint="Block refs with the same identity. Nothing references block refs, so keep one and delete the others.">
              <BlockTable label="Duplicate block states" rows={audit.duplicateBlockStates.flat()} />
            </AuditGroup>
          )}
          {audit.invalidBlockStates.length > 0 && (
            <AuditGroup title="Invalid block states" count={audit.invalidBlockStates.length}>
              <BlockTable label="Invalid block states" rows={audit.invalidBlockStates} />
            </AuditGroup>
          )}
          {audit.unlinkedBlockRefs.length > 0 && (
            <AuditGroup title="Block refs without a material" count={audit.unlinkedBlockRefs.length}>
              <BlockTable label="Block refs without a material" rows={audit.unlinkedBlockRefs} />
            </AuditGroup>
          )}
          {audit.notCanonicalBlockRefs.length > 0 && (
            <AuditGroup title="Block refs not in canonical form" count={audit.notCanonicalBlockRefs.length}
              hint="The stored key, state or state key differs from the canonical form or from the material.">
              <BlockTable label="Block refs not in canonical form" rows={audit.notCanonicalBlockRefs} />
            </AuditGroup>
          )}
        </>
      )}

      {mergeSource && (
        <MaterialMergeTargetDialog source={mergeSource} onPick={pickTarget} onClose={() => setMergeSource(null)} />
      )}
      {confirmModal}
    </section>
  );
};

const AuditGroup: React.FC<{ title: string; count: number; hint?: string; children: React.ReactNode }> = ({ title, count, hint, children }) => (
  <div className="space-y-2">
    <h3 className="text-sm font-semibold">
      {title} <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{count}</span>
    </h3>
    {hint && <p className="text-xs text-gray-500">{hint}</p>}
    <div className="overflow-x-auto">{children}</div>
  </div>
);

const MaterialTable: React.FC<{
  label: string;
  rows: MinecraftCatalogAuditMaterialDto[];
  showReferences?: boolean;
  action?: (row: MinecraftCatalogAuditMaterialDto) => React.ReactNode;
}> = ({ label, rows, showReferences = false, action }) => (
  <table className="min-w-full text-sm" aria-label={label}>
    <thead>
      <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
        <th className="py-1.5 pr-3 font-medium">Key</th>
        <th className="py-1.5 pr-3 font-medium">Name</th>
        <th className="py-1.5 pr-3 font-medium">#</th>
        {showReferences && <th className="py-1.5 pr-3 font-medium">Used by</th>}
        {action && <th className="py-1.5 font-medium"><span className="sr-only">Actions</span></th>}
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.id} className="border-b border-gray-100 last:border-0 align-top">
          <td className="py-1.5 pr-3 font-mono">{row.namespaceKey}</td>
          <td className="py-1.5 pr-3">{row.displayName ?? '—'}</td>
          <td className="py-1.5 pr-3 text-gray-500">{row.id}</td>
          {showReferences && (
            <td className="py-1.5 pr-3 text-gray-600">
              <span className="font-medium text-gray-900">{row.totalReferences}</span>
              <span className="text-gray-500"> — {describeReferences(row.references)}</span>
            </td>
          )}
          {action && <td className="py-1.5 text-right whitespace-nowrap">{action(row)}</td>}
        </tr>
      ))}
    </tbody>
  </table>
);

const EnchantmentTable: React.FC<{ label: string; rows: MinecraftCatalogAuditEnchantmentDto[] }> = ({ label, rows }) => (
  <table className="min-w-full text-sm" aria-label={label}>
    <thead>
      <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
        <th className="py-1.5 pr-3 font-medium">Key</th>
        <th className="py-1.5 pr-3 font-medium">Name</th>
        <th className="py-1.5 pr-3 font-medium">Kind</th>
        <th className="py-1.5 pr-3 font-medium">#</th>
        <th className="py-1.5 font-medium">Used by</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.id} className="border-b border-gray-100 last:border-0 align-top">
          <td className="py-1.5 pr-3 font-mono">{row.namespaceKey}</td>
          <td className="py-1.5 pr-3">{row.displayName ?? '—'}</td>
          <td className="py-1.5 pr-3">{row.isCustom ? 'Custom' : 'Vanilla'}</td>
          <td className="py-1.5 pr-3 text-gray-500">{row.id}</td>
          <td className="py-1.5 text-gray-600">
            {(row.definitions ?? []).length === 0 ? 'Nothing' : (
              <ul className="space-y-0.5">
                {row.definitions.map((definition) => (
                  <li key={definition.id}>
                    <span className="text-gray-900">{definition.displayName}</span>{' '}
                    <span className="font-mono text-xs text-gray-500">{definition.key}</span>{' '}
                    <span className="text-gray-500">(definition #{definition.id})</span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const BlockTable: React.FC<{ label: string; rows: MinecraftCatalogAuditBlockDto[] }> = ({ label, rows }) => (
  <table className="min-w-full text-sm" aria-label={label}>
    <thead>
      <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
        <th className="py-1.5 pr-3 font-medium">#</th>
        <th className="py-1.5 pr-3 font-medium">Key</th>
        <th className="py-1.5 pr-3 font-medium">Block state</th>
        <th className="py-1.5 pr-3 font-medium">State key</th>
        <th className="py-1.5 font-medium">Material</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.id} className="border-b border-gray-100 last:border-0">
          <td className="py-1.5 pr-3 text-gray-500">{row.id}</td>
          <td className="py-1.5 pr-3 font-mono">{row.namespaceKey}</td>
          <td className="py-1.5 pr-3 font-mono text-xs break-all">{row.blockStateString ?? '—'}</td>
          <td className="py-1.5 pr-3 font-mono text-xs break-all">{row.stateKey ?? '—'}</td>
          <td className="py-1.5 text-gray-600">{row.materialRefId ?? '—'}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const BackfillSummary: React.FC<{ result: MinecraftCatalogBackfillResultDto }> = ({ result }) => (
  <div role="status" className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 space-y-1">
    <p>
      Backfill done: {result.materialKeysNormalized} key{result.materialKeysNormalized === 1 ? '' : 's'} normalised,{' '}
      {result.materialDisplayNamesFilled} name{result.materialDisplayNamesFilled === 1 ? '' : 's'} filled,{' '}
      {result.materialsCreated} material{result.materialsCreated === 1 ? '' : 's'} created,{' '}
      {result.blockRefsCanonicalized} block ref{result.blockRefsCanonicalized === 1 ? '' : 's'} canonicalised,{' '}
      {result.blockRefsLinked} linked.
    </p>
    {result.skipped?.length > 0 && (
      <details>
        <summary className="cursor-pointer">{result.skipped.length} row{result.skipped.length === 1 ? '' : 's'} skipped</summary>
        <ul className="mt-1 list-disc pl-5 text-xs">
          {result.skipped.map((line, index) => <li key={index}>{line}</li>)}
        </ul>
      </details>
    )}
  </div>
);
