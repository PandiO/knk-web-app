// DisplayConfiguration TypeScript Interfaces
// Matches backend DTOs with camelCase naming

export interface DisplayConfigurationDto {
  id?: string;
  configurationGuid?: string;
  name: string;
  entityTypeName: string;
  isDefault: boolean;
  description?: string;
  sectionOrderJson?: string;
  isDraft: boolean;
  createdAt?: string;
  updatedAt?: string;
  sections: DisplaySectionDto[];
}

export interface DisplaySectionDto {
  id?: string;
  sectionGuid?: string;
  displayConfigurationId?: string;
  sectionName: string;
  description?: string;
  isReusable: boolean;
  sourceSectionId?: string;
  isLinkedToSource: boolean;
  hasCompatibilityIssues?: boolean;
  compatibilityIssues?: string[];
  fieldOrderJson?: string;
  relatedEntityPropertyName?: string;
  relatedEntityTypeName?: string;
  isCollection: boolean;
  actionButtonsConfigJson?: string;
  parentSectionId?: string;
  createdAt?: string;
  updatedAt?: string;
  fields: DisplayFieldDto[];
  subSections: DisplaySectionDto[];
}

export interface DisplayFieldDto {
  id?: string;
  fieldGuid?: string;
  displaySectionId?: string;
  relatedEntityPropertyName?: string; // e.g., "ParentCategory", "IconMaterialRef"
  relatedEntityTypeName?: string; // e.g., "Category", "MinecraftMaterialRef"
  fieldName?: string;
  label: string;
  description?: string;
  templateText?: string;
  fieldType?: string;
  isReusable: boolean;
  sourceFieldId?: string;
  isLinkedToSource: boolean;
  hasCompatibilityIssues?: boolean;
  compatibilityIssues?: string[];
  isEditableInDisplay?: boolean; // Enable hot edit feature for this field
  createdAt?: string;
  updatedAt?: string;
}

export interface ActionButtonsConfigDto {
  // Common buttons
  showViewButton?: boolean;
  showEditButton?: boolean;
  
  // Single relationship buttons
  showSelectButton?: boolean;
  showUnlinkButton?: boolean;
  
  // Collection relationship buttons
  showAddButton?: boolean;
  showRemoveButton?: boolean;
  
  // Both types
  showCreateButton?: boolean;
}

export enum ReuseLinkMode {
  Copy = 0,
  Link = 1
}

// Request DTOs for API calls
export interface AddReusableSectionRequestDto {
  sourceSectionId: string;
  linkMode: ReuseLinkMode;
}

export interface AddReusableFieldRequestDto {
  sourceFieldId: string;
  linkMode: ReuseLinkMode;
}

// Component Props Interfaces
export interface DisplayWizardProps {
  entityTypeName: string;
  entityId: number;
  configurationId?: number;
  onActionClick?: (action: DisplayAction) => void;
}

export interface DisplayAction {
  type: 'view' | 'edit' | 'create' | 'select' | 'unlink' | 'add' | 'remove';
  entityType: string;
  entityId?: number;
  fieldName?: string;
}

export interface DisplayConfigBuilderProps {
  entityTypeName: string;
  configurationId?: number;
  onSave?: (config: DisplayConfigurationDto) => void;
  onCancel?: () => void;
}

export interface DisplaySectionProps {
  section: DisplaySectionDto;
  entityData: Record<string, unknown>;
  entityId?: string | number;
  entityTypeName?: string;
  onActionClick?: (action: DisplayAction) => void;
  onValueChange?: (fieldName: string, newValue: unknown) => Promise<void>;
}

export interface DisplayFieldProps {
  field: DisplayFieldDto;
  data: unknown;
  entityId?: string | number;
  entityTypeName?: string;
  onValueChange?: (fieldName: string, newValue: unknown) => Promise<void>;
}

export interface CollectionSectionProps {
  section: DisplaySectionDto;
  collectionData: unknown[];
  onActionClick?: (action: DisplayAction) => void;
}
