import React from 'react';
import { Loader2 } from 'lucide-react';
import { discoveryClient } from '../../../apiClients/discoveryClient';
import { formatAmount } from '../../../utils/auditDetails';
import {
  DISCOVERY_DOMAIN_TYPES,
  DiscoveryRewardPreviewDto,
  DomainDiscoveryOverrideDto,
  UpdateDiscoveryRewardRuleDto,
  discoveryTypeLabel,
} from '../../../types/dtos/discovery/DiscoveryDtos';
import { previewRowsFor } from './discoveryRuleForm';

// docs/specs/domain-discovery/DESIGN.md §3.9 (2) - what a type (or one overridden domain) pays at
// each title, at multiplier 1.0, from GET api/discovery-rewards/preview. While the matching type
// rule is being edited the rows follow the inputs (same formula as the API) before it is saved.

export type PreviewTarget = { domainType: string } | { domainId: number };

const targetKey = (target: PreviewTarget): string =>
  'domainId' in target ? `domain:${target.domainId}` : `type:${target.domainType}`;

const parseTargetKey = (key: string): PreviewTarget =>
  key.startsWith('domain:') ? { domainId: Number(key.slice('domain:'.length)) } : { domainType: key.slice('type:'.length) };

const amountRange = (min: number, max: number): string =>
  min === max ? formatAmount(min) : `${formatAmount(min)} – ${formatAmount(max)}`;

export const DiscoveryPreviewCard: React.FC<{
  target: PreviewTarget;
  onTargetChange: (target: PreviewTarget) => void;
  overrides: DomainDiscoveryOverrideDto[];
  /** The target type's rule as it is being typed; null shows the saved rule. */
  draft: UpdateDiscoveryRewardRuleDto | null;
  /** Bumped after a rule or override is saved, to fetch the preview again. */
  refreshKey: number;
}> = ({ target, onTargetChange, overrides, draft, refreshKey }) => {
  const [preview, setPreview] = React.useState<DiscoveryRewardPreviewDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const key = targetKey(target);
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    discoveryClient.getPreview(parseTargetKey(key))
      .then((result) => { if (!cancelled) setPreview(result); })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load discovery preview:', err);
        setPreview(null);
        setError('Could not load the preview.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, refreshKey]);

  const rows = preview ? (draft ? previewRowsFor(preview.rows, draft) : preview.rows) : [];
  const enabled = draft ? draft.isEnabled : preview?.rule.isEnabled;

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            Reward preview per title
            {draft && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                Unsaved changes
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500">Base amounts at multiplier 1.0 - personal and rank multipliers apply on top.</p>
        </div>
        <select
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
          value={key}
          onChange={(e) => onTargetChange(parseTargetKey(e.target.value))}
          aria-label="Preview for"
        >
          <optgroup label="Domain types">
            {DISCOVERY_DOMAIN_TYPES.map((type) => (
              <option key={type} value={`type:${type}`}>{discoveryTypeLabel(type)}</option>
            ))}
          </optgroup>
          {overrides.length > 0 && (
            <optgroup label="Overridden domains">
              {overrides.map((o) => (
                <option key={o.domainId} value={`domain:${o.domainId}`}>
                  {o.domainName ?? `Domain #${o.domainId}`}{o.domainType ? ` (${discoveryTypeLabel(o.domainType)})` : ''}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {loading && !preview ? (
        <div className="flex items-center text-sm text-gray-500">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">No title brackets are configured.</p>
      ) : (
        <>
          {enabled === false && (
            <p className="mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
              Discovery is disabled here - nothing is discovered or paid until it is enabled.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200">
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">From XP</th>
                  <th className="py-2 pr-4" title="1% of the bracket's XP width">XP unit</th>
                  <th className="py-2 pr-4">Salary/h</th>
                  <th className="py-2 pr-4">XP</th>
                  <th className="py-2 pr-4">Coins</th>
                  <th className="py-2 pr-4">Gems</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.titleBracketId} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-medium text-gray-900">{row.titleName}</td>
                    <td className="py-2 pr-4 text-gray-500">{formatAmount(row.minExperience)}</td>
                    <td className="py-2 pr-4 text-gray-500">{formatAmount(row.expUnit)}</td>
                    <td className="py-2 pr-4 text-gray-500">{formatAmount(row.salary)}</td>
                    <td className="py-2 pr-4 text-gray-900">{amountRange(row.expMin, row.expMax)}</td>
                    <td className="py-2 pr-4 text-gray-900">{amountRange(row.coinsMin, row.coinsMax)}</td>
                    <td className="py-2 pr-4 text-gray-900">{amountRange(row.gemsMin, row.gemsMax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
