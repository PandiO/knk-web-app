import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { metadataClient } from '../../../apiClients/metadataClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { displayConfigClient } from '../../../apiClients/displayConfigClient';
import { getFetchByIdFunctionForEntity, getSearchFunctionForEntity } from '../../../utils/entityApiMapping';

/**
 * Arena duels Phase 1 (KNG-210): the seeded Arena form (knk-web-api Data/FormConfigurationSeeds/Arena.json) renders
 * its steps in order, a saved arena's eligible kits load as ordered relationship cards, and the submitted payload
 * carries the kits in order with their SequenceNumber (the API keeps the list order; the first is the KIT_CHOICE
 * default) and the duel settings as typed.
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

// As reflected by the API's MetadataService for Models/Arena/ArenaKit.cs.
const ARENA_KIT_METADATA = {
    entityName: 'ArenaKit',
    displayName: 'ArenaKit',
    fields: [
        meta('ArenaId', 'Integer', { isRelatedEntity: true, relatedEntityType: 'Arena' }),
        meta('Arena', 'Arena', { isRelatedEntity: true, relatedEntityType: 'Arena' }),
        meta('KitId', 'Integer', { isRelatedEntity: true, relatedEntityType: 'Kit' }),
        meta('Kit', 'Kit', { isRelatedEntity: true, relatedEntityType: 'Kit' }),
        meta('SequenceNumber', 'Integer', { hasDefaultValue: true })
    ]
};

const field = (overrides: Record<string, unknown>) => ({
    isRequired: false, isReadOnly: false, order: 0, isReusable: false, isLinkedToSource: false,
    hasCompatibilityIssues: false, validations: [], displayConditionGroups: [], ...overrides
});

const step = (id: string, stepName: string, order: number, fields: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({
    id, stepName, description: '', order, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false,
    isManyToManyRelationship: false, childFormSteps: [], conditions: [], fields, ...extra
});

const STEP_NAMES = ['General', 'Negotiation & stakes', 'Eligibility & abuse limits', 'Gear & kits', 'Eligible kits',
    'Timing & queue', 'Announcements'];

// The seed's steps with a representative field each (the full seed is checked by the API's seed-file tests).
const ARENA_CONFIG = {
    id: '60', entityTypeName: 'Arena', configurationName: 'Arena - Default (seed v1)', isDefault: true, isActive: true,
    steps: [
        step('600', 'General', 0, [
            field({ id: '601', fieldName: 'Name', label: 'Name', fieldType: 'String', isRequired: true, order: 0 }),
            field({ id: '602', fieldName: 'Key', label: 'Key', fieldType: 'String', isRequired: true, order: 1 })
        ]),
        step('610', 'Negotiation & stakes', 1, [
            field({ id: '611', fieldName: 'MaxOffers', label: 'Offers per negotiation', fieldType: 'Integer', isRequired: true, defaultValue: '3' })
        ]),
        step('620', 'Eligibility & abuse limits', 2, [
            field({ id: '621', fieldName: 'PairCooldownMinutes', label: 'Pair cooldown (minutes)', fieldType: 'Integer', isRequired: true, defaultValue: '10' })
        ]),
        step('630', 'Gear & kits', 3, [
            field({ id: '631', fieldName: 'AllowKitChoice', label: 'Kit choice', fieldType: 'Boolean', defaultValue: 'false' })
        ]),
        step('640', 'Eligible kits', 4, [
            field({ id: '641', fieldName: 'EligibleKits', label: 'Eligible kits', fieldType: 'List', objectType: 'ArenaKit' })
        ], { isManyToManyRelationship: true, relatedEntityPropertyName: 'EligibleKits', joinEntityType: 'ArenaKit', subConfigurationId: '61' }),
        step('650', 'Timing & queue', 5, [
            field({ id: '651', fieldName: 'FightTimeLimitSeconds', label: 'Fight time limit (seconds)', fieldType: 'Integer', isRequired: true, defaultValue: '300' })
        ]),
        step('660', 'Announcements', 6, [
            field({ id: '661', fieldName: 'AnnounceMatches', label: 'Announce matches', fieldType: 'Boolean', defaultValue: 'true' })
        ])
    ]
};

const ARENA_KIT_CONFIG = {
    id: '61', entityTypeName: 'ArenaKit', configurationName: 'ArenaKit - Join Entry (seed v1)', isDefault: true, isActive: true,
    steps: [step('670', 'Kit', 0, [field({ id: '671', fieldName: 'KitId', label: 'Kit', fieldType: 'Object', objectType: 'Kit', isRequired: true })])]
};

const SAVED_ARENA = {
    id: 2,
    name: 'Arena',
    key: 'arena_2',
    maxOffers: 2,
    pairCooldownMinutes: 10,
    allowKitChoice: true,
    fightTimeLimitSeconds: 0,
    announceMatches: true,
    eligibleKits: [
        { arenaId: 2, kitId: 8, kitName: 'Archer', sequenceNumber: 0 },
        { arenaId: 2, kitId: 7, kitName: 'Knight', sequenceNumber: 1 }
    ]
};

const next = async (labelOnNextStep: string) => {
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(screen.getAllByText(new RegExp(`^${labelOnNextStep.replace(/[()]/g, '\\$&')}`)).length).toBeGreaterThan(0));
};

describe('Arena form (KNG-210)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (metadataClient.getEntityMetadata as jest.Mock).mockImplementation(async (name: string) =>
            name === 'ArenaKit' ? ARENA_KIT_METADATA : { entityName: name, displayName: name, fields: [] });
        (metadataClient.getAllEntityMetadata as jest.Mock).mockResolvedValue([]);
        (displayConfigClient.getDefaultByEntityType as jest.Mock).mockRejectedValue(new Error('none'));
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.getByEntityTypeNameFiltered as jest.Mock).mockResolvedValue([]);
        let nextProgress = 1;
        (formSubmissionClient.create as jest.Mock).mockImplementation(async (p: Record<string, unknown>) => ({ ...p, id: `p${nextProgress++}` }));
        (formSubmissionClient.update as jest.Mock).mockImplementation(async (p: Record<string, unknown>) => p);
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(ARENA_CONFIG);
        (formConfigClient.getById as jest.Mock).mockImplementation(async (id: string) => (id === '61' ? ARENA_KIT_CONFIG : ARENA_CONFIG));
        (getFetchByIdFunctionForEntity as jest.Mock).mockImplementation(() => async () => SAVED_ARENA);
        (getSearchFunctionForEntity as jest.Mock).mockImplementation(() =>
            jest.fn(async () => ({ items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 })));
    });

    it('renders the settings steps in order with their defaults on a new arena', async () => {
        render(<FormWizard entityName="arena" userId="1" onComplete={jest.fn()} />);

        await waitFor(() => expect(screen.getAllByRole('textbox')).toHaveLength(2));
        for (const name of STEP_NAMES) {
            expect(screen.getAllByText(name).length).toBeGreaterThan(0);
        }

        fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Arena' } });
        fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'arena_2' } });
        await next('Offers per negotiation');
        expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    });

    it('loads a saved arena, keeps its eligible kits in order and submits them with the settings', async () => {
        const onComplete = jest.fn();
        render(<FormWizard entityName="arena" entityId="2" userId="1" onComplete={onComplete} />);

        await waitFor(() => expect(screen.getByDisplayValue('arena_2')).toBeInTheDocument());

        // Walk to the Eligible kits step.
        await next('Offers per negotiation');
        await next('Pair cooldown (minutes)');
        await next('Kit choice');
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => expect(screen.getByText('Archer')).toBeInTheDocument());
        expect(screen.getByText('Knight')).toBeInTheDocument();
        expect(screen.queryByText('Missing Entity')).not.toBeInTheDocument();
        const archer = screen.getByText('Archer');
        const knight = screen.getByText('Knight');
        expect(archer.compareDocumentPosition(knight) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        await next('Fight time limit (seconds)');
        await next('Announce matches');
        await waitFor(() => expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /submit/i }));

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        const payload = onComplete.mock.calls[0][0];
        expect(payload.Key).toBe('arena_2');
        expect(payload.MaxOffers).toBe(2);
        expect(payload.FightTimeLimitSeconds).toBe(0);
        expect(payload.EligibleKits.map((k: Record<string, unknown>) => [k.KitId, k.SequenceNumber])).toEqual([[8, 0], [7, 1]]);
        expect(payload.EligibleKits[0].ArenaId).toBeUndefined();
    });
});
