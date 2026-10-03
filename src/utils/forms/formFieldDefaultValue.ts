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
