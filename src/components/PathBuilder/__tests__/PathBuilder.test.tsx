import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PathBuilder } from './PathBuilder';
import * as fieldValidationRuleClient from '../../apiClients/fieldValidationRuleClient';
import {
  EntityMetadataDto,
  EntityPropertyDto,
} from '../../types/dtos/metadata/MetadataModels';

// Mock the API client
jest.mock('../../apiClients/fieldValidationRuleClient');

// Mock the logging utility
jest.mock('../../utils', () => ({
  logging: {
    getLogger: jest.fn(() => ({
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    })),
  },
}));

// Helper to create mock entity metadata
const createMockEntityMetadata = (): Map<string, EntityMetadataDto> => {
  return new Map([
    [
      'Town',
      {
        entityName: 'Town',
        displayName: 'Town',
        description: 'Town entity',
        properties: [
          {
            name: 'wgRegionId',
            type: 'string',
            description: 'Region ID',
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
        ] as EntityPropertyDto[],
      } as EntityMetadataDto,
    ],
    [
      'Region',
      {
        entityName: 'Region',
        displayName: 'Region',
        description: 'Region entity',
        properties: [
          {
            name: 'x1',
            type: 'number',
            description: 'X1 coordinate',
            isRequired: true,
            isNavigable: false,
          },
          {
            name: 'z1',
            type: 'number',
            description: 'Z1 coordinate',
            isRequired: true,
            isNavigable: false,
          },
        ] as EntityPropertyDto[],
      } as EntityMetadataDto,
    ],
  ]);
};

describe('PathBuilder Component', () => {
  const mockOnPathChange = jest.fn();
  const mockOnValidationStatusChange = jest.fn();
  const mockEntityMetadata = createMockEntityMetadata();

  beforeEach(() => {
    jest.clearAllMocks();
    (fieldValidationRuleClient as any).fieldValidationRuleClient = {
      getEntityProperties: jest.fn().mockResolvedValue([
        {
          propertyName: 'wgRegionId',
          propertyType: 'string',
          isRequired: true,
          description: 'Region ID',
        },
        {
          propertyName: 'name',
          propertyType: 'string',
          isRequired: true,
          description: 'Town name',
        },
      ]),
      validatePath: jest.fn().mockResolvedValue({
        isValid: true,
        error: undefined,
      }),
    };
  });

  it('renders entity dropdown', () => {
    render(
      <PathBuilder
        entityTypeName="Town"
        entityMetadata={mockEntityMetadata}
        onPathChange={mockOnPathChange}
      />
    );

    expect(screen.getByLabelText('Select dependency entity')).toBeInTheDocument();
    expect(screen.getByText('Dependency Field (Entity)')).toBeInTheDocument();
  });

  it('displays label and required indicator when required', () => {
    render(
      <PathBuilder
        entityTypeName="Town"
        entityMetadata={mockEntityMetadata}
        onPathChange={mockOnPathChange}
        label="Custom Label"
        required
      />
    );

    expect(screen.getByText('Custom Label')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('loads property suggestions when entity is selected', async () => {
    const user = userEvent.setup();
    
    render(
      <PathBuilder
        entityTypeName="Town"
        entityMetadata={mockEntityMetadata}
        onPathChange={mockOnPathChange}
      />
    );

    const entitySelect = screen.getByLabelText('Select dependency entity');
    await user.selectOptions(entitySelect, 'Town');

    await waitFor(() => {
      expect(screen.getByText(/Property/)).toBeInTheDocument();
    });
  });

  it('validates path when entity and property are selected', async () => {
    const user = userEvent.setup();
    const validatePathMock = jest.fn().mockResolvedValue({
      isValid: true,
      error: undefined,
    });

    (fieldValidationRuleClient as any).fieldValidationRuleClient = {
      getEntityProperties: jest.fn().mockResolvedValue([
        { propertyName: 'wgRegionId', propertyType: 'string', isRequired: true },
      ]),
      validatePath: validatePathMock,
    };

    render(
      <PathBuilder
        entityTypeName="Town"
        entityMetadata={mockEntityMetadata}
        onPathChange={mockOnPathChange}
        onValidationStatusChange={mockOnValidationStatusChange}
      />
    );

    const entitySelect = screen.getByLabelText('Select dependency entity');
    await user.selectOptions(entitySelect, 'Town');

    await waitFor(() => {
      expect(screen.getByLabelText('Select property')).toBeInTheDocument();
    });

    const propertySelect = screen.getByLabelText('Select property');
    await user.selectOptions(propertySelect, 'wgRegionId');

    await waitFor(() => {
      expect(validatePathMock).toHaveBeenCalledWith('Town.wgRegionId', 'Town');
    });
  });

  it('displays success validation status when path is valid', async () => {
    const user = userEvent.setup();
    
    (fieldValidationRuleClient as any).fieldValidationRuleClient = {
      getEntityProperties: jest.fn().mockResolvedValue([
        { propertyName: 'wgRegionId', propertyType: 'string' },
      ]),
      validatePath: jest.fn().mockResolvedValue({
        isValid: true,
        error: undefined,
      }),
    };

    render(
      <PathBuilder
        entityTypeName="Town"
        entityMetadata={mockEntityMetadata}
        onPathChange={mockOnPathChange}
      />
    );

    const entitySelect = screen.getByLabelText('Select dependency entity');
    await user.selectOptions(entitySelect, 'Town');

    await waitFor(() => {
      expect(screen.getByLabelText('Select property')).toBeInTheDocument();
    });

    const propertySelect = screen.getByLabelText('Select property');
    await user.selectOptions(propertySelect, 'wgRegionId');

    await waitFor(() => {
      expect(screen.getByText('✓ Valid path')).toBeInTheDocument();
    });
  });

  it('displays error validation status when path is invalid', async () => {
    const user = userEvent.setup();
    
    (fieldValidationRuleClient as any).fieldValidationRuleClient = {
      getEntityProperties: jest.fn().mockResolvedValue([
        { propertyName: 'invalidProperty', propertyType: 'string' },
      ]),
      validatePath: jest.fn().mockResolvedValue({
        isValid: false,
        error: 'Property not found on entity',
        detailedError: 'Available properties: wgRegionId, name',
      }),
    };

    render(
      <PathBuilder
        entityTypeName="Town"
        entityMetadata={mockEntityMetadata}
        onPathChange={mockOnPathChange}
      />
    );

    const entitySelect = screen.getByLabelText('Select dependency entity');
    await user.selectOptions(entitySelect, 'Town');

    await waitFor(() => {
      expect(screen.getByLabelText('Select property')).toBeInTheDocument();
    });

    const propertySelect = screen.getByLabelText('Select property');
    await user.selectOptions(propertySelect, 'invalidProperty');

    await waitFor(() => {
      expect(screen.getByText(/Property not found on entity/)).toBeInTheDocument();
    });
  });

  it('displays path preview when both entity and property are selected', async () => {
    const user = userEvent.setup();
    
    render(
      <PathBuilder
        entityTypeName="Town"
        entityMetadata={mockEntityMetadata}
        onPathChange={mockOnPathChange}
      />
    );

    const entitySelect = screen.getByLabelText('Select dependency entity');
    await user.selectOptions(entitySelect, 'Town');

    await waitFor(() => {
      expect(screen.getByLabelText('Select property')).toBeInTheDocument();
    });

    const propertySelect = screen.getByLabelText('Select property');
    await user.selectOptions(propertySelect, 'wgRegionId');

    await waitFor(() => {
      expect(screen.getByText('Town.wgRegionId')).toBeInTheDocument();
    });
  });

  it('calls onPathChange with correct path when validated', async () => {
    const user = userEvent.setup();
    
    render(
      <PathBuilder
        entityTypeName="Town"
        entityMetadata={mockEntityMetadata}
        onPathChange={mockOnPathChange}
      />
    );

    const entitySelect = screen.getByLabelText('Select dependency entity');
    await user.selectOptions(entitySelect, 'Town');

    await waitFor(() => {
      expect(screen.getByLabelText('Select property')).toBeInTheDocument();
    });

    const propertySelect = screen.getByLabelText('Select property');
    await user.selectOptions(propertySelect, 'wgRegionId');

    await waitFor(() => {
      expect(mockOnPathChange).toHaveBeenCalledWith('Town.wgRegionId');
    });
  });

  it('resets property when entity changes', async () => {
    const user = userEvent.setup();
    
    render(
      <PathBuilder
        entityTypeName="Town"
        entityMetadata={mockEntityMetadata}
        onPathChange={mockOnPathChange}
      />
    );

    // Select initial entity and property
    const entitySelect = screen.getByLabelText('Select dependency entity');
    await user.selectOptions(entitySelect, 'Town');

    await waitFor(() => {
      expect(screen.getByLabelText('Select property')).toBeInTheDocument();
    });

    // Change entity
    await user.selectOptions(entitySelect, 'Region');

    // Property select should be reset
    const propertySelect = screen.getByLabelText('Select property');
    expect(propertySelect).toHaveValue('');
  });

  it('disables component when disabled prop is true', () => {
    render(
      <PathBuilder
        entityTypeName="Town"
        entityMetadata={mockEntityMetadata}
        onPathChange={mockOnPathChange}
        disabled
        initialPath="Town.wgRegionId"
      />
    );

    const entitySelect = screen.getByLabelText('Select dependency entity') as HTMLSelectElement;
    expect(entitySelect).toBeDisabled();
  });

  it('initializes with provided path', async () => {
    render(
      <PathBuilder
        entityTypeName="Town"
        entityMetadata={mockEntityMetadata}
        onPathChange={mockOnPathChange}
        initialPath="Town.wgRegionId"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Town.wgRegionId')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Failed to load properties';

    (fieldValidationRuleClient as any).fieldValidationRuleClient = {
      getEntityProperties: jest.fn().mockRejectedValue(new Error(errorMessage)),
      validatePath: jest.fn(),
    };

    render(
      <PathBuilder
        entityTypeName="Town"
        entityMetadata={mockEntityMetadata}
        onPathChange={mockOnPathChange}
      />
    );

    const entitySelect = screen.getByLabelText('Select dependency entity');
    await user.selectOptions(entitySelect, 'Town');

    await waitFor(() => {
      expect(screen.getByText(new RegExp(errorMessage))).toBeInTheDocument();
    });
  });

  it('sorts entities by display name', () => {
    render(
      <PathBuilder
        entityTypeName="Town"
        entityMetadata={mockEntityMetadata}
        onPathChange={mockOnPathChange}
      />
    );

    const entitySelect = screen.getByLabelText('Select dependency entity') as HTMLSelectElement;
    const options = Array.from(entitySelect.options);
    
    // Check that entities are sorted
    // Should be: Select a dependency field... (empty), Region, Town
    expect(options[1].textContent).toBe('Region');
    expect(options[2].textContent).toBe('Town');
  });
});
