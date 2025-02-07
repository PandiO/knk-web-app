import { LocationViewDTO } from '../utils/domain/dto/LocationViewDTO';
import { StreetViewDTO } from '../utils/domain/dto/StreetViewDTO';
import { DistrictViewDTO } from '../utils/domain/dto/DistrictViewDTO';
import { TownViewDTO } from '../utils/domain/dto/TownViewDTO';
import { StructureViewDTO, StructureStreetViewDTO } from '../utils/domain/dto/StructureViewDTO';

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

// Create StructureStreetViewDTO instances
const structureStreets: StructureStreetViewDTO[] = [
  {
    Id: 1,
    Name: "Market Street",
    Districts: new Map([[1, "Merchant Quarter"]])
  },
  {
    Id: 3,
    Name: "High Street",
    Districts: new Map([[2, "Noble District"]])
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
    District: districts[0]
  }
];

// Export all created objects
export const testData = {
  locations,
  town,
  districts,
  streets,
  structures
};