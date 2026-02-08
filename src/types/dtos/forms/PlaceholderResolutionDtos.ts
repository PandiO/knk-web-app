export interface PlaceholderResolutionRequest {
    fieldValidationRuleId?: number;
    placeholderPaths?: string[];
    currentEntityPlaceholders?: Record<string, string>;
    entityId?: number | null;
    entityTypeName?: string;
    contextData?: Record<string, string>;
}

export interface PlaceholderResolutionResponse {
    resolvedPlaceholders: Record<string, string>;
    resolutionErrors: PlaceholderResolutionError[];
    totalPlaceholdersRequested: number;
    isSuccessful: boolean;
}

export interface PlaceholderResolutionError {
    placeholderPath: string;
    errorCode: string;
    message: string;
    stackTrace?: string;
    details?: string;
}
