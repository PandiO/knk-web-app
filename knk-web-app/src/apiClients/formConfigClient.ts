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
        return this.invokeServiceCall(null, `${FormConfigurationOperation.GetById}${id}`, Controllers.FormConfigurations, HttpMethod.Get);
    }

    getByEntityTypeName(entityName: string, defaultOnly: boolean = true): Promise<FormConfigurationDto | FormConfigurationDto[] | undefined> {
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

    getEntityNames(): Promise<string[]> {
        return this.invokeServiceCall(
            null,
            FormConfigurationOperation.GetEntityNames,
            Controllers.FormConfigurations,
            HttpMethod.Get
        );
    }

    create(data: FormConfigurationDto): Promise<FormConfigurationDto> {
        return this.invokeServiceCall(data, FormConfigurationOperation.Create, Controllers.FormConfigurations, HttpMethod.Post);
    }

    update(data: FormConfigurationDto): Promise<FormConfigurationDto> {
        if (!data.id) {
            throw new Error('FormConfigurationDto id is required for update operation');
        }
        return this.invokeServiceCall(data, data.id, Controllers.FormConfigurations, HttpMethod.Put);
    }

    delete(id: string): Promise<void> {
        return this.invokeServiceCall(null, `${FormConfigurationOperation.Delete}${id}`, Controllers.FormConfigurations, HttpMethod.Delete);
    }
}

export const formConfigClient = FormConfigClient.getInstance();
