import {
  UIObjectConfigDto,
  UIFieldGroupDto,
  UIFieldDto,
  UIFieldValidationDto,
} from "./UIFieldConfigurations";


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
    id: apiData.Id,
    uiObjectConfigId: apiData.UIObjectConfigId,
    name: apiData.Name,
    label: apiData.Label,
    order: apiData.Order,
    fields: apiData.Fields?.map(mapApiToUIFieldDto),
  };
}

export function mapApiToUIFieldDto(apiData: any): UIFieldDto {
  return {
    id: apiData.Id,
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
