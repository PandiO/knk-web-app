import React from 'react';
import { ImageOff } from 'lucide-react';
import { minecraftCatalogClient } from '../../../apiClients/minecraftCatalogClient';
import { MinecraftCatalogAuditMaterialDto } from '../../../types/dtos/minecraftCatalog/MinecraftCatalogDtos';
import { apiRefusalReason } from '../../../utils/apiRefusalReason';
import { MinecraftIcon } from '../../minecraft/MinecraftIcon';

// KNG-200 §7: active materials the scan found no icon for. An override wins over the scanned icon
// and survives every scan; clearing it (empty field) lets the scanned icon show again. A row with
// an override leaves this list once the audit reloads.

const withoutKey = <T,>(record: Record<number, T>, key: number): Record<number, T> => {
  const copy = { ...record };
  delete copy[key];
  return copy;
};

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const MinecraftMissingIconsCard: React.FC<{
  rows: MinecraftCatalogAuditMaterialDto[];
  onChanged: () => Promise<void> | void;
}> = ({ rows, onChanged }) => {
  const [drafts, setDrafts] = React.useState<Record<number, string>>({});
  const [savingId, setSavingId] = React.useState<number | null>(null);
  const [errors, setErrors] = React.useState<Record<number, string>>({});
  const [message, setMessage] = React.useState<string | null>(null);

  const save = async (row: MinecraftCatalogAuditMaterialDto, rawValue: string) => {
    const value = rawValue.trim();
    if (value !== '' && !isHttpUrl(value)) {
      setErrors((previous) => ({ ...previous, [row.id]: 'Enter an http(s) URL, or leave it empty to clear the override.' }));
      return;
    }
    setSavingId(row.id);
    setMessage(null);
    setErrors((previous) => withoutKey(previous, row.id));
    try {
      await minecraftCatalogClient.setIconOverride(row.id, value === '' ? null : value);
      setMessage(value === '' ? `Icon override of ${row.namespaceKey} cleared.` : `Icon override of ${row.namespaceKey} saved.`);
      setDrafts((previous) => withoutKey(previous, row.id));
      await onChanged();
    } catch (err) {
      console.error('Failed to save the icon override:', err);
      setErrors((previous) => ({ ...previous, [row.id]: apiRefusalReason(err) ?? 'Could not save the icon override.' }));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-4" aria-labelledby="catalog-icons-heading">
      <div>
        <h2 id="catalog-icons-heading" className="text-lg font-semibold flex items-center">
          <ImageOff className="h-5 w-5 mr-2" aria-hidden="true" />
          Missing icons
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{rows.length}</span>
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Materials the scan found no icon for. Paste an image URL to use instead; it wins over the scan and survives later scans.
        </p>
      </div>

      {message && <p role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Every active material has an icon.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" aria-label="Materials without an icon">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th className="py-1.5 pr-3 font-medium">Icon</th>
                <th className="py-1.5 pr-3 font-medium">Material</th>
                <th className="py-1.5 font-medium">Override URL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const draft = drafts[row.id] ?? '';
                const preview = draft.trim() !== '' ? draft.trim() : row.iconUrl;
                const name = row.displayName || row.namespaceKey;
                const saving = savingId === row.id;
                return (
                  <tr key={row.id} className="border-b border-gray-100 last:border-0 align-top">
                    <td className="py-2 pr-3">
                      <MinecraftIcon src={preview} alt={name} size={32} />
                    </td>
                    <td className="py-2 pr-3">
                      <span className="block font-medium text-gray-900">{name}</span>
                      <span className="block font-mono text-xs text-gray-500">{row.namespaceKey} · #{row.id}</span>
                    </td>
                    <td className="py-2">
                      <form
                        className="flex flex-wrap items-center gap-2"
                        noValidate
                        onSubmit={(event) => {
                          event.preventDefault();
                          void save(row, draft);
                        }}
                      >
                        <input
                          type="url"
                          className="min-w-[16rem] flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                          placeholder="https://…/textures/item/example.png"
                          aria-label={`Icon URL for ${row.namespaceKey}`}
                          value={draft}
                          disabled={saving}
                          onChange={(event) => setDrafts((previous) => ({ ...previous, [row.id]: event.target.value }))}
                        />
                        <button type="submit" className="btn-primary !px-3 !py-1 text-xs" disabled={saving || draft.trim() === ''}>
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary !px-3 !py-1 text-xs"
                          disabled={saving}
                          onClick={() => void save(row, '')}
                          aria-label={`Clear the icon override of ${row.namespaceKey}`}
                        >
                          Clear
                        </button>
                      </form>
                      {errors[row.id] && <p role="alert" className="mt-1 text-xs text-red-700">{errors[row.id]}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
