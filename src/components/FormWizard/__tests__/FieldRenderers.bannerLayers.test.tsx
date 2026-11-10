import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FieldRenderer } from '../FieldRenderers';
import { toBannerLayers } from '../BannerLayersField';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';

jest.mock('../../PagedEntityTable/PagedEntityTable', () => ({
    PagedEntityTable: () => <div data-testid="paged-table">paged-table</div>
}));
jest.mock('../../../apiClients/bannerDesignClient', () => ({
    bannerDesignClient: { getPatternKeys: jest.fn() }
}));
import { bannerDesignClient } from '../../../apiClients/bannerDesignClient';

// CRA resets mock implementations before each test, so the offline answer is set here, not in the factory.
beforeEach(() => {
    (bannerDesignClient.getPatternKeys as jest.Mock).mockRejectedValue(new Error('offline'));
});

/**
 * PandiO/knk-workspace#232: the shield banner layers of an item blueprint, bottom to top, as one field whose
 * value is the API's layer array.
 */
const layersField = (overrides: Partial<FormFieldDto> = {}): FormFieldDto => ({
    fieldName: 'ShieldBannerLayers',
    label: 'Shield banner pattern',
    fieldType: FieldType.BannerLayers,
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    ...overrides
});

const twoLayers = [
    { patternKey: 'minecraft:stripe_top', color: 'YELLOW' },
    { patternKey: 'minecraft:border', color: 'BLACK' }
];

describe('FieldRenderer BannerLayers (#232)', () => {
    it('shows the layers in order with their pattern and colour', () => {
        render(<FieldRenderer field={layersField()} value={twoLayers} onChange={jest.fn()} />);

        expect(screen.getByRole('combobox', { name: 'Layer 1 pattern' })).toHaveValue('minecraft:stripe_top');
        expect(screen.getByRole('combobox', { name: 'Layer 1 colour' })).toHaveValue('YELLOW');
        expect(screen.getByRole('combobox', { name: 'Layer 2 pattern' })).toHaveValue('minecraft:border');
        expect(screen.getByRole('combobox', { name: 'Layer 2 colour' })).toHaveValue('BLACK');
        expect(screen.getByText(/Layer 1 is the bottom layer/)).toBeInTheDocument();
    });

    it('the untouched default is a plain shield and Add layer appends a layer', () => {
        const onChange = jest.fn();
        render(<FieldRenderer field={layersField()} value="new Collection()" onChange={onChange} />);

        expect(screen.getByText(/No pattern layers/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /add layer/i }));

        expect(onChange).toHaveBeenCalledWith([{ patternKey: 'minecraft:base', color: 'WHITE' }]);
    });

    it('changes, reorders and removes layers through onChange', () => {
        const onChange = jest.fn();
        render(<FieldRenderer field={layersField()} value={twoLayers} onChange={onChange} />);

        fireEvent.change(screen.getByRole('combobox', { name: 'Layer 2 colour' }), { target: { value: 'RED' } });
        expect(onChange).toHaveBeenLastCalledWith([twoLayers[0], { patternKey: 'minecraft:border', color: 'RED' }]);

        fireEvent.click(screen.getByRole('button', { name: /move layer 2 down/i }));
        expect(onChange).toHaveBeenLastCalledWith([twoLayers[1], twoLayers[0]]);

        fireEvent.click(screen.getByRole('button', { name: /remove layer 1/i }));
        expect(onChange).toHaveBeenLastCalledWith([twoLayers[1]]);

        expect(screen.getByRole('button', { name: /move layer 1 down/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /move layer 2 up/i })).toBeDisabled();
    });

    it('read-only shows the layers without controls', () => {
        render(<FieldRenderer field={layersField({ isReadOnly: true })} value={twoLayers} onChange={jest.fn()} />);

        expect(screen.queryByRole('button', { name: /add layer/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /remove layer/i })).not.toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Layer 1 pattern' })).toBeDisabled();
    });

    it('a pattern the bundled list does not know is still offered, so the saved value is not lost', () => {
        render(<FieldRenderer field={layersField()} value={[{ patternKey: 'minecraft:from_a_newer_version', color: 'RED' }]} onChange={jest.fn()} />);

        expect(screen.getByRole('combobox', { name: 'Layer 1 pattern' })).toHaveValue('minecraft:from_a_newer_version');
    });
});

describe('toBannerLayers', () => {
    it('keeps well-formed layers in order and drops the rest', () => {
        expect(toBannerLayers([
            { patternKey: 'minecraft:cross', color: 'white' },
            { patternKey: '', color: 'RED' },
            'junk',
            { patternKey: 'minecraft:border', color: 'BLACK' }
        ])).toEqual([{ patternKey: 'minecraft:cross', color: 'WHITE' }, { patternKey: 'minecraft:border', color: 'BLACK' }]);
        expect(toBannerLayers('new Collection()')).toEqual([]);
        expect(toBannerLayers(undefined)).toEqual([]);
    });
});
