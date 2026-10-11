import { FieldValidationRuleDto } from '../../types/dtos/forms/FieldValidationRuleDtos';
import { FormConfigurationDto, FormFieldDto } from '../../types/dtos/forms/FormModels';
import { FieldType } from '../enums';
import { getFetchByIdFunctionForEntity } from '../entityApiMapping';

type FetchById = (entityTypeName: string) => (id: string) => Promise<unknown>;

const findField = (config: FormConfigurationDto | undefined, fieldId: number | undefined): FormFieldDto | undefined => {
    if (!config || fieldId == null) return undefined;
    for (const step of config.steps ?? []) {
        const found = step.fields?.find(f => f.id != null && Number(f.id) === Number(fieldId));
        if (found) return found;
    }
    return undefined;
};

// The property the plugin reads the region from (LocationInsideRegion / RegionContainment config).
const regionProperty = (rule: FieldValidationRuleDto): string => {
    try {
        const config = JSON.parse(rule.configJson || '{}');
        return config.regionPropertyPath || config.parentRegionPath || 'WgRegionId';
    } catch {
        return 'WgRegionId';
    }
};

const hasProperty = (value: Record<string, unknown>, name: string): boolean => {
    const key = Object.keys(value).find(k => k.toLowerCase() === name.toLowerCase());
    return key != null && value[key] !== null && value[key] !== undefined && value[key] !== '';
};

const referencedId = (value: unknown): string | null => {
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return /^\d+$/.test(value) ? value : null;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        return referencedId(record.id ?? record.Id);
    }
    return null;
};

/**
 * KNG-131: the dependency value a world task's validation rule hands the plugin, which reads the
 * region off it (e.g. GateStructure.WgRegionId). An edit-loaded Object field holds only the picked
 * record's id (or {id, name}), so a bare reference is replaced by the saved record - as the API's
 * own validation does (ValidationService.ResolveDependencyRecordAsync). Anything else, or a record
 * that can't be loaded, stays as it is.
 */
export async function resolveWorldTaskDependencyValue(
    rule: FieldValidationRuleDto,
    value: unknown,
    formConfiguration: FormConfigurationDto | undefined,
    fetchById: FetchById = getFetchByIdFunctionForEntity
): Promise<unknown> {
    const field = findField(formConfiguration, rule.dependsOnFieldId);
    if (!field || field.fieldType !== FieldType.Object || !field.objectType) return value;

    if (value && typeof value === 'object' && !Array.isArray(value)
        && hasProperty(value as Record<string, unknown>, regionProperty(rule))) {
        return value;
    }

    const id = referencedId(value);
    if (id == null) return value;

    try {
        const record = await fetchById(field.objectType)(id);
        return record && typeof record === 'object' ? record : value;
    } catch (error) {
        console.warn(`Could not load ${field.objectType} ${id} for a world task validation rule:`, error);
        return value;
    }
}
