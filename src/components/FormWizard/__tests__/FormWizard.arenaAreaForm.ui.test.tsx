import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { metadataClient } from '../../../apiClients/metadataClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import {
    getCreateFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getUpdateFunctionForEntity
} from '../../../utils/entityApiMapping';

/**
 * Arena duels rev. 6 (knk-workspace docs/specs/arena-duels/DESIGN.md §4.1): battlegrounds, spectator areas and the
 * lobby are the arena's own ArenaArea rows (knk-web-api Data/FormConfigurationSeeds/ArenaArea.json), each with its
 * regions as an owned list of ArenaAreaRegion (drawn by a world task, like a domain's sub-regions). The arena form's
 * last step lists its areas the same way.
 */

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: { getByEntityTypeName: jest.fn(), getById: jest.fn() }
}));
jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: { getEntityMetadata: jest.fn().mockResolvedValue({ entityName: '', displayName: '', fields: [] }) }
}));
jest.mock('../../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: { getById: jest.fn(), create: jest.fn(), update: jest.fn() }
}));
jest.mock('../../../apiClients/fieldValidationRuleClient', () => ({
    fieldValidationRuleClient: { getByFormConfigurationId: jest.fn(), validateField: jest.fn(), resolvePlaceholders: jest.fn() }
}));
jest.mock('../../../utils/entityApiMapping', () => ({
    getFetchByIdFunctionForEntity: jest.fn(),
    getCreateFunctionForEntity: jest.fn(),
    getUpdateFunctionForEntity: jest.fn(),
    getSearchFunctionForEntity: jest.fn(() => jest.fn(async () => ({ items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 }))),
    getDeleteFunctionForEntity: jest.fn()
}));

let mockNextId = 501;
jest.mock('../ChildFormModal', () => ({
    ChildFormModal: ({ open, parentEntityTypeName, onComplete }: {
        open: boolean; parentEntityTypeName?: string; onComplete: (data: Record<string, unknown>) => void;
    }) => open ? (
        <div>
            <div data-testid="child-parent-type">{parentEntityTypeName ?? ''}</div>
            <button type="button" data-testid="complete-child"
                onClick={() => onComplete({ id: mockNextId++, name: 'tempregion_worldtask_9' })}>complete</button>
        </div>
    ) : null
}));

const field = (overrides: Record<string, unknown>) => ({
    isRequired: false, isReadOnly: false, order: 0, isReusable: false, isLinkedToSource: false,
    hasCompatibilityIssues: false, validations: [], displayConditionGroups: [], ...overrides
});

const step = (id: string, stepName: string, order: number, fields: Record<string, unknown>[]) => ({
    id, stepName, description: '', order, fieldOrderJson: '[]', isReusable: false, isLinkedToSource: false,
    hasCompatibilityIssues: false, isManyToManyRelationship: false, childFormSteps: [], conditions: [], fields
});

const ownedList = (id: string, fieldName: string, objectType: string) => field({
    id, fieldName, label: fieldName, fieldType: 'List', elementType: 'Object', objectType, canCreate: true,
    settingsJson: '{"ownedChildCollection":true}'
});

const AREA_GENERAL = step('700', 'General', 0, [
    field({ id: '701', fieldName: 'Kind', label: 'Kind', fieldType: 'Enum', isRequired: true, defaultValue: 'BATTLEGROUND',
        settingsJson: '{"enumValues": ["BATTLEGROUND", "SPECTATOR", "LOBBY"]}' }),
    field({ id: '702', fieldName: 'Key', label: 'Key', fieldType: 'String', isRequired: true, order: 1 })
]);

const config = (entityTypeName: string, steps: unknown[]) => ({
    id: '70', entityTypeName, configurationName: `${entityTypeName} - Default (seed v1)`, description: '', isDefault: true, steps
});

describe('ArenaArea form (arena duels rev. 6)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        let progress = 1;
        (formSubmissionClient.create as jest.Mock).mockImplementation(async (p: Record<string, unknown>) => ({ ...p, id: `p${progress++}` }));
        (formSubmissionClient.update as jest.Mock).mockImplementation(async (p: Record<string, unknown>) => p);
        (getCreateFunctionForEntity as jest.Mock).mockReturnValue(jest.fn(async (data: Record<string, unknown>) => ({ ...data, id: 999 })));
        (getUpdateFunctionForEntity as jest.Mock).mockReturnValue(jest.fn(async () => undefined));
    });

    it('renders the kind and key and submits them for a new area', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(config('ArenaArea', [AREA_GENERAL]));
        const onComplete = jest.fn();
        render(<FormWizard entityName="ArenaArea" userId="1" onComplete={onComplete} />);

        await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
        expect(screen.getByRole('option', { name: 'SPECTATOR' })).toBeInTheDocument();
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'SPECTATOR' } });
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'stands' } });
        fireEvent.click(screen.getByRole('button', { name: /submit/i }));

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        const payload = onComplete.mock.calls[0][0];
        expect(payload.Kind).toBe('SPECTATOR');
        expect(payload.Key).toBe('stands');
    });

    it('adds regions to a saved area through the ArenaAreaRegion form (created by its own API)', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(
            config('ArenaArea', [step('710', 'Regions', 0, [ownedList('711', 'Regions', 'ArenaAreaRegion')])]));
        (getFetchByIdFunctionForEntity as jest.Mock).mockImplementation(() => async () => ({
            id: 30, Kind: 'BATTLEGROUND', Key: 'bg1', Regions: []
        }));
        render(<FormWizard entityName="ArenaArea" entityId="30" userId="1" onComplete={jest.fn()} />);

        await waitFor(() => expect(screen.getByRole('button', { name: /create new/i })).toBeEnabled());
        fireEvent.click(screen.getByRole('button', { name: /create new/i }));
        await waitFor(() => expect(screen.getByTestId('complete-child')).toBeInTheDocument());
        expect(screen.getByTestId('child-parent-type').textContent).toBe('ArenaArea');
        fireEvent.click(screen.getByTestId('complete-child'));

        await waitFor(() => expect(screen.queryByTestId('complete-child')).not.toBeInTheDocument());
        expect(getCreateFunctionForEntity).toHaveBeenCalledWith('ArenaAreaRegion');
    });

    it("lists the arena's areas on the arena form and creates new ones through the ArenaArea form", async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(
            config('Arena', [step('720', 'Battlegrounds, spectator areas and lobby', 0, [ownedList('721', 'Areas', 'ArenaArea')])]));
        (getFetchByIdFunctionForEntity as jest.Mock).mockImplementation(() => async () => ({
            id: 2, Name: 'Arena', Key: 'arena_2', Areas: []
        }));
        render(<FormWizard entityName="Arena" entityId="2" userId="1" onComplete={jest.fn()} />);

        await waitFor(() => expect(screen.getByRole('button', { name: /create new/i })).toBeEnabled());
        fireEvent.click(screen.getByRole('button', { name: /create new/i }));
        await waitFor(() => expect(screen.getByTestId('child-parent-type').textContent).toBe('Arena'));
        fireEvent.click(screen.getByTestId('complete-child'));

        await waitFor(() => expect(getCreateFunctionForEntity).toHaveBeenCalledWith('ArenaArea'));
    });
});
