import { Controllers, FormSubmissionProgressOperation, HttpMethod } from "../utils/enums";
import { FormSubmissionProgressDto } from "../utils/domain/dto/forms/FormModels";
import { ObjectManager } from "./objectManager";
import { logging } from "../utils";

export class FormSubmissionClient extends ObjectManager {
    private static instance: FormSubmissionClient;

    public static getInstance() {
        if (!FormSubmissionClient.instance) {
            FormSubmissionClient.instance = new FormSubmissionClient();
            FormSubmissionClient.instance.logger = logging.getLogger('FormSubmissionClient');
        }
        return FormSubmissionClient.instance;
    }

    getByUser(userId: string): Promise<FormSubmissionProgressDto[]> {
        return this.invokeServiceCall({ userId }, FormSubmissionProgressOperation.GetByUser, Controllers.FormSubmissionProgress, HttpMethod.Get);
    }

    getById(id: string): Promise<FormSubmissionProgressDto> {
        return this.invokeServiceCall({ id }, FormSubmissionProgressOperation.GetById, Controllers.FormSubmissionProgress, HttpMethod.Get);
    }

    create(data: FormSubmissionProgressDto): Promise<FormSubmissionProgressDto> {
        return this.invokeServiceCall(data, FormSubmissionProgressOperation.Create, Controllers.FormSubmissionProgress, HttpMethod.Post);
    }

    update(data: FormSubmissionProgressDto): Promise<FormSubmissionProgressDto> {
        return this.invokeServiceCall(data, FormSubmissionProgressOperation.Update, Controllers.FormSubmissionProgress, HttpMethod.Put);
    }

    delete(id: string): Promise<void> {
        return this.invokeServiceCall({ id }, FormSubmissionProgressOperation.Delete, Controllers.FormSubmissionProgress, HttpMethod.Delete);
    }
}

export const formSubmissionClient = FormSubmissionClient.getInstance();
