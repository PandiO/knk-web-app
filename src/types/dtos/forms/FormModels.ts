import { FieldType, ValidationType, FormSubmissionStatus, ConditionOperator } from '../../../enums';

export interface FieldValidationDto {
    id?: string;
    formFieldId?: string;
    validationType: ValidationType;
    parametersJson?: string;
    errorMessage?: string;
    isActive: boolean;
}

export interface ValidationParameters {
    min?: number;
    max?: number;
    pattern?: string;
    customEndpoint?: string;
    [key: string]: any;
}

export interface DependencyCondition {
    fieldName: string;
    operator: ConditionOperator;
    value: any;
    fromPreviousStep?: boolean;
}

export interface StepConditionDto {
    id?: string;
    formStepId?: string;
    conditionType: 'Entry' | 'Completion';
    conditionJson: string;
    errorMessage?: string;
    isActive: boolean;
}

export interface ParsedStepCondition {
    conditions: DependencyCondition[];
    logic?: 'AND' | 'OR';
}

export interface FormFieldDto {
    id?: string;
    formStepId?: string;
    fieldGuid?: string;
    fieldName: string;
    label: string;
    placeholder?: string;
    description?: string;
    fieldType: FieldType;
    defaultValue?: string;
    elementType?: FieldType; // Type of elements for List/collection fields
    isRequired: boolean;
    isReadOnly: boolean;
    order: number;
    dependencyConditionJson?: string;
    settingsJson?: string;
    objectType?: string;
    subConfigurationId?: string;
    incrementValue?: number;
    isReusable: boolean;
    sourceFieldId?: string;
    isLinkedToSource: boolean;
    hasCompatibilityIssues: boolean;
    compatibilityIssues?: string[];
    validations: FieldValidationDto[];
    // added: min/max selection for List/collection types
    minSelection?: number;
    maxSelection?: number;
    // added: whether user can create new instances on-the-fly for Object/List fields
    canCreate?: boolean;
}

export interface FormStepDto {
    id?: string;
    formConfigurationId?: string;
    stepGuid?: string;
    stepName: string;
    description?: string;
    order: number;
    fieldOrderJson?: string;
    isReusable: boolean;
    sourceStepId?: string;
    isLinkedToSource: boolean;
    hasCompatibilityIssues: boolean;
    stepLevelIssues?: string[];
    isManyToManyRelationship: boolean;
    relatedEntityPropertyName?: string;
    joinEntityType?: string;
    subConfigurationId?: string;
    parentStepId?: string;
    childFormSteps: FormStepDto[];
    fields: FormFieldDto[];
    conditions: StepConditionDto[];
}

export interface FormConfigurationDto {
    id?: string;
    entityTypeName: string;
    configurationName: string;
    description?: string;
    isDefault: boolean;
    stepOrderJson?: string;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
    steps: FormStepDto[];
}

export interface FormSubmissionProgressDto {
    id?: string;
    formConfigurationId: string;
    userId?: string;
    entityTypeName?: string;
    entityId?: string;
    currentStepIndex: number;
    currentStepDataJson?: string;
    allStepsDataJson?: string;
    parentProgressId?: string;
    status: FormSubmissionStatus;
    createdAt?: string;
    updatedAt?: string;
    completedAt?: string;
    configuration?: FormConfigurationDto;
    childProgresses?: FormSubmissionProgressDto[];
}

    // public class FormSubmissionProgressSummaryDto
    // {
    //     [JsonPropertyName("id")]
    //     public string? Id { get; set; }
    //     [JsonPropertyName("formConfigurationId")]
    //     public string FormConfigurationId { get; set; } = null!;
    //     [JsonPropertyName("formConfigurationName")]
    //     public string FormConfigurationName { get; set; } = null!;
    //     [JsonPropertyName("userId")]
    //     public string? UserId { get; set; }
    //     [JsonPropertyName("entityTypeName")]
    //     public string? EntityTypeName { get; set; }
    //     [JsonPropertyName("parentProgressId")]
    //     public string? ParentProgressId { get; set; }
    //     [JsonPropertyName("currentStepIndex")]
    //     public int CurrentStepIndex { get; set; }
    //     [JsonPropertyName("status")]
    //     public FormSubmissionStatus Status { get; set; }
    //     [JsonPropertyName("createdAt")]
    //     public string? CreatedAt { get; set; }
    //     [JsonPropertyName("updatedAt")]
    //     public string? UpdatedAt { get; set; }
    // }
export interface FormSubmissionProgressSummaryDto {
    id?: string;
    formConfigurationId: string;
    formConfigurationName: string;
    userId?: string;
    entityTypeName?: string;
    entityId?: string;
    parentProgressId?: string;
    currentStepIndex: number;
    status: FormSubmissionStatus;
    createdAt?: string;
    updatedAt?: string;
}

export interface StepData {
    [fieldName: string]: any;
}

export interface AllStepsData {
    [stepIndex: number]: StepData;
}

// Template reuse types
export type ReuseLinkMode = 'copy' | 'link';

export interface AddReusableStepRequestDto {
    sourceStepId: number;
    linkMode: ReuseLinkMode;
}

export interface AddReusableFieldRequestDto {
    sourceFieldId: number;
    linkMode: ReuseLinkMode;
}

// Template validation result DTOs (for future use when backend exposes detailed validation endpoints)
export interface TemplateFieldValidationResultDto {
    formFieldId: number;
    fieldName: string;
    isCompatible: boolean;
    issues: string[];
}

export interface TemplateStepValidationResultDto {
    formStepId: number;
    stepName: string;
    isCompatible: boolean;
    fieldResults: TemplateFieldValidationResultDto[];
}

export interface FormConfigurationValidationResultDto {
    formConfigurationId: number;
    entityTypeName: string;
    isValid: boolean;
    summary?: string;
    stepResults: TemplateStepValidationResultDto[];
}
