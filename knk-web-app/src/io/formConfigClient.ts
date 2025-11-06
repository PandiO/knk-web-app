import { Controllers, FormConfigurationOperation, HttpMethod } from "../utils/enums";
import { FormConfigurationDto } from "../utils/domain/dto/forms/FormModels";
import { ObjectManager } from "./objectManager";
import { logging } from "../utils";

export class FormConfigClient extends ObjectManager {
    private static instance: FormConfigClient;

    public static getInstance() {
        if (!FormConfigClient.instance) {
            FormConfigClient.instance = new FormConfigClient();
            FormConfigClient.instance.logger = logging.getLogger('FormConfigClient');
        }
        return FormConfigClient.instance;
    }

    getAll(): Promise<FormConfigurationDto[]> {
        return this.invokeServiceCall(null, FormConfigurationOperation.GetAll, Controllers.FormConfigurations, HttpMethod.Get);
    }

    getById(id: string): Promise<FormConfigurationDto> {
        return this.invokeServiceCall({ id }, FormConfigurationOperation.GetById, Controllers.FormConfigurations, HttpMethod.Get);
    }

    getByEntity(entityName: string, defaultOnly: boolean = true): Promise<FormConfigurationDto> {
        return this.invokeServiceCall(
            { defaultOnly },
            entityName,
            Controllers.FormConfigurations,
            HttpMethod.Get
        );
    }

    getByEntityAll(entityName: string): Promise<FormConfigurationDto[]> {
        return this.invokeServiceCall(
            { entityName },
            FormConfigurationOperation.GetByEntityAll,
            Controllers.FormConfigurations,
            HttpMethod.Get
        );
    }

    create(data: FormConfigurationDto): Promise<FormConfigurationDto> {
        return this.invokeServiceCall(data, FormConfigurationOperation.Create, Controllers.FormConfigurations, HttpMethod.Post);
    }

    update(data: FormConfigurationDto): Promise<FormConfigurationDto> {
        return this.invokeServiceCall(data, FormConfigurationOperation.Update, Controllers.FormConfigurations, HttpMethod.Put);
    }

    delete(id: string): Promise<void> {
        return this.invokeServiceCall({ id }, FormConfigurationOperation.Delete, Controllers.FormConfigurations, HttpMethod.Delete);
    }
}

export const formConfigClient = FormConfigClient.getInstance();
