import React from 'react';
import { FormFieldDto } from '../../types/dtos/forms/FormModels';
import { SiegeReadinessPanel } from '../siege/SiegeReadinessPanel';

/**
 * Read-only "display panel" fields (siege Phase 3, verification item 4). A FormField whose
 * settingsJson has { "displayPanel": "<name>" } renders the named panel instead of an input, so a
 * FormConfiguration can end on a step that only shows information about the saved record.
 *
 * The field still has to name a real property of the entity (FormTemplateValidationService checks
 * it) - the convention is the read-only, not-required "Id" field, whose value never changes the
 * payload. Panels receive the wizard's entity id (undefined until the record is saved).
 */

export interface DisplayPanelContext {
    field: FormFieldDto;
    entityId?: string;
}

const panels: Record<string, (context: DisplayPanelContext) => React.ReactElement> = {
    siegeScenarioReadiness: ({ field, entityId }) => (
        <SiegeReadinessPanel scenarioId={entityId} label={field.label} description={field.description} />
    )
};

export const parseDisplayPanel = (settingsJson?: string): string | null => {
    if (!settingsJson) return null;
    try {
        const parsed = JSON.parse(settingsJson);
        return typeof parsed?.displayPanel === 'string' && parsed.displayPanel.length > 0 ? parsed.displayPanel : null;
    } catch {
        return null;
    }
};

export const renderDisplayPanel = (name: string, context: DisplayPanelContext): React.ReactElement => {
    const panel = panels[name];
    if (!panel) {
        return <div className="text-sm text-gray-500">Unknown display panel: {name}</div>;
    }
    return panel(context);
};
