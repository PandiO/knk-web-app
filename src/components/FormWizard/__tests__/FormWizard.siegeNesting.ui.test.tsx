import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { workflowClient } from '../../../apiClients/workflowClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { metadataClient } from '../../../apiClients/metadataClient';
import { displayConfigClient } from '../../../apiClients/displayConfigClient';
import {
    getCreateFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getSearchFunctionForEntity,
    getUpdateFunctionForEntity
} from '../../../utils/entityApiMapping';

/**
 * Siege Phase 3, verification items 1 and 2 (docs/specs/siege-minigame/IMPLEMENTATION_PLAN.md):
 * two-level owned nesting Scenario -> Team -> Spawnpoint through the REAL ChildFormModal at both
 * depths - each modal creates its own WorkflowSession (the gate QoL 5.11 fix, now at depth 2), the
 * depth-2 child is prefilled with its parent team and persisted through its own create API - and the
 * team form's Clan picker receiving the scenario's town as a pickerFilters {parent.TownId} value.
 */

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: { getByEntityTypeName: jest.fn(), getById: jest.fn() }
}));
jest.mock('../../../apiClients/workflowClient', () => ({
    workflowClient: { createSession: jest.fn(), getProgress: jest.fn(), completeStep: jest.fn() }
}));
jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: {
        getEntityMetadata: jest.fn().mockResolvedValue({ entityName: '', displayName: '', fields: [] }),
        getAllEntityMetadata: jest.fn().mockResolvedValue([])
    }
}));
jest.mock('../../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: {
        getById: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        getByEntityTypeNameFiltered: jest.fn()
    }
}));
jest.mock('../../../apiClients/fieldValidationRuleClient', () => ({
    fieldValidationRuleClient: {
        getByFormConfigurationId: jest.fn(),
        validateField: jest.fn(),
        resolvePlaceholders: jest.fn(),
        resolveDependencies: jest.fn()
    }
}));
jest.mock('../../../apiClients/displayConfigClient', () => ({
    displayConfigClient: { getDefaultByEntityType: jest.fn().mockRejectedValue(new Error('none')) }
}));
jest.mock('../../../apiClients/worldTaskClient', () => ({
    worldTaskClient: { create: jest.fn(), getById: jest.fn(), getBySession: jest.fn() }
}));
// PagedEntityTable reads column metadata through the auth-bound metadata context.
jest.mock('../../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => ({ baseMetadata: [], allMergedMetadata: [], configurations: [] })
}));
jest.mock('../../../utils/entityApiMapping', () => ({
    getFetchByIdFunctionForEntity: jest.fn(),
    getCreateFunctionForEntity: jest.fn(),
    getUpdateFunctionForEntity: jest.fn(),
    getSearchFunctionForEntity: jest.fn(),
    getDeleteFunctionForEntity: jest.fn()
}));

const field = (overrides: Record<string, unknown>) => ({
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    displayConditionGroups: [],
    ...overrides
});

const config = (id: string, entityTypeName: string, fields: Record<string, unknown>[]) => ({
    id,
    entityTypeName,
    configurationName: `${entityTypeName} - Default`,
    description: '',
    isDefault: true,
    isActive: true,
    steps: [{
        id: `${id}0`,
        stepName: 'Main',
        description: '',
        order: 0,
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        isManyToManyRelationship: false,
        childFormSteps: [],
        conditions: [],
        fields: fields.map((f, i) => field({ id: `${id}${i + 1}`, order: i, ...f }))
    }]
});

