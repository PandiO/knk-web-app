import { logging, Controllers, HttpMethod } from "../utils";
import { DomainSubRegionDto } from "../types/dtos/domain/DomainDtos";
import { ObjectManager } from "./objectManager";

/**
 * A domain's sub-regions (KNG-254): the owned SubRegions list on the domain forms creates, edits and removes them one by
 * one. Saving renames the drawn region to domain_<domainId>_sub_<id>; a removed one's WorldGuard region is deleted by
 * the game server after the grace period.
 */
export class DomainSubRegionClient extends ObjectManager {
    private static instance: DomainSubRegionClient;

    public static getInstance() {
        if (!DomainSubRegionClient.instance) {
            DomainSubRegionClient.instance = new DomainSubRegionClient();
            DomainSubRegionClient.instance.logger = logging.getLogger('DomainSubRegionClient');
        }
        return DomainSubRegionClient.instance;
    }

    getByDomainId(domainId: number): Promise<DomainSubRegionDto[]> {
        return this.invokeServiceCall(null, `by-domain/${domainId}`, Controllers.DomainSubRegions, HttpMethod.Get);
    }

    getById(id: number): Promise<DomainSubRegionDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.DomainSubRegions, HttpMethod.Get);
    }

    create(data: DomainSubRegionDto): Promise<DomainSubRegionDto> {
        return this.invokeServiceCall(data, '', Controllers.DomainSubRegions, HttpMethod.Post);
    }

    update(data: DomainSubRegionDto): Promise<DomainSubRegionDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.DomainSubRegions, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.DomainSubRegions, HttpMethod.Delete);
    }
}
