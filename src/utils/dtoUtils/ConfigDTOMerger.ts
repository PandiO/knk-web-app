import { objectConfigs } from '../../config/objectConfigs';
import { extractFieldsFromDTO } from './dtoUtils';

export function mergeDTOWithConfig(dtoFields: Record<string, any>, config: Record<string, any>): Record<string, any> {
  const mergedFields: Record<string, any> = {};

  for (const key in dtoFields) {
    if (dtoFields.hasOwnProperty(key)) {
      mergedFields[key] = {
        ...dtoFields[key],
        ...config[key],
      };
    }
  }

  return mergedFields;
}

// Example usage
const structureFields = extractFieldsFromDTO(new StructureCreateDTO());
const mergedFields = mergeDTOWithConfig(structureFields, objectConfigs.structure.fields);
console.log(mergedFields);