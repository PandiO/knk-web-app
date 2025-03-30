import {
  UIObjectConfigDto,
  UIFieldGroupDto,
  UIFieldDto,
  UIFieldValidationDto,
} from "./domain/dto/UIFieldConfigurations";

export function mapApiToUIObjectConfigDto(apiData: any): UIObjectConfigDto {
  return {
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

export function mapToFrontendModel(dto: UIObjectConfigDto): any {
  return {
    objectType: dto.ObjectType,
    title: dto.Title,
    layoutStyle: dto.LayoutStyle,
    fieldGroups: dto.FieldGroups?.map(mapFieldGroupToFrontendModel),
    fields: dto.Fields?.map(mapFieldToFrontendModel),
  };
}

export function mapToDto(frontendModel: any): UIObjectConfigDto {
  return {
    ObjectType: frontendModel.objectType,
    Title: frontendModel.title,
    LayoutStyle: frontendModel.layoutStyle,
    FieldGroups: frontendModel.fieldGroups?.map(mapFieldGroupToDto),
    Fields: frontendModel.fields?.map(mapFieldToDto),
  };
}

function mapFieldGroupToFrontendModel(dto: UIFieldGroupDto): any {
  return {
    name: dto.Name,
    label: dto.Label,
    order: dto.Order,
    fields: dto.Fields?.map(mapFieldToFrontendModel),
  };
}

function mapFieldGroupToDto(frontendModel: any): UIFieldGroupDto {
  return {
    Name: frontendModel.name,
    Label: frontendModel.label,
    Order: frontendModel.order,
    Fields: frontendModel.fields?.map(mapFieldToDto),
  };
}

function mapFieldToFrontendModel(dto: UIFieldDto): any {
  return {
    name: dto.Name,
    label: dto.Label,
    type: dto.Type,
    required: dto.Required,
    defaultValue: dto.DefaultValue,
    placeholder: dto.Placeholder,
    referenceObjectType: dto.ReferenceObjectType,
    order: dto.Order,
    componentType: dto.ComponentType,
    validations: dto.Validations?.map(mapValidationToFrontendModel),
  };
}

function mapFieldToDto(frontendModel: any): UIFieldDto {
  return {
    Name: frontendModel.name,
    Label: frontendModel.label,
    Type: frontendModel.type,
    Required: frontendModel.required,
    DefaultValue: frontendModel.defaultValue,
    Placeholder: frontendModel.placeholder,
    ReferenceObjectType: frontendModel.referenceObjectType,
    Order: frontendModel.order,
    ComponentType: frontendModel.componentType,
    Validations: frontendModel.validations?.map(mapValidationToDto),
  };
}

function mapValidationToFrontendModel(dto: UIFieldValidationDto): any {
  return {
    type: dto.Type,
    value: dto.Value,
  };
}

function mapValidationToDto(frontendModel: any): UIFieldValidationDto {
  return {
    Type: frontendModel.type,
    Value: frontendModel.value,
  };
}
