import { logging, Controllers, HttpMethod } from '../utils';
import {
    LocationOrphanDeleteResultDto,
    LocationOrphanDto,
    LocationOrphanPageDto,
    LocationOrphanStatusFilter,
    LocationRetentionRunDto,
    LocationRetentionSettingsDto,
    LocationRetentionStatusDto,
} from '../types/dtos/locationRetention/LocationRetentionDtos';
import { ObjectManager } from './objectManager';

// knk-web-api api/location-retention (KNG-80): the orphaned-Location review panel. Every route is
// permission-checked server side; the page only hides what the API would refuse anyway.
class LocationRetentionClient extends ObjectManager {
    private static instance: LocationRetentionClient;

    public static getInstance() {
        if (!LocationRetentionClient.instance) {
            LocationRetentionClient.instance = new LocationRetentionClient();
            LocationRetentionClient.instance.logger = logging.getLogger('LocationRetentionClient');
        }
        return LocationRetentionClient.instance;
    }

    getOrphans(status: LocationOrphanStatusFilter, page: number, pageSize: number): Promise<LocationOrphanPageDto> {
        const query = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
        return this.invokeServiceCall(null, `orphans?${query.toString()}`, Controllers.LocationRetention, HttpMethod.Get);
    }

    keep(itemId: number, note?: string): Promise<LocationOrphanDto> {
        return this.invokeServiceCall({ note: note || null }, `orphans/${itemId}/keep`, Controllers.LocationRetention, HttpMethod.Post);
    }

    /** 200 when deleted; rejects with status 409 and the result in error.response when the re-check found a relation. */
    delete(itemId: number, note?: string): Promise<LocationOrphanDeleteResultDto> {
        return this.invokeServiceCall({ note: note || null }, `orphans/${itemId}/delete`, Controllers.LocationRetention, HttpMethod.Post);
    }

    getStatus(): Promise<LocationRetentionStatusDto> {
        return this.invokeServiceCall(null, 'status', Controllers.LocationRetention, HttpMethod.Get);
    }

    /** "Run check now" (409 while a run is going on). Flags only. */
    runNow(): Promise<LocationRetentionRunDto> {
        return this.invokeServiceCall(null, 'run', Controllers.LocationRetention, HttpMethod.Post);
    }

    updateSettings(settings: LocationRetentionSettingsDto): Promise<LocationRetentionSettingsDto> {
        return this.invokeServiceCall(settings, 'settings', Controllers.LocationRetention, HttpMethod.Put);
    }
}

export const locationRetentionClient = LocationRetentionClient.getInstance();
