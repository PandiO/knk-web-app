/**
 * Portable DisplayConfiguration files ("knk-displayconfig/1", spec: knk-web-api
 * Data/DisplayConfigurationSeeds/README.md) and the API's import results. The display counterpart of
 * FormPortabilityModels (KNG-138); the file itself is passed through as JSON, the web app only reads its header.
 */
export const PORTABLE_DISPLAY_FORMAT = 'knk-displayconfig/1';

export interface PortableDisplayConfiguration {
    format?: string;
    configurationGuid?: string;
    entityTypeName?: string;
    name?: string;
    description?: string;
    sections?: Array<{ sectionName?: string; fields?: unknown[]; subSections?: unknown[] } & Record<string, unknown>>;
    notes?: string[];
    [key: string]: unknown;
}

export type DisplayConfigurationImportStatus = 'Imported' | 'DryRunPassed' | 'AlreadyImported' | 'Invalid';

export interface DisplayConfigurationImportResult {
    status: DisplayConfigurationImportStatus;
    dryRun: boolean;
    message: string;
    configurationGuid?: string | null;
    entityTypeName?: string | null;
    name?: string | null;
    /** The created configuration, or the existing one for AlreadyImported. */
    displayConfigurationId?: string | null;
    isDefault: boolean;
    /** The display page only shows a published (non-draft) default. */
    isDraft: boolean;
    replacedDefaultId?: string | null;
    replacedDefaultName?: string | null;
    /** All sections, sub-sections included. */
    sectionCount: number;
    fieldCount: number;
    errors: string[];
    warnings: string[];
}

export interface DisplayConfigurationSeed {
    /** File name without ".json" (e.g. "User.display"); used in seeds/{name}/import. */
    name: string;
    configurationGuid?: string | null;
    entityTypeName?: string | null;
    configurationName?: string | null;
    description?: string | null;
    sectionCount: number;
    fieldCount: number;
    imported: boolean;
    importedDisplayConfigurationId?: string | null;
    error?: string | null;
}

export interface DisplayConfigurationImportOptions {
    dryRun: boolean;
    makeDefault: boolean;
    asDraft: boolean;
}
