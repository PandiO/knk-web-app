import { Controllers, HttpMethod } from "../utils/enums";
import { logging } from "../utils";
import { ObjectManager } from "./objectManager";
import {
    CreateFieldValidationRuleDto,
    FieldValidationRuleDto,
    UpdateFieldValidationRuleDto,
    ValidateFieldRequestDto,
    ValidationResultDto,
    ValidationIssueDto
} from "../types/dtos/forms/FieldValidationRuleDtos";
import {
    PlaceholderResolutionRequest,
    PlaceholderResolutionResponse
} from "../types/dtos/forms/PlaceholderResolutionDtos";
import { FormConfigurationDto } from "../types/dtos/forms/FormModels";

export enum FieldValidationRuleOperation {
    GetByField = "by-field/",
    GetByConfiguration = "by-configuration/",
    Validate = "validate",
    ResolvePlaceholders = "resolve-placeholders",
    HealthCheckConfiguration = "health-check/configuration/",
    HealthCheckDraft = "health-check/configuration/draft"
}

export class FieldValidationRuleClient extends ObjectManager {
    private static instance: FieldValidationRuleClient;

    public static getInstance() {
        if (!FieldValidationRuleClient.instance) {
            FieldValidationRuleClient.instance = new FieldValidationRuleClient();
            FieldValidationRuleClient.instance.logger = logging.getLogger("FieldValidationRuleClient");
        }
        return FieldValidationRuleClient.instance;
    }

    getById(id: number): Promise<FieldValidationRuleDto> {
        return this.invokeServiceCall(null, id.toString(), Controllers.FieldValidationRules, HttpMethod.Get);
    }

    getByFormFieldId(fieldId: number): Promise<FieldValidationRuleDto[]> {
        return this.invokeServiceCall(null, `${FieldValidationRuleOperation.GetByField}${fieldId}`, Controllers.FieldValidationRules, HttpMethod.Get);
    }

    getByFormConfigurationId(configId: number): Promise<FieldValidationRuleDto[]> {
        return this.invokeServiceCall(null, `${FieldValidationRuleOperation.GetByConfiguration}${configId}`, Controllers.FieldValidationRules, HttpMethod.Get);
    }

    create(payload: CreateFieldValidationRuleDto): Promise<FieldValidationRuleDto> {
        return this.invokeServiceCall(payload, "", Controllers.FieldValidationRules, HttpMethod.Post);
    }

    update(id: number, payload: UpdateFieldValidationRuleDto): Promise<void> {
        return this.invokeServiceCall(payload, id.toString(), Controllers.FieldValidationRules, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, id.toString(), Controllers.FieldValidationRules, HttpMethod.Delete);
    }

    validateField(request: ValidateFieldRequestDto): Promise<ValidationResultDto> {
        return this.invokeServiceCall(request, FieldValidationRuleOperation.Validate, Controllers.FieldValidationRules, HttpMethod.Post);
    }

    resolvePlaceholders(request: PlaceholderResolutionRequest): Promise<PlaceholderResolutionResponse> {
        return this.invokeServiceCall(request, FieldValidationRuleOperation.ResolvePlaceholders, Controllers.FieldValidationRules, HttpMethod.Post);
    }

    validateConfigurationHealth(configId: number): Promise<ValidationIssueDto[]> {
        return this.invokeServiceCall(null, `${FieldValidationRuleOperation.HealthCheckConfiguration}${configId}`, Controllers.FieldValidationRules, HttpMethod.Get);
    }

    validateDraftConfiguration(config: FormConfigurationDto): Promise<ValidationIssueDto[]> {
        return this.invokeServiceCall(config, FieldValidationRuleOperation.HealthCheckDraft, Controllers.FieldValidationRules, HttpMethod.Post);
    }
}

export const fieldValidationRuleClient = FieldValidationRuleClient.getInstance();
