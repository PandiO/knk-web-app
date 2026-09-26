import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { metadataClient } from '../../../apiClients/metadataClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { displayConfigClient } from '../../../apiClients/displayConfigClient';
import { getFetchByIdFunctionForEntity, getSearchFunctionForEntity } from '../../../utils/entityApiMapping';

/**
 * Siege Phase 3, verification item 3 (docs/specs/siege-minigame/IMPLEMENTATION_PLAN.md): the M2M
 * join editor with three join fields - SiegeScenario.Gates -> SiegeScenarioGate (GateStructureId +
 * InitialOwnerTeamId + InitialState + Damageable) - editing a SAVED scenario:
 * - saved rows are hydrated into relationship cards (name + join-field summary, no "Missing Entity");
 * - "Edit Join Entry" starts from the row's saved values, not the join form's defaults;
 * - the owner-team picker is scoped to the scenario's teams via pickerFilters {parent.id};
 * - the restricted OPEN/CLOSED enum survives the live-enum override (enumValuesSubset);
 * - the submitted payload carries all join fields for the API's replace-set.
 */

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: { getByEntityTypeName: jest.fn(), getById: jest.fn() }
}));
jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: { getEntityMetadata: jest.fn(), getAllEntityMetadata: jest.fn() }
}));
jest.mock('../../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: { getById: jest.fn(), create: jest.fn(), update: jest.fn(), getByEntityTypeNameFiltered: jest.fn() }
}));
jest.mock('../../../apiClients/fieldValidationRuleClient', () => ({
    fieldValidationRuleClient: { getByFormConfigurationId: jest.fn(), validateField: jest.fn(), resolvePlaceholders: jest.fn() }
}));
jest.mock('../../../apiClients/displayConfigClient', () => ({
    displayConfigClient: { getDefaultByEntityType: jest.fn() }
}));
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

const meta = (fieldName: string, fieldType: string, extra: Record<string, unknown> = {}) => ({
    fieldName, fieldType, isNullable: false, isRelatedEntity: false, hasDefaultValue: false, ...extra
});

// As reflected by the real MetadataService (declaration order matters: the selected gate first).
const GATE_JOIN_METADATA = {
    entityName: 'SiegeScenarioGate',
    displayName: 'SiegeScenarioGate',
    fields: [
        meta('SiegeScenarioId', 'Integer', { isRelatedEntity: true, relatedEntityType: 'SiegeScenario' }),
        meta('SiegeScenario', 'SiegeScenario', { isRelatedEntity: true, relatedEntityType: 'SiegeScenario' }),
        meta('GateStructureId', 'Integer', { isRelatedEntity: true, relatedEntityType: 'GateStructure' }),
        meta('GateStructure', 'GateStructure', { isRelatedEntity: true, relatedEntityType: 'GateStructure' }),
        meta('InitialOwnerTeamId', 'Integer', { isRelatedEntity: true, relatedEntityType: 'SiegeTeam', isNullable: true }),
        meta('InitialOwnerTeam', 'SiegeTeam', { isRelatedEntity: true, relatedEntityType: 'SiegeTeam', isNullable: true }),
        meta('InitialState', 'Enum', { isEnum: true, enumValues: ['CLOSED', 'OPENING', 'OPEN', 'CLOSING', 'JAMMED'] }),
        meta('Damageable', 'Boolean')
    ]
};

const field = (overrides: Record<string, unknown>) => ({
    isRequired: false, isReadOnly: false, order: 0, isReusable: false, isLinkedToSource: false,
    hasCompatibilityIssues: false, validations: [], displayConditionGroups: [], ...overrides
});

