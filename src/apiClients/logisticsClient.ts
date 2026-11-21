import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import {
    ConsumerViewDto,
    LogisticsPlanDto,
    TownServiceAreasDto,
    TownSupplyDto,
} from '../types/dtos/production/LogisticsDtos';

// Town logistics P9 (PandiO/knk-workspace#127 API, #686 web app; TOWN_LOGISTICS § 2, § 5): the town views and the
// planner (api/Logistics). Reads need the World area; the dry run and Run now need knk.admin.world.
export class LogisticsClient extends ObjectManager {
    private static instance: LogisticsClient;

    public static getInstance() {
        if (!LogisticsClient.instance) {
            LogisticsClient.instance = new LogisticsClient();
            LogisticsClient.instance.logger = logging.getLogger('LogisticsClient');
        }
        return LogisticsClient.instance;
    }

    /** Stock per blueprint across the town's warehouses, reserves, reservations, available, flows and days of cover;
     *  the open reservations, the last run and the next. */
    townSupply(townId: number): Promise<TownSupplyDto> {
        return this.invokeServiceCall(null, `towns/${townId}/supply`, Controllers.Logistics, HttpMethod.Get);
    }

    /** Which warehouse serves each district, the rural territory and every producer and consumer (Rule or Nearest). */
    serviceAreas(townId: number): Promise<TownServiceAreasDto> {
        return this.invokeServiceCall(null, `towns/${townId}/service-areas`, Controllers.Logistics, HttpMethod.Get);
    }

    /** What a planner run would do now, with the explanation per consumer line; writes nothing and works while
     *  production is off (`featureEnabled` says which). */
    dryRun(townId: number): Promise<LogisticsPlanDto> {
        return this.invokeServiceCall(null, `towns/${townId}/dry-run`, Controllers.Logistics, HttpMethod.Post);
    }

    /** Runs the town's planner now (the same shape with `runId`); 409 `ProductionDisabled` while production is off. */
    runNow(townId: number): Promise<LogisticsPlanDto> {
        return this.invokeServiceCall(null, `towns/${townId}/run-now`, Controllers.Logistics, HttpMethod.Post);
    }

    /** A structure as a consumer: its storages with min and max per blueprint and where they came from, its workers,
     *  its service warehouse, open reservations and warnings. 404 for a structure that doesn't exist. */
    consumer(structureId: number): Promise<ConsumerViewDto> {
        return this.invokeServiceCall(null, `consumers/${structureId}`, Controllers.Logistics, HttpMethod.Get);
    }
}

export const logisticsClient = LogisticsClient.getInstance();
