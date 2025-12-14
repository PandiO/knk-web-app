export interface FieldMetadataDto {
  fieldName: string;
  fieldType: string;
  isNullable: boolean;
  isRelatedEntity: boolean;
  relatedEntityType?: string | null;
}

export interface EntityMetadataDto {
  entityName: string;
  displayName: string;
  fields: FieldMetadataDto[];
}
