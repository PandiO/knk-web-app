# FRONTEND REQUIREMENTS: DisplayConfiguration Feature

**Datum:** 10 december 2025  
**Status:** Ready for Implementation  
**Related Backend:** `knkwebapi_v2/Prompts/REQUIREMENTS_DISPLAYCONFIG_VERSION2.md`

---

## 1. OVERZICHT

### 1.1 Doel
Implementatie van een DisplayConfiguration systeem in de frontend voor het:
1. **DisplayConfigBuilder** - Admin tool om display templates te configureren
2. **DisplayWizard** - Component om entity data te tonen volgens configuratie

Parallel aan het bestaande FormConfiguration/FormWizard systeem, maar voor **read-only weergave** van data.

### 1.2 Technologie Stack
- **Framework:** React 18 + TypeScript
- **State Management:** React Context + Hooks (zoals bestaande FormWizard)
- **API Client:** Fetch API (consistent met huidige implementatie)
- **Styling:** Tailwind CSS + Material-UI componenten
- **Form Handling:** React Hook Form (voor builder interface)
- **Routing:** React Router v6

### 1.3 Architectuur Principes
- Volgt exact dezelfde patronen als FormWizard/FormConfigBuilder
- Hergebruik bestaande utilities (`apiClient.ts`, type definitions)
- Component compositie voor flexibiliteit
- TypeScript interfaces matchen backend DTOs (camelCase)

---

## 2. TYPESCRIPT INTERFACES

### 2.1 API DTOs (mirror backend)

```typescript
// src/types/displayConfiguration.ts

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
  fieldName?: string;
  label: string;
  description?: string;
  templateText?: string;
  fieldType?: string;
  isReusable: boolean;
  sourceFieldId?: string;
  isLinkedToSource: boolean;
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
```

### 2.2 Component Props

```typescript
// DisplayWizard component props
export interface DisplayWizardProps {
  entityTypeName: string;
  entityId: number;
  configurationId?: number; // Optional: gebruik default als niet opgegeven
  onActionClick?: (action: DisplayAction) => void;
}

export interface DisplayAction {
  type: 'view' | 'edit' | 'create' | 'select' | 'unlink' | 'add' | 'remove';
  entityType: string;
  entityId?: number;
  fieldName?: string;
}

// DisplayConfigBuilder component props
export interface DisplayConfigBuilderProps {
  entityTypeName: string;
  configurationId?: number; // Nieuw vs. bestaand
  onSave?: (config: DisplayConfigurationDto) => void;
  onCancel?: () => void;
}
```

---

## 3. API CLIENT

### 3.1 DisplayConfiguration API Service

