import { HttpMethod, Controllers, UIFieldConfigurationsOperation } from "../utils";
import { UIFieldConfigurationDTO } from "../utils/domain/dto/UIFieldConfigurationDTO";
import { ObjectManager } from "./objectManager";

export class UIFieldConfigurationsClient extends ObjectManager {
    private static instance: UIFieldConfigurationsClient;

    public static getInstance() {
        if (!UIFieldConfigurationsClient.instance) {
            UIFieldConfigurationsClient.instance = new UIFieldConfigurationsClient();
        }
        return UIFieldConfigurationsClient.instance;
    }

    async getAll(): Promise<UIFieldConfigurationDTO[]> {
        const response = await this.invokeServiceCall(
            null,
            UIFieldConfigurationsOperation.GetAll,
            Controllers.UIFieldConfigurations,
            HttpMethod.Get
        );
        return response.map((item: any) => UIFieldConfigurationDTO.fromApi(item));
    }

    async create(dto: UIFieldConfigurationDTO): Promise<UIFieldConfigurationDTO> {
        const response = await this.invokeServiceCall(
            dto.toApi(),
            UIFieldConfigurationsOperation.Create,
            Controllers.UIFieldConfigurations,
            HttpMethod.Post
        );
        return UIFieldConfigurationDTO.fromApi(response);
    }

    async update(dto: UIFieldConfigurationDTO): Promise<UIFieldConfigurationDTO> {
        const response = await this.invokeServiceCall(
            dto.toApi(),
            UIFieldConfigurationsOperation.Update,
            Controllers.UIFieldConfigurations,
            HttpMethod.Put
        );
        return UIFieldConfigurationDTO.fromApi(response);
    }

    async delete(id: number): Promise<void> {
        await this.invokeServiceCall(
            { id },
            UIFieldConfigurationsOperation.Delete,
            Controllers.UIFieldConfigurations,
            HttpMethod.Delete
        );
    }
}
