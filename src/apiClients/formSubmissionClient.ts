import { Controllers, FormSubmissionProgressOperation, HttpMethod } from "../utils/enums";
import { FormSubmissionProgressDto, FormSubmissionProgressSummaryDto } from "../types/dtos/forms/FormModels";
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

    /**
     * Finds submissions (drafts included) for an entity type whose saved field data has a
     * property matching the given value - e.g. every GateDoor submission whose GateStructureId
     * is 14. Always requests summaries: this is for lightweight "here are the drafts for this
     * parent" lists, not full step data. See FormSubmissionProgressRepository.GetByEntityTypeNameAsync
     * for how the match works (current-step data, or any step of the step-partitioned all-steps
     * data; bare primitive or nested {id} object values).
     */
    getByEntityTypeNameFiltered(entityTypeName: string, propertyName: string, propertyValue: string): Promise<FormSubmissionProgressSummaryDto[]> {
        return this.invokeServiceCall(
            { entityTypeName, isSummary: true, propertyName, propertyValue },
            FormSubmissionProgressOperation.GetByEntityTypeName,
            Controllers.FormSubmissionProgress,
            HttpMethod.Get
        );
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
        return this.invokeServiceCall(null, `${FormSubmissionProgressOperation.Delete}${id}`, Controllers.FormSubmissionProgress, HttpMethod.Delete);
    }
}

export const formSubmissionClient = FormSubmissionClient.getInstance();

