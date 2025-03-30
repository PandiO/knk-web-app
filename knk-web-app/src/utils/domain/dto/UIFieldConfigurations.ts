export interface UIObjectConfigDto {
  id: number;
  objectType: string;
  title: string;
  layoutStyle: string;
  fieldGroups?: UIFieldGroupDto[];
  fields?: UIFieldDto[];
}

export interface UIFieldGroupDto {
  name: string;
  label: string;
  order?: number;
  fields: UIFieldDto[];
}

export interface UIFieldDto {
  name: string;
  label: string;
  type: UIFieldType;
  required: boolean;
  defaultValue?: any;
  placeholder?: string;
  referenceObjectType?: string;
  order?: number;
  componentType?: string;
  validations?: UIFieldValidationDto[];
}

export interface UIFieldValidationDto {
  type: ValidationType;
  value?: string | number;
}

export enum UIFieldType {
  Text = "Text",
  Number = "Number",
  Date = "Date",
  Checkbox = "Checkbox",
  Dropdown = "Dropdown",
}

export enum ValidationType {
  Required = "Required",
  MinLength = "MinLength",
  MaxLength = "MaxLength",
  Pattern = "Pattern",
}

export function mapApiToUIObjectConfigDto(apiData: any): UIObjectConfigDto {
  return {
    id: apiData.Id,
    objectType: apiData.ObjectType,
    title: apiData.Title,
    layoutStyle: apiData.LayoutStyle,
    fieldGroups: apiData.FieldGroups?.map(mapApiToUIFieldGroupDto),
    fields: apiData.Fields?.map(mapApiToUIFieldDto),
  };
}

export function mapApiToUIFieldGroupDto(apiData: any): UIFieldGroupDto {
  return {
    name: apiData.Name,
    label: apiData.Label,
    order: apiData.Order,
    fields: apiData.Fields?.map(mapApiToUIFieldDto),
  };
}

export function mapApiToUIFieldDto(apiData: any): UIFieldDto {
  return {
    name: apiData.Name,
    label: apiData.Label,
    type: apiData.Type,
    required: apiData.Required,
    defaultValue: apiData.DefaultValue,
    placeholder: apiData.Placeholder,
    referenceObjectType: apiData.ReferenceObjectType,
    order: apiData.Order,
    componentType: apiData.ComponentType,
    validations: apiData.Validations?.map(mapApiToUIFieldValidationDto),
  };
}

export function mapApiToUIFieldValidationDto(apiData: any): UIFieldValidationDto {
  return {
    type: apiData.Type,
    value: apiData.Value,
  };
}
