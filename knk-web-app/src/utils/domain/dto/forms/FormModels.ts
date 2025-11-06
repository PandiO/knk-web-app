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
    fieldName: string;
    label: string;
    placeholder?: string;
    description?: string;
    fieldType: FieldType;
    defaultValue?: string;
    isRequired: boolean;
    isReadOnly: boolean;
    order: number;
    dependencyConditionJson?: string;
    objectType?: string;
    subConfigurationId?: string;
    incrementValue?: number;
    isReusable: boolean;
    sourceFieldId?: string;
    validations: FieldValidationDto[];
}

export interface FormStepDto {
    id?: string;
    formConfigurationId?: string;
    stepName: string;
    title: string;
    description?: string;
    order: number;
    fieldOrderJson?: string;
    isReusable: boolean;
    sourceStepId?: string;
    fields: FormFieldDto[];
    conditions: StepConditionDto[];
}

export interface FormConfigurationDto {
    id?: string;
    entityName: string;
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

export interface StepData {
    [fieldName: string]: any;
}

export interface AllStepsData {
    [stepIndex: number]: StepData;
}
