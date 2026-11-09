import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormConfigurationTable } from '../FormConfigurationTable';
import { DisplayConfigurationTable } from '../DisplayConfigurationTable';
import { SavedProgressList } from '../SavedProgressList';
import { FormConfigurationDto, FormSubmissionProgressSummaryDto } from '../../../types/dtos/forms/FormModels';
import { DisplayConfigurationDto } from '../../../types/dtos/displayConfig/DisplayModels';

// PandiO/knk-workspace#266: at 390 px the Entity setup page (/forms/{type}) was 785 px wide. The header button
// rows did not wrap (the buttons were cut off by the card) and the table head's absolutely positioned sr-only
// "Actions" label had no positioned ancestor, so it sat at the table's right edge in page coordinates and widened
// the page. jsdom does no layout: these tests pin the classes; the width itself is checked in a browser (smoke test).

const formConfig = { id: '9', entityTypeName: 'Town', configurationName: 'Default', isDefault: true, steps: [] } as unknown as FormConfigurationDto;
const displayConfig = { id: '4', entityTypeName: 'Town', name: 'Town default', isDefault: true, isDraft: false, sections: [] } as unknown as DisplayConfigurationDto;

const classesOf = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/);

const expectWrappingHeader = (createButton: HTMLElement) => {
    const buttonRow = createButton.parentElement!;
    expect(classesOf(buttonRow)).toEqual(expect.arrayContaining(['flex', 'flex-wrap']));
    const header = buttonRow.parentElement!;
    // Stacked below sm, a row from sm up.
    expect(classesOf(header)).toEqual(expect.arrayContaining(['flex', 'flex-col', 'sm:flex-row']));
};

const expectClippingScrollBox = (container: HTMLElement) => {
    const table = container.querySelector('table')!;
    const box = table.parentElement!;
    expect(classesOf(box)).toEqual(expect.arrayContaining(['relative', 'overflow-x-auto']));
    // The label that used to escape it is still there for screen readers.
    expect(box.querySelector('th .sr-only')).toHaveTextContent('Actions');
};

describe('Entity setup at phone width (#266)', () => {
    it('lets the form configuration header buttons wrap and keeps the table inside its scroll box', () => {
        const { container } = render(
            <FormConfigurationTable configurations={[formConfig]} onOpen={jest.fn()} onSetDefault={jest.fn()} onRemoveDefault={jest.fn()}
                onEdit={jest.fn()} onCreate={jest.fn()} onCreateDefault={jest.fn()} onImport={jest.fn()} />
        );
        expectWrappingHeader(screen.getByRole('button', { name: 'Create Form' }));
        expect(screen.getByRole('button', { name: 'Import / Seeds' }).parentElement).toBe(screen.getByRole('button', { name: 'Create Form' }).parentElement);
        expectClippingScrollBox(container);
    });

    it('does the same for the display configurations', () => {
        const { container } = render(
            <DisplayConfigurationTable configurations={[displayConfig]} onEdit={jest.fn()} onSetDefault={jest.fn()} onRemoveDefault={jest.fn()}
                onCreate={jest.fn()} onCreateDefault={jest.fn()} onImport={jest.fn()} />
        );
        expectWrappingHeader(screen.getByRole('button', { name: 'Create Display' }));
        expectClippingScrollBox(container);
    });

    it('stacks a saved progress row and wraps its details', () => {
        const progress = { id: '1', formConfigurationName: 'Default', status: 'InProgress', currentStepIndex: 0,
            updatedAt: '2026-11-08T10:00:00', createdAt: '2026-11-08T09:00:00' } as unknown as FormSubmissionProgressSummaryDto;
        render(<SavedProgressList progressList={[progress]} onResume={jest.fn()} onDelete={jest.fn()} />);
        const row = screen.getByRole('button', { name: /Resume/ }).parentElement!.parentElement!;
        expect(classesOf(row)).toEqual(expect.arrayContaining(['flex-col', 'sm:flex-row']));
        expect(classesOf(screen.getByText('Step 1').parentElement)).toContain('flex-wrap');
    });

    it('makes the dashboard content column the containing block of stray absolute elements', () => {
        const css = fs.readFileSync(path.join(__dirname, '../../ObjectDashboard/ObjectDashboard.css'), 'utf8');
        const rule = css.match(/\.dashboard-content\s*\{([^}]*)\}/)![1];
        expect(rule).toMatch(/position:\s*relative/);
        expect(rule).toMatch(/overflow-y:\s*auto/);
    });
});
