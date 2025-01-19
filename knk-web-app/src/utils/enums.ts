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
    GetByName = 'GetStructureyName',
    Create = ''
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

export enum Controllers {
    Items = 'Items',
    Structures = 'Structures',
    Districts = 'Districts',
    Locations = 'Locations'
}

export enum FormPlaceHolder {
    Name = 'TestName',
    Mail = 'JohnDoe@gmail.com',
    Number = 128
}