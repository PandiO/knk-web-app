import { logging, Controllers, HttpMethod } from '../utils';
import {
  AnalyticsRange,
  DomainInteractionKind,
  DomainInteractionReportDto,
  HeatmapDto,
  HeatmapWorldDto,
  MenuFunnelReportDto,
} from '../types/dtos/analytics/WorldAnalyticsDtos';
import { ObjectManager } from './objectManager';

/** Drops empty parameters so the query string only carries what was set. */
function compact<T extends object>(params: T): Partial<T> | null {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? (Object.fromEntries(entries) as Partial<T>) : null;
}

// knk-web-api WorldAnalyticsController (api/world-analytics, KNG-34 link 7). Every read needs an exact
// grant of knk.owner.analytics.view; wildcard holders get 403. The data is anonymous (no player ids).
export class WorldAnalyticsClient extends ObjectManager {
  private static instance: WorldAnalyticsClient;

  public static getInstance() {
    if (!WorldAnalyticsClient.instance) {
      WorldAnalyticsClient.instance = new WorldAnalyticsClient();
      WorldAnalyticsClient.instance.logger = logging.getLogger('WorldAnalyticsClient');
    }
    return WorldAnalyticsClient.instance;
  }

  getWorlds(range: AnalyticsRange): Promise<HeatmapWorldDto[]> {
    return this.invokeServiceCall(compact(range), 'heatmap/worlds', Controllers.WorldAnalytics, HttpMethod.Get);
  }

  getHeatmap(world: string, range: AnalyticsRange, cellSize?: number): Promise<HeatmapDto> {
    return this.invokeServiceCall(compact({ world, ...range, cellSize }), 'heatmap', Controllers.WorldAnalytics, HttpMethod.Get);
  }

  getMenuFunnels(range: AnalyticsRange, menuKey?: string): Promise<MenuFunnelReportDto> {
    return this.invokeServiceCall(compact({ ...range, menuKey }), 'menu-funnels', Controllers.WorldAnalytics, HttpMethod.Get);
  }

  getDomains(range: AnalyticsRange, kind?: DomainInteractionKind): Promise<DomainInteractionReportDto> {
    return this.invokeServiceCall(compact({ ...range, kind }), 'domains', Controllers.WorldAnalytics, HttpMethod.Get);
  }
}

export const worldAnalyticsClient = WorldAnalyticsClient.getInstance();
