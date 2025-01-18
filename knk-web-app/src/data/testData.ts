// Basic location for reuse
const createLocation = (id: number, x: number, y: number, z: number, yaw: number = 0, pitch: number = 0) => ({
  Id: id,
  x,
  y,
  z,
  yaw,
  pitch
});

// Create Streets
const mainStreet = {
  Id: 1,
  Name: "Main Street"
};

const highStreet = {
  Id: 2,
  Name: "High Street"
};

// Create Town
const town = {
  Id: 1,
  Name: "Riverside",
  Description: "A peaceful town by the river",
  Created: new Date("2024-03-15T10:00:00Z"),
  Location: createLocation(1, 100, 64, 100),
  RegionName: "Central",
  Districts: [] as any[] // Will be populated after district creation
};

// Create Districts
const northDistrict = {
  Id: 2,
  Name: "North District",
  Description: "The northern residential area",
  Created: new Date("2024-03-15T10:30:00Z"),
  Location: createLocation(2, 150, 64, 50),
  RegionName: "North",
  Town: town,
  Streets: [mainStreet]
};

const southDistrict = {
  Id: 3,
  Name: "South District",
  Description: "The southern commercial district",
  Created: new Date("2024-03-15T11:00:00Z"),
  Location: createLocation(3, 50, 64, 150),
  RegionName: "South",
  Town: town,
  Streets: [highStreet]
};

// Link districts to town
town.Districts = [northDistrict, southDistrict];

// Create Structures
const structure1 = {
  Id: 4,
  Name: "Town Hall",
  Description: "The central administrative building",
  Created: new Date("2024-03-15T12:00:00Z"),
  Location: createLocation(4, 155, 64, 55),
  RegionName: "North",
  District: northDistrict,
  Street: mainStreet,
  StreetNumber: 1,
  Storages: [] as any[] // Will be populated after storage creation
};

const structure2 = {
  Id: 5,
  Name: "Market",
  Description: "The main marketplace",
  Created: new Date("2024-03-15T12:30:00Z"),
  Location: createLocation(5, 45, 64, 145),
  RegionName: "South",
  District: southDistrict,
  Street: highStreet,
  StreetNumber: 2,
  Storages: [] as any[] // Will be populated after storage creation
};

const structure3 = {
  Id: 6,
  Name: "Library",
  Description: "Public library and archive",
  Created: new Date("2024-03-15T13:00:00Z"),
  Location: createLocation(6, 160, 64, 60),
  RegionName: "North",
  District: northDistrict,
  Street: mainStreet,
  StreetNumber: 3,
  Storages: [] as any[] // Will be populated after storage creation
};

// Create Storages
const storage1 = {
  Id: 7,
  Name: "Storage",
  Structure: structure1,
  ItemAmountMax: 999,
  CapacityMax: 999999,
  ItemAmount: 0,
  Capacity: 0,
  StorageItems: new Map()
};

const storage2 = {
  Id: 8,
  Name: "Storage",
  Structure: structure2,
  ItemAmountMax: 999,
  CapacityMax: 999999,
  ItemAmount: 0,
  Capacity: 0,
  StorageItems: new Map()
};

const storage3 = {
  Id: 9,
  Name: "Storage",
  Structure: structure3,
  ItemAmountMax: 999,
  CapacityMax: 999999,
  ItemAmount: 0,
  Capacity: 0,
  StorageItems: new Map()
};

// Link storages to structures
structure1.Storages = [storage1];
structure2.Storages = [storage2];
structure3.Storages = [storage3];

// Export all created objects
export const testData = {
  town,
  districts: {
    northDistrict,
    southDistrict
  },
  streets: {
    mainStreet,
    highStreet
  },
  structures: {
    structure1,
    structure2,
    structure3
  },
  storages: {
    storage1,
    storage2,
    storage3
  }
};

// Type definitions
export interface Location {
  Id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface Dominion {
  Id: number;
  Name: string;
  Description?: string;
  Created: Date;
  Location: Location;
  RegionName?: string;
}

export interface Street {
  Id: number;
  Name: string;
}

export interface District extends Dominion {
  Town?: Town;
  Streets: Street[];
}

export interface Town extends Dominion {
  Districts?: District[];
}

export interface Structure extends Dominion {
  District?: District;
  Street: Street;
  StreetNumber: number;
  Storages?: Storage[];
}

export interface Storage {
  Id: number;
  Name: string;
  Structure?: Structure;
  ItemAmountMax: number;
  CapacityMax: number;
  ItemAmount: number;
  Capacity: number;
  StorageItems: Map<any, number>; // Using 'any' for Item type as it's not defined
}