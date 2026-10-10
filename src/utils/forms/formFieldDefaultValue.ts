import { FormFieldDto } from '../../types/dtos/forms/FormModels';
import { FieldType } from '../enums';
import { toBooleanFieldValue } from './booleanFieldValue';

/**
 * Returns the value FormWizard should submit for a field the user never touched.
 * Boolean DTO properties cannot accept JSON null, so a Boolean field without an
 * authored default follows the checkbox convention and starts as false.
 */
export function formFieldDefaultValue(
    field: Pick<FormFieldDto, 'fieldType' | 'defaultValue'>
): unknown {
    if (field.fieldType === FieldType.Boolean) {
        return toBooleanFieldValue(field.defaultValue);
    }

    return field.defaultValue ?? null;
}

/**
 * The value FormWizard holds for a field once it seeds step data from any source: a new form,
 * resumed progress, an entity being edited, a child/join form's initial values. A checkbox cannot
 * show "no value", so a Boolean that arrives as null/undefined (progress saved before KNG-26, an
 * entity without the property) becomes its default instead of an invisible missing value that
 * fails the Required check (KNG-53), and a "true"/"false" string becomes a real boolean. Other
 * field types keep a present value as is and fall back to their default when absent.
 */
export function seededFormFieldValue(
    field: Pick<FormFieldDto, 'fieldType' | 'defaultValue'>,
    hasValue: boolean,
    value: unknown
): unknown {
    if (field.fieldType === FieldType.Boolean) {
        return hasValue && value !== null && value !== undefined && value !== ''
            ? toBooleanFieldValue(value)
            : formFieldDefaultValue(field);
    }

    return hasValue ? value : formFieldDefaultValue(field);
}
