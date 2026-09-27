import { logging, Controllers, HttpMethod } from '../utils';
import {
  DiscoveryPagedResultDto,
  DiscoveryProgressQuery,
  DiscoveryProgressRowDto,
  DiscoveryRewardPreviewDto,
  DiscoveryRewardRuleDto,
  DiscoveryStatsDto,
  DiscoveryStatsQuery,
  DiscoverySummaryDto,
  DomainDiscoveryOverrideDto,
  UpdateDiscoveryRewardRuleDto,
  UpdateDomainDiscoveryOverrideDto,
} from '../types/dtos/discovery/DiscoveryDtos';
import { ObjectManager } from './objectManager';

// docs/specs/domain-discovery/DESIGN.md §3.5/§3.9. A player may read their own progress and
// summary; everything else (another player's discoveries, reset, rules, overrides, preview,
// stats) needs knk.admin.discovery - the API answers 403 otherwise.
export class DiscoveryClient extends ObjectManager {
  private static instance: DiscoveryClient;

  public static getInstance() {
    if (!DiscoveryClient.instance) {
      DiscoveryClient.instance = new DiscoveryClient();
      DiscoveryClient.instance.logger = logging.getLogger('DiscoveryClient');
    }
    return DiscoveryClient.instance;
  }

  // ===== A player's discoveries (api/users/{userId}/discoveries/...)

  getProgress(userId: number, query: DiscoveryProgressQuery = {}): Promise<DiscoveryPagedResultDto<DiscoveryProgressRowDto>> {
    return this.invokeServiceCall(query, `${userId}/discoveries/progress`, Controllers.Users, HttpMethod.Post);
  }

  getSummary(userId: number): Promise<DiscoverySummaryDto> {
    return this.invokeServiceCall(null, `${userId}/discoveries/summary`, Controllers.Users, HttpMethod.Get);
  }

  /** Staff: forget one discovery so it can be discovered (and rewarded) again. No claw-back. */
  reset(userId: number, domainId: number): Promise<void> {
    return this.invokeServiceCall(null, `${userId}/discoveries/${domainId}`, Controllers.Users, HttpMethod.Delete);
  }

  // ===== Reward configuration (api/discovery-rewards)

  getRules(): Promise<DiscoveryRewardRuleDto[]> {
    return this.invokeServiceCall(null, '', Controllers.DiscoveryRewards, HttpMethod.Get);
  }

  updateRule(domainType: string, rule: UpdateDiscoveryRewardRuleDto): Promise<DiscoveryRewardRuleDto> {
    return this.invokeServiceCall(rule, encodeURIComponent(domainType), Controllers.DiscoveryRewards, HttpMethod.Put);
  }

  getOverrides(): Promise<DomainDiscoveryOverrideDto[]> {
    return this.invokeServiceCall(null, 'overrides', Controllers.DiscoveryRewards, HttpMethod.Get);
  }

  upsertOverride(domainId: number, domainOverride: UpdateDomainDiscoveryOverrideDto): Promise<DomainDiscoveryOverrideDto> {
    return this.invokeServiceCall(domainOverride, `overrides/${domainId}`, Controllers.DiscoveryRewards, HttpMethod.Put);
  }

  deleteOverride(domainId: number): Promise<void> {
    return this.invokeServiceCall(null, `overrides/${domainId}`, Controllers.DiscoveryRewards, HttpMethod.Delete);
  }

  /** Min/max rewards per title for a type, or for one domain with its override applied. */
  getPreview(target: { domainType: string } | { domainId: number }): Promise<DiscoveryRewardPreviewDto> {
    const params = 'domainId' in target ? { domainId: target.domainId } : { domainType: target.domainType };
    return this.invokeServiceCall(params, 'preview', Controllers.DiscoveryRewards, HttpMethod.Get);
  }

  // ===== Statistics (api/discoveries/stats)

  getStats(query: DiscoveryStatsQuery = {}): Promise<DiscoveryStatsDto> {
    // Only the parameters that are set - serviceCall would send an undefined one as "undefined".
    const params: Record<string, string | number | boolean> = {};
    if (query.pageNumber !== undefined) params.pageNumber = query.pageNumber;
    if (query.pageSize !== undefined) params.pageSize = query.pageSize;
    if (query.domainType) params.domainType = query.domainType;
    if (query.searchTerm) params.searchTerm = query.searchTerm;
    if (query.sortBy) params.sortBy = query.sortBy;
    if (query.sortDescending !== undefined) params.sortDescending = query.sortDescending;
    return this.invokeServiceCall(params, 'stats', Controllers.Discoveries, HttpMethod.Get);
  }
}

export const discoveryClient = DiscoveryClient.getInstance();
