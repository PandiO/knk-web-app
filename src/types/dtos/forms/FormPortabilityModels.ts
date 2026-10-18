/**
 * KNG-138: portable FormConfiguration files ("knk-formconfig/1") and the API's import results.
 * The file itself is passed through as JSON; the web app only reads its header fields.
 */
export const PORTABLE_FORM_FORMAT = 'knk-formconfig/1';

export interface PortableFormConfiguration {
    format?: string;
    configurationGuid?: string;
    entityTypeName?: string;
    name?: string;
    description?: string;
    steps?: Array<{ stepName?: string; fields?: unknown[] } & Record<string, unknown>>;
    validationRules?: unknown[];
    notes?: string[];
    [key: string]: unknown;
}

export type FormConfigurationImportStatus = 'Imported' | 'DryRunPassed' | 'AlreadyImported' | 'Invalid';

export interface FormConfigurationImportResult {
    status: FormConfigurationImportStatus;
    dryRun: boolean;
    message: string;
    configurationGuid?: string | null;
    entityTypeName?: string | null;
    name?: string | null;
    /** The created configuration, or the existing one for AlreadyImported. */
    formConfigurationId?: string | null;
    isDefault: boolean;
    replacedDefaultId?: string | null;
    replacedDefaultName?: string | null;
    stepCount: number;
    fieldCount: number;
    validationRuleCount: number;
    errors: string[];
    warnings: string[];
}

export interface FormConfigurationSeed {
    /** File name without ".json"; used in seeds/{name}/import. */
    name: string;
    configurationGuid?: string | null;
    entityTypeName?: string | null;
    configurationName?: string | null;
    description?: string | null;
    stepCount: number;
    fieldCount: number;
    imported: boolean;
    importedFormConfigurationId?: string | null;
    error?: string | null;
}

export interface FormConfigurationImportOptions {
    dryRun: boolean;
    makeDefault: boolean;
}
