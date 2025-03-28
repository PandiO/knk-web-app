// Common interfaces for all data types
export interface BaseEntity {
  Id: string | number;
  Name: string;
  Created?: Date;
}

export interface Dependency {
  object: string;
  fieldName: string;
}

export interface FormField<T = any> {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'object' | 'array' | 'bool';
  required?: boolean;
  defaultValue?: T;
  options?: { label: string; value: any }[];
  validation?: (value: T) => string | undefined;
  objectConfig?: ObjectConfig;
  formatValue?: (value: T) => React.ReactNode;
  dependsOn?: Dependency[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;   
  hidden?: boolean;
  fieldDisplayMode?: 'all' | 'idAndName' | 'nameOnly';
}

export interface ObjectConfig {
  type: string;
  label: string;
  icon: React.ReactNode;
  fields: Record<string, FormField>;
  formatters?: Record<string, (value: any) => React.ReactNode>;
  validators?: Record<string, (value: any) => string | undefined>;
  showViewButton?: boolean;
  fieldDisplayConfig?: Record<string, {
    fieldDisplayMode?: 'all' | 'idAndName' | 'nameOnly';
    fields?: Record<string, {
      fieldDisplayMode?: 'all' | 'idAndName' | 'nameOnly';
    }>;
  }>;
}

export interface NestedFormData {
  type: string;
  data: Record<string, any>;
  parent?: {
    type: string;
    id: string | number;
  };
}