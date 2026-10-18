import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { compactStepLabel, stepStripOverflow, WizardStepProgress, WizardStepTitle } from '../WizardStepHeader';

describe('WizardStepProgress (KNG-137)', () => {
    const steps = [
        { key: 'a', name: 'Basics', isDone: true, isCurrent: false },
        { key: 'b', name: 'Geometry and reference points of the gate door', isDone: false, isCurrent: true },
        { key: 'c', name: 'Review', isDone: false, isCurrent: false }
    ];

    it('shows each step name next to its number, full name on hover', () => {
        render(<WizardStepProgress steps={steps} />);

        const items = within(screen.getByRole('list', { name: 'Form steps' })).getAllByRole('listitem');
        expect(items).toHaveLength(3);
        expect(within(items[0]).getByText('Basics')).toBeInTheDocument();
        expect(items[1]).toHaveAttribute('title', 'Geometry and reference points of the gate door');
        expect(within(items[1]).getByText('2')).toBeInTheDocument();
        expect(within(items[2]).getByText('3')).toBeInTheDocument();
    });

    it('truncates long names and hides them on narrow screens (numbers only)', () => {
        render(<WizardStepProgress steps={steps} />);

        const name = screen.getByText('Geometry and reference points of the gate door');
        expect(name).toHaveClass('truncate', 'hidden', 'md:block');
    });

    it('marks the current step and labels every step for screen readers', () => {
        render(<WizardStepProgress steps={steps} />);

        const items = screen.getAllByRole('listitem');
        expect(items[1]).toHaveAttribute('aria-current', 'step');
        expect(items[0]).not.toHaveAttribute('aria-current');
        expect(items[2]).toHaveAttribute('aria-label', 'Step 3: Review');
    });

    it('shows just the number for a step without a name', () => {
        render(<WizardStepProgress steps={[{ key: 1, name: '  ', isDone: false, isCurrent: true }]} />);

        const item = screen.getByRole('listitem');
        expect(item).not.toHaveAttribute('title');
        expect(item).toHaveAttribute('aria-label', 'Step 1');
        expect(screen.queryByTestId('wizard-step-name')).toBeNull();
    });
});

