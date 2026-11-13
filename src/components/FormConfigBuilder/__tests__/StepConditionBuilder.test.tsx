import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { StepConditionBuilder } from '../StepConditionBuilder';
import { FormFieldDto, StepConditionDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';
import { SourceFieldOption } from '../../../utils/forms/displayConditionSources';

// PandiO/knk-workspace#88: step conditions are authored in the step editor, as rows over the step's fields.

const field = (fieldName: string, label: string, fieldType: FieldType = FieldType.String): FormFieldDto => ({
    id: fieldName,
    fieldGuid: `guid-${fieldName}`,
    fieldName,
    label,
    fieldType,
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: []
});

const STEP_FIELDS = [
    field('AllowEntry', 'Allow entry', FieldType.Boolean),
    field('Weight', 'Weight', FieldType.Integer),
    field('Notes', 'Notes')
];
const EARLIER: SourceFieldOption[] = [
    { field: field('Name', 'Name'), stepName: 'Basics', stepIndex: 0, fieldIndex: 0 }
];

const Harness: React.FC<{ initial?: StepConditionDto[]; onChange?: (c: StepConditionDto[]) => void }> = ({ initial = [], onChange }) => {
    const [conditions, setConditions] = useState(initial);
    return (
        <StepConditionBuilder
            stepLabel={'Step "Region and access"'}
            conditions={conditions}
            stepFields={STEP_FIELDS}
            earlierFields={EARLIER}
            metadataFields={[]}
            onChange={next => { setConditions(next); onChange?.(next); }}
        />
    );
};

const last = (spy: jest.Mock): StepConditionDto[] => spy.mock.calls[spy.mock.calls.length - 1][0];

describe('StepConditionBuilder (#88)', () => {
    it('builds the acceptance condition: Allow entry / is / ticked, with a message', () => {
        const onChange = jest.fn();
        render(<Harness onChange={onChange} />);
        expect(screen.getByTestId('step-condition-count')).toHaveTextContent('No conditions');

        fireEvent.click(screen.getByRole('button', { name: /add condition/i }));
        expect(screen.getByLabelText('Condition 1: when')).toHaveValue('Completion');
        expect(screen.getByLabelText('Condition 1 rule 1: field')).toHaveValue('AllowEntry');
        expect(screen.getByLabelText('Condition 1 rule 1: value')).toBeChecked();

        // No message yet: said inline (Publish refuses it, see FormConfigBuilder).
        expect(screen.getByText(/add a message/i)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/^message/i), { target: { value: 'Allow entry before you continue.' } });
        expect(screen.queryByText(/add a message/i)).not.toBeInTheDocument();

        expect(last(onChange)).toEqual([{
            conditionType: 'Completion',
            conditionJson: '{"conditions":[{"fieldName":"AllowEntry","operator":"Equals","value":true}],"logic":"AND"}',
            errorMessage: 'Allow entry before you continue.',
            isActive: true
        }]);
        expect(screen.getByTestId('step-condition-summary-0')).toHaveTextContent('Allow entry is ticked');
    });

    it('keeps a Boolean value a boolean and a number a number', () => {
        const onChange = jest.fn();
        render(<Harness onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: /add condition/i }));

        fireEvent.click(screen.getByLabelText('Condition 1 rule 1: value'));
        expect(JSON.parse(last(onChange)[0].conditionJson).conditions[0].value).toBe(false);

        fireEvent.change(screen.getByLabelText('Condition 1 rule 1: field'), { target: { value: 'Weight' } });
        fireEvent.change(screen.getByLabelText('Condition 1 rule 1: operator'), { target: { value: 'GreaterThan' } });
        fireEvent.change(screen.getByLabelText('Condition 1 rule 1: value'), { target: { value: '5' } });
        expect(JSON.parse(last(onChange)[0].conditionJson).conditions[0]).toEqual({ fieldName: 'Weight', operator: 'GreaterThan', value: 5 });
    });

    it('offers only the operators the wizard evaluates, and no value for is empty / is not empty', () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole('button', { name: /add condition/i }));
        const operators = within(screen.getByLabelText('Condition 1 rule 1: operator')).getAllByRole('option').map(o => (o as HTMLOptionElement).value);
        expect(operators).toEqual(['Equals', 'NotEquals', 'GreaterThan', 'LessThan', 'Contains', 'IsEmpty', 'IsNotEmpty']);

        fireEvent.change(screen.getByLabelText('Condition 1 rule 1: operator'), { target: { value: 'IsNotEmpty' } });
        expect(screen.queryByLabelText('Condition 1 rule 1: value')).not.toBeInTheDocument();
        expect(screen.getByText(/no value needed/i)).toBeInTheDocument();
    });

    it('writes an Entry condition over a field from an earlier step, with all / any for two rules', () => {
        const onChange = jest.fn();
        render(<Harness onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: /add condition/i }));
        fireEvent.change(screen.getByLabelText('Condition 1: when'), { target: { value: 'Entry' } });
        expect(screen.queryByLabelText(/match all or any/i)).not.toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Condition 1 rule 1: from an earlier step'));
        expect(screen.getByLabelText('Condition 1 rule 1: field')).toHaveValue('Name');
        fireEvent.change(screen.getByLabelText('Condition 1 rule 1: operator'), { target: { value: 'IsNotEmpty' } });

        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        // A new rule of an Entry condition reads an earlier step by default.
        expect(screen.getByLabelText('Condition 1 rule 2: from an earlier step')).toBeChecked();
        fireEvent.change(screen.getByLabelText(/match all or any/i), { target: { value: 'OR' } });

        const stored = last(onChange)[0];
        expect(stored.conditionType).toBe('Entry');
        expect(JSON.parse(stored.conditionJson)).toEqual({
            conditions: [
                { fieldName: 'Name', operator: 'IsNotEmpty', fromPreviousStep: true },
                { fieldName: 'Name', operator: 'Equals', value: null, fromPreviousStep: true }
            ],
            logic: 'OR'
        });
        // An Entry condition needs no message.
        expect(screen.queryByText(/add a message/i)).not.toBeInTheDocument();
    });

    it('shows stored conditions as the same rows, with the count and the switched-off one', () => {
        const stored: StepConditionDto[] = [
            {
                id: '4', conditionType: 'Completion', errorMessage: 'Allow entry before you continue.', isActive: true,
                conditionJson: '{"conditions":[{"fieldName":"AllowEntry","operator":"Equals","value":true}],"logic":"AND"}'
            },
            {
                id: '5', conditionType: 'Entry', errorMessage: '', isActive: false,
                conditionJson: '{"conditions":[{"fieldName":"Name","operator":"IsNotEmpty","fromPreviousStep":true}],"logic":"AND"}'
            }
        ];
        const onChange = jest.fn();
        render(<Harness initial={stored} onChange={onChange} />);

        expect(screen.getByTestId('step-condition-count')).toHaveTextContent('2 conditions, 1 off');
        expect(screen.getByLabelText('Condition 1 rule 1: field')).toHaveValue('AllowEntry');
        expect(screen.getByLabelText('Condition 1 rule 1: value')).toBeChecked();
        expect(screen.getByLabelText('Condition 2: when')).toHaveValue('Entry');
        expect(screen.getByLabelText('Condition 2 rule 1: from an earlier step')).toBeChecked();
        expect(screen.getByLabelText('Condition 2: active')).not.toBeChecked();
        expect(screen.getByTestId('step-condition-summary-1')).toHaveTextContent('Name (earlier step) is not empty');

        // Switching it on changes only the flag; the id and the JSON stay.
        fireEvent.click(screen.getByLabelText('Condition 2: active'));
        expect(last(onChange)[1]).toEqual({ ...stored[1], isActive: true });
        expect(screen.getByTestId('step-condition-count')).toHaveTextContent('2 conditions');
    });

    it('flags a rule whose field is no longer on the step, keeping the stored name', () => {
        render(<Harness initial={[{
            conditionType: 'Completion', errorMessage: 'x', isActive: true,
            conditionJson: '{"conditions":[{"fieldName":"OldName","operator":"Equals","value":"a"}],"logic":"AND"}'
        }]} />);

        const picker = screen.getByLabelText('Condition 1 rule 1: field');
        expect(picker).toHaveValue('OldName');
        expect(picker).toHaveAttribute('aria-invalid', 'true');
        expect(picker.className).toMatch(/border-danger/);
        expect(screen.getByText(/"OldName" is no longer on this step/)).toBeInTheDocument();
    });

    it('shows JSON that is not the rule shape as text and leaves it unchanged', () => {
        const handWritten = '{"anyOf":[{"field":"AllowEntry","eq":true}]}';
        const onChange = jest.fn();
        render(<Harness initial={[{ conditionType: 'Completion', errorMessage: 'x', isActive: true, conditionJson: handWritten }]} onChange={onChange} />);

        expect(screen.getByLabelText(/condition json/i)).toHaveValue(handWritten);
        expect(screen.getByText(/not made with the rule editor/i)).toBeInTheDocument();
        expect(screen.queryByLabelText('Condition 1 rule 1: field')).not.toBeInTheDocument();

        // Another edit to the condition keeps the JSON as it was.
        fireEvent.change(screen.getByLabelText(/^message/i), { target: { value: 'New message' } });
        expect(last(onChange)[0].conditionJson).toBe(handWritten);
    });

    it('removes a rule and a condition', () => {
        const onChange = jest.fn();
        render(<Harness onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: /add condition/i }));
        fireEvent.click(screen.getByRole('button', { name: /remove condition 1 rule 1/i }));
        expect(JSON.parse(last(onChange)[0].conditionJson).conditions).toEqual([]);
        fireEvent.click(screen.getByRole('button', { name: /^remove condition 1$/i }));
        expect(last(onChange)).toEqual([]);
    });
});
