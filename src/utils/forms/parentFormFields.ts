import { FormConfigurationDto, FormFieldDto } from '../../types/dtos/forms/FormModels';
import { FieldType } from '../enums';

/**
 * The fields of the forms a form is opened from - its "parent forms" - for a validation rule's
 * "Depends On Field". A form is opened from a parent when the parent has an owned-child List field
 * of its entity type (settingsJson.ownedChildCollection, e.g. SiegeTeam.Spawnpoints) or a
 * many-to-many step whose join entity it is. Parents of parents count too (a siege spawnpoint is
 * opened from a team, which is opened from the scenario), nearest first.
 *
 * At runtime the wizard resolves such a dependency by field name from the values of the forms the
 * child was opened from (FormWizard parentContext), and so does the server-side check of a saved
 * entity (siege scenario readiness). Only default configurations are listed: they're the ones a
 * child form is opened with, and a parent field is matched by name anyway.
 */
export interface ParentFormField {
    field: FormFieldDto;
    configurationName: string;
    entityTypeName: string;
    /** 1 = the form this one is opened from, 2 = that form's parent, ... */
    depth: number;
}

const MAX_DEPTH = 3;

const opensAsChild = (config: FormConfigurationDto, childEntityTypeName: string): boolean => {
    const child = childEntityTypeName.toLowerCase();
    return config.steps.some(step => {
        if (step.isManyToManyRelationship) {
            return (step.joinEntityType || '').toLowerCase() === child;
        }
        return step.fields.some(field =>
            field.fieldType === FieldType.List &&
            (field.objectType || '').toLowerCase() === child &&
            isOwnedChildCollection(field.settingsJson));
    });
};

const isOwnedChildCollection = (settingsJson?: string): boolean => {
    if (!settingsJson) return false;
    try {
        return !!JSON.parse(settingsJson)?.ownedChildCollection;
    } catch {
        return false;
    }
};

export const findParentFormFields = (configurations: FormConfigurationDto[], entityTypeName: string): ParentFormField[] => {
    const defaults = configurations.filter(c => c.isDefault && c.isActive !== false);
    const result: ParentFormField[] = [];
    const visited = new Set<string>([entityTypeName.toLowerCase()]);
    let level = [entityTypeName];

    for (let depth = 1; depth <= MAX_DEPTH && level.length > 0; depth++) {
        const next: string[] = [];
        level.forEach(child => {
            defaults
                .filter(config => !visited.has(config.entityTypeName.toLowerCase()) && opensAsChild(config, child))
                .forEach(config => {
                    visited.add(config.entityTypeName.toLowerCase());
                    next.push(config.entityTypeName);
                    config.steps
                        .filter(step => !step.isManyToManyRelationship)
                        .flatMap(step => step.fields)
                        .filter(field => field.id && field.fieldType !== FieldType.List)
                        .forEach(field => result.push({
                            field,
                            configurationName: config.configurationName,
                            entityTypeName: config.entityTypeName,
                            depth
                        }));
                });
        });
        level = next;
    }

    return result;
};
