import { LocationViewDTO } from '../utils/domain/dto/location/LocationViewDTO';
import { StreetViewDTO } from '../utils/domain/dto/street/StreetViewDTO';
import { DistrictViewDTO } from '../utils/domain/dto/district/DistrictViewDTO';
import { TownViewDTO } from '../utils/domain/dto/town/TownViewDTO';
import { StructureViewDTO, StructureStreetViewDTO } from '../utils/domain/dto/structure/StructureViewDTO';
import { StorageViewConciseDTO } from '../utils/domain/dto/item/StorageViewConciseDTO';
import { ItemDTO } from '../utils/domain/dto/item/ItemDTO';
import { StorageItemDTO } from '../utils/domain/dto/item/StorageItemDTO';
import { UIObjectConfigDto, UIFieldType, ValidationType } from '../utils/domain/dto/UIFieldConfigurations';

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
    WgRegionId: 3001,
    Location: locations[1],
    Street: structureStreets[0],
    StreetNumber: 1,
    District: districts[0]
  },
  {
    Id: 2,
    Name: "Noble Manor",
    Description: "An impressive mansion with ornate architecture",
    AllowEntry: false,
    Created: new Date("2024-01-16T11:00:00Z"),
    WgRegionId: 3002,
    Location: locations[2],
    Street: structureStreets[1],
    StreetNumber: 15,
    District: districts[1]
  },
  {
    Id: 3,
    Name: "Craftsmen's Guild Hall",
    Description: "Headquarters of the town's artisan guilds",
    AllowEntry: true,
    Created: new Date("2024-01-16T12:00:00Z"),
    WgRegionId: 3003,
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
    Street: null,
    StreetNumber: null,
    District: null,
    storages: [storages[1]]
  },
  {
    Id: 68,
    Name: "Stone Quarry",
    Description: "This Stone Quarry generates stone, and some iron ore as byproduct.",
    AllowEntry: true,
    Created: new Date("2023-02-09T16:10:34"),
    WgRegionId: "productionstructure_1000012",
    Location: {
      Id: 10,
      X: 1507.5899658203125,
      Y: 53,
      Z: -401.760498046875,
      Yaw: 317.573,
      Pitch: 2.40026,
      WorldName: "world"
    },
    Street: null,
    StreetNumber: null,
    District: null,
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
    objectType: 'structure',
    title: 'Structure Configuration',
    layoutStyle: 'standard',
    fieldGroups: [
      {
        name: 'basicInfo',
        label: 'Basic Information',
        order: 1,
        fields: [
          {
            name: 'name',
            label: 'Structure Name',
            type: UIFieldType.Text,
            required: true,
            placeholder: 'Enter structure name',
            validations: [
              { type: ValidationType.Required },
              { type: ValidationType.MinLength, value: 3 }
            ]
          },
          {
            name: 'description',
            label: 'Description',
            type: UIFieldType.Text,
            required: false,
            placeholder: 'Enter structure description'
          }
        ]
      },
      {
        name: 'location',
        label: 'Location Details',
        order: 2,
        fields: [
          {
            name: 'coordinates',
            label: 'Coordinates',
            type: UIFieldType.Text,
            required: true,
            componentType: 'coordinates-input'
          },
          {
            name: 'district',
            label: 'District',
            type: UIFieldType.Dropdown,
            required: true,
            referenceObjectType: 'district'
          }
        ]
      }
    ]
  },
  {
    objectType: 'district',
    title: 'District Configuration',
    layoutStyle: 'compact',
    fields: [
      {
        name: 'name',
        label: 'District Name',
        type: UIFieldType.Text,
        required: true,
        placeholder: 'Enter district name',
        validations: [
          { type: ValidationType.Required },
          { type: ValidationType.MinLength, value: 2 }
        ]
      },
      {
        name: 'allowEntry',
        label: 'Allow Entry',
        type: UIFieldType.Checkbox,
        required: true,
        defaultValue: true
      }
    ]
  },
  {
    objectType: 'storage',
    title: 'Storage Configuration',
    layoutStyle: 'detailed',
    fieldGroups: [
      {
        name: 'capacity',
        label: 'Capacity Settings',
        order: 1,
        fields: [
          {
            name: 'maxCapacity',
            label: 'Maximum Capacity',
            type: UIFieldType.Number,
            required: true,
            validations: [
              { type: ValidationType.Required }
            ]
          },
          {
            name: 'itemLimit',
            label: 'Item Limit',
            type: UIFieldType.Number,
            required: true,
            defaultValue: 64
          }
        ]
      }
    ]
  }
];