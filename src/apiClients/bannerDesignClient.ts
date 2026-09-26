import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { BannerDesignDto, BannerDesignListDto, BannerLayerDto } from '../types/dtos/clan/ClanDtos';

// Siege Phase 1 (docs/specs/siege-minigame/IMPLEMENTATION_PLAN.md). A banner's own create/update
// ignores its layers - those are an owned child collection with their own endpoints
// (BannerLayerClient), same split as GateStructure/GateDoor.
export class BannerDesignClient extends ObjectManager {
    private static instance: BannerDesignClient;

    public static getInstance() {
        if (!BannerDesignClient.instance) {
            BannerDesignClient.instance = new BannerDesignClient();
            BannerDesignClient.instance.logger = logging.getLogger('BannerDesignClient');
        }
        return BannerDesignClient.instance;
    }

    getAll(): Promise<BannerDesignDto[]> {
        return this.invokeServiceCall(null, '', Controllers.BannerDesigns, HttpMethod.Get);
    }

    getById(id: number): Promise<BannerDesignDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.BannerDesigns, HttpMethod.Get);
    }

    create(data: BannerDesignDto): Promise<BannerDesignDto> {
        return this.invokeServiceCall(data, '', Controllers.BannerDesigns, HttpMethod.Post);
    }

    update(data: BannerDesignDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.BannerDesigns, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.BannerDesigns, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<BannerDesignListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.BannerDesigns, HttpMethod.Post);
    }

    getLayers(bannerDesignId: number): Promise<BannerLayerDto[]> {
        return this.invokeServiceCall(null, `${bannerDesignId}/layers`, Controllers.BannerDesigns, HttpMethod.Get);
    }

    // Valid BannerLayer.patternKey values (e.g. "minecraft:stripe_top").
    getPatternKeys(): Promise<string[]> {
        return this.invokeServiceCall(null, 'pattern-keys', Controllers.BannerDesigns, HttpMethod.Get);
    }
}

export const bannerDesignClient = BannerDesignClient.getInstance();
