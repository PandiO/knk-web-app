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
    /**
     * KNG-269: what the form is about, so the API can answer from its log of the last run: the entity
     * type name and id in edit mode, or "FormSubmissionProgress" and the draft id. Without a subject
     * every rule runs.
     */
    subjectType?: string;
    subjectId?: number;
    /** KNG-269: run every rule even when the log holds a matching result (Re-check). */
    force?: boolean;
}

/** KNG-269: every rule-bearing field of a step in one request. */
export interface ValidateFieldsBatchRequestDto {
    fields: ValidateFieldsBatchItemDto[];
    formContextData?: { [fieldName: string]: any };
    subjectType?: string;
    subjectId?: number;
    force?: boolean;
}

export interface ValidateFieldsBatchItemDto {
    fieldId: number;
    fieldValue: any;
    dependencyValue?: any;
}

export interface ValidateFieldsBatchResultDto {
    /** Keyed by field id (JSON object keys, so strings at runtime). */
    results: { [fieldId: string]: ValidationResultDto };
}

export interface ValidationMetadataDto {
    validationType: string;
    executedAt: string;
    dependencyFieldName?: string;
    dependencyValue?: any;
    /** Set when the check couldn't be completed due to a system problem (e.g. "PluginUnreachable") rather than a genuine validation failure. */
    failureReason?: string;
    /** KNG-269: answered from the API's log of an earlier run; executedAt is that run's time. */
    fromCache?: boolean;
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
