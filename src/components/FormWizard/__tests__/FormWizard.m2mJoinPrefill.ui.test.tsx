import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { metadataClient } from '../../../apiClients/metadataClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { FormSubmissionStatus } from '../../../utils/enums';

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: {
        getByEntityTypeName: jest.fn(),
        getById: jest.fn()
    }
}));

jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: {
        getEntityMetadata: jest.fn()
    }
}));

jest.mock('../../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: {
        getById: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
    }
}));

jest.mock('../../../apiClients/fieldValidationRuleClient', () => ({
    fieldValidationRuleClient: {
        getByFormConfigurationId: jest.fn(),
        validateField: jest.fn(),
        resolvePlaceholders: jest.fn()
    }
}));

const relationship = (id: number, displayName: string) => ({
    relatedEntityId: id,
    relatedEntity: { id, displayName, key: `minecraft:${displayName.toLowerCase()}` }
});

jest.mock('../ManyToManyRelationshipEditor', () => ({
    ManyToManyRelationshipEditor: ({ value, onChange, onOpenJoinEntry }: {
        value: Record<string, unknown>[];
        onChange: (value: Record<string, unknown>[]) => void;
        onOpenJoinEntry?: (relationshipIndex: number) => void;
    }) => (
        <div>
            <div data-testid="editor-value">{JSON.stringify(value.map(r => r.relatedEntityId))}</div>
            <button type="button" data-testid="seed-relationship" onClick={() => onChange([relationship(99, 'Sharpness')])}>
                seed relationship
            </button>
            <button
                type="button"
                data-testid="seed-three"
                onClick={() => onChange([relationship(1, 'Sharpness'), relationship(2, 'Unbreaking'), relationship(3, 'Mending')])}
            >
                seed three
            </button>
            <button type="button" data-testid="remove-first" onClick={() => onChange(value.slice(1))}>
                remove first
            </button>
            <button type="button" data-testid="reverse" onClick={() => onChange([...value].reverse())}>
                reverse
            </button>
            <button type="button" data-testid="open-join-entry" onClick={() => onOpenJoinEntry?.(0)}>
                open join entry
            </button>
        </div>
    )
}));

jest.mock('../JoinEntityFormModal', () => ({
    JoinEntityFormModal: ({ open, initialFieldValues }: { open: boolean; initialFieldValues?: Record<string, unknown> }) => (
        <div data-testid="join-modal">
            <div data-testid="join-modal-open">{open ? 'open' : 'closed'}</div>
            <div data-testid="join-modal-initial-values">{JSON.stringify(initialFieldValues ?? {})}</div>
        </div>
    )
}));

// Authored M2M steps carry a List field named after relatedEntityPropertyName (knk-workspace
// docs/specs/*/PHASE_*_FORMCONFIGS.md); FormWizard adds that field itself when a step lacks it.
const CARRIER_FIELD = {
    id: '111', fieldName: 'DefaultEnchantments', label: 'Default Enchantments', fieldType: 'List',
    objectType: 'ItemBlueprintDefaultEnchantment', isRequired: false, isReadOnly: false, order: 0
};

const itemBlueprintConfig = (fields: Record<string, unknown>[]) => ({
    id: '5',
    entityTypeName: 'ItemBlueprint',
    configurationName: 'ItemBlueprint Default',
    description: '',
    isDefault: true,
    isActive: true,
    steps: [
        {
            id: '11',
            stepName: 'Default Enchantments',
            description: '',
            order: 0,
            fieldOrderJson: '[]',
            isReusable: false,
            isLinkedToSource: false,
            hasCompatibilityIssues: false,
            isManyToManyRelationship: true,
            relatedEntityPropertyName: 'DefaultEnchantments',
            joinEntityType: 'ItemBlueprintDefaultEnchantment',
            subConfigurationId: '6',
            childFormSteps: [],
            fields,
            conditions: []
        }
    ]
});

const STEP_SHAPES: Array<[string, Record<string, unknown>[]]> = [
    ['an authored carrier field', [CARRIER_FIELD]],
    ['no carrier field', []]
];

