import { describeImportCounts, describeImportResult, exportFileName, readPortableFile } from '../formConfigPortability';
import { FormConfigurationImportResult } from '../../../types/dtos/forms/FormPortabilityModels';

const result = (overrides: Partial<FormConfigurationImportResult>): FormConfigurationImportResult => ({
    status: 'DryRunPassed',
    dryRun: true,
    message: '',
    isDefault: false,
    stepCount: 2,
    fieldCount: 1,
    validationRuleCount: 0,
    errors: [],
    warnings: [],
    ...overrides
});

describe('formConfigPortability (KNG-138)', () => {
    it('names export files after the entity and the configuration', () => {
        expect(exportFileName('GateStructure', 'Gate Structure Configuration')).toBe('GateStructure-Gate-Structure-Configuration.json');
        expect(exportFileName('SiegeScenario', '  SiegeScenario - Default ')).toBe('SiegeScenario-SiegeScenario-Default.json');
        expect(exportFileName(undefined, null)).toBe('form-configuration.json');
    });

    it('accepts only knk-formconfig/1 JSON objects', () => {
        expect(readPortableFile('{"format": "knk-formconfig/1", "name": "X"}').file?.name).toBe('X');
        expect(readPortableFile('{ nope').error).toMatch(/not valid JSON/);
        expect(readPortableFile('[1]').error).toMatch(/expected a JSON object/);
        expect(readPortableFile('{"format": "other"}').error).toMatch(/format "other"/);
        expect(readPortableFile('{}').error).toMatch(/format "missing"/);
    });

    it('describes each outcome', () => {
        expect(describeImportResult(result({ isDefault: true }))).toMatch(/make it the default \(there is none yet\)/);
        expect(describeImportResult(result({ isDefault: true, replacedDefaultName: 'Old' }))).toMatch(/replacing "Old"/);
        expect(describeImportResult(result({}))).toMatch(/non-default/);
        expect(describeImportResult(result({ status: 'Imported', formConfigurationId: '12', isDefault: true }))).toBe('Imported as configuration 12 (default).');
        expect(describeImportResult(result({ status: 'AlreadyImported', formConfigurationId: '9' }))).toMatch(/Already imported as configuration 9/);
        expect(describeImportResult(result({ status: 'Invalid', errors: ['a', 'b'] }))).toBe('2 problems found. Nothing was imported.');
        expect(describeImportCounts(result({ stepCount: 1, fieldCount: 3, validationRuleCount: 1 }))).toBe('1 step, 3 fields, 1 validation rule');
    });
});
