import {
    FormConfigurationImportResult,
    PORTABLE_FORM_FORMAT,
    PortableFormConfiguration
} from '../../types/dtos/forms/FormPortabilityModels';

/**
 * KNG-138: helpers for the form configuration Export / Import buttons and the seeds panel.
 */

const slug = (value: string | undefined | null): string =>
    (value ?? '')
        .trim()
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

/** "GateStructure-Gate-Structure-Configuration.json": the entity first, so files sort per entity. */
export const exportFileName = (entityTypeName: string | undefined | null, configurationName: string | undefined | null): string => {
    const parts = [slug(entityTypeName), slug(configurationName)].filter(Boolean);
    return `${parts.length > 0 ? parts.join('-') : 'form-configuration'}.json`;
};

/** Saves the file through a temporary download link. */
export const downloadJson = (fileName: string, data: unknown): void => {
    const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

export type ReadPortableFileResult =
    | { file: PortableFormConfiguration; error?: undefined }
    | { file?: undefined; error: string };

/** Parses a chosen file. Only the header is checked here; the API's dry run checks the rest. */
export const readPortableFile = (text: string): ReadPortableFileResult => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { error: 'This file is not valid JSON.' };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { error: 'This file is not a form configuration export (expected a JSON object).' };
    }
    const file = parsed as PortableFormConfiguration;
    if (file.format !== PORTABLE_FORM_FORMAT) {
        return { error: `This file is not a form configuration export (format "${file.format ?? 'missing'}", expected "${PORTABLE_FORM_FORMAT}").` };
    }
    return { file };
};

/** One line for the result banner. */
export const describeImportResult = (result: FormConfigurationImportResult): string => {
    switch (result.status) {
        case 'DryRunPassed':
            return result.isDefault
                ? result.replacedDefaultName
                    ? `Dry run passed. Importing will make it the default, replacing "${result.replacedDefaultName}".`
                    : 'Dry run passed. Importing will make it the default (there is none yet).'
                : 'Dry run passed. Importing will add it as a non-default configuration.';
        case 'Imported':
            return `Imported as configuration ${result.formConfigurationId}${result.isDefault ? ' (default)' : ''}.`;
        case 'AlreadyImported':
            return `Already imported as configuration ${result.formConfigurationId}. Nothing was changed.`;
        default:
            return `${result.errors.length} problem${result.errors.length === 1 ? '' : 's'} found. Nothing was imported.`;
    }
};

/** Short summary of what the file holds. */
export const describeImportCounts = (result: FormConfigurationImportResult): string =>
    `${result.stepCount} step${result.stepCount === 1 ? '' : 's'}, ${result.fieldCount} field${result.fieldCount === 1 ? '' : 's'}, ` +
    `${result.validationRuleCount} validation rule${result.validationRuleCount === 1 ? '' : 's'}`;
