import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import {
    StructureLoyaltyUpdateDto,
    StructureTerritoryDto,
    TownTerritoryChange,
    TownTerritoryDto,
} from '../types/dtos/territory/TerritoryDtos';
import { districtCapitalPayload, townTerritoryPayload } from '../utils/territory';

// Territory V1 (PandiO/knk-workspace#326 API, #690 web app): a town's effective ranges, a structure's flag and loyalty
// (api/Territory), and the territory fields of towns and districts (power, kingdom, province, capital; G11), saved
// through api/Towns and api/Districts with every other group "not on this form".
export class TerritoryClient extends ObjectManager {
    private static instance: TerritoryClient;

    public static getInstance() {
        if (!TerritoryClient.instance) {
            TerritoryClient.instance = new TerritoryClient();
            TerritoryClient.instance.logger = logging.getLogger('TerritoryClient');
        }
        return TerritoryClient.instance;
    }

    getTown(townId: number): Promise<TownTerritoryDto> {
        return this.invokeServiceCall(null, `towns/${townId}`, Controllers.Territory, HttpMethod.Get);
    }

    getStructure(structureId: number): Promise<StructureTerritoryDto> {
        return this.invokeServiceCall(null, `structures/${structureId}`, Controllers.Territory, HttpMethod.Get);
    }

    /** Stored only in V1 (territory DESIGN § 4); null = loyal to its own town. */
    setLoyalty(structureId: number, data: StructureLoyaltyUpdateDto): Promise<StructureTerritoryDto> {
        return this.invokeServiceCall(data, `structures/${structureId}/loyalty`, Controllers.Territory, HttpMethod.Put);
    }

    /** Clears a structure's flag by hand (the next report sets it again while it still applies). */
    clearFlag(structureId: number): Promise<StructureTerritoryDto> {
        return this.invokeServiceCall(null, `structures/${structureId}/flag`, Controllers.Territory, HttpMethod.Delete);
    }

    /** Sets a town's power, kingdom and province: reads the town, then saves it with only those fields changed. */
    async saveTownTerritory(townId: number, change: TownTerritoryChange): Promise<void> {
        const town = await this.invokeServiceCall(null, `${townId}`, Controllers.Towns, HttpMethod.Get);
        await this.invokeServiceCall(townTerritoryPayload(town, change), `${townId}`, Controllers.Towns, HttpMethod.Put);
    }

    /** Marks a district as its town's capital (or not): reads the district, then saves it with only the flag changed. */
    async setDistrictCapital(districtId: number, isCapital: boolean): Promise<void> {
        const district = await this.invokeServiceCall(null, `${districtId}`, Controllers.Districts, HttpMethod.Get);
        await this.invokeServiceCall(districtCapitalPayload(district, isCapital), `${districtId}`, Controllers.Districts, HttpMethod.Put);
    }
}

export const territoryClient = TerritoryClient.getInstance();
