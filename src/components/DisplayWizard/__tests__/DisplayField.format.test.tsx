import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DisplayField, formatValue } from '../DisplayField';
import { DisplayFieldDto } from '../../../types/dtos/displayConfig/DisplayModels';
import { formatDateTime } from '../../../utils/format';

// PandiO/knk-workspace#187 (X-10): the detail page showed API dates as raw ISO text. Values go through
// utils/format.ts: dates as the viewer's date and time (zone-less API dates are UTC), numbers in en-US.

const field = (overrides: Partial<DisplayFieldDto>): DisplayFieldDto => ({
    label: 'Value',
    fieldName: 'value',
    isReusable: false,
    isLinkedToSource: false,
    ...overrides,
});

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('DisplayField formatting (#187)', () => {
    it('shows a date-time field as a date and time, read as UTC', () => {
        render(<DisplayField field={field({ label: 'Created', fieldName: 'createdAt', fieldType: 'DateTime' })} data={{ createdAt: '2026-11-05T20:52:02' }} />);
        expect(screen.getByText(formatDateTime(new Date('2026-11-05T20:52:02Z')))).toBeInTheDocument();
        expect(screen.queryByText('2026-11-05T20:52:02')).not.toBeInTheDocument();
    });

    it('shows an ISO date-time without a field type (or typed String) as a date and time too', () => {
        render(<DisplayField field={field({ label: 'Updated', fieldName: 'updatedAt' })} data={{ updatedAt: '2026-11-05T20:52:02.123Z' }} />);
        expect(screen.getByText(formatDateTime('2026-11-05T20:52:02.123Z'))).toBeInTheDocument();
        expect(formatValue('2026-11-05T20:52:02', 'String')).toBe(formatDateTime('2026-11-05T20:52:02'));
    });

    it('formats a template variable holding a date', () => {
        render(<DisplayField field={field({ label: 'Since', fieldName: undefined, templateText: 'Since ${createdAt}' })} data={{ createdAt: '2026-11-05T20:52:02' }} />);
        expect(screen.getByText(`Since ${formatDateTime('2026-11-05T20:52:02')}`)).toBeInTheDocument();
    });

    it('formats numbers in en-US and leaves other text alone', () => {
        expect(formatValue(1234567, 'Integer')).toBe('1,234,567');
        expect(formatValue(1234.5, 'Decimal')).toBe('1,234.5');
        expect(formatValue('abc', 'Integer')).toBe('abc');
        expect(formatValue('Harbour', undefined)).toBe('Harbour');
        expect(formatValue('2026', 'String')).toBe('2026');
        expect(formatValue(true, undefined)).toBe('Yes');
        expect(formatValue(null, 'DateTime')).toBe('-');
        expect(formatValue('', 'String')).toBe('-');
    });
});
