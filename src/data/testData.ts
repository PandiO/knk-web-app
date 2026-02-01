import { LocationViewDTO } from '../types/dtos/location/LocationViewDTO';
import { StreetViewDTO } from '../types/dtos/street/StreetViewDTO';
import { DistrictViewDTO } from '../types/dtos/district/DistrictViewDTO';
import { TownViewDTO } from '../types/dtos/town/TownViewDTO';
import { StructureViewDTO, StructureStreetViewDTO } from '../types/dtos/structure/StructureViewDTO';
import { StorageViewConciseDTO } from '../types/dtos/item/StorageViewConciseDTO';
import { ItemDTO } from '../types/dtos/item/ItemDTO';
import { StorageItemDTO } from '../types/dtos/item/StorageItemDTO';
import { UIObjectConfigDto, UIFieldGroupDto, UIFieldDto, UIFieldValidationDto, ValidationType, UIFieldType } from "../types/uiObjectConfig/UIFieldConfigurations";

// Create LocationViewDTO instances
const locations: LocationViewDTO[] = [
  {
    Id: 1,
    X: 245,
    Y: 64,
    Z: -128,
    Pitch: 0,
    Yaw: 180,
    WorldName: 'world'
  },
  {
    Id: 2,
    X: 312,
    Y: 67,
    Z: -156,
    Pitch: 15,
    Yaw: 90,
    WorldName: 'world'
  },
  {
    Id: 3,
    X: 198,
    Y: 65,
    Z: -142,
    Pitch: 0,
    Yaw: 270,
    WorldName: 'world'
  },
  {
    Id: 4,
    X: 275,
    Y: 68,
    Z: -134,
    Pitch: 30,
    Yaw: 45,
    WorldName: 'world'
  }
];

// Create TownViewDTO instance
const town: TownViewDTO = {
  Id: 1,
  Name: "Silverbrook",
  Description: "A prosperous medieval town nestled in a scenic valley",
  AllowEntry: true,
  Created: new Date("2024-01-15T08:00:00Z"),
  WgRegionId: 1001,
  Location: locations[0],
  RequiredTitle: 2
};

// Create DistrictViewDTO instances
const districts: DistrictViewDTO[] = [
  {
    Id: 1,
    Name: "Merchant Quarter",
    Description: "The bustling commercial heart of Silverbrook",
    AllowEntry: true,
    Created: new Date("2024-01-15T09:00:00Z"),
    WgRegionId: 2001,
    Location: locations[1],
    Town: town,
    Streets: [], // Will be populated after street creation
    StreetNames: new Map([
      [1, "Market Street"],
      [2, "Guild Row"]
    ])
  },
  {
    Id: 2,
    Name: "Noble District",
    Description: "An elegant residential area for the town's elite",
    AllowEntry: false,
    Created: new Date("2024-01-15T09:30:00Z"),
    WgRegionId: 2002,
    Location: locations[2],
    Town: town,
    Streets: [], // Will be populated after street creation
    StreetNames: new Map([
      [3, "High Street"],
      [4, "Royal Avenue"]
    ])
  }
];

// Create StreetViewDTO instances
const streets: StreetViewDTO[] = [
  {
    Id: 1,
    Name: "Market Street"
  },
  {
    Id: 2,
    Name: "Guild Row"
  },
  {
    Id: 3,
    Name: "High Street"
  },
  {
    Id: 4,
    Name: "Royal Avenue"
  }
];

// Update districts with their streets
districts[0].Streets = [streets[0], streets[1]];
districts[1].Streets = [streets[2], streets[3]];

// Create ItemDTO instances
const items: ItemDTO[] = [
  {
    id: 57,
    name: "Coal",
    displayName: "§7Coal",
    basePrice: 1,
    categoryId: 42,
    gradeId: 6,
    itemtypeId: 36,
    itemtypeName: "COAL"
  },
  {
    id: 60,
    name: "Iron Ingot",
    displayName: "§7Iron Ingot",
    basePrice: 1,
    categoryId: 42,
    gradeId: 6,
    itemtypeId: 38,
    itemtypeName: "IRON_INGOT"
  },
  {
    id: 65,
    name: "Cobblestone",
    displayName: "§7Cobblestone",
    basePrice: 1,
    categoryId: 42,
    gradeId: 6,
    itemtypeId: 8,
    itemtypeName: "COBBLESTONE",
    blockData: "minecraft:cobblestone",
    data: 0
  }
];

