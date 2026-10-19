import {
    DisplayConfigurationImportResult,
    DisplayConfigurationSeed,
    PORTABLE_DISPLAY_FORMAT,
    PortableDisplayConfiguration
} from '../types/dtos/displayConfig/DisplayPortabilityModels';
import { exportFileName } from './forms/formConfigPortability';

/**
 * Helpers for the display configuration Export / Import buttons and the seeds panel ("knk-displayconfig/1").
 * The display counterpart of utils/forms/formConfigPortability.ts.
 */

/** "GateStructure-GateStructure-Default-seed-v1.display.json": like the API's seed files (<Entity>.display.json). */
export const displayExportFileName = (entityTypeName: string | undefined | null, configurationName: string | undefined | null): string => {
    const name = exportFileName(entityTypeName, configurationName);
    return name === 'form-configuration.json' ? 'display-configuration.json' : name.replace(/\.json$/, '.display.json');
};

export type ReadPortableDisplayFileResult =
    | { file: PortableDisplayConfiguration; error?: undefined }
    | { file?: undefined; error: string };

/** Parses a chosen file. Only the header is checked here; the API's dry run checks the rest. */
export const readPortableDisplayFile = (text: string): ReadPortableDisplayFileResult => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { error: 'This file is not valid JSON.' };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { error: 'This file is not a display configuration export (expected a JSON object).' };
    }
    const file = parsed as PortableDisplayConfiguration;
    if (file.format !== PORTABLE_DISPLAY_FORMAT) {
        const hint = file.format === 'knk-formconfig/1' ? ' It is a form configuration: import it under Form Configurations.' : '';
        return { error: `This file is not a display configuration export (format "${file.format ?? 'missing'}", expected "${PORTABLE_DISPLAY_FORMAT}").${hint}` };
    }
    return { file };
};

const draftText = (result: DisplayConfigurationImportResult) => (result.isDraft ? 'keep it a draft' : 'publish it');

/** One line for the result banner. */
export const describeDisplayImportResult = (result: DisplayConfigurationImportResult): string => {
    switch (result.status) {
        case 'DryRunPassed':
            return result.isDefault
                ? result.replacedDefaultName
                    ? `Dry run passed. Importing will make it the default, replacing "${result.replacedDefaultName}", and ${draftText(result)}.`
                    : `Dry run passed. Importing will make it the default (there is none yet) and ${draftText(result)}.`
                : `Dry run passed. Importing will add it as a non-default configuration and ${draftText(result)}.`;
        case 'Imported':
            return `Imported as display configuration ${result.displayConfigurationId} (${[result.isDraft ? 'draft' : 'published', result.isDefault ? 'default' : ''].filter(Boolean).join(', ')}).`;
        case 'AlreadyImported':
            return `Already imported as display configuration ${result.displayConfigurationId}. Nothing was changed.`;
        default:
            return `${result.errors.length} problem${result.errors.length === 1 ? '' : 's'} found. Nothing was imported.`;
    }
};

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** Short summary of what the file holds. */
export const describeDisplayImportCounts = (result: { sectionCount: number; fieldCount: number }): string =>
    `${plural(result.sectionCount, 'section')}, ${plural(result.fieldCount, 'field')}`;

export const describeDisplaySeedCounts = (seed: DisplayConfigurationSeed): string => describeDisplayImportCounts(seed);
