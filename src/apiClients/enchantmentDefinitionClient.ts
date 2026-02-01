import { logging, Controllers, HttpMethod, EnchantmentDefinitionOperation } from "../utils";
import { PagedQueryDto } from "../types/dtos/common/PagedQuery";
import { EnchantmentDefinitionDto } from "../types/dtos/enchantmentDefinition/EnchantmentDefinitionDtos";
import { ObjectManager } from "./objectManager";

export class EnchantmentDefinitionClient extends ObjectManager {
    private static instance: EnchantmentDefinitionClient;

    public static getInstance() {
        if (!EnchantmentDefinitionClient.instance) {
            EnchantmentDefinitionClient.instance = new EnchantmentDefinitionClient();
            EnchantmentDefinitionClient.instance.logger = logging.getLogger('EnchantmentDefinitionClient');
        }
        return EnchantmentDefinitionClient.instance;
    }

    getAll(): Promise<EnchantmentDefinitionDto[]> {
        return this.invokeServiceCall(null, EnchantmentDefinitionOperation.GetAll, Controllers.EnchantmentDefinitions, HttpMethod.Get);
    }

    getById(id: string): Promise<EnchantmentDefinitionDto> {
        return this.invokeServiceCall(null, `${EnchantmentDefinitionOperation.GetById}${id}`, Controllers.EnchantmentDefinitions, HttpMethod.Get);
    }

    public create(data: EnchantmentDefinitionDto): Promise<EnchantmentDefinitionDto> {
        return this.invokeServiceCall(data, EnchantmentDefinitionOperation.Create, Controllers.EnchantmentDefinitions, HttpMethod.Post);
    }

    public update(data: EnchantmentDefinitionDto): Promise<EnchantmentDefinitionDto> {
        if (!data.id) {
            throw new Error('EnchantmentDefinitionDto id is required for update operation');
        }
        return this.invokeServiceCall(data, data.id, Controllers.EnchantmentDefinitions, HttpMethod.Put);
    }

    delete(id: string): Promise<void> {
        return this.invokeServiceCall(null, id, Controllers.EnchantmentDefinitions, HttpMethod.Delete);
    }

    public searchPaged(queryParams: PagedQueryDto): Promise<any> {
        return this.invokeServiceCall(queryParams, EnchantmentDefinitionOperation.SearchPaged, Controllers.EnchantmentDefinitions, HttpMethod.Post);
    }
}

export const enchantmentDefinitionClient = EnchantmentDefinitionClient.getInstance();