const CONFIGS: Record<string, unknown> = {
    SiegeScenario: config('30', 'SiegeScenario', [
        { fieldName: 'TownId', label: 'Town', fieldType: 'Object', objectType: 'Town', isRequired: true },
        { fieldName: 'Teams', label: 'Teams', fieldType: 'List', elementType: 'Object', objectType: 'SiegeTeam', settingsJson: '{"ownedChildCollection":true}' }
    ]),
    SiegeTeam: config('31', 'SiegeTeam', [
        { fieldName: 'SiegeScenarioId', label: 'Scenario', fieldType: 'Object', objectType: 'SiegeScenario', isRequired: true, isReadOnly: true },
        { fieldName: 'ClanId', label: 'Clan', fieldType: 'Object', objectType: 'Clan', settingsJson: '{"pickerFilters":{"preferTownId":"{parent.TownId?}"}}' },
        { fieldName: 'Spawnpoints', label: 'Spawnpoints', fieldType: 'List', elementType: 'Object', objectType: 'SiegeSpawnpoint', settingsJson: '{"ownedChildCollection":true}' }
    ]),
    SiegeSpawnpoint: config('32', 'SiegeSpawnpoint', [
        { fieldName: 'SiegeTeamId', label: 'Team', fieldType: 'Object', objectType: 'SiegeTeam', isRequired: true, isReadOnly: true },
        { fieldName: 'Name', label: 'Spawnpoint name', fieldType: 'String', isRequired: true },
        { fieldName: 'LocationId', label: 'Location', fieldType: 'Object', objectType: 'Location', settingsJson: '{"worldTask":{"enabled":true,"taskType":"LocationSelection"}}' }
    ])
};

const ENTITIES: Record<string, Record<string, unknown>> = {
    SiegeScenario: {
        id: 1, name: '[TEST] Siege of Cinix', townId: 5, townName: 'Cinix',
        teams: [{ id: 1, siegeScenarioId: 1, role: 'Defender', name: null, resolvedName: '[TEST] Cinix Garrison', spawnpoints: [] }]
    },
    SiegeTeam: { id: 1, siegeScenarioId: 1, role: 'Defender', clanId: null, name: null, resolvedName: '[TEST] Cinix Garrison', spawnpoints: [] }
};

// The API looks entity names up case-insensitively (the route segment is lowercase).
const byName = <T,>(map: Record<string, T>, name: string): T | undefined =>
    map[Object.keys(map).find(key => key.toLowerCase() === name.toLowerCase()) ?? ''];

const modalFor = (title: string): HTMLElement => {
    // The modal header comes first; an edit-mode wizard repeats the same title below it.
    const heading = screen.getAllByText(title)[0];
    return heading.closest('.overflow-y-auto') as HTMLElement;
};

