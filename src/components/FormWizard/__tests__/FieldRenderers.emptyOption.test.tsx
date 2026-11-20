import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { emptyOptionText, FieldRenderer } from '../FieldRenderers';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';

// PandiO/knk-workspace#852: a dropdown's empty option can be named in settingsJson.emptyOptionLabel, as the
// permission group's "Default route mode" does ("None (default: preferred)"); picking it sends "".

const routeModeField = (overrides: Partial<FormFieldDto> = {}): FormFieldDto => ({
    fieldName: 'DefaultRouteMode',
    label: 'Default route mode',
    fieldType: FieldType.String,
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    settingsJson: JSON.stringify({ enumValues: ['shortest', 'efficient', 'preferred'], emptyOptionLabel: 'None (default: preferred)' }),
    ...overrides
});

describe('dropdown empty option (#852)', () => {
    it('names the empty option from emptyOptionLabel and lists the three modes', () => {
        render(<FieldRenderer field={routeModeField()} value={null} onChange={jest.fn()} />);

        const select = screen.getByRole('combobox', { name: 'Default route mode' });
        expect(select).toHaveValue('');
        expect(Array.from((select as HTMLSelectElement).options).map(o => [o.value, o.text])).toEqual([
            ['', 'None (default: preferred)'],
            ['shortest', 'shortest'],
            ['efficient', 'efficient'],
            ['preferred', 'preferred'],
        ]);
    });

    it('shows the stored mode and sends "" for None', () => {
        const onChange = jest.fn();
        render(<FieldRenderer field={routeModeField()} value="efficient" onChange={onChange} />);

        const select = screen.getByRole('combobox', { name: 'Default route mode' });
        expect(select).toHaveValue('efficient');
        fireEvent.change(select, { target: { value: '' } });
        expect(onChange).toHaveBeenCalledWith('');
    });

    it('works for an Enum field too', () => {
        render(<FieldRenderer field={routeModeField({ fieldType: FieldType.Enum })} value={null} onChange={jest.fn()} />);

        expect(screen.getByRole('option', { name: 'None (default: preferred)' })).toHaveValue('');
    });

    it.each([
        ['no settings', undefined],
        ['no label', JSON.stringify({ enumValues: ['a'] })],
        ['a blank label', JSON.stringify({ enumValues: ['a'], emptyOptionLabel: '  ' })],
        ['a label that is not text', JSON.stringify({ enumValues: ['a'], emptyOptionLabel: 3 })],
        ['settings that are not JSON', 'a,b'],
    ])('falls back to "Select <label>" with %s', (_case, settingsJson) => {
        expect(emptyOptionText(routeModeField({ settingsJson }))).toBe('Select Default route mode');
    });
});
