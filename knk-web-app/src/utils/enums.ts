export enum HttpMethod {
    Get = "get",
    Post = "post",
    Delete = "delete",
    Put = "put"
}

export enum ItemOperation {
    GetAll = '',
    GetItemById = 'GetItem',
    GetItemByName = 'GetItemByName'
}

export enum StructuresOperation {
    GetAll = '',
    GetById = 'GetStructure',
    GetViewById = 'GetStructureView',
    GetByName = 'GetStructureyName',
    Create = '',
    GetOverview = 'GetStructuresOverview'
}

export enum DistrictsOperation {
    GetAll = '',
    GetById = 'GetDistrict',
    GetByName = 'GetDistrictByName'
}

export enum LocationsOperation {
    GetAll = '',
    GetById = 'GetLocation',
    GetByName = 'GetLocationByName'
}    

export enum StreetsOperation {
    GetAll = '',
    GetById = 'GetStreet',
    GetByName = 'GetStreetByName'
}

export enum DominionOperation {
    GetAll = '',
    GetById = 'GetDominion',
    GetByName = 'GetDominionByName'
}

export enum UIObjectConfigurationOperation {
    GetAll = 'GetAll',
    GetByType = 'GetByType',
    Create = 'Create',
    Update = 'Update',
    Delete = 'Delete',
}

export enum Controllers {
    Items = 'Items',
    Structures = 'Structures',
    Districts = 'Districts',
    Locations = 'Locations',
    Streets = 'Streets',
    Dominions = 'Dominions',
    Towns = 'Towns',
    UIObjectConfigurations = 'UIObjectConfig',
    FormConfigurations = 'FormConfigurations',
    FormSteps = 'FormSteps',
    FormFields = 'FormFields',
    FormSubmissionProgress = 'FormSubmissionProgress',
    Metadata = 'Metadata', // added
    Categories = 'Categories'
}

export enum FormPlaceHolder {
    Name = 'TestName',
    Mail = 'JohnDoe@gmail.com',
    Number = 128
}

export enum StructureOverviewFilter {
    District = 0,
    Town = 1,
    Street = 2,
    Entry = 3,
}

export enum FilterType {
    Include = 0,
    Exclude = 1
}

export enum ErrorColor {
    Red = 'Red',
    Yellow = 'Yellow',
    Blue = 'Blue',
    Grey = 'Grey'
}

export enum FieldType {
    String = 'String',
    Integer = 'Integer',
    Boolean = 'Boolean',
    DateTime = 'DateTime',
    Decimal = 'Decimal',
    Enum = 'Enum',
    Object = 'Object',
    List = 'List'
}

export enum ValidationType {
    Required = 'Required',
    MinLength = 'MinLength',
    MaxLength = 'MaxLength',
    Range = 'Range',
    Regex = 'Regex',
    Email = 'Email',
    Custom = 'Custom'
}

export enum FormSubmissionStatus {
    // Draft = 'Draft',
    InProgress = 'InProgress',
    Paused = 'Paused',
    Completed = 'Completed',
    Abandoned = 'Abandoned'
}

export enum ConditionOperator {
    Equals = 'Equals',
    NotEquals = 'NotEquals',
    GreaterThan = 'GreaterThan',
    LessThan = 'LessThan',
    Contains = 'Contains',
    IsEmpty = 'IsEmpty',
    IsNotEmpty = 'IsNotEmpty'
}

export enum FormConfigurationOperation {
    GetAll = '',
    GetById = '',
    GetByEntity = '',
    GetByEntityAll = '',
    GetEntityNames = 'entity-names',
    Create = '',
    Update = '',
    Delete = ''
}

export enum FormStepOperation {
    GetAll = '',
    GetById = '',
    Create = '',
    Update = '',
    Delete = ''
}

export enum FormFieldOperation {
    GetAll = '',
    GetById = 'GetFormField',
    Create = '',
    Update = '',
    Delete = ''
}

export enum FormSubmissionProgressOperation {
    GetByEntityTypeName = 'entity',
    GetByUser = 'user',
    GetById = '',
    Create = '',
    Update = '',
    Delete = ''
}

export enum MetadataOperation {
    Entities = 'entities',
    EntityNames = 'entity-names',
}

export enum CategoryOperation {
    GetAll = '',
    GetById = 'GetCategory',
    Create = '',
    Update = '',
    Delete = ''
}

