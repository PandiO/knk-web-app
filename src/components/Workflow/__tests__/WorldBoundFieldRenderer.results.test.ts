import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
    getWorldTaskResultDetails,
    shouldShowWorldTaskResultDetails,
    WorldTaskResultDetails
} from '../WorldBoundFieldRenderer';
import { WorldTaskReadDto } from '../../../types/dtos/workflow/WorkflowDtos';

const createCompletedTask = (taskType: string, output: Record<string, unknown>): WorldTaskReadDto => ({
    id: 86,
    workflowSessionId: 155,
    taskType,
    status: 'Completed',
    outputJson: JSON.stringify(output),
    createdAt: '2026-08-30T13:13:08Z'
});

describe('WorldBoundFieldRenderer result details', () => {
    it('formats all captured location details for comparison with Minecraft', () => {
        const task = createCompletedTask('LocationSelection', {
            fieldName: 'Location',
            name: 'Gate anchor',
            x: 1420.3,
            y: 85,
            z: -521.66,
            yaw: -83.43,
            pitch: 78.9,
            World: 'world_KNK-DEV',
            capturedAt: 1788095588000
        });

        expect(getWorldTaskResultDetails(task, 'LocationSelection')).toEqual([
            { label: 'Name', value: 'Gate anchor' },
            { label: 'Position', value: '(1420.30, 85.00, -521.66)' },
            { label: 'Rotation', value: 'yaw=-83.43, pitch=78.90' },
            { label: 'World', value: 'world_KNK-DEV' }
        ]);
    });

    it('renders captured coordinates and world in the completion details', () => {
        render(React.createElement(WorldTaskResultDetails, {
            details: [
                { label: 'Position', value: '(1420.30, 85.00, -521.66)' },
                { label: 'Rotation', value: 'yaw=-83.43, pitch=78.90' },
                { label: 'World', value: 'world_KNK-DEV' }
            ]
        }));

        expect(screen.getByText('Minecraft result')).toBeVisible();
        expect(screen.getByText('(1420.30, 85.00, -521.66)')).toBeVisible();
        expect(screen.getByText('yaw=-83.43, pitch=78.90')).toBeVisible();
        expect(screen.getByText('world_KNK-DEV')).toBeVisible();
    });

    it('uses the draft-safe object card as the only Location result display', () => {
        const task = createCompletedTask('LocationSelection', {
            name: 'Location',
            x: 1422.7,
            y: 85,
            z: -521.59,
            World: 'world_KNK-DEV'
        });

        expect(shouldShowWorldTaskResultDetails(task, 'LocationSelection')).toBe(false);
    });

    it('shows the relevant WorldGuard region result details', () => {
        const task = createCompletedTask('RegionCreate', {
            fieldName: 'WgRegionId',
            regionId: 'gate_test',
            worldName: 'world_KNK-DEV',
            parentRegionId: 'district_1000006',
            createdAt: 1788095588000
        });

        expect(shouldShowWorldTaskResultDetails(task, 'RegionCreate')).toBe(true);
        expect(getWorldTaskResultDetails(task, 'RegionCreate')).toEqual([
            { label: 'Region ID', value: 'gate_test' },
            { label: 'World', value: 'world_KNK-DEV' },
            { label: 'Parent region', value: 'district_1000006' }
        ]);
    });

    it('shows meaningful fields for unknown future task types', () => {
        const task = createCompletedTask('VerifyStructure', {
            fieldName: 'StructureId',
            structureId: 42,
            verified: true,
            createdAt: 1788095588000
        });

        expect(getWorldTaskResultDetails(task, 'VerifyStructure')).toEqual([
            { label: 'Structure Id', value: '42' },
            { label: 'Verified', value: 'true' }
        ]);
    });
});