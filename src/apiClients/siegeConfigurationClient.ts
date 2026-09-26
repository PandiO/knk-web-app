import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { SiegeConfigurationDto, UpdateSiegeConfigurationDto } from '../types/dtos/siege/SiegeDtos';

// Siege Phase 3 (DESIGN.md §3.8): the global singleton, seeded with the legacy defaults on first GET.
// PUT is partial - omitted properties keep their value.
export class SiegeConfigurationClient extends ObjectManager {
    private static instance: SiegeConfigurationClient;

    public static getInstance() {
        if (!SiegeConfigurationClient.instance) {
            SiegeConfigurationClient.instance = new SiegeConfigurationClient();
            SiegeConfigurationClient.instance.logger = logging.getLogger('SiegeConfigurationClient');
        }
        return SiegeConfigurationClient.instance;
    }

    get(): Promise<SiegeConfigurationDto> {
        return this.invokeServiceCall(null, '', Controllers.SiegeConfiguration, HttpMethod.Get);
    }

    update(dto: UpdateSiegeConfigurationDto): Promise<SiegeConfigurationDto> {
        return this.invokeServiceCall(dto, '', Controllers.SiegeConfiguration, HttpMethod.Put);
    }
}

export const siegeConfigurationClient = SiegeConfigurationClient.getInstance();
