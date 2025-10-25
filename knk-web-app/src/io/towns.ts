import { Controllers, DominionOperation, HttpMethod, logging } from "../utils";
import { TownViewDTO } from "../utils/domain/dto/town/TownViewDTO";
import { ObjectManager } from "./objectManager";
import { mapFieldDataToForm } from '../utils/domain/dto/town/TownViewDTO';

export class TownsManager extends ObjectManager {
    private static instance: TownsManager;

    public static getInstance() {
        if (!TownsManager.instance) {
            TownsManager.instance = new TownsManager();
            TownsManager.instance.logger = logging.getLogger('TownsManager');
        }

        return TownsManager.instance;
    }

    getAll(data?: any): Promise<TownViewDTO[]> {
        return this.invokeServiceCall(data, DominionOperation.GetAll, Controllers.Towns, HttpMethod.Post).then((response) => {
            return response.map(mapFieldDataToForm) as TownViewDTO[];
        });
    }

    getView(id: number): Promise<TownViewDTO> {
        return this.invokeServiceCall(id, DominionOperation.GetById, Controllers.Towns, HttpMethod.Get);
    }
}