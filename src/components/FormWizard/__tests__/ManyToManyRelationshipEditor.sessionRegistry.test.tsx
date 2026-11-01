import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ManyToManyRelationshipEditor } from '../ManyToManyRelationshipEditor';
import { FormStepDto } from '../../../types/dtos/forms/FormModels';
import { metadataClient } from '../../../apiClients/metadataClient';
import { getCreateFunctionForEntity } from '../../../utils/entityApiMapping';
import { FormSessionScope, FormSessionValue, useFormSession } from '../../../contexts/FormSessionContext';

/**
 * KNG-136: an entity the many-to-many step creates through its "create related" child form is
 * registered in the form session. (No button opens that modal today - see the chain report, L4-4 -
 * so the stubbed ChildFormModal below completes it directly.)
 */

jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: { getEntityMetadata: jest.fn() }
}));
jest.mock('../../../utils/entityApiMapping', () => ({
    getCreateFunctionForEntity: jest.fn(),
    getSearchFunctionForEntity: jest.fn()
}));
jest.mock('../../../hooks/useRelationshipDrafts', () => ({
    useRelationshipDrafts: () => ({ drafts: [], refresh: jest.fn() })
}));
jest.mock('../FieldRenderers', () => ({
    FieldRenderer: () => null
}));
jest.mock('../ChildFormModal', () => ({
    ChildFormModal: ({ onComplete }: { onComplete: (data: Record<string, unknown>) => Promise<void> }) => (
        <button type="button" onClick={() => onComplete({ Name: 'Old Quarter' })}>complete related form</button>
    )
}));

const step: FormStepDto = {
    id: 'step-1',
    stepName: 'Districts',
    description: '',
    order: 0,
    fieldOrderJson: '[]',
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    isManyToManyRelationship: true,
    relatedEntityPropertyName: 'Districts',
    joinEntityType: 'SiegeScenarioDistrict',
    childFormSteps: [],
    fields: [],
    conditions: []
};

const Probe: React.FC<{ sink: { session?: FormSessionValue | null } }> = ({ sink }) => {
    sink.session = useFormSession();
    return null;
};

describe('ManyToManyRelationshipEditor: created related entity joins the form session (KNG-136)', () => {
    it('registers the created entity with its type, id and field', async () => {
        (metadataClient.getEntityMetadata as jest.Mock).mockResolvedValue({
            entityName: 'SiegeScenarioDistrict',
            displayName: 'Siege scenario district',
            fields: [
                { fieldName: 'siegeScenario', fieldType: 'SiegeScenario', isNullable: false, isRelatedEntity: true, relatedEntityType: 'SiegeScenario', hasDefaultValue: false, defaultValue: null },
                { fieldName: 'district', fieldType: 'District', isNullable: false, isRelatedEntity: true, relatedEntityType: 'District', hasDefaultValue: false, defaultValue: null },
                { fieldName: 'districtId', fieldType: 'int', isNullable: false, isRelatedEntity: false, relatedEntityType: null, hasDefaultValue: false, defaultValue: null }
            ]
        });
        const create = jest.fn(async (data: Record<string, unknown>) => ({ id: 501, name: data.Name }));
        (getCreateFunctionForEntity as jest.Mock).mockImplementation(() => create);

        const sink: { session?: FormSessionValue | null } = {};
        render(
            <FormSessionScope formName="SiegeScenario">
                <Probe sink={sink} />
                <ManyToManyRelationshipEditor
                    step={step}
                    value={[]}
                    onChange={jest.fn()}
                    entityName="SiegeScenario"
                />
            </FormSessionScope>
        );

        // Metadata resolves the related type (District) before the create can run.
        await waitFor(() => expect(metadataClient.getEntityMetadata).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByText('complete related form')).toBeInTheDocument());
        await new Promise(resolve => setTimeout(resolve, 0));
        fireEvent.click(screen.getByText('complete related form'));

        await waitFor(() => expect(create).toHaveBeenCalledWith({ Name: 'Old Quarter' }));
        await waitFor(() => expect(sink.session!.createdEntities()).toHaveLength(1));
        expect(sink.session!.createdEntities()[0]).toMatchObject({
            key: 'district:501',
            entityTypeName: 'District',
            id: 501,
            origin: { formPath: ['SiegeScenario'], fieldName: 'Districts' },
            status: 'created'
        });
    });
});
