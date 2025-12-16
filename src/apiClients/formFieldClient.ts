import { Controllers, FormFieldOperation, HttpMethod } from "../utils/enums";
import { FormFieldDto } from "../types/dtos/forms/FormModels";
import { ObjectManager } from "./objectManager";
import { logging } from "../utils";

export class FormFieldClient extends ObjectManager {
    private static instance: FormFieldClient;

    public static getInstance() {
        if (!FormFieldClient.instance) {
            FormFieldClient.instance = new FormFieldClient();
            FormFieldClient.instance.logger = logging.getLogger('FormFieldClient');
        }
        return FormFieldClient.instance;
    }

    getAll(): Promise<FormFieldDto[]> {
        return this.invokeServiceCall(null, FormFieldOperation.GetAll, Controllers.FormFields, HttpMethod.Get);
    }

    getById(id: string): Promise<FormFieldDto> {
        return this.invokeServiceCall({ id }, FormFieldOperation.GetById, Controllers.FormFields, HttpMethod.Get);
    }

    create(data: FormFieldDto): Promise<FormFieldDto> {
        return this.invokeServiceCall(data, FormFieldOperation.Create, Controllers.FormFields, HttpMethod.Post);
    }

    update(data: FormFieldDto): Promise<FormFieldDto> {
        return this.invokeServiceCall({id: data.id, data}, FormFieldOperation.Update, Controllers.FormFields, HttpMethod.Put);
    }

    delete(id: string): Promise<void> {
        return this.invokeServiceCall({ id }, FormFieldOperation.Delete, Controllers.FormFields, HttpMethod.Delete);
    }
}

export const formFieldClient = FormFieldClient.getInstance();

