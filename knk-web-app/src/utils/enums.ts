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

export enum UIFieldConfigurationsOperation {
    GetAll = '',
    Create = '',
    Update = '',
    Delete = ''
}

export enum Controllers {
    Items = 'Items',
    Structures = 'Structures',
    Districts = 'Districts',
    Locations = 'Locations',
    Streets = 'Streets',
    Dominions = 'Dominions',
    Towns = 'Towns',
    UIFieldConfigurations = 'UIFieldConfigurations'
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