import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { BannerLayerDto } from '../types/dtos/clan/ClanDtos';
import { findValueByFieldName } from '../utils/fieldNameMapper';

// Siege Phase 1: one layer of a BannerDesign. Created under its banner
// (POST /api/BannerDesigns/{id}/layers), otherwise addressed by its own id - GateDoorClient's shape.
export class BannerLayerClient extends ObjectManager {
    private static instance: BannerLayerClient;

    public static getInstance() {
        if (!BannerLayerClient.instance) {
            BannerLayerClient.instance = new BannerLayerClient();
            BannerLayerClient.instance.logger = logging.getLogger('BannerLayerClient');
        }
        return BannerLayerClient.instance;
    }

    getById(id: number): Promise<BannerLayerDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.BannerLayers, HttpMethod.Get);
    }

    create(data: BannerLayerDto): Promise<BannerLayerDto> {
        // The wizard submits authored field names ("BannerDesignId"); read it case-insensitively
        // to build the nested URL (same reason as GateDoorClient.create).
        const bannerDesignId = findValueByFieldName(data as unknown as Record<string, unknown>, 'bannerDesignId');
        return this.invokeServiceCall(data, `${bannerDesignId}/layers`, Controllers.BannerDesigns, HttpMethod.Post);
    }

    update(data: BannerLayerDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.BannerLayers, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.BannerLayers, HttpMethod.Delete);
    }
}

export const bannerLayerClient = BannerLayerClient.getInstance();