```typescript
// src/apiClients/displayConfigClient.ts

import { API_BASE_URL } from '../config/apiConfig';

export const displayConfigClient = {
  // Configurations
  async getAll(includeDrafts: boolean = true): Promise<DisplayConfigurationDto[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/displayconfigurations?includeDrafts=${includeDrafts}`
    );
    if (!response.ok) throw new Error('Failed to fetch configurations');
    return response.json();
  },

  async getById(id: number): Promise<DisplayConfigurationDto> {
    const response = await fetch(`${API_BASE_URL}/api/displayconfigurations/${id}`);
    if (!response.ok) throw new Error('Configuration not found');
    return response.json();
  },

  async getDefaultByEntityType(
    entityName: string, 
    includeDrafts: boolean = false
  ): Promise<DisplayConfigurationDto> {
    const response = await fetch(
      `${API_BASE_URL}/api/displayconfigurations/entity/${entityName}?includeDrafts=${includeDrafts}`
    );
    if (!response.ok) throw new Error('No default configuration found');
    return response.json();
  },

  async create(config: DisplayConfigurationDto): Promise<DisplayConfigurationDto> {
    const response = await fetch(`${API_BASE_URL}/api/displayconfigurations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Failed to create configuration');
    return response.json();
  },

  async update(id: number, config: DisplayConfigurationDto): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/displayconfigurations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Failed to update configuration');
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/displayconfigurations/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete configuration');
  },

  async publish(id: number): Promise<DisplayConfigurationDto> {
    const response = await fetch(
      `${API_BASE_URL}/api/displayconfigurations/${id}/publish`,
      { method: 'POST' }
    );
    if (!response.ok) throw new Error('Failed to publish configuration');
    return response.json();
  },

  // Sections
  async getAllReusableSections(): Promise<DisplaySectionDto[]> {
    const response = await fetch(`${API_BASE_URL}/api/displaysections/reusable`);
    if (!response.ok) throw new Error('Failed to fetch reusable sections');
    return response.json();
  },

  async createReusableSection(section: DisplaySectionDto): Promise<DisplaySectionDto> {
    const response = await fetch(`${API_BASE_URL}/api/displaysections/reusable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(section)
    });
    if (!response.ok) throw new Error('Failed to create reusable section');
    return response.json();
  },

  async cloneSection(id: number, linkMode: ReuseLinkMode): Promise<DisplaySectionDto> {
    const response = await fetch(`${API_BASE_URL}/api/displaysections/${id}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkMode })
    });
    if (!response.ok) throw new Error('Failed to clone section');
    return response.json();
  },

  // Fields
  async getAllReusableFields(): Promise<DisplayFieldDto[]> {
    const response = await fetch(`${API_BASE_URL}/api/displayfields/reusable`);
    if (!response.ok) throw new Error('Failed to fetch reusable fields');
    return response.json();
  },

  async cloneField(id: number, linkMode: ReuseLinkMode): Promise<DisplayFieldDto> {
    const response = await fetch(`${API_BASE_URL}/api/displayfields/${id}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkMode })
    });
    if (!response.ok) throw new Error('Failed to clone field');
    return response.json();
  }
};
```

---

## 4. DISPLAYWIZARD COMPONENT

### 4.1 Component Structuur

```
src/components/DisplayWizard/
├── DisplayWizard.tsx              # Main container
├── DisplaySection.tsx             # Section renderer
├── DisplayField.tsx               # Field renderer (per type)
├── CollectionSection.tsx          # Collection iterator
├── ActionButtons.tsx              # Dynamic action buttons
├── TemplateTextRenderer.tsx       # ${...} variable interpolation
├── displayWizard.css             # Styling
└── hooks/
    ├── useDisplayConfig.ts        # Fetch & cache configuration
    ├── useEntityData.ts           # Fetch entity data
    └── useTemplateParser.ts       # Parse ${...} syntax
```

### 4.2 DisplayWizard Implementatie

```typescript
// src/components/DisplayWizard/DisplayWizard.tsx

import React, { useEffect, useState } from 'react';
import { useDisplayConfig } from './hooks/useDisplayConfig';
import { useEntityData } from './hooks/useEntityData';
import DisplaySection from './DisplaySection';
import './displayWizard.css';

export const DisplayWizard: React.FC<DisplayWizardProps> = ({
  entityTypeName,
  entityId,
  configurationId,
  onActionClick
}) => {
  const { config, loading: configLoading, error: configError } = useDisplayConfig(
    entityTypeName,
    configurationId
  );
  
  const { data: entityData, loading: dataLoading, error: dataError } = useEntityData(
    entityTypeName,
    entityId
  );

  if (configLoading || dataLoading) {
    return <div className="display-wizard-loading">Loading...</div>;
  }

  if (configError || dataError) {
    return (
      <div className="display-wizard-error">
        Error: {configError?.message || dataError?.message}
      </div>
    );
  }

  if (!config || !entityData) {
    return <div className="display-wizard-empty">No data available</div>;
  }

  // Parse sectionOrderJson to get ordered sections
  const sectionOrder: string[] = config.sectionOrderJson 
    ? JSON.parse(config.sectionOrderJson) 
    : [];
  
  const orderedSections = sectionOrder
    .map(guid => config.sections.find(s => s.sectionGuid === guid))
    .filter(Boolean) as DisplaySectionDto[];

  return (
    <div className="display-wizard">
      <div className="display-wizard-header">
        <h2>{config.name}</h2>
        {config.description && (
          <p className="display-wizard-description">{config.description}</p>
        )}
      </div>

      <div className="display-wizard-sections">
        {orderedSections.map(section => (
          <DisplaySection
            key={section.sectionGuid}
            section={section}
            entityData={entityData}
            onActionClick={onActionClick}
          />
        ))}
      </div>
    </div>
  );
};
```

### 4.3 DisplaySection Implementatie

```typescript
// src/components/DisplayWizard/DisplaySection.tsx

