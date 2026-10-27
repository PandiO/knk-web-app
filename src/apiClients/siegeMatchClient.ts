import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { SiegeMatchPublicDto, SiegeMatchPublicSummaryDto } from '../types/dtos/siege/SiegeMatchDtos';

// Alpha run 1 (PandiO/knk-workspace#174): the public siege results log. Anonymous reads; the API filters each
// participant's numbers for the viewer (statistics visibility).
export class SiegeMatchClient extends ObjectManager {
    private static instance: SiegeMatchClient;

    public static getInstance() {
        if (!SiegeMatchClient.instance) {
            SiegeMatchClient.instance = new SiegeMatchClient();
            SiegeMatchClient.instance.logger = logging.getLogger('SiegeMatchClient');
        }
        return SiegeMatchClient.instance;
    }

    /** A player's finished matches, newest first. */
    getPlayerMatches(userId: number, limit = 20): Promise<SiegeMatchPublicSummaryDto[]> {
        return this.invokeServiceCall(null, `public/users/${userId}?limit=${limit}`, Controllers.SiegeMatches, HttpMethod.Get);
    }

    /** One finished match; 404 when there is none (or it is still running). */
    getMatch(id: number): Promise<SiegeMatchPublicDto> {
        return this.invokeServiceCall(null, `public/${id}`, Controllers.SiegeMatches, HttpMethod.Get);
    }
}

export const siegeMatchClient = SiegeMatchClient.getInstance();
