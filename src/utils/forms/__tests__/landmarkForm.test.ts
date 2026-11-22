import { FieldType } from '../../enums';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import {
    LINKED_DOMAIN_NEEDS_PARENT_REGION,
    landmarkFieldError,
    landmarkPickerFilters,
    parentIdFromValue,
    parentRegionFromValue,
    withLandmarkAreaOptions,
} from '../landmarkForm';

// Landmark-domain A17 and A18 (PandiO/knk-workspace#986): the landmark form's Area options and the parent picker.
const areaField: FormFieldDto = {
    fieldName: 'AreaKind', label: 'Area', fieldType: FieldType.Enum, order: 0, isRequired: false, isReadOnly: false,
    isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, validations: [],
    description: 'Where the landmark counts as reached.',
    settingsJson: JSON.stringify({ enumValues: ['None', 'OwnRegion', 'LinkedDomain'] }),
};
const settingsOf = (field: FormFieldDto) => JSON.parse(field.settingsJson!);

describe('landmark form rules', () => {
    it("reads whether the picked parent has a region, or that it has to be looked up", () => {
        expect(parentRegionFromValue(null)).toBe(false);
        expect(parentRegionFromValue({ id: 4, name: 'Cinix', wgRegionId: 'town_cinix' })).toBe(true);
        expect(parentRegionFromValue({ id: 5, name: 'Well', wgRegionId: null })).toBe(false);
        expect(parentRegionFromValue({ id: 5, WgRegionId: '  ' })).toBe(false);
        expect(parentRegionFromValue({ id: 6, name: 'Keep' })).toBeNull();
        expect(parentRegionFromValue(6)).toBeNull();
        expect(parentRegionFromValue({ id: -1 })).toBe(false);
        expect(parentIdFromValue({ Id: '7' })).toBe(7);
        expect(parentIdFromValue('x')).toBeNull();
    });

    it("names the areas and offers Linked domain's area only while the parent has a region", () => {
        const withRegion = withLandmarkAreaOptions('Landmark', areaField, 'None', true);
        expect(settingsOf(withRegion).enumValues).toEqual(['None', 'OwnRegion', 'LinkedDomain']);
        expect(settingsOf(withRegion).enumLabels).toMatchObject({ None: 'Point', OwnRegion: 'Own region', LinkedDomain: "Linked domain's area" });
        expect(withRegion.description).toBe(areaField.description);

        const withoutRegion = withLandmarkAreaOptions('landmark', areaField, 'None', false);
        expect(settingsOf(withoutRegion).enumValues).toEqual(['None', 'OwnRegion']);
        expect(withoutRegion.description).toContain("Linked domain's area is offered once the parent has a region.");

        // Still looking the parent up: nothing is held back yet.
        expect(settingsOf(withLandmarkAreaOptions('Landmark', areaField, 'None', null)).enumValues).toContain('LinkedDomain');
        // The stored value stays selectable, and the field says what is wrong.
        expect(settingsOf(withLandmarkAreaOptions('Landmark', areaField, 'LinkedDomain', false)).enumValues).toContain('LinkedDomain');
        expect(landmarkFieldError('Landmark', 'AreaKind', { AreaKind: 'LinkedDomain' }, false)).toBe(LINKED_DOMAIN_NEEDS_PARENT_REGION);
        expect(landmarkFieldError('Landmark', 'AreaKind', { AreaKind: 'LinkedDomain' }, true)).toBeUndefined();
        expect(landmarkFieldError('Landmark', 'AreaKind', { AreaKind: 'LinkedDomain' }, null)).toBeUndefined();
        expect(landmarkFieldError('Landmark', 'AreaKind', { AreaKind: 'OwnRegion' }, false)).toBeUndefined();
    });

    it('leaves every other form and field alone', () => {
        expect(withLandmarkAreaOptions('Town', areaField, 'None', false)).toBe(areaField);
        const other = { ...areaField, fieldName: 'Kind' };
        expect(withLandmarkAreaOptions('Landmark', other, 'None', false)).toBe(other);
        expect(landmarkFieldError('Structure', 'AreaKind', { AreaKind: 'LinkedDomain' }, false)).toBeUndefined();
        expect(landmarkPickerFilters('Structure', 'ParentDomainId', '9', undefined)).toBeUndefined();
    });

    it("leaves a saved landmark and its subtree out of its parent picker, nothing for a new one", () => {
        expect(landmarkPickerFilters('Landmark', 'ParentDomainId', '9', undefined)).toEqual({ excludeSubtreeOf: '9' });
        expect(landmarkPickerFilters('Landmark', 'parentDomainId', 9, { worldName: 'world' }))
            .toEqual({ worldName: 'world', excludeSubtreeOf: '9' });
        expect(landmarkPickerFilters('Landmark', 'ParentDomainId', undefined, undefined)).toBeUndefined();
        expect(landmarkPickerFilters('Landmark', 'LocationId', '9', undefined)).toBeUndefined();
    });
});