// Create StorageItemDTO instances
const storageItems: StorageItemDTO[] = [
  {
    storageId: 50,
    itemId: 57,
    amount: 208,
    item: items[0]
  },
  {
    storageId: 50,
    itemId: 65,
    amount: 128,
    item: items[2]
  },
  {
    storageId: 67,
    itemId: 57,
    amount: 104,
    item: items[0]
  },
  {
    storageId: 69,
    itemId: 60,
    amount: 80,
    item: items[1]
  },
  {
    storageId: 69,
    itemId: 65,
    amount: 48,
    item: items[2]
  }
];

// Create StorageViewConciseDTO instances
const storages: StorageViewConciseDTO[] = [
  {
    id: 50,
    name: "Storage",
    capacityMax: 2600,
    capacity: 336,
    itemAmountMax: 12,
    itemAmount: 2,
    structureId: 49,
    structureName: "Docks Warehouse",
    contents: storageItems.filter(si => si.storageId === 50)
  },
  {
    id: 67,
    name: "Storage",
    capacityMax: 240,
    capacity: 104,
    itemAmountMax: 1,
    itemAmount: 1,
    structureId: 66,
    structureName: "Coal Mine",
    contents: storageItems.filter(si => si.storageId === 67)
  },
  {
    id: 69,
    name: "Storage",
    capacityMax: 680,
    capacity: 128,
    itemAmountMax: 4,
    itemAmount: 2,
    structureId: 68,
    structureName: "Stone Quarry",
    contents: storageItems.filter(si => si.storageId === 69)
  }
];

// Create StructureStreetViewDTO instances
const structureStreets: StructureStreetViewDTO[] = [
  {
    Id: 1,
    Name: "Market Street",
    Districts: new Map([[1, "Merchant Quarter"]])
  },
  {
    Id: 48,
    Name: "Merchantstreet",
    Districts: new Map([
      [44, "Merchant's District"],
      [45, "Residential District"]
    ])
  },
  {
    Id: 47,
    Name: "Keepstreet",
    Districts: new Map([
      [45, "Residential District"],
      [46, "The Keep"]
    ])
  }
];

// Create StructureViewDTO instances
const structures: StructureViewDTO[] = [
  {
    Id: 1,
    Name: "Grand Marketplace",
    Description: "The central trading hub of Silverbrook",
    AllowEntry: true,
    Created: new Date("2024-01-16T10:00:00Z"),
    WgRegionId: "3001",
    Location: locations[1],
    Street: structureStreets[0],
    StreetNumber: 1,
    District: districts[0],
    storages: []
  },
  {
    Id: 2,
    Name: "Noble Manor",
    Description: "An impressive mansion with ornate architecture",
    AllowEntry: false,
    Created: new Date("2024-01-16T11:00:00Z"),
    WgRegionId: "3002",
    Location: locations[2],
    Street: structureStreets[1],
    StreetNumber: 15,
    District: districts[1],
    storages: []
  },
  {
    Id: 3,
    Name: "Craftsmen's Guild Hall",
    Description: "Headquarters of the town's artisan guilds",
    AllowEntry: true,
    Created: new Date("2024-01-16T12:00:00Z"),
    WgRegionId: "3003",
    Location: locations[3],
    Street: structureStreets[0],
    StreetNumber: 8,
    District: districts[0],
    storages: []
  },
  {
    Id: 49,
    Name: "Docks Warehouse",
    Description: "The main warehouse of Cinix, located at the docks.",
    AllowEntry: true,
    Created: new Date("2021-04-26T10:17:13"),
    WgRegionId: "warehouse_622000009",
    Location: {
      Id: 5,
      X: 1426,
      Y: 44,
      Z: -554,
      Yaw: -11,
      Pitch: 134.1,
      WorldName: "world"
    },
    Street: structureStreets[1],
    StreetNumber: 1,
    District: districts[0],
    storages: [storages[0]]
  },
  {
    Id: 66,
    Name: "Coal Mine",
    Description: "This is a Cinixian coal mine located at the roots of the mountain.",
    AllowEntry: true,
    Created: new Date("2023-02-08T15:28:31"),
    WgRegionId: "productionstructure_1000006",
    Location: {
      Id: 8,
      X: 961.2449951171875,
      Y: 79,
      Z: -578.405029296875,
      Yaw: 317.573,
      Pitch: 2.40026,
      WorldName: "world"
    },
    Street: structureStreets[2],
    streetNumber: null,
    district: null,
    storages: [storages[1]]
  },
  {
    Id: 68,
    Name: "Stone Quarry",
    Description: "This Stone Quarry generates stone, and some iron ore as byproduct.",
    AllowEntry: true,
    Created: new Date("2023-02-09T16:10:34"),
    wgRegionId: "productionstructure_1000012",
    Location: {
      Id: 10,
      X: 1507.5899658203125,
      Y: 53,
      Z: -401.760498046875,
      Yaw: 317.573,
      Pitch: 2.40026,
      WorldName: "world"
    },
    street: null,
    streetNumber: null,
    district: null,
    storages: [storages[2]]
  }
];