import React from 'react';
import DisplayField from './DisplayField';
import CollectionSection from './CollectionSection';
import ActionButtons from './ActionButtons';

interface DisplaySectionProps {
  section: DisplaySectionDto;
  entityData: any;
  onActionClick?: (action: DisplayAction) => void;
}

export const DisplaySection: React.FC<DisplaySectionProps> = ({
  section,
  entityData,
  onActionClick
}) => {
  // Parse fieldOrderJson
  const fieldOrder: string[] = section.fieldOrderJson 
    ? JSON.parse(section.fieldOrderJson) 
    : [];
  
  const orderedFields = fieldOrder
    .map(guid => section.fields.find(f => f.fieldGuid === guid))
    .filter(Boolean) as DisplayFieldDto[];

  // Determine data source
  let sectionData = entityData;
  if (section.relatedEntityPropertyName) {
    sectionData = entityData[section.relatedEntityPropertyName];
  }

  // Parse action buttons config
  const actionButtons: ActionButtonsConfigDto = section.actionButtonsConfigJson
    ? JSON.parse(section.actionButtonsConfigJson)
    : {};

  return (
    <div className="display-section">
      <div className="display-section-header">
        <h3>{section.sectionName}</h3>
        {section.description && (
          <p className="display-section-description">{section.description}</p>
        )}
      </div>

      <div className="display-section-content">
        {section.isCollection ? (
          // Collection: iterate over array data
          <CollectionSection
            section={section}
            collectionData={sectionData}
            onActionClick={onActionClick}
          />
        ) : (
          // Single entity: render fields
          <>
            <div className="display-fields">
              {orderedFields.map(field => (
                <DisplayField
                  key={field.fieldGuid}
                  field={field}
                  data={sectionData}
                />
              ))}
            </div>

            {/* Action buttons for single relationship */}
            <ActionButtons
              config={actionButtons}
              isCollection={false}
              entityType={section.relatedEntityTypeName}
              entityData={sectionData}
              onActionClick={onActionClick}
            />
          </>
        )}
      </div>
    </div>
  );
};
```

### 4.4 DisplayField Implementatie

```typescript
// src/components/DisplayWizard/DisplayField.tsx

import React from 'react';
import { useTemplateParser } from './hooks/useTemplateParser';

interface DisplayFieldProps {
  field: DisplayFieldDto;
  data: any;
}

export const DisplayField: React.FC<DisplayFieldProps> = ({ field, data }) => {
  const { parseTemplate } = useTemplateParser();

  // Determine value to display
  let displayValue: any;

  if (field.templateText) {
    // Use template text with variable interpolation
    displayValue = parseTemplate(field.templateText, data);
  } else if (field.fieldName) {
    // Direct property access (supports nested: "street.name")
    displayValue = getNestedValue(data, field.fieldName);
  } else {
    displayValue = null;
  }

  // Format value based on fieldType
  const formattedValue = formatValue(displayValue, field.fieldType);

  return (
    <div className="display-field">
      <label className="display-field-label">{field.label}</label>
      <div className="display-field-value">{formattedValue}</div>
      {field.description && (
        <p className="display-field-description">{field.description}</p>
      )}
    </div>
  );
};

// Helper: Get nested property value (e.g., "street.name")
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Helper: Format value based on type
function formatValue(value: any, fieldType?: string): string {
  if (value === null || value === undefined) return '-';

  switch (fieldType?.toLowerCase()) {
    case 'datetime':
      return new Date(value).toLocaleString();
    case 'date':
      return new Date(value).toLocaleDateString();
    case 'integer':
    case 'number':
      return value.toLocaleString();
    case 'boolean':
      return value ? 'Yes' : 'No';
    default:
      return String(value);
  }
}
```

### 4.5 CollectionSection Implementatie

```typescript
// src/components/DisplayWizard/CollectionSection.tsx

