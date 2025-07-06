import { Controllers, HttpMethod, UIObjectConfigurationOperation } from "../utils/enums";
import { UIObjectConfigDto, mapApiToUIObjectConfigDto } from "../utils/domain/dto/uiObjectConfig/UIFieldConfigurations";
import { ObjectManager } from "./objectManager";

export class UIObjectConfigClient extends ObjectManager {
    private static instance: UIObjectConfigClient;

    public static getInstance() {
        if (!UIObjectConfigClient.instance) {
            UIObjectConfigClient.instance = new UIObjectConfigClient();
        }
        return UIObjectConfigClient.instance;
    }

    // Fetch all UI object configurations
    getAll(): Promise<UIObjectConfigDto[]> {
        return this.invokeServiceCall(null, UIObjectConfigurationOperation.GetAll, Controllers.UIObjectConfigurations, HttpMethod.Post)
            .then(response => response.map(mapApiToUIObjectConfigDto));
    }

    // Fetch a specific UI object configuration by type
    getByType(type: string): Promise<UIObjectConfigDto | null> {
        return this.invokeServiceCall(type, UIObjectConfigurationOperation.GetByType, Controllers.UIObjectConfigurations, HttpMethod.Get)
            .then(response => (response ? mapApiToUIObjectConfigDto(response) : null));
    }

    // Create a new UI object configuration
    create(config: UIObjectConfigDto): Promise<UIObjectConfigDto> {
        return this.invokeServiceCall(config, UIObjectConfigurationOperation.Create, Controllers.UIObjectConfigurations, HttpMethod.Post)
            .then(mapApiToUIObjectConfigDto);
    }

    // Update an existing UI object configuration
    update(config: UIObjectConfigDto): Promise<UIObjectConfigDto> {
        return this.invokeServiceCall(config, UIObjectConfigurationOperation.Update, Controllers.UIObjectConfigurations, HttpMethod.Put)
            .then(mapApiToUIObjectConfigDto);
    }

    // Delete a UI object configuration by ID
    delete(id: number): Promise<void> {
        return this.invokeServiceCall(id, UIObjectConfigurationOperation.Delete, Controllers.UIObjectConfigurations, HttpMethod.Delete);
    }
}

export const uiObjectConfigClient = UIObjectConfigClient.getInstance();