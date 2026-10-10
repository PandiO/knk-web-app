import { logging, Controllers, HttpMethod } from '../utils';
import {
  PlayerStatisticsDto,
  StatisticsCatalogDto,
  StatisticsPagedResultDto,
  StatisticsPeriod,
  StatisticsVisibilityChangeDto,
  StatisticsVisibilityDto,
  TitleChangeDto,
} from '../types/dtos/statistics/StatisticsDtos';
import { ObjectManager } from './objectManager';

// knk-web-api StatisticsController (api/statistics, KNG-34). Reads are filtered for the caller:
// the player themselves and staff (knk.admin.statistics.view) see everything, other signed-in
// players what the player set to Everyone, anonymous visitors only the always-public fields.
// Visibility settings are the player's own (staff may read them); a PUT is atomic and answers 409
// with the current settings when anything changed meanwhile.
export class StatisticsClient extends ObjectManager {
  private static instance: StatisticsClient;
  private catalog: Promise<StatisticsCatalogDto> | null = null;

  public static getInstance() {
    if (!StatisticsClient.instance) {
      StatisticsClient.instance = new StatisticsClient();
      StatisticsClient.instance.logger = logging.getLogger('StatisticsClient');
    }
    return StatisticsClient.instance;
  }

  /** Metric labels, groups and settings - read once per page load (a failure is retried next time). */
  getCatalog(): Promise<StatisticsCatalogDto> {
    if (!this.catalog) {
      this.catalog = this.invokeServiceCall(null, 'catalog', Controllers.Statistics, HttpMethod.Get)
        .catch((err: unknown) => {
          this.catalog = null;
          throw err;
        });
    }
    return this.catalog as Promise<StatisticsCatalogDto>;
  }

  getUserStatistics(userId: number, period: StatisticsPeriod = 'lifetime', date?: string): Promise<PlayerStatisticsDto> {
    // Only the parameters that are set - serviceCall would send an undefined one as "undefined".
    const params: Record<string, string> = { period };
    if (date) params.date = date;
    return this.invokeServiceCall(params, `users/${userId}`, Controllers.Statistics, HttpMethod.Get);
  }

  /** 403 when the player keeps their title history private. */
  getTitleHistory(userId: number, page = 1, pageSize = 20): Promise<StatisticsPagedResultDto<TitleChangeDto>> {
    return this.invokeServiceCall({ page, pageSize }, `users/${userId}/title-history`, Controllers.Statistics, HttpMethod.Get);
  }

  getVisibility(userId: number): Promise<StatisticsVisibilityDto> {
    return this.invokeServiceCall(null, `users/${userId}/visibility`, Controllers.Statistics, HttpMethod.Get);
  }

  /** One atomic update; a 409 rejects it with err.status 409 and err.response.current. */
  updateVisibility(userId: number, changes: StatisticsVisibilityChangeDto[]): Promise<StatisticsVisibilityDto> {
    return this.invokeServiceCall({ changes }, `users/${userId}/visibility`, Controllers.Statistics, HttpMethod.Put);
  }
}

export const statisticsClient = StatisticsClient.getInstance();