import React from 'react';
import DisplayField from './DisplayField';
import ActionButtons from './ActionButtons';

interface CollectionSectionProps {
  section: DisplaySectionDto;
  collectionData: any[];
  onActionClick?: (action: DisplayAction) => void;
}

export const CollectionSection: React.FC<CollectionSectionProps> = ({
  section,
  collectionData,
  onActionClick
}) => {
  if (!Array.isArray(collectionData) || collectionData.length === 0) {
    return <div className="collection-empty">No items</div>;
  }

  // Get subsection template (first subsection)
  const itemTemplate = section.subSections[0];
  if (!itemTemplate) {
    return <div className="collection-error">No template configured</div>;
  }

  // Parse action buttons
  const actionButtons: ActionButtonsConfigDto = section.actionButtonsConfigJson
    ? JSON.parse(section.actionButtonsConfigJson)
    : {};

  return (
    <div className="collection-section">
      {/* Collection-level action buttons */}
      <ActionButtons
        config={actionButtons}
        isCollection={true}
        entityType={section.relatedEntityTypeName}
        onActionClick={onActionClick}
      />

      {/* Iterate over collection items */}
      <div className="collection-items">
        {collectionData.map((item, index) => (
          <div key={item.id || index} className="collection-item">
            <div className="collection-item-fields">
              {itemTemplate.fields.map(field => (
                <DisplayField
                  key={field.fieldGuid}
                  field={field}
                  data={item}
                />
              ))}
            </div>

            {/* Per-item action buttons */}
            <ActionButtons
              config={actionButtons}
              isCollection={true}
              entityType={section.relatedEntityTypeName}
              entityData={item}
              onActionClick={onActionClick}
              isItemLevel={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 4.6 Template Text Parser Hook

```typescript
// src/components/DisplayWizard/hooks/useTemplateParser.ts

import { useMemo } from 'react';

export function useTemplateParser() {
  const parseTemplate = useMemo(() => {
    return (template: string, data: any): string => {
      // Regex to match ${...} patterns
      const variableRegex = /\$\{([^}]+)\}/g;

      return template.replace(variableRegex, (match, expression) => {
        try {
          // Handle simple property access: ${name}
          // Handle nested: ${street.name}
          // Handle count: ${districts.Count}
          // Handle calculations: ${districts.Count + streets.Count}

          const trimmed = expression.trim();

          // Check if it's a calculation (contains operators)
          if (/[+\-*/]/.test(trimmed)) {
            return evaluateCalculation(trimmed, data);
          }

          // Simple property access
          return getNestedValue(data, trimmed) ?? '';
        } catch (error) {
          console.warn(`Failed to parse template variable: ${expression}`, error);
          return match; // Return original ${...} on error
        }
      });
    };
  }, []);

  return { parseTemplate };
}

function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (part === 'Count' && Array.isArray(current)) {
      return current.length;
    }
    current = current?.[part];
    if (current === undefined) return null;
  }

  return current;
}

function evaluateCalculation(expression: string, data: any): string {
  // Split by operators while preserving them
  const tokens = expression.split(/([+\-*/])/);
  
  let result = 0;
  let currentOp = '+';

  for (const token of tokens) {
    const trimmed = token.trim();
    
    if (['+', '-', '*', '/'].includes(trimmed)) {
      currentOp = trimmed;
      continue;
    }

    // Get value (either number or property path)
    const value = isNaN(Number(trimmed))
      ? Number(getNestedValue(data, trimmed))
      : Number(trimmed);

    switch (currentOp) {
      case '+': result += value; break;
      case '-': result -= value; break;
      case '*': result *= value; break;
      case '/': result /= value; break;
    }
  }

  return String(result);
}
```

---

## 5. DISPLAYCONFIGBUILDER COMPONENT

### 5.1 Component Structuur

```
src/components/DisplayConfigBuilder/
├── DisplayConfigBuilder.tsx       # Main builder interface
├── ConfigurationEditor.tsx        # Top-level config properties
├── SectionList.tsx                # Drag-drop section ordering
├── SectionEditor.tsx              # Edit single section
├── FieldList.tsx                  # Drag-drop field ordering
├── FieldEditor.tsx                # Edit single field
├── TemplateTextEditor.tsx         # Syntax highlighted editor for ${...}
├── ActionButtonsEditor.tsx        # Checkbox grid for buttons
├── ReusableLibrary.tsx            # Modal for selecting reusable sections/fields
└── displayConfigBuilder.css
```

### 5.2 Builder Main Component

```typescript
// src/components/DisplayConfigBuilder/DisplayConfigBuilder.tsx

import React, { useState, useEffect } from 'react';
import { displayConfigClient } from '../../apiClients/displayConfigClient';
import ConfigurationEditor from './ConfigurationEditor';
import SectionList from './SectionList';
import Button from '@mui/material/Button';

export const DisplayConfigBuilder: React.FC<DisplayConfigBuilderProps> = ({
  entityTypeName,
  configurationId,
  onSave,
  onCancel
}) => {
  const [config, setConfig] = useState<DisplayConfigurationDto>({
    name: `${entityTypeName} Display`,
    entityTypeName,
    isDefault: false,
    isDraft: true,
    sectionOrderJson: '[]',
    sections: []
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing configuration
  useEffect(() => {
    if (configurationId) {
      setLoading(true);
      displayConfigClient.getById(configurationId)
        .then(setConfig)
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [configurationId]);

  const handleSave = async (publish: boolean = false) => {
    try {
      setLoading(true);
      
      if (configurationId) {
        // Update existing
        await displayConfigClient.update(configurationId, config);
        
        if (publish && config.isDraft) {
          await displayConfigClient.publish(configurationId);
        }
      } else {
        // Create new
        const created = await displayConfigClient.create(config);
        
        if (publish) {
          await displayConfigClient.publish(parseInt(created.id!));
        }
      }

      onSave?.(config);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !config.id) {
    return <div>Loading...</div>;
  }

  return (
    <div className="display-config-builder">
      <div className="builder-header">
        <h2>
          {configurationId ? 'Edit' : 'Create'} Display Configuration
        </h2>
        {config.isDraft && <span className="badge-draft">DRAFT</span>}
      </div>

      {error && (
        <div className="builder-error">{error}</div>
      )}

      {/* Top-level configuration properties */}
      <ConfigurationEditor
        config={config}
        onChange={setConfig}
      />

      {/* Section list with drag-drop ordering */}
      <SectionList
        sections={config.sections}
        sectionOrder={JSON.parse(config.sectionOrderJson || '[]')}
        onSectionsChange={(sections) => setConfig({ ...config, sections })}
        onOrderChange={(order) => 
          setConfig({ ...config, sectionOrderJson: JSON.stringify(order) })
        }
      />

      {/* Action buttons */}
      <div className="builder-actions">
        <Button onClick={onCancel} variant="outlined">
          Cancel
        </Button>
        <Button 
          onClick={() => handleSave(false)} 
          variant="contained"
          disabled={loading}
        >
          Save Draft
        </Button>
        <Button 
          onClick={() => handleSave(true)} 
          variant="contained" 
          color="primary"
          disabled={loading}
        >
          {config.isDraft ? 'Save & Publish' : 'Update'}
        </Button>
      </div>
    </div>
  );
};
```

### 5.3 Template Text Editor met Syntax Highlighting

```typescript
// src/components/DisplayConfigBuilder/TemplateTextEditor.tsx

import React, { useState } from 'react';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';

interface TemplateTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  entityTypeName: string;
}

export const TemplateTextEditor: React.FC<TemplateTextEditorProps> = ({
  value,
  onChange,
  entityTypeName
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Load available properties from metadata
  useEffect(() => {
    // Fetch entity metadata to get available properties
    // This would use your existing metadata service
    metadataClient.getEntityMetadata(entityTypeName)
      .then(metadata => {
        const props = metadata.properties.map(p => p.name);
        setSuggestions(props);
      });
  }, [entityTypeName]);

  const insertVariable = (propertyName: string) => {
    onChange(value + `\${${propertyName}}`);
  };

  return (
    <div className="template-text-editor">
      <TextField
        label="Template Text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        multiline
        rows={4}
        fullWidth
        helperText="Use ${propertyName} for variables. Example: This town has ${Districts.Count} districts"
      />

      <div className="variable-suggestions">
        <label>Insert Variable:</label>
        {suggestions.map(prop => (
          <Chip
            key={prop}
            label={`\${${prop}}`}
            onClick={() => insertVariable(prop)}
            size="small"
            variant="outlined"
          />
        ))}
      </div>

      {/* Preview */}
      <div className="template-preview">
        <label>Preview:</label>
        <div className="preview-text">
          {highlightVariables(value)}
        </div>
      </div>
    </div>
  );
};

function highlightVariables(text: string): React.ReactNode {
  const parts = text.split(/(\$\{[^}]+\})/g);
  
  return parts.map((part, i) => {
    if (part.startsWith('${')) {
      return (
        <span key={i} className="template-variable">
          {part}
        </span>
      );
    }
    return part;
  });
}
```

---

## 6. ROUTING & PAGE INTEGRATION

### 6.1 Routes Setup

```typescript
// src/App.tsx (add to existing routes)

import DisplayWizardPage from './pages/DisplayWizardPage';
import DisplayConfigBuilderPage from './pages/DisplayConfigBuilderPage';
import DisplayConfigListPage from './pages/DisplayConfigListPage';

// In router:
<Route path="/display/:entityName/:id" element={<DisplayWizardPage />} />
<Route path="/admin/display-configs" element={<DisplayConfigListPage />} />
<Route path="/admin/display-configs/new/:entityName" element={<DisplayConfigBuilderPage />} />
<Route path="/admin/display-configs/edit/:id" element={<DisplayConfigBuilderPage />} />
```

### 6.2 Display Wizard Page

```typescript
// src/pages/DisplayWizardPage.tsx

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DisplayWizard from '../components/DisplayWizard/DisplayWizard';

export const DisplayWizardPage: React.FC = () => {
  const { entityName, id } = useParams<{ entityName: string; id: string }>();
  const navigate = useNavigate();

  const handleActionClick = (action: DisplayAction) => {
    switch (action.type) {
      case 'edit':
        navigate(`/form/${action.entityType}/${action.entityId}`);
        break;
      case 'view':
        navigate(`/display/${action.entityType}/${action.entityId}`);
        break;
      case 'create':
        navigate(`/form/${action.entityType}/new`);
        break;
      // ... andere actions
    }
  };

  if (!entityName || !id) {
    return <div>Invalid parameters</div>;
  }

  return (
    <div className="page-container">
      <DisplayWizard
        entityTypeName={entityName}
        entityId={parseInt(id)}
        onActionClick={handleActionClick}
      />
    </div>
  );
};
```

---

## 7. STYLING GUIDE

### 7.1 CSS Classes (Tailwind + Custom)

```css
/* src/components/DisplayWizard/displayWizard.css */

.display-wizard {
  @apply max-w-6xl mx-auto p-6;
}

.display-wizard-header {
  @apply mb-6 pb-4 border-b border-gray-200;
}

.display-wizard-header h2 {
  @apply text-3xl font-bold text-gray-900;
}

.display-wizard-description {
  @apply text-gray-600 mt-2;
}

.display-wizard-sections {
  @apply space-y-6;
}

/* Section styling */
.display-section {
  @apply bg-white rounded-lg shadow-md p-6;
}

.display-section-header {
  @apply mb-4 pb-3 border-b border-gray-100;
}

.display-section-header h3 {
  @apply text-xl font-semibold text-gray-800;
}

.display-fields {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

/* Field styling */
.display-field {
  @apply mb-4;
}

.display-field-label {
  @apply block text-sm font-medium text-gray-700 mb-1;
}

.display-field-value {
  @apply text-base text-gray-900 bg-gray-50 px-3 py-2 rounded;
}

/* Collection styling */
.collection-section {
  @apply space-y-4;
}

.collection-items {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4;
}

.collection-item {
  @apply bg-gray-50 rounded-lg p-4 border border-gray-200;
}

/* Template variables highlighting */
.template-variable {
  @apply bg-blue-100 text-blue-800 px-1 rounded font-mono text-sm;
}
```

---

## 8. STATE MANAGEMENT

### 8.1 Custom Hooks Pattern

Volg hetzelfde patroon als bestaande FormWizard hooks:

```typescript
// src/components/DisplayWizard/hooks/useDisplayConfig.ts

export function useDisplayConfig(
  entityTypeName: string,
  configurationId?: number
) {
  const [config, setConfig] = useState<DisplayConfigurationDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        
        const fetchedConfig = configurationId
          ? await displayConfigClient.getById(configurationId)
          : await displayConfigClient.getDefaultByEntityType(entityTypeName);
        
        setConfig(fetchedConfig);
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [entityTypeName, configurationId]);

  return { config, loading, error };
}
```

---

## 9. TESTING CHECKLIST

### 9.1 Unit Tests
- [ ] Template text parser (various ${...} patterns)
- [ ] Nested property accessor
- [ ] Value formatters (DateTime, Number, Boolean)
- [ ] Action button visibility logic

### 9.2 Integration Tests
- [ ] DisplayWizard renders configuration correctly
- [ ] Section ordering matches sectionOrderJson
- [ ] Field ordering matches fieldOrderJson
- [ ] Collection iteration works for arrays
- [ ] Action buttons trigger correct callbacks

### 9.3 E2E Tests (Cypress)
- [ ] Load entity display page
- [ ] Verify all sections render
- [ ] Verify template text interpolation
- [ ] Click action buttons (edit, view, create)
- [ ] Navigate to related entities

### 9.4 Builder Tests
- [ ] Create new configuration
- [ ] Add/remove/reorder sections
- [ ] Add/remove/reorder fields
- [ ] Save as draft
- [ ] Publish configuration
- [ ] Clone reusable sections

---

## 10. IMPLEMENTATION VOLGORDE

### Phase 1: Core Display (Week 1)
1. ✅ TypeScript interfaces
2. ✅ API client (displayConfigClient.ts)
3. ✅ DisplayWizard component (basis rendering)
4. ✅ DisplayField component (alle types)
5. ✅ Template text parser hook

### Phase 2: Collections & Actions (Week 2)
6. ✅ CollectionSection component
7. ✅ ActionButtons component
8. ✅ Nested sections support
9. ✅ Action click handlers
10. ✅ Page integration & routing

### Phase 3: Builder Interface (Week 3)
11. ✅ DisplayConfigBuilder component
12. ✅ Section drag-drop ordering
13. ✅ Field editor panel
14. ✅ TemplateTextEditor with syntax highlighting
15. ✅ Reusable library modal

### Phase 4: Polish & Testing (Week 4)
16. ✅ CSS styling (responsive design)
17. ✅ Error handling & loading states
18. ✅ Unit tests
19. ✅ Integration tests
20. ✅ Documentation

---

## 11. VERSCHILLEN MET FORMWIZARD

| Aspect | FormWizard | DisplayWizard |
|--------|------------|---------------|
| **Doel** | Data input (create/edit) | Data weergave (read-only) |
| **Steps** | FormSteps (wizard flow) | DisplaySections (all visible) |
| **Fields** | Input fields (editable) | Display fields (readonly) |
| **Validation** | Client + server validation | Geen validatie nodig |
| **Submit** | POST/PUT naar backend | Geen submit actie |
| **Navigation** | Next/Previous buttons | Scroll/anchor links |
| **Draft Mode** | Save progress | N/A (alleen in builder) |
| **Template Text** | ❌ Niet ondersteund | ✅ ${...} interpolation |
| **Collections** | Sub-forms (nested wizard) | Iteration met template |

---

## 12. VOORBEELD GEBRUIK

### 12.1 Town Detail Page

```typescript
// Display Town entity met default configuration
<DisplayWizard
  entityTypeName="Town"
  entityId={townId}
  onActionClick={(action) => {
    if (action.type === 'edit') {
      navigate(`/form/Town/${action.entityId}`);
    }
  }}
/>
```

### 12.2 Custom Configuration

```typescript
// Display met specifieke configuration
<DisplayWizard
  entityTypeName="Town"
  entityId={townId}
  configurationId={5} // Custom "Town Public View" config
/>
```

### 12.3 Builder Usage

```typescript
// Maak nieuwe display configuratie
<DisplayConfigBuilder
  entityTypeName="District"
  onSave={(config) => {
    console.log('Saved config:', config);
    navigate('/admin/display-configs');
  }}
  onCancel={() => navigate('/admin/display-configs')}
/>
```

---

## 13. API RESPONSE VOORBEELDEN

### 13.1 GET Configuration Response

```json
{
  "id": "1",
  "name": "Town Detail View",
  "entityTypeName": "Town",
  "isDefault": true,
  "isDraft": false,
  "sectionOrderJson": "[\"guid-1\", \"guid-2\", \"guid-3\"]",
  "sections": [
    {
      "id": "10",
      "sectionGuid": "guid-1",
      "sectionName": "General Information",
      "fieldOrderJson": "[\"field-guid-1\", \"field-guid-2\"]",
      "isCollection": false,
      "fields": [
        {
          "id": "100",
          "fieldGuid": "field-guid-1",
          "label": "Town Name",
          "fieldName": "name",
          "fieldType": "String"
        },
        {
          "id": "101",
          "fieldGuid": "field-guid-2",
          "label": "Description",
          "templateText": "This town has ${Districts.Count} districts and ${Streets.Count} streets",
          "fieldType": "String"
        }
      ],
      "subSections": []
    },
    {
      "id": "11",
      "sectionGuid": "guid-2",
      "sectionName": "Districts",
      "relatedEntityPropertyName": "districts",
      "relatedEntityTypeName": "District",
      "isCollection": true,
      "actionButtonsConfigJson": "{\"showViewButton\":true,\"showEditButton\":true,\"showAddButton\":true}",
      "fields": [],
      "subSections": [
        {
          "sectionGuid": "guid-2-sub",
          "sectionName": "District Template",
          "parentSectionId": "11",
          "fields": [
            {
              "fieldGuid": "field-guid-3",
              "label": "District Name",
              "fieldName": "name"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 14. HERGEBRUIK VAN BESTAANDE CODE

### 14.1 Reuse from FormWizard
- ✅ API client utilities
- ✅ Entity metadata service
- ✅ Type definitions (waar mogelijk)
- ✅ CSS patterns en Tailwind classes
- ✅ Error handling patterns

### 14.2 Nieuwe Code Specifiek voor Display
- Template text parsing
- Read-only field rendering
- Collection iteration (geen sub-forms)
- Section-based layout (geen wizard steps)
- Action buttons configuratie

---

## SAMENVATTING

Dit document bevat alle frontend requirements voor de DisplayConfiguration feature:

✅ **TypeScript interfaces** - Matchen backend DTOs  
✅ **API client** - Alle endpoints gedocumenteerd  
✅ **Component architectuur** - DisplayWizard + Builder  
✅ **Template text parsing** - ${...} variabele interpolatie  
✅ **Collection rendering** - Subsection templates  
✅ **Action buttons** - Dynamic configuratie  
✅ **Styling guide** - Tailwind CSS patterns  
✅ **Testing checklist** - Unit, Integration, E2E  
✅ **Implementation volgorde** - 4-week plan  
✅ **Code voorbeelden** - Complete componenten  

**Ready voor Copilot!** Je kunt dit document gebruiken om stap-voor-stap de frontend feature te implementeren. 🚀
