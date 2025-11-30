import { Controllers, FormSubmissionProgressOperation, HttpMethod } from "../utils/enums";
import { FormSubmissionProgressDto, FormSubmissionProgressSummaryDto } from "../utils/domain/dto/forms/FormModels";
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

    getByEntityTypeName(entityTypeName: string, userId: string | undefined, isSummary: boolean | undefined): Promise<FormSubmissionProgressDto[] | FormSubmissionProgressSummaryDto[]> {
        return this.invokeServiceCall({entityTypeName, userId, isSummary}, FormSubmissionProgressOperation.GetByEntityTypeName, Controllers.FormSubmissionProgress, HttpMethod.Get);
    }

    getByUser(userId: string): Promise<FormSubmissionProgressDto[]> {
        return this.invokeServiceCall({ userId }, FormSubmissionProgressOperation.GetByUser, Controllers.FormSubmissionProgress, HttpMethod.Get);
    }

    getById(id: string): Promise<FormSubmissionProgressDto> {
        return this.invokeServiceCall(null, `${FormSubmissionProgressOperation.GetById}${id}`, Controllers.FormSubmissionProgress, HttpMethod.Get);
    }

    create(data: FormSubmissionProgressDto): Promise<FormSubmissionProgressDto> {
        return this.invokeServiceCall(data, FormSubmissionProgressOperation.Create, Controllers.FormSubmissionProgress, HttpMethod.Post);
    }

    update(data: FormSubmissionProgressDto): Promise<FormSubmissionProgressDto> {
        return this.invokeServiceCall(data, `${FormSubmissionProgressOperation.Update}${data.id}`, Controllers.FormSubmissionProgress, HttpMethod.Put);
    }

    delete(id: string): Promise<void> {
        return this.invokeServiceCall({ id }, FormSubmissionProgressOperation.Delete, Controllers.FormSubmissionProgress, HttpMethod.Delete);
    }
}

export const formSubmissionClient = FormSubmissionClient.getInstance();
