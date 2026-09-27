import React from 'react';
import { Compass, Loader2, RefreshCcw } from 'lucide-react';
import { discoveryClient } from '../../apiClients/discoveryClient';
import {
  DiscoveryRewardRuleDto,
  DomainDiscoveryOverrideDto,
  UpdateDiscoveryRewardRuleDto,
} from '../../types/dtos/discovery/DiscoveryDtos';
import { DiscoveryRulesCard } from '../../components/admin/discovery/DiscoveryRulesCard';
import { DiscoveryPreviewCard, PreviewTarget } from '../../components/admin/discovery/DiscoveryPreviewCard';
import { DiscoveryOverridesCard } from '../../components/admin/discovery/DiscoveryOverridesCard';
import { DiscoveryStatsCard } from '../../components/admin/discovery/DiscoveryStatsCard';

// docs/specs/domain-discovery/DESIGN.md §3.9 / IMPLEMENTATION_PLAN.md Phase 4 - discovery reward
// configuration and statistics (knk.admin.discovery, see the /admin/discovery route): the type
// rules, a per-title preview, per-domain overrides and who discovered what. A dedicated page
// rather than a FormConfig, because the preview is computed. Saved rules apply to the next
// in-game discovery - the API reads them on every grant.

export const DiscoveryAdminPage: React.FC = () => {
  const [rules, setRules] = React.useState<DiscoveryRewardRuleDto[]>([]);
  const [overrides, setOverrides] = React.useState<DomainDiscoveryOverrideDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [previewTarget, setPreviewTarget] = React.useState<PreviewTarget>({ domainType: 'Town' });
  const [previewRefresh, setPreviewRefresh] = React.useState(0);
  // The type rule being edited, as typed - the preview follows it when it shows that type.
  const [draft, setDraft] = React.useState<{ domainType: string; rule: UpdateDiscoveryRewardRuleDto | null } | null>(null);

  const loadOverrides = React.useCallback(async () => {
    setOverrides(await discoveryClient.getOverrides());
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesResult, overridesResult] = await Promise.all([discoveryClient.getRules(), discoveryClient.getOverrides()]);
      setRules(rulesResult);
      setOverrides(overridesResult);
      setPreviewRefresh((n) => n + 1);
    } catch (err) {
      console.error('Failed to load discovery configuration:', err);
      setError('Could not load the discovery configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleRuleSaved = (saved: DiscoveryRewardRuleDto) => {
    setRules((current) => current.map((r) => (r.domainType === saved.domainType ? saved : r)));
    setPreviewRefresh((n) => n + 1);
  };

  const handleDraftChange = React.useCallback((domainType: string, rule: UpdateDiscoveryRewardRuleDto | null) => {
    setDraft((current) => {
      if (rule) return { domainType, rule };
      return current?.domainType === domainType ? null : current;
    });
  }, []);

  const handleOverridesChanged = async () => {
    try {
      await loadOverrides();
    } catch (err) {
      console.error('Failed to reload discovery overrides:', err);
    }
    setPreviewRefresh((n) => n + 1);
  };

  // A removed override can't be previewed any more; go back to the Town rule.
  React.useEffect(() => {
    if ('domainId' in previewTarget && !loading && !overrides.some((o) => o.domainId === previewTarget.domainId)) {
      setPreviewTarget({ domainType: 'Town' });
    }
  }, [overrides, previewTarget, loading]);

  const previewDraft = draft?.rule && 'domainType' in previewTarget && previewTarget.domainType === draft.domainType ? draft.rule : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Compass className="h-6 w-6 mr-2" />
              Domain discovery
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Rewards for a player&apos;s first entry into a town, district, structure or gate.
            </p>
          </div>
          <button className="btn-secondary text-sm" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Reload
          </button>
        </div>

        {loading && rules.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 bg-white border border-red-200 rounded-lg p-4">{error}</p>
        ) : (
          <>
            <DiscoveryRulesCard rules={rules} onSaved={handleRuleSaved} onDraftChange={handleDraftChange} />
            <DiscoveryPreviewCard
              target={previewTarget}
              onTargetChange={setPreviewTarget}
              overrides={overrides}
              draft={previewDraft}
              refreshKey={previewRefresh}
            />
            <DiscoveryOverridesCard
              overrides={overrides}
              rules={rules}
              onChanged={handleOverridesChanged}
              onPreview={(domainId) => setPreviewTarget({ domainId })}
            />
          </>
        )}

        <DiscoveryStatsCard />
      </div>
    </div>
  );
};
