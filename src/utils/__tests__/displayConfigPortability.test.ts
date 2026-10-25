import {
    describeDisplayImportCounts,
    describeDisplayImportResult,
    displayExportFileName,
    readPortableDisplayFile
} from '../displayConfigPortability';
import { DisplayConfigurationImportResult } from '../../types/dtos/displayConfig/DisplayPortabilityModels';

const result = (overrides: Partial<DisplayConfigurationImportResult>): DisplayConfigurationImportResult => ({
    status: 'DryRunPassed',
    dryRun: true,
    message: '',
    isDefault: false,
    isDraft: false,
    sectionCount: 2,
    fieldCount: 1,
    errors: [],
    warnings: [],
    ...overrides
});

describe('displayConfigPortability (knk-displayconfig/1)', () => {
    it('names export files like the API seeds, after the entity and the configuration', () => {
        expect(displayExportFileName('User', 'User - Default (seed v1)')).toBe('User-User-Default-seed-v1.display.json');
        expect(displayExportFileName('', '')).toBe('display-configuration.json');
    });

    it('reads only knk-displayconfig/1 files', () => {
        expect(readPortableDisplayFile('{"format": "knk-displayconfig/1", "name": "x"}').file?.name).toBe('x');
        expect(readPortableDisplayFile('not json').error).toBe('This file is not valid JSON.');
        expect(readPortableDisplayFile('[1]').error).toContain('expected a JSON object');
        expect(readPortableDisplayFile('{}').error).toContain('format "missing", expected "knk-displayconfig/1"');
        expect(readPortableDisplayFile('{"format": "knk-formconfig/1"}').error).toContain('It is a form configuration');
    });

    it('describes each outcome, with the draft and default state', () => {
        expect(describeDisplayImportResult(result({ isDefault: true })))
            .toBe('Dry run passed. Importing will make it the default (there is none yet) and publish it.');
        expect(describeDisplayImportResult(result({ isDefault: true, isDraft: true, replacedDefaultName: 'User - old' })))
            .toBe('Dry run passed. Importing will make it the default, replacing "User - old", and keep it a draft.');
        expect(describeDisplayImportResult(result({}))).toBe('Dry run passed. Importing will add it as a non-default configuration and publish it.');
        expect(describeDisplayImportResult(result({ status: 'Imported', displayConfigurationId: '12', isDefault: true })))
            .toBe('Imported as display configuration 12 (published, default).');
        expect(describeDisplayImportResult(result({ status: 'Imported', displayConfigurationId: '13', isDraft: true })))
            .toBe('Imported as display configuration 13 (draft).');
        expect(describeDisplayImportResult(result({ status: 'AlreadyImported', displayConfigurationId: '4' })))
            .toBe('Already imported as display configuration 4. Nothing was changed.');
        expect(describeDisplayImportResult(result({ status: 'Invalid', errors: ['a'] }))).toBe('1 problem found. Nothing was imported.');
    });

    it('counts sections and fields', () => {
        expect(describeDisplayImportCounts({ sectionCount: 1, fieldCount: 2 })).toBe('1 section, 2 fields');
    });
});
