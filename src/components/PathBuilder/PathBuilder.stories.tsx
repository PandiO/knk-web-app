import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { PathBuilder, type PathBuilderProps } from './PathBuilder';
import { EntityMetadataDto, EntityPropertyDto } from '../../types/dtos/metadata/MetadataModels';

const meta = {
  title: 'Forms/PathBuilder',
  component: PathBuilder,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Component for selecting a dependency path in the format "Entity.Property"',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    entityTypeName: {
      control: 'text',
      description: 'The entity type being configured',
    },
    label: {
      control: 'text',
      description: 'Label for the component',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the component is disabled',
    },
    required: {
      control: 'boolean',
      description: 'Whether the field is required',
    },
    initialPath: {
      control: 'text',
      description: 'Initial path in format "Entity.Property"',
    },
  },
} satisfies Meta<typeof PathBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock entity metadata
const mockEntityMetadata = new Map<string, EntityMetadataDto>([
  [
    'Town',
    {
      entityName: 'Town',
      displayName: 'Town',
      description: 'Represents a town entity',
      properties: [
        {
          name: 'wgRegionId',
          type: 'string',
          description: 'WorldGuard region ID',
          isRequired: true,
          isNavigable: false,
        },
        {
          name: 'name',
          type: 'string',
          description: 'Town name',
          isRequired: true,
          isNavigable: false,
        },
        {
          name: 'population',
          type: 'number',
          description: 'Current population',
          isRequired: false,
          isNavigable: false,
        },
      ] as EntityPropertyDto[],
    } as EntityMetadataDto,
  ],
  [
    'District',
    {
      entityName: 'District',
      displayName: 'District',
      description: 'Represents a district entity',
      properties: [
        {
          name: 'regionId',
          type: 'string',
          description: 'Region ID',
          isRequired: true,
          isNavigable: false,
        },
        {
          name: 'areaSize',
          type: 'number',
          description: 'Area size in blocks',
          isRequired: false,
          isNavigable: false,
        },
      ] as EntityPropertyDto[],
    } as EntityMetadataDto,
  ],
  [
    'Region',
    {
      entityName: 'Region',
      displayName: 'Region',
      description: 'Represents a region entity',
      properties: [
        {
          name: 'name',
          type: 'string',
          description: 'Region name',
          isRequired: true,
          isNavigable: false,
        },
        {
          name: 'x1',
          type: 'number',
          description: 'X coordinate 1',
          isRequired: true,
          isNavigable: false,
        },
        {
          name: 'x2',
          type: 'number',
          description: 'X coordinate 2',
          isRequired: true,
          isNavigable: false,
        },
        {
          name: 'z1',
          type: 'number',
          description: 'Z coordinate 1',
          isRequired: true,
          isNavigable: false,
        },
        {
          name: 'z2',
          type: 'number',
          description: 'Z coordinate 2',
          isRequired: true,
          isNavigable: false,
        },
      ] as EntityPropertyDto[],
    } as EntityMetadataDto,
  ],
]);

// Default story
export const Default: Story = {
  args: {
    entityTypeName: 'Town',
    label: 'Dependency Path',
    entityMetadata: mockEntityMetadata,
    onPathChange: (path) => console.log('Path changed:', path),
    disabled: false,
    required: false,
  },
  render: (args) => {
    const [path, setPath] = React.useState('');
    return (
      <div className="w-full max-w-md">
        <PathBuilder
          {...args}
          onPathChange={(newPath) => {
            setPath(newPath);
            args.onPathChange?.(newPath);
          }}
        />
        {path && <p className="mt-4 text-sm text-gray-600">Selected path: <code className="bg-gray-100 px-2 py-1 rounded">{path}</code></p>}
      </div>
    );
  },
};

// With initial path
export const WithInitialPath: Story = {
  args: {
    ...Default.args,
    initialPath: 'Town.wgRegionId',
  },
  render: (args) => {
    const [path, setPath] = React.useState(args.initialPath || '');
    return (
      <div className="w-full max-w-md">
        <PathBuilder
          {...args}
          onPathChange={(newPath) => {
            setPath(newPath);
            args.onPathChange?.(newPath);
          }}
        />
        {path && <p className="mt-4 text-sm text-gray-600">Selected path: <code className="bg-gray-100 px-2 py-1 rounded">{path}</code></p>}
      </div>
    );
  },
};

// Disabled state
export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
    initialPath: 'Town.wgRegionId',
  },
  render: (args) => (
    <div className="w-full max-w-md">
      <PathBuilder {...args} />
    </div>
  ),
};

// Required field
export const Required: Story = {
  args: {
    ...Default.args,
    required: true,
  },
  render: (args) => (
    <div className="w-full max-w-md">
      <PathBuilder {...args} />
    </div>
  ),
};

// Mobile view
export const MobileView: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  render: (args) => {
    const [path, setPath] = React.useState('');
    return (
      <div className="w-full p-4">
        <PathBuilder
          {...args}
          onPathChange={(newPath) => {
            setPath(newPath);
            args.onPathChange?.(newPath);
          }}
        />
        {path && <p className="mt-4 text-sm text-gray-600">Selected path: <code className="bg-gray-100 px-2 py-1 rounded">{path}</code></p>}
      </div>
    );
  },
};

// Tablet view
export const TabletView: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
  render: (args) => {
    const [path, setPath] = React.useState('');
    return (
      <div className="w-full p-4 max-w-2xl">
        <PathBuilder
          {...args}
          onPathChange={(newPath) => {
            setPath(newPath);
            args.onPathChange?.(newPath);
          }}
        />
        {path && <p className="mt-4 text-sm text-gray-600">Selected path: <code className="bg-gray-100 px-2 py-1 rounded">{path}</code></p>}
      </div>
    );
  },
};

// With custom label
export const CustomLabel: Story = {
  args: {
    ...Default.args,
    label: 'Custom Dependency Field',
  },
  render: (args) => (
    <div className="w-full max-w-md">
      <PathBuilder {...args} />
    </div>
  ),
};
