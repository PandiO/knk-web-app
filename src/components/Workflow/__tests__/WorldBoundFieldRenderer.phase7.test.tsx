/**
 * Phase 7 E2E Tests: WorldTask Integration with Dependency Resolution
 * 
 * Tests validate that WorldBoundFieldRenderer properly integrates with 
 * useEnrichedFormContext to resolve dependencies and pass validation context 
 * to Minecraft plugin via WorldTask inputJson.
 * 
 * Test Scenarios:
 * 1. Dependency resolution integration
 * 2. Validation context building
 * 3. WorldTask creation with resolved dependencies
 * 4. Message interpolation
 * 5. Multi-layer dependency resolution
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorldBoundFieldRenderer } from '../WorldBoundFieldRenderer';
import { FormFieldDto, FormConfigurationDto } from '../../../types/dtos/forms/FormModels';
import * as worldTaskClientModule from '../../../apiClients/worldTaskClient';
import * as useEnrichedFormContextModule from '../../../hooks/useEnrichedFormContext';

// Mock dependencies
jest.mock('../../../apiClients/worldTaskClient');
jest.mock('../../../hooks/useEnrichedFormContext');

describe('WorldBoundFieldRenderer - Phase 7 E2E Tests', () => {
    const mockFormConfiguration: FormConfigurationDto = {
        id: '1',
        entityName: 'Town',
        version: 1,
        steps: [
            {
                id: '1',
                stepNumber: 1,
                title: 'Basic Info',
                description: 'Enter basic information',
                fields: [
                    {
                        id: '1',
                        fieldName: 'wgRegionId',
                        label: 'Region',
                        fieldType: 'String',
                        isRequired: true,
                        order: 1,
                        settingsJson: JSON.stringify({ worldTask: { enabled: true, taskType: 'RegionCreate' } })
                    } as FormFieldDto
                ]
            }
        ]
    } as FormConfigurationDto;

    const mockField: FormFieldDto = {
        id: '1',
        fieldName: 'wgRegionId',
        label: 'Region',
        fieldType: 'String',
        isRequired: true,
        order: 1,
        settingsJson: JSON.stringify({ worldTask: { enabled: true, taskType: 'RegionCreate' } })
    };

    const mockFormContextValue = {
        values: {
            wgRegionId: 'region_123',
            town: 'TestTown',
            player: 'TestPlayer'
        },
        fieldMetadata: new Map(),
        entityMetadata: new Map(),
        resolvedDependencies: new Map([
            [1, { ruleId: 1, status: 'resolved', dependencyPath: 'Town.name', resolvedValue: 'TestTown', resolvedAt: new Date().toISOString() }]
        ]),
        isLoading: false,
        error: null,
        setFieldValue: jest.fn(),
        resolveDependency: jest.fn(),
        resolveDependenciesBatch: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============================================================================
    // Scenario 1: Dependency Resolution Integration
    // ============================================================================
    
    describe('Scenario 1: Dependency Resolution Integration', () => {
        it('should load enriched form context when formConfiguration is provided', async () => {
            (useEnrichedFormContextModule.useEnrichedFormContext as jest.Mock).mockReturnValue(mockFormContextValue);
            (worldTaskClientModule.worldTaskClient.create as jest.Mock).mockResolvedValue({
                id: 1,
                status: 'Pending',
                linkCode: 'ABC123'
            });

            const onChange = jest.fn();
            
            render(
                <WorldBoundFieldRenderer
                    field={mockField}
                    value={null}
                    onChange={onChange}
                    taskType="RegionCreate"
                    workflowSessionId={1}
                    formConfiguration={mockFormConfiguration}
                />
            );

            // Verify hook is called with correct configuration
            expect(useEnrichedFormContextModule.useEnrichedFormContext).toHaveBeenCalledWith(mockFormConfiguration);
        });

        it('should handle missing formConfiguration gracefully (backward compatibility)', async () => {
            const onChange = jest.fn();
            
            const { container } = render(
                <WorldBoundFieldRenderer
                    field={mockField}
                    value={null}
                    onChange={onChange}
                    taskType="RegionCreate"
                    workflowSessionId={1}
                    // No formConfiguration provided
                />
            );

            // Component should still render without errors
            expect(container).toBeInTheDocument();
            expect(useEnrichedFormContextModule.useEnrichedFormContext).not.toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Scenario 2: Validation Context Building
    // ============================================================================

    describe('Scenario 2: Validation Context Building', () => {
        it('should include resolved dependencies in WorldTask inputJson', async () => {
            (useEnrichedFormContextModule.useEnrichedFormContext as jest.Mock).mockReturnValue(mockFormContextValue);
            (worldTaskClientModule.worldTaskClient.create as jest.Mock).mockResolvedValue({
                id: 1,
                status: 'Pending',
                linkCode: 'ABC123'
            });

            const onChange = jest.fn();
            const onTaskCompleted = jest.fn();
            
            render(
                <WorldBoundFieldRenderer
                    field={mockField}
                    value={null}
                    onChange={onChange}
                    taskType="RegionCreate"
                    workflowSessionId={1}
                    formConfiguration={mockFormConfiguration}
                    onTaskCompleted={onTaskCompleted}
                />
            );

            const button = screen.getByText(/Send to Minecraft/i);
            fireEvent.click(button);

            await waitFor(() => {
                expect(worldTaskClientModule.worldTaskClient.create).toHaveBeenCalled();
            });

            const createCall = (worldTaskClientModule.worldTaskClient.create as jest.Mock).mock.calls[0][0];
            const inputJson = JSON.parse(createCall.inputJson);

            // Verify validation context is included
            expect(inputJson.validationContext).toBeDefined();
            expect(inputJson.validationContext.formContextValues).toEqual(mockFormContextValue.values);
            expect(inputJson.validationContext.resolvedDependencies).toHaveLength(1);
            expect(inputJson.validationContext.resolvedDependencies[0].dependencyPath).toBe('Town.name');
        });

        it('should include pre-resolved placeholders alongside validation context', async () => {
            (useEnrichedFormContextModule.useEnrichedFormContext as jest.Mock).mockReturnValue(mockFormContextValue);
            (worldTaskClientModule.worldTaskClient.create as jest.Mock).mockResolvedValue({
                id: 1,
                status: 'Pending',
                linkCode: 'ABC123'
            });

            const onChange = jest.fn();
            const preResolvedPlaceholders = {
                'Town.name': 'MyTown',
                'Region.id': 'region_123'
            };
            
            render(
                <WorldBoundFieldRenderer
                    field={mockField}
                    value={null}
                    onChange={onChange}
                    taskType="RegionCreate"
                    workflowSessionId={1}
                    formConfiguration={mockFormConfiguration}
                    preResolvedPlaceholders={preResolvedPlaceholders}
                />
            );

            const button = screen.getByText(/Send to Minecraft/i);
            fireEvent.click(button);

            await waitFor(() => {
                expect(worldTaskClientModule.worldTaskClient.create).toHaveBeenCalled();
            });

            const createCall = (worldTaskClientModule.worldTaskClient.create as jest.Mock).mock.calls[0][0];
            const inputJson = JSON.parse(createCall.inputJson);

            // Verify both placeholders and validation context are present
            expect(inputJson.allPlaceholders).toEqual(preResolvedPlaceholders);
            expect(inputJson.validationContext).toBeDefined();
        });
    });

    // ============================================================================
    // Scenario 3: Multi-Layer Dependency Resolution
    // ============================================================================

    describe('Scenario 3: Multi-Layer Dependency Resolution', () => {
        it('should resolve multi-layer dependencies through enriched context', async () => {
            const multiLayerContext = {
                ...mockFormContextValue,
                resolvedDependencies: new Map([
                    [1, { 
                        ruleId: 1, 
                        status: 'resolved', 
                        dependencyPath: 'Town.district.region.name',  // Multi-layer path
                        resolvedValue: 'WestRegion',
                        resolvedAt: new Date().toISOString()
                    }],
                    [2, {
                        ruleId: 2,
                        status: 'resolved',
                        dependencyPath: 'Town.owner.faction',  // Different path
                        resolvedValue: 'RedFaction',
                        resolvedAt: new Date().toISOString()
                    }]
                ])
            };

            (useEnrichedFormContextModule.useEnrichedFormContext as jest.Mock).mockReturnValue(multiLayerContext);
            (worldTaskClientModule.worldTaskClient.create as jest.Mock).mockResolvedValue({
                id: 1,
                status: 'Pending',
                linkCode: 'ABC123'
            });

            const onChange = jest.fn();
            
            render(
                <WorldBoundFieldRenderer
                    field={mockField}
                    value={null}
                    onChange={onChange}
                    taskType="RegionCreate"
                    workflowSessionId={1}
                    formConfiguration={mockFormConfiguration}
                />
            );

            const button = screen.getByText(/Send to Minecraft/i);
            fireEvent.click(button);

            await waitFor(() => {
                expect(worldTaskClientModule.worldTaskClient.create).toHaveBeenCalled();
            });

            const createCall = (worldTaskClientModule.worldTaskClient.create as jest.Mock).mock.calls[0][0];
            const inputJson = JSON.parse(createCall.inputJson);

            // Verify multi-layer dependencies are included
            expect(inputJson.validationContext.resolvedDependencies).toHaveLength(2);
            expect(inputJson.validationContext.resolvedDependencies.some((d: any) => d.dependencyPath.includes('district.region'))).toBe(true);
            expect(inputJson.validationContext.resolvedDependencies.some((d: any) => d.dependencyPath.includes('owner.faction'))).toBe(true);
        });

        it('should handle circular dependency detection in validation context', async () => {
            const contextWithIssues = {
                ...mockFormContextValue,
                error: 'Circular dependency detected: Field A → Field B → Field A'
            };

            (useEnrichedFormContextModule.useEnrichedFormContext as jest.Mock).mockReturnValue(contextWithIssues);
            (worldTaskClientModule.worldTaskClient.create as jest.Mock).mockResolvedValue({
                id: 1,
                status: 'Pending',
                linkCode: 'ABC123'
            });

            const onChange = jest.fn();
            
            render(
                <WorldBoundFieldRenderer
                    field={mockField}
                    value={null}
                    onChange={onChange}
                    taskType="RegionCreate"
                    workflowSessionId={1}
                    formConfiguration={mockFormConfiguration}
                />
            );

            const button = screen.getByText(/Send to Minecraft/i);
            fireEvent.click(button);

            await waitFor(() => {
                expect(worldTaskClientModule.worldTaskClient.create).toHaveBeenCalled();
            });

            const createCall = (worldTaskClientModule.worldTaskClient.create as jest.Mock).mock.calls[0][0];
            const inputJson = JSON.parse(createCall.inputJson);

            // Error should be included in validation context
            expect(inputJson.validationContext.error).toBe('Circular dependency detected: Field A → Field B → Field A');
        });
    });

    // ============================================================================
    // Scenario 4: Backward Compatibility
    // ============================================================================

    describe('Scenario 4: Backward Compatibility', () => {
        it('should work with legacy props (no formConfiguration)', async () => {
            (worldTaskClientModule.worldTaskClient.create as jest.Mock).mockResolvedValue({
                id: 1,
                status: 'Pending',
                linkCode: 'ABC123'
            });

            const onChange = jest.fn();
            
            render(
                <WorldBoundFieldRenderer
                    field={mockField}
                    value={null}
                    onChange={onChange}
                    taskType="RegionCreate"
                    workflowSessionId={1}
                    stepNumber={1}
                    stepKey="step1"
                    preResolvedPlaceholders={{ 'Town': 'TestTown' }}
                />
            );

            const button = screen.getByText(/Send to Minecraft/i);
            fireEvent.click(button);

            await waitFor(() => {
                expect(worldTaskClientModule.worldTaskClient.create).toHaveBeenCalled();
            });

            const createCall = (worldTaskClientModule.worldTaskClient.create as jest.Mock).mock.calls[0][0];
            const inputJson = JSON.parse(createCall.inputJson);

            // Legacy props still work
            expect(inputJson.allPlaceholders).toEqual({ 'Town': 'TestTown' });
            // But no validation context (backward compatible)
            expect(inputJson.validationContext).toBeUndefined();
        });
    });

    // ============================================================================
    // Scenario 5: Error Handling
    // ============================================================================

    describe('Scenario 5: Error Handling and Recovery', () => {
        it('should handle enriched context loading errors gracefully', async () => {
            (useEnrichedFormContextModule.useEnrichedFormContext as jest.Mock).mockReturnValue({
                ...mockFormContextValue,
                isLoading: true,
                error: 'Failed to load entity metadata'
            });
            (worldTaskClientModule.worldTaskClient.create as jest.Mock).mockResolvedValue({
                id: 1,
                status: 'Pending',
                linkCode: 'ABC123'
            });

            const onChange = jest.fn();
            
            render(
                <WorldBoundFieldRenderer
                    field={mockField}
                    value={null}
                    onChange={onChange}
                    taskType="RegionCreate"
                    workflowSessionId={1}
                    formConfiguration={mockFormConfiguration}
                />
            );

            const button = screen.getByText(/Send to Minecraft/i);
            fireEvent.click(button);

            // Should still proceed with task creation despite error
            await waitFor(() => {
                expect(worldTaskClientModule.worldTaskClient.create).toHaveBeenCalled();
            });
        });

        it('should log validation context for debugging when error occurs', async () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

            (useEnrichedFormContextModule.useEnrichedFormContext as jest.Mock).mockReturnValue(mockFormContextValue);
            (worldTaskClientModule.worldTaskClient.create as jest.Mock).mockResolvedValue({
                id: 1,
                status: 'Pending',
                linkCode: 'ABC123'
            });

            const onChange = jest.fn();
            
            render(
                <WorldBoundFieldRenderer
                    field={mockField}
                    value={null}
                    onChange={onChange}
                    taskType="RegionCreate"
                    workflowSessionId={1}
                    formConfiguration={mockFormConfiguration}
                />
            );

            const button = screen.getByText(/Send to Minecraft/i);
            fireEvent.click(button);

            await waitFor(() => {
                expect(worldTaskClientModule.worldTaskClient.create).toHaveBeenCalled();
            });

            // Should log validation context for debugging
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('WorldTask created with enriched validation context'),
                expect.any(Object)
            );

            consoleLogSpy.mockRestore();
        });
    });

    // ============================================================================
    // Scenario 6: Integration with Minecraft Plugin
    // ============================================================================

    describe('Scenario 6: Plugin Integration Verification', () => {
        it('should dehydrate validation context for plugin consumption', async () => {
            (useEnrichedFormContextModule.useEnrichedFormContext as jest.Mock).mockReturnValue(mockFormContextValue);
            (worldTaskClientModule.worldTaskClient.create as jest.Mock).mockResolvedValue({
                id: 1,
                status: 'Pending',
                linkCode: 'ABC123',
                inputJson: null // Plugin will receive this
            });

            const onChange = jest.fn();
            
            render(
                <WorldBoundFieldRenderer
                    field={mockField}
                    value={null}
                    onChange={onChange}
                    taskType="RegionCreate"
                    workflowSessionId={1}
                    formConfiguration={mockFormConfiguration}
                />
            );

            const button = screen.getByText(/Send to Minecraft/i);
            fireEvent.click(button);

            await waitFor(() => {
                expect(worldTaskClientModule.worldTaskClient.create).toHaveBeenCalled();
            });

            const createCall = (worldTaskClientModule.worldTaskClient.create as jest.Mock).mock.calls[0][0];
            const inputJson = JSON.parse(createCall.inputJson);

            // Plugin should be able to deserialize and use this context
            expect(inputJson.validationContext).toBeDefined();
            expect(inputJson.validationContext.formContextValues).toBeTruthy();
            expect(Array.isArray(inputJson.validationContext.resolvedDependencies)).toBe(true);
            expect(Array.isArray(inputJson.validationContext.entityMetadata)).toBe(true);
        });
    });
});