describe('WizardStepProgress with many steps (KNG-168)', () => {
    const names = ['Basics', 'Gate', 'Anchor', 'Hinge', 'Rotation', 'Geometry', 'Blocks', 'Region', 'Review'];
    const manySteps = names.map((name, index) => ({
        key: index,
        name,
        isDone: index < 2,
        isCurrent: index === 2
    }));

    it('shows a compact "Step x of n · name" header with a progress bar for narrow screens', () => {
        render(<WizardStepProgress steps={manySteps} />);

        const compact = screen.getByTestId('wizard-step-compact');
        expect(compact).toHaveClass('sm:hidden');
        expect(within(compact).getByText('Step 3 of 9 · Anchor')).toBeInTheDocument();
        const bar = within(compact).getByRole('progressbar');
        expect(bar).toHaveAttribute('aria-valuenow', '3');
        expect(bar).toHaveAttribute('aria-valuemax', '9');
        // The circles are for sm and up only; every step is still listed.
        expect(screen.getByTestId('wizard-step-circles')).toHaveClass('hidden', 'sm:block');
        expect(within(screen.getByRole('list', { name: 'Form steps' })).getAllByRole('listitem')).toHaveLength(9);
    });

    it('lists every step under the compact header when its label is pressed, and hides them again', () => {
        render(<WizardStepProgress steps={manySteps} />);

        const toggle = within(screen.getByTestId('wizard-step-compact')).getByRole('button', { name: /Step 3 of 9 · Anchor/ });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('list', { name: 'All form steps' })).not.toBeInTheDocument();

        fireEvent.click(toggle);

        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const items = within(screen.getByRole('list', { name: 'All form steps' })).getAllByRole('listitem');
        expect(items.map(item => item.textContent)).toEqual(['Basics', 'Gate', '3Anchor', '4Hinge', '5Rotation', '6Geometry', '7Blocks', '8Region', '9Review']);
        expect(items[2]).toHaveAttribute('aria-current', 'step');
        expect(within(items[0]).getByLabelText('done')).toBeInTheDocument();

        fireEvent.click(toggle);
        expect(screen.queryByRole('list', { name: 'All form steps' })).not.toBeInTheDocument();
    });

    it('closes the compact step list when the step changes', () => {
        const { rerender } = render(<WizardStepProgress steps={manySteps} />);
        fireEvent.click(within(screen.getByTestId('wizard-step-compact')).getByRole('button'));
        expect(screen.getByRole('list', { name: 'All form steps' })).toBeInTheDocument();

        rerender(<WizardStepProgress steps={manySteps.map((step, index) => ({ ...step, isDone: index < 3, isCurrent: index === 3 }))} />);

        expect(screen.queryByRole('list', { name: 'All form steps' })).not.toBeInTheDocument();
    });

    it('leaves out the name in the compact header for a step without one', () => {
        expect(compactStepLabel([
            { key: 1, name: 'Basics', isDone: true, isCurrent: false },
            { key: 2, name: ' ', isDone: false, isCurrent: true }
        ])).toBe('Step 2 of 2');
        expect(compactStepLabel([])).toBe('');
    });

    it('shows no scroll buttons when nothing overflows', () => {
        render(<WizardStepProgress steps={manySteps} />);

        expect(screen.queryByRole('button', { name: 'Show earlier steps' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Show later steps' })).toBeNull();
    });

    it('works out which sides hide steps from the scroll metrics', () => {
        expect(stepStripOverflow({ scrollLeft: 0, scrollWidth: 600, clientWidth: 600 })).toEqual({ left: false, right: false });
        expect(stepStripOverflow({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 })).toEqual({ left: false, right: false });
        expect(stepStripOverflow({ scrollLeft: 0, scrollWidth: 1200, clientWidth: 600 })).toEqual({ left: false, right: true });
        expect(stepStripOverflow({ scrollLeft: 300, scrollWidth: 1200, clientWidth: 600 })).toEqual({ left: true, right: true });
        expect(stepStripOverflow({ scrollLeft: 600, scrollWidth: 1200, clientWidth: 600 })).toEqual({ left: true, right: false });
        // Sub-pixel rounding at the ends doesn't count as hidden steps.
        expect(stepStripOverflow({ scrollLeft: 599.5, scrollWidth: 1200, clientWidth: 600 })).toEqual({ left: true, right: false });
        expect(stepStripOverflow({ scrollLeft: 0, scrollWidth: 601, clientWidth: 600 })).toEqual({ left: false, right: false });
    });

    it('shows the scroll buttons on the sides that hide steps', () => {
        const metrics = { scrollLeft: 300, scrollWidth: 1200, clientWidth: 600 };
        const spies = (Object.keys(metrics) as (keyof typeof metrics)[]).map(prop =>
            jest.spyOn(HTMLElement.prototype, prop, 'get').mockImplementation(function (this: HTMLElement) {
                return this.dataset.testid === 'wizard-step-strip' ? metrics[prop] : 0;
            })
        );
        try {
            render(<WizardStepProgress steps={manySteps} />);

            expect(screen.getByRole('button', { name: 'Show earlier steps' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Show later steps' })).toBeInTheDocument();
        } finally {
            spies.forEach(spy => spy.mockRestore());
        }
    });
});

describe('WizardStepTitle (KNG-137)', () => {
    it('shows the step name as the title in create mode', () => {
        render(<WizardStepTitle stepName="Basics" description="Name and town" />);

        expect(screen.getByRole('heading', { name: 'Basics' })).toBeInTheDocument();
        expect(screen.getByText('Name and town')).toBeInTheDocument();
        expect(screen.queryByText(/^Edit /)).toBeNull();
    });

    it('keeps the step name as the title in edit mode, with "Edit {entity}" as a small heading', () => {
        render(<WizardStepTitle stepName="Basics" editingEntityName="GateStructure" />);

        expect(screen.getByRole('heading', { name: 'Basics' })).toBeInTheDocument();
        expect(screen.getByText('Edit GateStructure')).toBeInTheDocument();
    });

    it('falls back to "Edit {entity}" as the title when the step has no name', () => {
        render(<WizardStepTitle stepName="" editingEntityName="Street" />);

        expect(screen.getByRole('heading', { name: 'Edit Street' })).toBeInTheDocument();
    });
});
