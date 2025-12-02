import React from 'react';
import { Building2, MapPin, Home, Package, User, TagIcon, BrickWallIcon } from 'lucide-react';
import type { ColumnDefinition, FormField, ObjectConfig } from '../types/common';
import type { Location } from '../types/Location';

const defaultLocationValue: Location = {
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  pitch: 0,
};

export const placeholderConfigs = {
  text: {
    type: 'text',
    placeholder: 'Enter a value'
  },
  mail: {
    type: 'mail',
    placeholder: 'Enter an email address'
  },
  number: {
    type: 'number',
    placeholder: 'Enter a number'
  },
}

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
      { key: 'parentCategory', label: 'Parent Category', sortable: false, render: (row: any) => row.parentCategory ? `${row.parentCategory?.name}(${row.parentCategory?.id})` : '-' },
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
  dominion: dominionConfig,
  town: townConfig,
  district: districtConfig,
  structure: structureConfig,
  street: streetConfig,
  category: CategoryConfig,
  itemType: ItemTypeConfig,
  item: {
    type: 'item',
    label: 'Item',
    icon: <Package className="h-5 w-5" />,
    fields: {
      Name: {
        name: 'Name',
        label: 'Name',
        type: 'text',
        required: true,
        validation: (value) => {
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Name must contain only lowercase letters, numbers, and hyphens';
          }
        }
      },
      DisplayName: {
        name: 'DisplayName',
        label: 'Display Name',
        type: 'text',
        required: true
      },
      CategoryId: {
        name: 'CategoryId',
        label: 'Category',
        type: 'select',
        required: true,
        options: [
          { label: 'Electronics', value: '1' },
          { label: 'Furniture', value: '2' },
          { label: 'Books', value: '3' }
        ]
      },
      BaseItemName: {
        name: 'BaseItemName',
        label: 'Base Item Name',
        type: 'text',
        required: true
      },
      BasePrice: {
        name: 'BasePrice',
        label: 'Base Price',
        type: 'number',
        required: true,
        validation: (value) => {
          if (value < 0) return 'Price cannot be negative';
        }
      },
      Price: {
        name: 'Price',
        label: 'Sale Price',
        type: 'number',
        required: true,
        validation: (value) => {
          if (value < 0) return 'Price cannot be negative';
        }
      }
    },
    formatters: {
      CategoryName: (value) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {value}
        </span>
      ),
      BasePrice: (value) => `$${value.toFixed(2)}`,
      Price: (value) => `$${value.toFixed(2)}`
    }
  },
  user: {
    type: 'user',
    label: 'User',
    icon: <User className="h-5 w-5" />,
    fields: {
      name: {
        name: 'name',
        label: 'Full Name',
        type: 'text',
        required: true
      },
      email: {
        name: 'email',
        label: 'Email Address',
        type: 'text',
        required: true,
        validation: (value) => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return 'Please enter a valid email address';
          }
        }
      },
      role: {
        name: 'role',
        label: 'Role',
        type: 'select',
        required: true,
        options: [
          { label: 'User', value: 'user' },
          { label: 'Admin', value: 'admin' },
          { label: 'Manager', value: 'manager' }
        ]
      },
      isActive: {
        name: 'isActive',
        label: 'Status',
        type: 'select',
        required: true,
        defaultValue: true,
        options: [
          { label: 'Active', value: 'true' },
          { label: 'Inactive', value: 'false' }
        ]
      }
    },
    formatters: {
      isActive: (value) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      ),
      role: (value) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          {value}
        </span>
      )
    }
  }
};