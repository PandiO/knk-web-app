import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WizardStepProgress, WizardStepTitle } from '../WizardStepHeader';

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
