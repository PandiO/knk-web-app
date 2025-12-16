export interface FieldMetadataDto {
  fieldName: string;
  fieldType: string;
  isNullable: boolean;
  isRelatedEntity: boolean;
  relatedEntityType?: string | null;
  hasDefaultValue: boolean;
  defaultValue?: string | null;
}

export interface EntityMetadataDto {
  entityName: string;
  displayName: string;
  fields: FieldMetadataDto[];
}

/**
 * Admin-configurable display and UI settings for an entity type.
 * Extends base EntityMetadata with icon, display properties, etc.
 */
export interface EntityTypeConfigurationDto {
  id: string;
  entityTypeName: string;
  iconKey?: string | null;
  customIconUrl?: string | null;
  displayColor?: string | null;
  sortOrder: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for creating a new entity type configuration.
 */
export interface EntityTypeConfigurationCreateDto {
  entityTypeName: string;
  iconKey: string;
  customIconUrl?: string | null;
  displayColor: string;
  sortOrder: number;
  isVisible: boolean;
}

/**
 * DTO for updating an existing entity type configuration.
 */
export interface EntityTypeConfigurationUpdateDto {
  id: string;
  iconKey: string;
  customIconUrl?: string | null;
  displayColor: string;
  sortOrder: number;
  isVisible: boolean;
}

// Alias for consistency
export type EntityTypeConfigurationReadDto = EntityTypeConfigurationDto;

/**
 * Merged metadata combining base entity structure + admin configuration.
 * Used throughout UI for forms, sidebars, dropdowns, etc.
 */
export interface MergedEntityMetadata extends EntityMetadataDto {
  configuration?: EntityTypeConfigurationDto;
  iconKey?: string | null;
  customIconUrl?: string | null;
  displayColor?: string | null;
  sortOrder: number;
  isVisible: boolean;
}
