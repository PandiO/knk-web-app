import { Controllers, FormStepOperation, HttpMethod } from "../utils/enums";
import { FormStepDto } from "../utils/domain/dto/forms/FormModels";
import { ObjectManager } from "./objectManager";
import { logging } from "../utils";

export class FormStepClient extends ObjectManager {
    private static instance: FormStepClient;

    public static getInstance() {
        if (!FormStepClient.instance) {
            FormStepClient.instance = new FormStepClient();
            FormStepClient.instance.logger = logging.getLogger('FormStepClient');
        }
        return FormStepClient.instance;
    }

    getAll(): Promise<FormStepDto[]> {
        return this.invokeServiceCall(null, FormStepOperation.GetAll, Controllers.FormSteps, HttpMethod.Get);
    }

    getById(id: string): Promise<FormStepDto> {
        return this.invokeServiceCall({ id }, FormStepOperation.GetById, Controllers.FormSteps, HttpMethod.Get);
    }

    create(data: FormStepDto): Promise<FormStepDto> {
        return this.invokeServiceCall(data, FormStepOperation.Create, Controllers.FormSteps, HttpMethod.Post);
    }

    update(data: FormStepDto): Promise<FormStepDto> {
        return this.invokeServiceCall(data, FormStepOperation.Update, Controllers.FormSteps, HttpMethod.Put);
    }

    delete(id: string): Promise<void> {
        return this.invokeServiceCall({ id }, FormStepOperation.Delete, Controllers.FormSteps, HttpMethod.Delete);
    }
}

export const formStepClient = FormStepClient.getInstance();
