import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SiegeScenarioClient } from '../../../apiClients/siegeScenarioClient';
import { FieldRenderer } from '../../FormWizard/FieldRenderers';
import { FieldType } from '../../../utils/enums';

// Siege Phase 3, verification item 4: the scenario wizard's read-only readiness step.

jest.mock('../../../apiClients/siegeScenarioClient', () => ({
    SiegeScenarioClient: { getInstance: jest.fn() }
}));

const readinessField = {
    id: '99',
    fieldName: 'Id',
    label: 'Readiness',
    description: 'Is this scenario playable?',
    fieldType: FieldType.Integer,
    isRequired: false,
    isReadOnly: true,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    settingsJson: '{"displayPanel":"siegeScenarioReadiness"}'
};

describe('Siege readiness panel (displayPanel field)', () => {
    let getReadiness: jest.Mock;

    beforeEach(() => {
        getReadiness = jest.fn();
        (SiegeScenarioClient.getInstance as jest.Mock).mockReturnValue({ getReadiness });
    });

    const renderPanel = (entityId?: string) => render(
        <FieldRenderer field={readinessField} value={entityId ? Number(entityId) : null} onChange={jest.fn()} parentEntityId={entityId} />
    );

    it('asks for a save first while the scenario has no id, without calling the API', () => {
        renderPanel(undefined);

        expect(screen.getByText(/submit to save the scenario first/i)).toBeInTheDocument();
        expect(getReadiness).not.toHaveBeenCalled();
        // The panel replaces the numeric input entirely.
        expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('lists errors and warnings with their codes and entities, and flags skipped spatial checks', async () => {
        getReadiness.mockResolvedValue({
            siegeScenarioId: 1,
            isReady: false,
            spatialChecksRun: false,
            errors: [
                { code: 'TEAM_NO_SPAWNPOINT', message: 'Team "Raiders" has no spawnpoint.', entityType: 'SiegeTeam', entityId: 2 },
                { code: 'OBJECTIVES_MIN_ONE', message: 'The scenario needs at least one objective.' }
            ],
            warnings: [
                { code: 'NO_INSTANT_VICTORY_OBJECTIVE', message: 'No objective ends the match early.' },
                { code: 'SPATIAL_CHECKS_UNAVAILABLE', message: 'The plugin could not be reached - locations were not checked.' }
            ]
        });

        renderPanel('1');

        await waitFor(() => expect(screen.getByText(/not ready - 2 problems to fix/i)).toBeInTheDocument());
        expect(getReadiness).toHaveBeenCalledWith(1);
        expect(screen.getByText('Team "Raiders" has no spawnpoint.')).toBeInTheDocument();
        expect(screen.getByText(/TEAM_NO_SPAWNPOINT · Team #2/)).toBeInTheDocument();
        expect(screen.getByText('No objective ends the match early.')).toBeInTheDocument();
        // The spatial warning is shown once, as the spatial-checks banner rather than a list entry.
        expect(screen.getAllByText('The plugin could not be reached - locations were not checked.')).toHaveLength(1);
    });

    it('shows ready and re-checks on demand', async () => {
        getReadiness.mockResolvedValue({ siegeScenarioId: 1, isReady: true, spatialChecksRun: true, errors: [], warnings: [] });

        renderPanel('1');

        await waitFor(() => expect(screen.getByText(/ready - this scenario can be put in a lobby rotation/i)).toBeInTheDocument());
        expect(screen.getByText(/spatial checks ran/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /re-check/i }));
        await waitFor(() => expect(getReadiness).toHaveBeenCalledTimes(2));
    });

    it('shows the API error when the check fails', async () => {
        getReadiness.mockRejectedValue(new Error('SiegeScenario with id 1 not found.'));

        renderPanel('1');

        await waitFor(() => expect(screen.getByText('SiegeScenario with id 1 not found.')).toBeInTheDocument());
    });
});
