import { Controllers, HttpMethod, UIObjectConfigurationOperation } from "../utils/enums";
import { UIObjectConfigDto } from "../utils/domain/dto/UIFieldConfigurations";
import { ObjectManager } from "./objectManager";

export class UIFieldConfigurationsManager extends ObjectManager {
    private static instance: UIFieldConfigurationsManager;

    public static getInstance() {
        if (!UIFieldConfigurationsManager.instance) {
            UIFieldConfigurationsManager.instance = new UIFieldConfigurationsManager();
        }
        return UIFieldConfigurationsManager.instance;
    }

    // Fetch all UI object configurations
    getAll(): Promise<UIObjectConfigDto[]> {
        return this.invokeServiceCall(null, UIObjectConfigurationOperation.GetAll, Controllers.UIObjectConfigurations, HttpMethod.Post);
    }

    // Fetch a specific UI object configuration by type
    getByType(type: string): Promise<UIObjectConfigDto | null> {
        return this.invokeServiceCall(type, UIObjectConfigurationOperation.GetByType, Controllers.UIObjectConfigurations, HttpMethod.Get);
    }

    // Create a new UI object configuration
    create(config: UIObjectConfigDto): Promise<UIObjectConfigDto> {
        return this.invokeServiceCall(config, UIObjectConfigurationOperation.Create, Controllers.UIObjectConfigurations, HttpMethod.Post);
    }

    // Update an existing UI object configuration
    update(config: UIObjectConfigDto): Promise<UIObjectConfigDto> {
        return this.invokeServiceCall(config, UIObjectConfigurationOperation.Update, Controllers.UIObjectConfigurations, HttpMethod.Put);
    }

    // Delete a UI object configuration by ID
    delete(id: number): Promise<void> {
        return this.invokeServiceCall(id, UIObjectConfigurationOperation.Delete, Controllers.UIObjectConfigurations, HttpMethod.Delete);
    }
}

export const uiFieldConfigurationsManager = UIFieldConfigurationsManager.getInstance();