const step = (id: string, stepName: string, fields: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({
    id, stepName, description: '', order: 0, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false,
    isManyToManyRelationship: false, childFormSteps: [], conditions: [], fields, ...extra
});

const SCENARIO_CONFIG = {
    id: '40', entityTypeName: 'SiegeScenario', configurationName: 'SiegeScenario - Default', isDefault: true, isActive: true,
    steps: [
        step('400', 'Gates', [field({ id: '401', fieldName: 'Gates', label: 'Gates', fieldType: 'List', objectType: 'SiegeScenarioGate' })], {
            isManyToManyRelationship: true, relatedEntityPropertyName: 'Gates', joinEntityType: 'SiegeScenarioGate', subConfigurationId: '41'
        })
    ]
};

const GATE_JOIN_CONFIG = {
    id: '41', entityTypeName: 'SiegeScenarioGate', configurationName: 'SiegeScenarioGate - Join Entry', isDefault: true, isActive: true,
    steps: [
        step('410', 'Gate', [
            field({ id: '411', fieldName: 'GateStructureId', label: 'Gate', fieldType: 'Object', objectType: 'GateStructure', isRequired: true, order: 0 }),
            field({
                id: '412', fieldName: 'InitialOwnerTeamId', label: 'Owner team', fieldType: 'Object', objectType: 'SiegeTeam', order: 1,
                settingsJson: '{"pickerFilters":{"siegeScenarioId":"{parent.id}"},"pickerFiltersMissingMessage":"Save the scenario first."}'
            }),
            field({
                id: '413', fieldName: 'InitialState', label: 'Initial state', fieldType: 'Enum', order: 2, defaultValue: 'CLOSED',
                settingsJson: '{"enumValues":["OPEN","CLOSED"],"enumValuesSubset":true}'
            }),
            field({ id: '414', fieldName: 'Damageable', label: 'Damageable', fieldType: 'Boolean', order: 3, defaultValue: 'true' })
        ])
    ]
};

const SAVED_SCENARIO = {
    id: 1,
    name: '[TEST] Siege of Cinix',
    gates: [
        { siegeScenarioId: 1, gateStructureId: 13, gateStructureName: 'South Gate', initialOwnerTeamId: 2, initialState: 'OPEN', damageable: false }
    ]
};

describe('Siege authoring: scenario Gates M2M with three join fields (edit mode)', () => {
    let teamSearch: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        (metadataClient.getEntityMetadata as jest.Mock).mockImplementation(async (name: string) =>
            name === 'SiegeScenarioGate' ? GATE_JOIN_METADATA : { entityName: name, displayName: name, fields: [] });
        (metadataClient.getAllEntityMetadata as jest.Mock).mockResolvedValue([]);
        (displayConfigClient.getDefaultByEntityType as jest.Mock).mockRejectedValue(new Error('none'));
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.getByEntityTypeNameFiltered as jest.Mock).mockResolvedValue([]);
        let nextProgress = 1;
        (formSubmissionClient.create as jest.Mock).mockImplementation(async (p: Record<string, unknown>) => ({ ...p, id: `p${nextProgress++}` }));
        (formSubmissionClient.update as jest.Mock).mockImplementation(async (p: Record<string, unknown>) => p);
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(SCENARIO_CONFIG);
        (formConfigClient.getById as jest.Mock).mockImplementation(async (id: string) => (id === '41' ? GATE_JOIN_CONFIG : SCENARIO_CONFIG));
        (getFetchByIdFunctionForEntity as jest.Mock).mockImplementation(() => async () => SAVED_SCENARIO);
        teamSearch = jest.fn(async () => ({ items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 }));
        (getSearchFunctionForEntity as jest.Mock).mockImplementation(() => teamSearch);
    });

    it('hydrates saved rows, edits one from its saved values with a scenario-scoped team picker, and submits every join field', async () => {
        const onComplete = jest.fn();
        render(<FormWizard entityName="siegescenario" entityId="1" userId="1" onComplete={onComplete} />);

        // Saved row -> relationship card with the gate's name and its join values.
        await waitFor(() => expect(screen.getByText('South Gate')).toBeInTheDocument());
        expect(screen.queryByText('Missing Entity')).not.toBeInTheDocument();
        expect(screen.getByText('InitialState:').parentElement).toHaveTextContent('InitialState: OPEN');

        fireEvent.click(screen.getByRole('button', { name: /edit join entry/i }));
        await waitFor(() => expect(screen.getByText('Create Join Entry')).toBeInTheDocument());
        const joinModal = screen.getByText('Create Join Entry').closest('.overflow-y-auto') as HTMLElement;

        // Starts from the saved values...
        const stateSelect = await waitFor(() => within(joinModal).getByDisplayValue('OPEN')) as HTMLSelectElement;
        // ...offering only the resting states despite the live enum having five values.
        expect(Array.from(stateSelect.options).map(o => o.value)).toEqual(['', 'OPEN', 'CLOSED']);
        expect(within(joinModal).getByRole('checkbox')).not.toBeChecked();
        expect(within(joinModal).getAllByText('ID: 2').length).toBeGreaterThan(0);

        // The owner-team picker is scoped to this scenario.
        const selectButtons = within(joinModal).getAllByText(/select instance|replace instance/i);
        fireEvent.click(selectButtons[selectButtons.length - 1]);
        await waitFor(() => expect(teamSearch).toHaveBeenCalledWith(
            expect.objectContaining({ filters: { siegeScenarioId: '1' } })
        ));
        expect(getSearchFunctionForEntity).toHaveBeenCalledWith('SiegeTeam');

        fireEvent.change(stateSelect, { target: { value: 'CLOSED' } });
        fireEvent.click(within(joinModal).getByRole('button', { name: /submit/i }));
        await waitFor(() => expect(screen.queryByText('Create Join Entry')).not.toBeInTheDocument());
        await waitFor(() => expect(screen.getByText('InitialState:').parentElement).toHaveTextContent('InitialState: CLOSED'));

        fireEvent.click(screen.getByRole('button', { name: /submit/i }));
        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        const payload = onComplete.mock.calls[0][0];
        expect(payload.Gates).toHaveLength(1);
        expect(payload.Gates[0]).toEqual(expect.objectContaining({
            GateStructureId: 13,
            InitialOwnerTeamId: 2,
            InitialState: 'CLOSED',
            Damageable: false
        }));
        // The parent side is stripped (the API takes the scenario from the URL/body id).
        expect(payload.Gates[0].SiegeScenarioId).toBeUndefined();
    });

    it('blocks the owner-team picker while the scenario is unsaved (no id to scope teams to)', async () => {
        (getFetchByIdFunctionForEntity as jest.Mock).mockImplementation(() => async () => ({ id: undefined, gates: [] }));
        render(<FormWizard entityName="siegescenario" userId="1" onComplete={jest.fn()} />);

        await waitFor(() => expect(screen.getByRole('button', { name: /create new join entry/i })).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /create new join entry/i }));
        await waitFor(() => expect(screen.getByText('Create Join Entry')).toBeInTheDocument());
        const joinModal = screen.getByText('Create Join Entry').closest('.overflow-y-auto') as HTMLElement;

        await waitFor(() => expect(within(joinModal).getByText('Save the scenario first.')).toBeInTheDocument());
        expect(teamSearch).not.toHaveBeenCalled();
    });
});