describe('FormWizard M2M join-entry prefill UI', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.create as jest.Mock).mockResolvedValue({
            id: 'progress-1',
            formConfigurationId: '5',
            currentStepIndex: 0,
            status: FormSubmissionStatus.InProgress
        });

        (metadataClient.getEntityMetadata as jest.Mock).mockImplementation(async (entityName: string) => {
            if (entityName === 'ItemBlueprintDefaultEnchantment') {
                return {
                    entityName: 'ItemBlueprintDefaultEnchantment',
                    displayName: 'ItemBlueprintDefaultEnchantment',
                    fields: [
                        { fieldName: 'ItemBlueprintId', isRelatedEntity: true, relatedEntityType: 'ItemBlueprint', fieldType: 'Integer', isNullable: false, hasDefaultValue: false },
                        { fieldName: 'ItemBlueprint', isRelatedEntity: true, relatedEntityType: 'ItemBlueprint', fieldType: 'Object', isNullable: true, hasDefaultValue: false },
                        { fieldName: 'EnchantmentDefinitionId', isRelatedEntity: true, relatedEntityType: 'EnchantmentDefinition', fieldType: 'Integer', isNullable: false, hasDefaultValue: false },
                        { fieldName: 'EnchantmentDefinition', isRelatedEntity: true, relatedEntityType: 'EnchantmentDefinition', fieldType: 'Object', isNullable: true, hasDefaultValue: false }
                    ]
                };
            }

            return {
                entityName: 'ItemBlueprint',
                displayName: 'ItemBlueprint',
                fields: []
            };
        });
    });

    const renderWizard = async () => {
        render(
            <FormWizard
                entityName="ItemBlueprint"
                userId="1"
                onComplete={() => {}}
            />
        );

        await waitFor(() => {
            expect(screen.queryByTestId('seed-relationship')).not.toBeNull();
        });
    };

    it.each(STEP_SHAPES)('prefills join modal with related entity id and unsaved parent placeholder id (step with %s)', async (_shape, fields) => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(itemBlueprintConfig(fields));
        await renderWizard();

        fireEvent.click(screen.getByTestId('seed-relationship'));
        fireEvent.click(screen.getByTestId('open-join-entry'));

        await waitFor(() => {
            expect((formSubmissionClient.create as jest.Mock).mock.calls.length).toBeGreaterThan(0);
        });

        await waitFor(() => {
            expect(screen.getByTestId('join-modal-open').textContent).toBe('open');
        });

        const initialValuesText = screen.getByTestId('join-modal-initial-values').textContent || '';
        const parsed = JSON.parse(initialValuesText);

        expect(parsed.ItemBlueprintId).toBe(-1);
        expect(parsed.EnchantmentDefinitionId).toBe(99);
    });

    it('keeps added, removed and reordered relationships on a step without a carrier field, through to the saved draft', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(itemBlueprintConfig([]));
        await renderWizard();

        fireEvent.click(screen.getByTestId('seed-three'));
        expect(screen.getByTestId('editor-value').textContent).toBe('[1,2,3]');

        fireEvent.click(screen.getByTestId('remove-first'));
        expect(screen.getByTestId('editor-value').textContent).toBe('[2,3]');

        fireEvent.click(screen.getByTestId('reverse'));
        expect(screen.getByTestId('editor-value').textContent).toBe('[3,2]');

        // Opening a join entry saves a draft of the parent form - the relationships must be in it.
        fireEvent.click(screen.getByTestId('open-join-entry'));
        await waitFor(() => {
            expect((formSubmissionClient.create as jest.Mock).mock.calls.length).toBeGreaterThan(0);
        });

        const draft = (formSubmissionClient.create as jest.Mock).mock.calls[0][0] as { currentStepDataJson: string };
        const saved = JSON.parse(draft.currentStepDataJson) as Record<string, Array<{ relatedEntityId: number }>>;
        expect(saved.DefaultEnchantments.map(r => r.relatedEntityId)).toEqual([3, 2]);
    });
});
