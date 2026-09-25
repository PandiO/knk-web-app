import { Building2, MapPin, Home, TagIcon, BrickWallIcon, Shield, Lock, Flag, Users, Swords, Castle } from 'lucide-react';
import type { ColumnDefinition, FormField, ObjectConfig } from '../types/common';

export const defaultColumnDefinitions: Record<string, ColumnDefinition<any>[]> = {
  default: [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
  ]
};

export const columnDefinitionsRegistry: Record<string, Record<string, ColumnDefinition<any>[]>> = {
  category: {
    //Used for category listing in ObjectDashboard. Currently also used for FormWizard PagedEntityTable
    "default": [
      ...defaultColumnDefinitions.default,
      { key: 'itemType', label: 'Item Type', sortable: false, render: (row: any) => row.itemType?.name || '-' },
      { key: 'parentCategory', label: 'Parent Category', sortable: false, render: (row: any) => row.parentCategoryName ? `${row.parentCategoryName}(${row.parentCategoryId})` : '-' },
    ]
  },
  minecraftblockref: {
    default: [
      ...defaultColumnDefinitions.default,
      { 
        key: 'iconUrl', 
        label: 'Icon', 
        sortable: false,
        render: (row: any) => row.iconUrl ? (
          <img src={row.iconUrl} alt={row.namespaceKey} className="h-8 w-8 object-contain" />
        ) : (
          <span className="text-gray-400 text-xs">No icon</span>
        )
      },
      { key: 'namespaceKey', label: 'Namespace Key', sortable: true },
      { key: 'logicalType', label: 'Logical Type', sortable: false },
      { key: 'blockStateString', label: 'Block State', sortable: false }
    ]
  },
  minecraftmaterialref: {
    default: [
      ...defaultColumnDefinitions.default,
      { 
        key: 'iconUrl', 
        label: 'Icon', 
        sortable: false,
        render: (row: any) => row.iconUrl ? (
          <img src={row.iconUrl} alt={row.namespaceKey} className="h-8 w-8 object-contain" />
        ) : (
          <span className="text-gray-400 text-xs">No icon</span>
        )
      },
      { key: 'namespaceKey', label: 'Namespace Key', sortable: true },
      { key: 'category', label: 'Category', sortable: true },
      { key: 'legacyName', label: 'Legacy Name', sortable: false }
    ]
  },
  minecraftenchantmentref: {
    default: [
      ...defaultColumnDefinitions.default,
      { 
        key: 'iconUrl', 
        label: 'Icon', 
        sortable: false,
        render: (row: any) => row.iconUrl ? (
          <img src={row.iconUrl} alt={row.namespaceKey} className="h-8 w-8 object-contain" />
        ) : (
          <span className="text-gray-400 text-xs">No icon</span>
        )
      },
      { key: 'displayName', label: 'Display Name', sortable: true },
      { key: 'namespaceKey', label: 'Namespace Key', sortable: true },
      { key: 'category', label: 'Category', sortable: true },
      { key: 'maxLevel', label: 'Max Level', sortable: false },
      { key: 'legacyName', label: 'Legacy Name', sortable: false }
    ]
  },
  structure: {
    //Used for structure listing in ObjectDashboard. Currently also used for FormWizard PagedEntityTable
    "default": [
      ...defaultColumnDefinitions.default,
      { key: 'Description', label: 'Description', sortable: false },
      { 
          key: 'Location', 
          label: 'Location', 
          sortable: false,
          render: (row: any) => row.Location ? `(${row.Location.x}, ${row.Location.y}, ${row.Location.z})` : '-'
      },
      { 
          key: 'Created', 
          label: 'Created', 
          sortable: true,
          render: (row: any) => row.Created ? new Date(row.Created).toLocaleDateString() : '-'
      },
      {
          key: 'RegionName',
          label: 'Region',
          sortable: false,
          render: (value: any) => (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {value}
              </span>
          )
      }
    ]
  },
  gatestructure: {
    default: [
      ...defaultColumnDefinitions.default,
      // Item 5 (docs/features/gate-structure-animation/GATESTRUCTURE_QOL_IMPLEMENTATION_PLAN.md)
      // moved gateType/isOpened/healthCurrent off GateStructure onto GateDoor - a structure can
      // now have several doors, each with its own value for these, so the list view shows how
      // many doors it has instead; per-door detail is available on the structure's display page.
      { key: 'doorCount', label: 'Doors', sortable: false },
      { key: 'districtName', label: 'District', sortable: false },
      { key: 'streetName', label: 'Street', sortable: false }
    ]
  },
  gatedoor: {
    default: [
      ...defaultColumnDefinitions.default,
      { key: 'gateStructureId', label: 'Gate Structure ID', sortable: true },
      { key: 'gateType', label: 'Gate Type', sortable: true },
      {
        key: 'openedState',
        label: 'Status',
        sortable: true,
        render: (row: any) => (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.openedState === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'
          }`}>
            {row.openedState ?? 'CLOSED'}
          </span>
        )
      },
      {
        key: 'healthCurrent',
        label: 'Health',
        sortable: true,
        render: (row: any) => `${row.healthCurrent ?? 0}/${row.healthMax ?? '-'}`
      }
    ]
  },
  permissiongroup: {
    default: [
      ...defaultColumnDefinitions.default,
      { key: 'weight', label: 'Weight', sortable: true },
      {
        key: 'isPremiumTier',
        label: 'Premium',
        sortable: true,
        render: (row: any) => row.isPremiumTier ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Premium</span>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )
      },
      { key: 'salaryMultiplier', label: 'Salary x', sortable: true },
      { key: 'parentGroupName', label: 'Parent', sortable: false, render: (row: any) => row.parentGroupName ?? '-' },
    ]
  },
  bannerdesign: {
    default: [
      ...defaultColumnDefinitions.default,
      { key: 'baseColor', label: 'Base Colour', sortable: false },
      { key: 'layerCount', label: 'Layers', sortable: false },
    ]
  },
  clan: {
    default: [
      ...defaultColumnDefinitions.default,
      { key: 'isNpc', label: 'NPC', sortable: false, render: (row: any) => row.isNpc ? 'Yes' : '-' },
      { key: 'chatColor', label: 'Chat Colour', sortable: false },
      { key: 'bannerDesignName', label: 'Banner', sortable: false, render: (row: any) => row.bannerDesignName ?? '-' },
      { key: 'defaultForTownName', label: 'Default For Town', sortable: false, render: (row: any) => row.defaultForTownName ?? '-' },
    ]
  },
  // Siege Phase 3
  siegescenario: {
    default: [
      ...defaultColumnDefinitions.default,
      { key: 'townName', label: 'Town', sortable: false, render: (row: any) => row.townName ?? '-' },
      { key: 'teamCount', label: 'Teams', sortable: false },
      { key: 'objectiveCount', label: 'Objectives', sortable: false },
      { key: 'gateCount', label: 'Gates', sortable: false },
    ]
  },
  // The picker for objective holders / gate owners (scoped to one scenario by pickerFilters).
  // A clan-sourced team has no name of its own, so show the resolved identity.
  siegeteam: {
    default: [
      { key: 'id', label: 'ID', sortable: false },
      { key: 'resolvedName', label: 'Team', sortable: false, render: (row: any) => row.resolvedName ?? row.name ?? '-' },
      { key: 'role', label: 'Role', sortable: false },
      { key: 'allianceGroup', label: 'Alliance', sortable: false },
    ]
  },
  siegelobby: {
    default: [
      ...defaultColumnDefinitions.default,
      { key: 'key', label: 'Key', sortable: false },
      { key: 'isEnabled', label: 'Enabled', sortable: false, render: (row: any) => row.isEnabled ? 'Yes' : '-' },
      { key: 'mode', label: 'Mode', sortable: false },
      { key: 'rotationCount', label: 'Scenarios', sortable: false },
    ]
  },
  titlebracket: {
    default: [
      ...defaultColumnDefinitions.default,
      { key: 'femaleName', label: 'Female Name', sortable: false },
      { key: 'minExperience', label: 'Min XP', sortable: false },
    ]
  }
};

export const commonFields: Record<string, FormField> = {
  id: { name: 'id', label: 'Id', type: 'number', required: false, hidden: true, defaultValue: -1 },
  name: {
    name: 'name',
    label: 'Name',
    type: 'text',
    required: true,
    validation: (value) => {
      if (!value || value.length < 3) return 'Name must be at least 3 characters';
    }
  },
  description: {
    name: 'description',
    label: 'Description',
    type: 'text',
    required: false
  }
};

const locationConfig: ObjectConfig = {
  type: 'location',
  label: 'Location',
  icon: <MapPin className="h-5 w-5" />,
  fields: {
    id: commonFields.id,
    name: { name: 'name', label: 'Name', type: 'text', required: false, defaultValue: 'Location', hidden: true },
    x: { name: 'x', label: 'X', type: 'number', required: true },
    y: { name: 'y', label: 'Y', type: 'number', required: true },
    z: { name: 'z', label: 'Z', type: 'number', required: true },
    yaw: { name: 'yaw', label: 'Yaw', type: 'number', required: false, defaultValue: 0 },
    pitch: { name: 'pitch', label: 'Pitch', type: 'number', required: false, defaultValue: 0 },
    worldName: { name: 'WorldName', label: 'World Name', type: 'text', required: true, defaultValue: 'world' }
  },
  showViewButton: false
};

const minecraftBlockRefConfig: ObjectConfig = {
  type: 'minecraftblockref',
  label: 'Minecraft Block Ref',
  icon: <BrickWallIcon className="h-5 w-5" />,
  fields: {
    id: commonFields.id,
    namespaceKey: {
      name: 'namespaceKey',
      label: 'Namespace Key',
      type: 'text',
      required: true
    },
    blockStateString: {
      name: 'blockStateString',
      label: 'Block State String',
      type: 'text',
      required: false
    },
    logicalType: {
      name: 'logicalType',
      label: 'Logical Type',
      type: 'text',
      required: false
    },
    iconUrl: {
      name: 'iconUrl',
      label: 'Icon URL',
      type: 'text',
      required: false
    }
  },
  showViewButton: true
};

const minecraftMaterialRefConfig: ObjectConfig = {
  type: 'minecraftmaterialref',
  label: 'Minecraft Material Ref',
  icon: <TagIcon className="h-5 w-5" />,
  fields: {
    id: commonFields.id,
    namespaceKey: {
      name: 'namespaceKey',
      label: 'Namespace Key',
      type: 'text',
      required: true
    },
    category: {
      name: 'category',
      label: 'Category',
      type: 'text',
      required: true
    },
    legacyName: {
      name: 'legacyName',
      label: 'Legacy Name',
      type: 'text',
      required: false
    },
    iconUrl: {
      name: 'iconUrl',
      label: 'Icon URL',
      type: 'text',
      required: false
    }
  },
  showViewButton: true
};

const dominionConfig: ObjectConfig = {
  type: 'dominion',
  label: 'Dominion',
  icon: <Home className="h-5 w-5" />,
  fields: {
    id: commonFields.id,
    name: commonFields.name,
    description: commonFields.description,
    allowEntry: {
      name: 'AllowEntry',
      label: 'Allow Entry',
      type: 'bool',
      required: true,
      defaultValue: true
    },
    wgRegionId: {
      name: 'RegionName',
      label: 'Region',
      type: 'text',
      required: true
    },
    created: {
      name: 'Created',
      label: 'Created',
      type: 'date',
      required: false,
      hidden: true,
      defaultValue: new Date()
    },
    location: {
      name: 'Location',
      label: 'Location',
      type: 'object',
      required: true,
      objectConfig: locationConfig
    }
  },
  formatters: {
    wgRegionId: (value) => (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
        {value}
      </span>
    ),
    created: (value: Date) => value.toLocaleDateString()
  }
};

const townConfig: ObjectConfig = {
  type: 'town',
  label: 'Town',
  icon: <Home className="h-5 w-5" />,
  fields: {
    ...dominionConfig.fields,
    requiredTitle: {
      name: 'RequiredTitle',
      label: 'Required Title',
      type: 'number',
      required: true,
      defaultValue: 1,
      validation: (value) => {
        if (value < 1) return 'Title must be larger than 0';
      }
    }
  },
  formatters: dominionConfig.formatters
};

const districtConfig: ObjectConfig = {
  type: 'district',
  label: 'District',
  icon: <MapPin className="h-5 w-5" />,
  fields: {
    ...dominionConfig.fields,
    town: {
      name: 'Town',
      label: 'Town',
      type: 'object',
      required: true,
      objectConfig: townConfig
    },
    streetNames: {
      name: 'Street Names',
      label: 'Street Names',
      type: 'array',
      required: false,
    }
  },
  formatters: dominionConfig.formatters
};

const streetConfig: ObjectConfig = {
  type: 'street',
  label: 'Street',
  icon: <MapPin className="h-5 w-5" />,
  fields: {
    id: commonFields.id,
    name: commonFields.name,
    district: {
      name: 'District',
      label: 'District',
      type: 'object',
      required: true,
      objectConfig: districtConfig
    }
  },
  formatters: dominionConfig.formatters
};

const structureConfig: ObjectConfig = {
  type: 'structure',
  label: 'Structure',
  icon: <Building2 className="h-5 w-5" />,
  fieldDisplayConfig: {
    District: {
      fieldDisplayMode: 'all',
      fields: {
        Town: {
          fieldDisplayMode: 'idAndName'
        }
      }
    },
    Street: {
      fieldDisplayMode: 'idAndName'
    },
    Location: {
      fieldDisplayMode: 'all'
    }
  },
  fields: {
    ...dominionConfig.fields,
    district: {
      name: 'District',
      label: 'District',
      type: 'object',
      required: true,
      objectConfig: districtConfig
    },
    street: {
      name: 'Street',
      label: 'Street',
      type: 'object',
      required: true,
      dependsOn: [{object: 'district', fieldName: 'streets'}],
      objectConfig: streetConfig
    },
    streetNumber: {
      name: 'StreetNumber',
      label: 'Street Number',
      type: 'number',
      required: false,
      validation: (value) => {
        if (value < 1) return 'Street number must be positive';
      }
    },
  },
  formatters: {
    ...dominionConfig.formatters,
    streetNumber: (value) => `#${value}`
  }
};

const ItemTypeConfig: ObjectConfig = {
  type: 'itemType',
  label: 'Item Type',
  icon: <BrickWallIcon className="h-5 w-5" />,
  fields: {
    id: commonFields.id,
    blockData: {name: 'blockData', label: 'Block Data', type: 'text', required: false},
    data: {name: 'data', label: 'Data', type: 'text', required: true},
    name: commonFields.name,
  }
};

const CategoryConfig: ObjectConfig = {
  type: 'category',
  label: 'Category',
  icon: <TagIcon className="h-5 w-5" />,
  fields: {
    id: commonFields.id,
    name: commonFields.name,
    itemType: {
      name: 'itemType',
      label: 'Item Type',
      type: 'object',
      objectConfig: ItemTypeConfig},
    parentCategory: {
      name: 'parentCategory',
      label: 'Parent Category',
      type: 'object',
      required: false,
      objectConfig: undefined as unknown as ObjectConfig,
    }
  }
};

// assign self-reference after creation to avoid "used before declaration" errors
(CategoryConfig.fields as any).parentCategory.objectConfig = CategoryConfig;

// Item 5 (docs/features/gate-structure-animation/GATESTRUCTURE_QOL_IMPLEMENTATION_PLAN.md) moved
// every per-door field (geometry, animation, health, display, etc. - see GateDoorConfig below)
// off this config onto the new GateDoorConfig. What's left is structure-level identity and the
// guard system; the cascading override fields (decision 5.0-B) are set via a dedicated endpoint
// (GateStructureClient.updateOverrides), not this general create/edit form.
const GateStructureConfig: ObjectConfig = {
  type: 'gatestructure',
  label: 'Gate',
  icon: <Shield className="h-5 w-5" />,
  fields: {
    id: commonFields.id,
    name: commonFields.name,
    description: {
      name: 'description',
      label: 'Description',
      type: 'text',
      required: false
    },
    districtId: {
      name: 'districtId',
      label: 'District ID',
      type: 'number',
      required: true,
      validation: (value) => {
        if (!value || value < 1) return 'District ID must be a positive number';
      }
    },
    streetId: {
      name: 'streetId',
      label: 'Street ID',
      type: 'number',
      required: false
    },
    guardSpawnLocations: {
      name: 'guardSpawnLocations',
      label: 'Guard Spawn Locations',
      type: 'array',
      required: false,
      objectConfig: locationConfig
    },
  }
};

// New (item 5, decision 5.0-D): minimal generic CRUD for a single door of a GateStructure -
// "ObjectConfig + generic framework, no custom pages", the same pattern GateStructureConfig
// itself already used (PHASE_STATUS.md Phase 5). A door is linked to its parent via the plain
// gateStructureId number field below (matching how GateStructureConfig itself links to its
// district/street), not a nested object picker.
const GateDoorConfig: ObjectConfig = {
  type: 'gatedoor',
  label: 'Gate Door',
  icon: <Shield className="h-5 w-5" />,
  fields: {
    id: commonFields.id,
    name: commonFields.name,
    gateStructureId: {
      name: 'gateStructureId',
      label: 'Gate Structure ID',
      type: 'number',
      required: true,
      validation: (value) => {
        if (!value || value < 1) return 'Gate Structure ID must be a positive number';
      }
    },
    gateType: {
      name: 'gateType',
      label: 'Gate Type',
      type: 'select',
      required: true,
      options: [
        { label: 'Sliding', value: 'SLIDING' },
        { label: 'Trap', value: 'TRAP' },
        { label: 'Drawbridge', value: 'DRAWBRIDGE' },
        { label: 'Double Doors', value: 'DOUBLE_DOORS' },
      ]
    },
    motionType: {
      name: 'motionType',
      label: 'Motion Type',
      type: 'select',
      required: true,
      options: [
        { label: 'Vertical', value: 'VERTICAL' },
        { label: 'Lateral', value: 'LATERAL' },
        { label: 'Rotation', value: 'ROTATION' },
      ]
    },
    faceDirection: {
      name: 'faceDirection',
      label: 'Face Direction',
      type: 'select',
      required: true,
      options: [
        { label: 'North', value: 'NORTH' },
        { label: 'North-East', value: 'NORTH_EAST' },
        { label: 'East', value: 'EAST' },
        { label: 'South-East', value: 'SOUTH_EAST' },
        { label: 'South', value: 'SOUTH' },
        { label: 'South-West', value: 'SOUTH_WEST' },
        { label: 'West', value: 'WEST' },
        { label: 'North-West', value: 'NORTH_WEST' },
      ]
    },
    geometryDefinitionMode: {
      name: 'geometryDefinitionMode',
      label: 'Geometry Mode',
      type: 'select',
      required: true,
      options: [
        { label: 'Plane Grid', value: 'PLANE_GRID' },
        { label: 'Flood Fill', value: 'FLOOD_FILL' },
      ]
    },
    anchorPoint: {
      name: 'anchorPoint',
      label: 'Anchor Point',
      type: 'object',
      required: false,
      objectConfig: locationConfig
    },
    referencePoint1: {
      name: 'referencePoint1',
      label: 'Reference Point 1',
      type: 'object',
      required: false,
      objectConfig: locationConfig
    },
    referencePoint2: {
      name: 'referencePoint2',
      label: 'Reference Point 2',
      type: 'object',
      required: false,
      objectConfig: locationConfig
    },
    geometryWidth: {
      name: 'geometryWidth',
      label: 'Width',
      type: 'number',
      required: false
    },
    geometryHeight: {
      name: 'geometryHeight',
      label: 'Height',
      type: 'number',
      required: false
    },
    geometryDepth: {
      name: 'geometryDepth',
      label: 'Depth',
      type: 'number',
      required: false
    },
    animationDurationTicks: {
      name: 'animationDurationTicks',
      label: 'Animation Duration (ticks)',
      type: 'number',
      required: true,
      validation: (value) => {
        if (!value || value < 1) return 'Duration must be at least 1 tick';
      }
    },
    animationTickRate: {
      name: 'animationTickRate',
      label: 'Tick Rate',
      type: 'number',
      required: true,
      validation: (value) => {
        if (!value || value < 1 || value > 5) return 'Tick rate must be between 1 and 5';
      }
    },
    tileEntityPolicy: {
      name: 'tileEntityPolicy',
      label: 'Tile Entity Policy',
      type: 'select',
      required: false,
      options: [
        { label: 'None', value: 'NONE' },
        { label: 'Decorative Only', value: 'DECORATIVE_ONLY' },
        { label: 'All', value: 'ALL' },
      ]
    },
    hingeAxis: {
      name: 'hingeAxis',
      label: 'Hinge Axis Location',
      type: 'object',
      required: false,
      objectConfig: locationConfig
    },
    leftDoorSeedBlock: {
      name: 'leftDoorSeedBlock',
      label: 'Left Door Seed Block',
      type: 'object',
      required: false,
      objectConfig: locationConfig
    },
    rightDoorSeedBlock: {
      name: 'rightDoorSeedBlock',
      label: 'Right Door Seed Block',
      type: 'object',
      required: false,
      objectConfig: locationConfig
    },
    healthMax: {
      name: 'healthMax',
      label: 'Max Health',
      type: 'number',
      required: true,
      validation: (value) => {
        if (!value || value <= 0) return 'Health must be greater than 0';
      }
    },
    showHealthDisplay: {
      name: 'showHealthDisplay',
      label: 'Show Health Display',
      type: 'boolean',
      required: false
    },
    healthDisplayMode: {
      name: 'healthDisplayMode',
      label: 'Health Display Mode',
      type: 'select',
      required: false,
      options: [
        { label: 'Always', value: 'ALWAYS' },
        { label: 'Damaged Only', value: 'DAMAGED_ONLY' },
        { label: 'Never', value: 'NEVER' },
        { label: 'Siege Only', value: 'SIEGE_ONLY' },
      ]
    },
    healthDisplayYOffset: {
      name: 'healthDisplayYOffset',
      label: 'Health Display Y Offset',
      type: 'number',
      required: false
    },
    infoDisplayLocation: {
      name: 'infoDisplayLocation',
      label: 'Info Display Location',
      type: 'object',
      required: false,
      objectConfig: locationConfig
    },
    gateNameDisplayMode: {
      name: 'gateNameDisplayMode',
      label: 'Gate Name Display Mode',
      type: 'select',
      required: false,
      options: [
        { label: 'Always', value: 'ALWAYS' },
        { label: 'Never', value: 'NEVER' },
        { label: 'Siege Only', value: 'SIEGE_ONLY' },
      ]
    },
    statusDisplayMode: {
      name: 'statusDisplayMode',
      label: 'Status Display Mode',
      type: 'select',
      required: false,
      options: [
        { label: 'Always', value: 'ALWAYS' },
        { label: 'Never', value: 'NEVER' },
        { label: 'Siege Only', value: 'SIEGE_ONLY' },
      ]
    },
    // New (decision 5.0-D): gates this door's own name line in the combined structure+door
    // hover, independent of gateNameDisplayMode (which gates the structure's name line).
    doorNameDisplayMode: {
      name: 'doorNameDisplayMode',
      label: 'Door Name Display Mode',
      type: 'select',
      required: false,
      options: [
        { label: 'Always', value: 'ALWAYS' },
        { label: 'Never', value: 'NEVER' },
        { label: 'Siege Only', value: 'SIEGE_ONLY' },
      ]
    },
    isInvincible: {
      name: 'isInvincible',
      label: 'Invincible',
      type: 'boolean',
      required: false
    },
    canRespawn: {
      name: 'canRespawn',
      label: 'Can Respawn',
      type: 'boolean',
      required: false
    },
    respawnRateSeconds: {
      name: 'respawnRateSeconds',
      label: 'Respawn Rate (seconds)',
      type: 'number',
      required: false,
      validation: (value) => {
        if (value && value < 1) return 'Respawn rate must be at least 1 second';
      }
    },
    allowPassThrough: {
      name: 'allowPassThrough',
      label: 'Allow Pass-Through',
      type: 'boolean',
      required: false
    },
    passThroughDurationSeconds: {
      name: 'passThroughDurationSeconds',
      label: 'Pass-Through Duration (seconds)',
      type: 'number',
      required: false,
      validation: (value) => {
        if (value && value < 1) return 'Pass-through duration must be at least 1 second';
      }
    },
  }
};

// PermissionGroup is [FormConfigurableEntity] on the backend and has been since user-features
// Phase 1, but was never registered here - a carried-forward gap every user-management/
// user-features phase handoff flagged (docs/specs/user-management/IMPLEMENTATION_PLAN.md's
// "Phase 1 status" carried-forward item 1). This is what closes it: generic CRUD via
// /dashboard and /forms/permissiongroup, the same mechanism every other entity here uses -
// no bespoke group-management page needed. parentGroupId is a plain number field rather than
// an object picker (unlike e.g. districtConfig's `town`) to avoid a self-referencing
// ObjectConfig - group hierarchies are expected to be shallow and edited by id, matching how
// structureConfig links districtId/streetId elsewhere in this file.
const permissionGroupConfig: ObjectConfig = {
  type: 'permissiongroup',
  label: 'Permission Group',
  icon: <Lock className="h-5 w-5" />,
  fields: {
    id: commonFields.id,
    name: commonFields.name,
    weight: {
      name: 'weight',
      label: 'Weight',
      type: 'number',
      required: true,
      defaultValue: 0,
    },
    isPremiumTier: {
      name: 'isPremiumTier',
      label: 'Premium Tier',
      type: 'bool',
      required: false,
      defaultValue: false,
    },
    salaryMultiplier: {
      name: 'salaryMultiplier',
      label: 'Salary Multiplier',
      type: 'number',
      required: true,
      defaultValue: 1.0,
    },
    chatPrefix: {
      name: 'chatPrefix',
      label: 'Chat Prefix',
      type: 'text',
      required: false,
    },
    chatSuffix: {
      name: 'chatSuffix',
      label: 'Chat Suffix',
      type: 'text',
      required: false,
    },
    parentGroupId: {
      name: 'parentGroupId',
      label: 'Parent Group Id',
      type: 'number',
      required: false,
    },
  },
};

// Siege Phase 1 (docs/specs/siege-minigame/IMPLEMENTATION_PLAN.md): dashboard/navigation entries
// for BannerDesign and Clan. The real authoring UI is their FormConfigurations (FormWizard); these
// ObjectConfigs are what puts them in /dashboard and /forms/<type>. BannerLayer has no entry of its
// own - layers are only created/edited as the owned "Layers" list inside a banner's wizard.
const dyeColorOptions = [
        { label: 'White', value: 'WHITE' },
        { label: 'Orange', value: 'ORANGE' },
        { label: 'Magenta', value: 'MAGENTA' },
        { label: 'Light Blue', value: 'LIGHT_BLUE' },
        { label: 'Yellow', value: 'YELLOW' },
        { label: 'Lime', value: 'LIME' },
        { label: 'Pink', value: 'PINK' },
        { label: 'Gray', value: 'GRAY' },
        { label: 'Light Gray', value: 'LIGHT_GRAY' },
        { label: 'Cyan', value: 'CYAN' },
        { label: 'Purple', value: 'PURPLE' },
        { label: 'Blue', value: 'BLUE' },
        { label: 'Brown', value: 'BROWN' },
        { label: 'Green', value: 'GREEN' },
        { label: 'Red', value: 'RED' },
        { label: 'Black', value: 'BLACK' }
];

const bannerDesignConfig: ObjectConfig = {
  type: 'bannerdesign',
  label: 'Banner Design',
  icon: <Flag className="h-5 w-5" />,
  fields: {
    id: commonFields.id,
    name: commonFields.name,
    baseColor: {
      name: 'baseColor',
      label: 'Base Colour',
      type: 'select',
      required: true,
      defaultValue: 'WHITE',
      options: dyeColorOptions,
    },
  },
};

const clanConfig: ObjectConfig = {
  type: 'clan',
  label: 'Clan',
  icon: <Users className="h-5 w-5" />,
  fields: {
    id: commonFields.id,
    name: commonFields.name,
    isNpc: {
      name: 'isNpc',
      label: 'NPC Clan',
      type: 'bool',
      required: false,
      defaultValue: false,
    },
    chatColor: {
      name: 'chatColor',
      label: 'Chat Colour',
      type: 'select',
      required: true,
      defaultValue: 'WHITE',
      options: [
        { label: 'Black', value: 'BLACK' },
        { label: 'Dark Blue', value: 'DARK_BLUE' },
        { label: 'Dark Green', value: 'DARK_GREEN' },
        { label: 'Dark Aqua', value: 'DARK_AQUA' },
        { label: 'Dark Red', value: 'DARK_RED' },
        { label: 'Dark Purple', value: 'DARK_PURPLE' },
        { label: 'Gold', value: 'GOLD' },
        { label: 'Gray', value: 'GRAY' },
        { label: 'Dark Gray', value: 'DARK_GRAY' },
        { label: 'Blue', value: 'BLUE' },
        { label: 'Green', value: 'GREEN' },
        { label: 'Aqua', value: 'AQUA' },
        { label: 'Red', value: 'RED' },
        { label: 'Light Purple', value: 'LIGHT_PURPLE' },
        { label: 'Yellow', value: 'YELLOW' },
        { label: 'White', value: 'WHITE' }
      ],
    },
    bannerDesignId: {
      name: 'bannerDesignId',
      label: 'Banner Design Id',
      type: 'number',
      required: true,
    },
    defaultForTownId: {
      name: 'defaultForTownId',
      label: 'Default For Town Id',
      type: 'number',
      required: false,
    },
  },
};

// Siege Phase 3 (docs/specs/siege-minigame/IMPLEMENTATION_PLAN.md): dashboard/navigation entries
// for the two top-level siege entities. Their real authoring UI is their FormConfigurations
// (FormWizard). SiegeTeam/SiegeSpawnpoint/SiegeObjective have no entry of their own - like
// BannerLayer they are owned children, created/edited only inside the scenario's wizard (only teams
// have a search endpoint, for the holder/owner pickers). SiegeConfiguration is a singleton with its
// own page (/admin/siege-configuration).
const siegeScenarioConfig: ObjectConfig = {
  type: 'siegescenario',
  label: 'Siege Scenario',
  icon: <Swords className="h-5 w-5" />,
  fields: {
    id: commonFields.id,
    name: commonFields.name,
    description: commonFields.description,
    townId: { name: 'townId', label: 'Town Id', type: 'number', required: true },
  },
};

const siegeLobbyConfig: ObjectConfig = {
  type: 'siegelobby',
  label: 'Siege Lobby',
  icon: <Castle className="h-5 w-5" />,
  fields: {
    id: commonFields.id,
    name: commonFields.name,
    key: { name: 'key', label: 'Key', type: 'text', required: true },
    isEnabled: { name: 'isEnabled', label: 'Enabled', type: 'bool', required: false, defaultValue: false },
  },
};

export const objectConfigs: Record<string, ObjectConfig> = {
  location: locationConfig,
  town: townConfig,
  district: districtConfig,
  structure: structureConfig,
  street: streetConfig,
  category: CategoryConfig,
  itemType: ItemTypeConfig,
  minecraftblockref: minecraftBlockRefConfig,
  minecraftmaterialref: minecraftMaterialRefConfig,
  gatestructure: GateStructureConfig,
  gatedoor: GateDoorConfig,
  permissiongroup: permissionGroupConfig,
  bannerdesign: bannerDesignConfig,
  clan: clanConfig,
  siegescenario: siegeScenarioConfig,
  siegelobby: siegeLobbyConfig,
};