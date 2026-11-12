export interface FieldMetadataDto {
  fieldName: string;
  fieldType: string;
  isNullable: boolean;
  isRelatedEntity: boolean;
  relatedEntityType?: string | null;
  hasDefaultValue: boolean;
  defaultValue?: string | null;
  isEnum?: boolean;
  enumTypeName?: string | null;
  enumValues?: string[] | null;
}

export interface EntityPropertyDto {
  name: string;
  type?: string;
  description?: string;
  isRequired?: boolean;
  isNavigable?: boolean;
}

/**
 * One relationship of a type for the entity detail page (PandiO/knk-workspace#188, knk-web-api
 * `RelationshipMetadataDto`): what Select/Add (`canLink`) and Unlink (`canUnlink`) can do through
 * `api/Relationships`, why not (`linkReason` / `unlinkReason`), and every node a change needs (`nodes`).
 */
export interface RelationshipMetadataDto {
  /** The navigation property, camelCase (`streets`, `parentCategory`). */
  property: string;
  /** The type the page links to; for a link row (`ItemBlueprintTag`) the other side (`Tag`). */
  relatedType: string;
  kind: 'reference' | 'collection';
  /** `foreignKey` (this record's column), `children` (the related row's column), `many` (link table), `linkRow`, `other`. */
  storage: 'foreignKey' | 'children' | 'many' | 'linkRow' | 'other';
  canLink: boolean;
  canUnlink: boolean;
  linkReason?: string;
  unlinkReason?: string;
  nodes: string[];
  /** `linkRow` only: the item's field with the other side's id (`tagId`) and the embedded other side (`tag`). */
  relatedIdField?: string;
  relatedNavigation?: string;
}

export interface EntityMetadataDto {
  entityName: string;
  displayName: string;
  fields: FieldMetadataDto[];
  properties?: EntityPropertyDto[];
  defaultTableColumns?: string[];
  // PandiO/knk-workspace#280 (AM1/AM2): the access model's fields, from the API's DashboardAccess registry.
  area?: string | null;
  accessNode?: string | null;
  writeNode?: string | null;
  /** Any one of these reads the type in full. */
  readNodes?: string[];
  deletable?: boolean;
  bulkDeletable?: boolean;
  exportable?: boolean;
  lookupSearchable?: boolean;
  lookupGettable?: boolean;
  /** Per action, every node it needs (all of them): view, create, edit, delete, bulkDelete, export. */
  actionNodes?: Record<string, string[]>;
  /** PandiO/knk-workspace#188: the type's relationships. */
  relationships?: RelationshipMetadataDto[];
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
  defaultTableColumns?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for creating a new entity type configuration.
 */
export interface EntityTypeConfigurationCreateDto {
  entityTypeName: string;
  iconKey?: string | null;
  customIconUrl?: string | null;
  displayColor?: string | null;
  sortOrder: number;
  isVisible: boolean;
  defaultTableColumns?: string[];
}

/**
 * DTO for updating an existing entity type configuration.
 */
export interface EntityTypeConfigurationUpdateDto {
  id: string;
  entityTypeName: string;
  iconKey?: string | null;
  customIconUrl?: string | null;
  displayColor?: string | null;
  sortOrder: number;
  isVisible: boolean;
  defaultTableColumns?: string[];
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