// Export all created objects
export const testData = {
  locations,
  town,
  districts,
  streets,
  structures,
  items,
  storages,
  storageItems
};

// UI Field Configurations Test Data
export const uiConfigTestData: UIObjectConfigDto[] = [
  {
    id: 1,
    objectType: "type1",
    title: "Test Object Config 1",
    layoutStyle: "grid",
    fieldGroups: [
      {
        id: 101,
        uiObjectConfigId: 1,
        name: "Group 1",
        label: "Test Group 1",
        order: 1,
        fields: [
          {
            id: 1001,
            name: "Field 1",
            label: "Test Field 1",
            type: UIFieldType.Text,
            required: true,
            defaultValue: "Default Value 1",
            placeholder: "Enter value 1",
            referenceObjectType: "ReferenceType1",
            order: 1,
            componentType: "input",
            validations: [
              {
                type: ValidationType.MaxLength,
                value: 50,
                message: "Maximum length is 50 characters",
              },
            ],
          },
        ],
      }
    ],
    fields: [
      {
        id: 1002,
        name: "Field 2",
        label: "Test Field 2",
        type: UIFieldType.Number,
        required: false,
        defaultValue: 10,
        placeholder: "Enter value 2",
        referenceObjectType: "ReferenceType2",
        order: 2,
        componentType: "number",
        validations: [
          {
            id: 202,
            type: ValidationType.Pattern,
            value: "^[0-9]+$",
            message: "Only numeric values are allowed",
          },
        ],
      },
    ],
  },
  {
    id: 2,
    objectType: "type2",
    title: "Test Object Config 2",
    layoutStyle: "list",
    fieldGroups: [],
    fields: [],
  }
];

// Mockup API DTO objects
export const uiConfigApiTestData = [
  {
    Id: 1,
    ObjectType: "type1",
    Title: "Test Object Config 1",
    LayoutStyle: "grid",
    FieldGroups: [
      {
        Id: 101,
        UIObjectConfigId: 1,
        Name: "Group 1",
        Label: "Test Group 1",
        Order: 1,
        Fields: [
          {
            Id: 1001,
            Name: "Field 1",
            Label: "Test Field 1",
            Type: "Text",
            Required: true,
            DefaultValue: "Default Value 1",
            Placeholder: "Enter value 1",
            ReferenceObjectType: "ReferenceType1",
            Order: 1,
            ComponentType: "input",
            Validations: [
              {
                Type: "MaxLength",
                Value: 50,
                Message: "Maximum length is 50 characters",
              },
            ],
          },
        ],
      },
    ],
    Fields: [
      {
        Id: 1002,
        Name: "Field 2",
        Label: "Test Field 2",
        Type: "Number",
        Required: false,
        DefaultValue: 10,
        Placeholder: "Enter value 2",
        ReferenceObjectType: "ReferenceType2",
        Order: 2,
        ComponentType: "number",
        Validations: [
          {
            Id: 202,
            Type: "Pattern",
            Value: "^[0-9]+$",
            Message: "Only numeric values are allowed",
          },
        ],
      },
    ],
  },
  {
    Id: 2,
    ObjectType: "type2",
    Title: "Test Object Config 2",
    LayoutStyle: "list",
    FieldGroups: [],
    Fields: [],
  },
];


