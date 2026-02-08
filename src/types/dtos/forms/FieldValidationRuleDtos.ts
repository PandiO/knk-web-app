export interface FormFieldNavDto {
    id: number;
    fieldName?: string;
    label?: string;
}

export interface FieldValidationRuleDto {
    id: number;
    formFieldId: number;
    validationType: string;
    dependsOnFieldId?: number;
    configJson: string;
    errorMessage: string;
    successMessage?: string;
    isBlocking: boolean;
    requiresDependencyFilled: boolean;
    createdAt: string;
    formField?: FormFieldNavDto;
    dependsOnField?: FormFieldNavDto;
}

export interface CreateFieldValidationRuleDto {
    formFieldId: number;
    validationType: string;
    dependsOnFieldId?: number;
    configJson: string;
    errorMessage: string;
    successMessage?: string;
    isBlocking: boolean;
    requiresDependencyFilled: boolean;
}

export interface UpdateFieldValidationRuleDto {
    validationType: string;
    dependsOnFieldId?: number;
    configJson: string;
    errorMessage: string;
    successMessage?: string;
    isBlocking: boolean;
    requiresDependencyFilled: boolean;
}

export interface ValidateFieldRequestDto {
    fieldId: number;
    fieldValue: any;
    dependencyValue?: any;
    formContextData?: { [fieldName: string]: any };
}

export interface ValidationMetadataDto {
    validationType: string;
    executedAt: string;
    dependencyFieldName?: string;
    dependencyValue?: any;
}

export interface ValidationResultDto {
    isValid: boolean;
    isBlocking: boolean;
    message?: string;
    placeholders?: { [key: string]: string };
    metadata?: ValidationMetadataDto;
}

export interface ValidationIssueDto {
    severity: string;
    message: string;
    fieldId?: number;
    ruleId?: number;
}
