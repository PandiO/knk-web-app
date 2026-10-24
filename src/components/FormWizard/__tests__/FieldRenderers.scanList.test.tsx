import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FieldRenderer } from '../FieldRenderers';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';

jest.mock('../../PagedEntityTable/PagedEntityTable', () => ({
    PagedEntityTable: () => <div data-testid="paged-table">paged-table</div>
}));

/**
 * KNG-268: a gate's block scan list is filled by the scan only. It showed a picker over all
 * snapshots ("Failed to load data", they have no search) and one card per scanned block.
 */
const scanField = (overrides: Partial<FormFieldDto> = {}): FormFieldDto => ({
    fieldName: 'OpenedBlockSnapshots',
    label: 'Open-door scan',
    fieldType: FieldType.List,
    elementType: FieldType.Object,
    objectType: 'GateOpenedBlockSnapshot',
    isRequired: false,
    isReadOnly: false,
    canCreate: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    settingsJson: JSON.stringify({ worldTask: { enabled: true, taskType: 'GateOpenedBlockScan' } }),
    ...overrides
});

describe('FieldRenderer: gate block scan list (KNG-268)', () => {
    it('shows how many blocks were scanned, without a picker or a card per block', () => {
        const scanned = Array.from({ length: 24 }, (_, i) => ({ id: 138 + i }));
        render(<FieldRenderer field={scanField()} value={scanned} onChange={jest.fn()} onWorldTaskAction={jest.fn()} />);

        expect(screen.getByText('24 blocks scanned.')).toBeInTheDocument();
        expect(screen.queryByTestId('paged-table')).not.toBeInTheDocument();
        expect(screen.queryByText(/selected \(24\)/i)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /re-scan in minecraft/i })).toBeInTheDocument();
    });

    it('says when nothing has been scanned yet', () => {
        render(<FieldRenderer field={scanField()} value={[]} onChange={jest.fn()} onWorldTaskAction={jest.fn()} />);

        expect(screen.getByText('Not scanned yet.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^scan in minecraft/i })).toBeInTheDocument();
    });

    it('keeps the picker for an ordinary object list', () => {
        render(<FieldRenderer field={scanField({ settingsJson: undefined, objectType: 'GateDoor' })} value={[]} onChange={jest.fn()} />);

        expect(screen.getByTestId('paged-table')).toBeInTheDocument();
    });
});
