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
    dependencyPath?: string;
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
    dependencyPath?: string;
    configJson: string;
    errorMessage: string;
    successMessage?: string;
    isBlocking: boolean;
    requiresDependencyFilled: boolean;
}

export interface UpdateFieldValidationRuleDto {
    validationType: string;
    dependsOnFieldId?: number;
    dependencyPath?: string;
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
    successMessage?: string;
    placeholders?: { [key: string]: string };
    metadata?: ValidationMetadataDto;
}

export interface ValidationIssueDto {
    severity: string;
    message: string;
    fieldId?: number;
    ruleId?: number;
}

export interface DependencyResolutionRequest {
    fieldIds: number[];
    formContextSnapshot: Record<string, any>;
    formConfigurationId?: number;
}

export interface ResolvedDependency {
    ruleId: number;
    status: 'success' | 'pending' | 'error';
    resolvedValue?: any;
    dependencyPath: string;
    resolvedAt: string;
    message?: string;
    errorDetail?: string;
}

export interface DependencyResolutionResponse {
    resolved: Record<number, ResolvedDependency>;
    resolvedAt: string;
    issues?: ValidationIssueDto[];
}

export interface ValidatePathRequest {
    path: string;
    entityTypeName: string;
}

export interface PathValidationResult {
    // Support both camelCase and PascalCase from backend
    isValid?: boolean;
    IsValid?: boolean;
    error?: string;
    ErrorMessage?: string;
    detailedError?: string;
    DetailedError?: string;
}

export interface EntityPropertySuggestion {
    // Support both camelCase and PascalCase from backend
    propertyName?: string;
    PropertyName?: string;
    propertyType?: string;
    PropertyType?: string;
    isRequired?: boolean;
    IsRequired?: boolean;
    isNavigationProperty?: boolean;
    IsNavigationProperty?: boolean;
    isCollection?: boolean;
    IsCollection?: boolean;
    description?: string;
    Description?: string;
}
