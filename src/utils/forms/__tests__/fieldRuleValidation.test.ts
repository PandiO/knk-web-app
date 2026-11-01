import { checkFieldValidations } from '../fieldRuleValidation';
import { ValidationType } from '../../enums';
import { FieldValidationDto } from '../../../types/dtos/forms/FormModels';

const field = (...validations: Partial<FieldValidationDto>[]) => ({
    label: 'Name',
    validations: validations.map(v => ({ isActive: true, validationType: ValidationType.Required, ...v }) as FieldValidationDto)
});

describe('checkFieldValidations (#109 CRUD-8)', () => {
    it('leaves an empty value to Required', () => {
        expect(checkFieldValidations(field({ validationType: ValidationType.MinLength, parametersJson: '{"min":3}' }), '')).toBeNull();
        expect(checkFieldValidations(field({ validationType: ValidationType.Email }), undefined)).toBeNull();
    });

    it('checks MinLength and MaxLength', () => {
        const f = field(
            { validationType: ValidationType.MinLength, parametersJson: '{"min":3}' },
            { validationType: ValidationType.MaxLength, parametersJson: '{"maxLength":"5"}' }
        );
        expect(checkFieldValidations(f, 'ab')).toBe('Name needs at least 3 characters');
        expect(checkFieldValidations(f, 'abcd')).toBeNull();
        expect(checkFieldValidations(f, 'abcdef')).toBe('Name can have at most 5 characters');
    });

    it('checks Range on numbers and numeric text', () => {
        const f = field({ validationType: ValidationType.Range, parametersJson: '{"min":1,"max":10}' });
        expect(checkFieldValidations(f, 0)).toBe('Name must be at least 1');
        expect(checkFieldValidations(f, '11')).toBe('Name must be at most 10');
        expect(checkFieldValidations(f, 5)).toBeNull();
    });

    it('checks Regex and Email, with the configured message first', () => {
        expect(checkFieldValidations(field({ validationType: ValidationType.Regex, parametersJson: '{"pattern":"^[a-z_]+$"}' }), 'Town 1'))
            .toBe('Name has the wrong format');
        expect(checkFieldValidations(field({ validationType: ValidationType.Regex, parametersJson: '{"pattern":"^[a-z_]+$"}', errorMessage: 'Lower case only' }), 'Town'))
            .toBe('Lower case only');
        expect(checkFieldValidations(field({ validationType: ValidationType.Email }), 'not-an-email')).toBe('Name must be an email address');
        expect(checkFieldValidations(field({ validationType: ValidationType.Email }), 'a@b.nl')).toBeNull();
    });

    it('skips inactive, Custom and broken validations', () => {
        expect(checkFieldValidations(field({ validationType: ValidationType.MinLength, parametersJson: '{"min":3}', isActive: false }), 'a')).toBeNull();
        expect(checkFieldValidations(field({ validationType: ValidationType.Custom }), 'a')).toBeNull();
        expect(checkFieldValidations(field({ validationType: ValidationType.Regex, parametersJson: '{"pattern":"("}' }), 'a')).toBeNull();
        expect(checkFieldValidations(field({ validationType: ValidationType.MinLength, parametersJson: 'not json' }), 'a')).toBeNull();
    });
});
