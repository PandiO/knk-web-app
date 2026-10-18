import { resolveWorldTaskDependencyValue } from '../worldTaskDependency';
import { FieldValidationRuleDto } from '../../../types/dtos/forms/FieldValidationRuleDtos';
import { FormConfigurationDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../enums';

// KNG-131: GateDoor.ReferencePoint1Id must be inside its gate's region (rule 13 in the dev data).
const rule = {
    id: 13,
    formFieldId: 133,
    validationType: 'LocationInsideRegion',
    dependsOnFieldId: 126,
    dependencyPath: 'GateStructure.WgRegionId',
    configJson: '{"regionPropertyPath":"WgRegionId","allowBoundary":true}',
    errorMessage: 'outside',
    isBlocking: false,
    requiresDependencyFilled: false,
    createdAt: '',
    dependsOnField: { id: 126, fieldName: 'GateStructureId', label: 'Gate structure' }
} as unknown as FieldValidationRuleDto;

const doorForm = {
    id: '9',
    entityTypeName: 'GateDoor',
    steps: [{ id: '90', fields: [
        { id: '126', fieldName: 'GateStructureId', fieldType: FieldType.Object, objectType: 'GateStructure' },
        { id: '133', fieldName: 'ReferencePoint1Id', fieldType: FieldType.Object, objectType: 'Location' }
    ] }]
} as unknown as FormConfigurationDto;

const gate = { id: 21, name: 'Main Gate', wgRegionId: 'domain_21', worldName: 'knk_hub' };

describe('resolveWorldTaskDependencyValue', () => {
    it.each([
        ['a bare id', 21],
        ['a numeric string', '21'],
        ['an {id, name} reference', { id: 21, name: 'Main Gate' }]
    ])('loads the gate for %s, so the plugin can read its region', async (_label, value) => {
        const fetchGate = jest.fn(async () => gate);
        const fetchById = jest.fn(() => fetchGate);

        await expect(resolveWorldTaskDependencyValue(rule, value, doorForm, fetchById)).resolves.toEqual(gate);
        expect(fetchById).toHaveBeenCalledWith('GateStructure');
        expect(fetchGate).toHaveBeenCalledWith('21');
    });

    it('keeps a value that already has the region (a new door created from the gate form)', async () => {
        const snapshot = { id: -1, Name: 'Main Gate', WgRegionId: 'domain_21' };
        const fetchById = jest.fn();

        await expect(resolveWorldTaskDependencyValue(rule, snapshot, doorForm, fetchById)).resolves.toBe(snapshot);
        expect(fetchById).not.toHaveBeenCalled();
    });

    it('keeps the value when the dependency is not an Object field', async () => {
        const regionRule = { ...rule, dependsOnFieldId: 3 } as FieldValidationRuleDto;
        const townForm = {
            steps: [{ fields: [{ id: '3', fieldName: 'WgRegionId', fieldType: FieldType.String }] }]
        } as unknown as FormConfigurationDto;
        const fetchById = jest.fn();

        await expect(resolveWorldTaskDependencyValue(regionRule, 'town_kardenna', townForm, fetchById))
            .resolves.toBe('town_kardenna');
        expect(fetchById).not.toHaveBeenCalled();
    });

    it('keeps the id when the record cannot be loaded', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const fetchById = jest.fn(() => async () => { throw new Error('404'); });

        await expect(resolveWorldTaskDependencyValue(rule, 21, doorForm, fetchById)).resolves.toBe(21);
        warn.mockRestore();
    });
});
