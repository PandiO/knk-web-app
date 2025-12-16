import { StructureCreateDTO } from './domain/dto/StructureCreateDTO';
// Import other DTOs as needed

export function extractFieldsFromDTO(dto: any): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const key in dto) {
    if (dto.hasOwnProperty(key)) {
      fields[key] = { name: key, type: typeof dto[key] };
    }
  }
  return fields;
}

// Example usage
const structureFields = extractFieldsFromDTO(new StructureCreateDTO());
console.log(structureFields);