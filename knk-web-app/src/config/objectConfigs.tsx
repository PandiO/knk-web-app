import React from 'react';
import { Building2, MapPin, Home, Package, User } from 'lucide-react';
import type { ObjectConfig } from '../types/common';
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

export const objectConfigs: Record<string, ObjectConfig> = {
  location: {
    type: 'location',
    label: 'Location',
    icon: <MapPin className="h-5 w-5" />,
    fields: {
      name: { name: 'name', label: 'Name', type: 'text', required: false, defaultValue: 'Location', hidden: true },
      x: { name: 'x', label: 'X', type: 'number', required: true },
      y: { name: 'y', label: 'Y', type: 'number', required: true },
      z: { name: 'z', label: 'Z', type: 'number', required: true },
      yaw: { name: 'yaw', label: 'Yaw', type: 'number', required: false, defaultValue: 0 },
      pitch: { name: 'pitch', label: 'Pitch', type: 'number', required: false, defaultValue: 0 }
    },
  },
  town: {
    type: 'town',
    label: 'Town',
    icon: <Home className="h-5 w-5" />,
    fields: {
      Name: {
        name: 'Name',
        label: 'Town Name',
        type: 'text',
        required: true,
        validation: (value) => {
          if (!value || value.length < 3) return 'Town name must be at least 3 characters';
        }
      },
      Description: {
        name: 'Description',
        label: 'Description',
        type: 'text',
        required: false
      },
      RegionName: {
        name: 'RegionName',
        label: 'Region',
        type: 'text',
        required: true
      },
      Location: {
        name: 'Location',
        label: 'Location',
        type: 'object',
        required: true,
        defaultValue: defaultLocationValue,
        objectConfig: {
          type: 'location',
          label: 'Location',
          icon: <MapPin className="h-5 w-5" />,
          fields: {
            x: { name: 'x', label: 'X', type: 'number', required: true },
            y: { name: 'y', label: 'Y', type: 'number', required: true },
            z: { name: 'z', label: 'Z', type: 'number', required: true },
            yaw: { name: 'yaw', label: 'Yaw', type: 'number', required: false, defaultValue: 0 },
            pitch: { name: 'pitch', label: 'Pitch', type: 'number', required: false, defaultValue: 0 }
          }
        }
      },
      Districts: {
        name: 'Districts',
        label: 'Districts',
        type: 'array',
        required: false,
        objectConfig: {
          type: 'district',
          label: 'District',
          icon: <MapPin className="h-5 w-5" />,
          fields: {} // Will be populated from district config
        }
      }
    },
    formatters: {
      RegionName: (value) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {value}
        </span>
      ),
      Created: (value: Date) => value.toLocaleDateString()
    }
  },
  district: {
    type: 'district',
    label: 'District',
    icon: <MapPin className="h-5 w-5" />,
    fields: {
      Name: {
        name: 'Name',
        label: 'District Name',
        type: 'text',
        required: true,
        validation: (value) => {
          if (!value || value.length < 3) return 'District name must be at least 3 characters';
        }
      },
      Description: {
        name: 'Description',
        label: 'Description',
        type: 'text',
        required: false
      },
      RegionName: {
        name: 'RegionName',
        label: 'Region',
        type: 'text',
        required: true
      },
      Town: {
        name: 'Town',
        label: 'Town',
        type: 'object',
        required: true,
        objectConfig: {
          type: 'town',
          label: 'Town',
          icon: <Home className="h-5 w-5" />,
          fields: {} // Will be populated from town config
        }
      },
      Location: {
        name: 'Location',
        label: 'Location',
        type: 'object',
        required: true,
        defaultValue: defaultLocationValue,
        objectConfig: {
          type: 'location',
          label: 'Location',
          icon: <MapPin className="h-5 w-5" />,
          fields: {
            x: { name: 'x', label: 'X', type: 'number', required: true },
            y: { name: 'y', label: 'Y', type: 'number', required: true },
            z: { name: 'z', label: 'Z', type: 'number', required: true },
            yaw: { name: 'yaw', label: 'Yaw', type: 'number', required: false, defaultValue: 0 },
            pitch: { name: 'pitch', label: 'Pitch', type: 'number', required: false, defaultValue: 0 }
          }
        }
      }
    },
    formatters: {
      RegionName: (value) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          {value}
        </span>
      ),
      Created: (value: Date) => value.toLocaleDateString()
    }
  },
  structure: {
    type: 'structure',
    label: 'Structure',
    icon: <Building2 className="h-5 w-5" />,
    fields: {
      Name: {
        name: 'Name',
        label: 'Structure Name',
        type: 'text',
        required: true,
        validation: (value) => {
          if (!value || value.length < 3) return 'Structure name must be at least 3 characters';
        }
      },
      Description: {
        name: 'Description',
        label: 'Description',
        type: 'text',
        required: false
      },
      District: {
        name: 'District',
        label: 'District',
        type: 'object',
        required: true,
        objectConfig: {
          type: 'district',
          label: 'District',
          icon: <MapPin className="h-5 w-5" />,
          fields: {} // Will be populated from district config
        }
      },
      StreetNumber: {
        name: 'StreetNumber',
        label: 'Street Number',
        type: 'number',
        required: false,
        validation: (value) => {
          if (value < 1) return 'Street number must be positive';
        }
      },
      Location: {
        name: 'Location',
        label: 'Location',
        type: 'object',
        required: true,
        defaultValue: defaultLocationValue,
        objectConfig: {
          type: 'location',
          label: 'Location',
          icon: <MapPin className="h-5 w-5" />,
          fields: {
            x: { name: 'x', label: 'X', type: 'number', required: true },
            y: { name: 'y', label: 'Y', type: 'number', required: true },
            z: { name: 'z', label: 'Z', type: 'number', required: true },
            yaw: { name: 'yaw', label: 'Yaw', type: 'number', required: false, defaultValue: 0 },
            pitch: { name: 'pitch', label: 'Pitch', type: 'number', required: false, defaultValue: 0 }
          }
        }
      }
    },
    formatters: {
      RegionName: (value) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          {value}
        </span>
      ),
      Created: (value: Date) => value.toLocaleDateString(),
      StreetNumber: (value) => `#${value}`
    }
  },
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
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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