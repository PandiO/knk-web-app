import { parsePickerFilterSettings, resolvePickerFilters } from '../pickerFilters';

describe('pickerFilters', () => {
    const settings = (json: object) => parsePickerFilterSettings(JSON.stringify(json));

    it('ignores fields without pickerFilters', () => {
        expect(parsePickerFilterSettings(undefined)).toBeNull();
        expect(parsePickerFilterSettings('{"worldTask":{"enabled":true}}')).toBeNull();
        expect(parsePickerFilterSettings('not json')).toBeNull();
        expect(resolvePickerFilters(null, {}, {})).toBeNull();
    });

    it('resolves parent tokens, taking an Object value\'s id, case-insensitively', () => {
        const result = resolvePickerFilters(
            settings({ pickerFilters: { preferTownId: '{parent.TownId}', siegeScenarioId: '{parent.id}' } }),
            {},
            { townid: { id: 5, name: 'Cinix' }, id: '1' }
        );
        expect(result).toEqual({ filters: { preferTownId: '5', siegeScenarioId: '1' } });
    });

    it('resolves own-form tokens (e.g. the prefilled parent link) and keeps literals', () => {
        const result = resolvePickerFilters(
            settings({ pickerFilters: { siegeScenarioId: '{SiegeScenarioId}', isActive: 'true' } }),
            { SiegeScenarioId: 7 }
        );
        expect(result).toEqual({ filters: { siegeScenarioId: '7', isActive: 'true' } });
    });

    it('drops an unresolved optional token', () => {
        const result = resolvePickerFilters(settings({ pickerFilters: { preferTownId: '{parent.TownId?}' } }), {}, undefined);
        expect(result).toEqual({ filters: {} });
    });

    it('makes the picker unavailable for an unresolved required token, including the -1 unsaved-parent id', () => {
        const unsaved = resolvePickerFilters(
            settings({ pickerFilters: { siegeScenarioId: '{parent.id}' }, pickerFiltersMissingMessage: 'Save the scenario first.' }),
            {},
            { id: -1 }
        );
        expect(unsaved?.unavailableReason).toBe('Save the scenario first.');

        const missing = resolvePickerFilters(settings({ pickerFilters: { siegeScenarioId: '{SiegeScenarioId}' } }), {});
        expect(missing?.unavailableReason).toMatch(/save the parent record first/i);

        const numericString = resolvePickerFilters(settings({ pickerFilters: { siegeScenarioId: '{parent.id}' } }), {}, { id: '-1' });
        expect(numericString?.unavailableReason).toBeDefined();
    });
});