describe('Siege authoring: Scenario -> Team -> Spawnpoint owned nesting', () => {
    let spawnpointCreate: jest.Mock;
    let clanSearch: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        // CRA's resetMocks clears factory implementations before every test - set them here.
        (metadataClient.getEntityMetadata as jest.Mock).mockResolvedValue({ entityName: '', displayName: '', fields: [] });
        (metadataClient.getAllEntityMetadata as jest.Mock).mockResolvedValue([]);
        (displayConfigClient.getDefaultByEntityType as jest.Mock).mockRejectedValue(new Error('none'));
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.getByEntityTypeNameFiltered as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.create as jest.Mock).mockImplementation(async (p: Record<string, unknown>) => ({ ...p, id: 'progress-1' }));
        (formSubmissionClient.update as jest.Mock).mockImplementation(async (p: Record<string, unknown>) => p);
        (formConfigClient.getByEntityTypeName as jest.Mock).mockImplementation(async (name: string) => byName(CONFIGS, name));
        (workflowClient.getProgress as jest.Mock).mockResolvedValue([]);
        let nextSession = 700;
        (workflowClient.createSession as jest.Mock).mockImplementation(async () => ({ id: nextSession++ }));

        (getFetchByIdFunctionForEntity as jest.Mock).mockImplementation((type: string) => async () => byName(ENTITIES, type));
        spawnpointCreate = jest.fn(async (data: Record<string, unknown>) => ({ id: 91, siegeTeamId: 1, name: data.Name }));
        (getCreateFunctionForEntity as jest.Mock).mockImplementation(() => spawnpointCreate);
        (getUpdateFunctionForEntity as jest.Mock).mockImplementation(() => jest.fn());
        clanSearch = jest.fn(async () => ({ items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 }));
        (getSearchFunctionForEntity as jest.Mock).mockImplementation(() => clanSearch);
    });

    it('opens a team, then a new spawnpoint inside it, each with its own workflow session, and persists the spawnpoint under the team', async () => {
        render(<FormWizard entityName="siegescenario" entityId="1" userId="1" onComplete={() => {}} />);

        // Edit-loaded FK without a navigation object shows its display name (townId + townName).
        await waitFor(() => expect(screen.getAllByText('Cinix').length).toBeGreaterThan(0));
        // A clan-sourced team has no own name - the card shows its resolved identity.
        await waitFor(() => expect(screen.getByText('[TEST] Cinix Garrison')).toBeInTheDocument());

        // Depth 1: edit the existing team.
        const teamsList = screen.getByText('Teams').closest('div') as HTMLElement;
        fireEvent.click(within(teamsList).getByRole('button', { name: /edit instance/i }));
        await waitFor(() => expect(screen.getAllByText('Edit SiegeTeam').length).toBeGreaterThan(0));
        await waitFor(() => expect(workflowClient.createSession).toHaveBeenCalledWith(
            expect.objectContaining({ entityTypeName: 'SiegeTeam', entityId: 1 })
        ));

        // Item 2: the Clan picker is ordered by the scenario's town (parent context, edit mode).
        const teamModal = modalFor('Edit SiegeTeam');
        await waitFor(() => expect(within(teamModal).getByText('Spawnpoints')).toBeInTheDocument());
        const selectButtons = within(teamModal).getAllByText('Select instance');
        fireEvent.click(selectButtons[selectButtons.length - 1]);
        await waitFor(() => expect(clanSearch).toHaveBeenCalledWith(
            expect.objectContaining({ filters: { preferTownId: '5' } })
        ));

        // Depth 2: create a spawnpoint from inside the team.
        const spawnpointsList = within(teamModal).getByText('Spawnpoints').closest('div') as HTMLElement;
        const createNew = within(spawnpointsList).getByRole('button', { name: /create new/i });
        await waitFor(() => expect(createNew).toBeEnabled());
        fireEvent.click(createNew);

        await waitFor(() => expect(screen.getByText('Create New SiegeSpawnpoint')).toBeInTheDocument());
        await waitFor(() => expect(workflowClient.createSession).toHaveBeenCalledWith(
            expect.objectContaining({ entityTypeName: 'SiegeSpawnpoint' })
        ));
        const spawnModal = modalFor('Create New SiegeSpawnpoint');
        // The depth-2 world-bound field has its "Send to Minecraft" action (needs the own session).
        await waitFor(() => expect(within(spawnModal).getAllByText('Send to Minecraft').length).toBeGreaterThan(0));
        // The parent link is prefilled with the team it was opened from.
        expect(within(spawnModal).getAllByText('ID: 1').length).toBeGreaterThan(0);

        fireEvent.change(within(spawnModal).getByRole('textbox'), { target: { value: 'Keep stairs' } });
        fireEvent.click(within(spawnModal).getByRole('button', { name: /submit/i }));

        await waitFor(() => expect(spawnpointCreate).toHaveBeenCalledTimes(1));
        expect(getCreateFunctionForEntity).toHaveBeenCalledWith('SiegeSpawnpoint');
        expect(spawnpointCreate).toHaveBeenCalledWith(expect.objectContaining({ SiegeTeamId: '1', Name: 'Keep stairs' }));

        // The depth-2 modal closes and the new spawnpoint shows in the team's list.
        await waitFor(() => expect(screen.queryByText('Create New SiegeSpawnpoint')).not.toBeInTheDocument());
        await waitFor(() => expect(within(modalFor('Edit SiegeTeam')).getByText('Keep stairs')).toBeInTheDocument());

        const sessionTypes = (workflowClient.createSession as jest.Mock).mock.calls.map(c => c[0].entityTypeName);
        expect(sessionTypes).toEqual(expect.arrayContaining(['SiegeTeam', 'SiegeSpawnpoint']));
    });
});
