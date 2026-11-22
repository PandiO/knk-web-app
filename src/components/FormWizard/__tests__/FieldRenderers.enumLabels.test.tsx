import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FieldRenderer, getEnumLabels } from '../FieldRenderers';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';

// Landmark-domain #986: an Enum field's options can carry words (settingsJson.enumLabels); the value sent stays the same.
const field = (settingsJson: string): FormFieldDto => ({
    fieldName: 'AreaKind', label: 'Area', fieldType: FieldType.Enum, order: 0, isRequired: false, isReadOnly: false,
    isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, validations: [], settingsJson,
});

describe('Enum option labels', () => {
    it('shows the label and keeps the value', () => {
        render(<FieldRenderer
            field={field(JSON.stringify({ enumValues: ['None', 'OwnRegion'], enumLabels: { OwnRegion: 'Own region' } }))}
            value="OwnRegion"
            onChange={() => undefined}
        />);
        const own = screen.getByRole('option', { name: 'Own region' }) as HTMLOptionElement;
        expect(own.value).toBe('OwnRegion');
        expect(screen.getByRole('option', { name: 'None' })).toBeInTheDocument();
    });

    it('ignores labels that are not text', () => {
        expect(getEnumLabels(field(JSON.stringify({ enumLabels: { A: 'a', B: 3, C: '' } })))).toEqual({ A: 'a' });
        expect(getEnumLabels(field('not json'))).toEqual({});
    });
});
