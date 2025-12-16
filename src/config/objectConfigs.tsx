import { Building2, MapPin, Home, TagIcon, BrickWallIcon } from 'lucide-react';
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
};