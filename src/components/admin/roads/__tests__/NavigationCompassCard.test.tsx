import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CompassDraft, NavigationCompassCard, compassChangedKeys, describeCompassRule, toCompassDraft } from '../NavigationCompassCard';
import { NavigationCompassSettingsDto } from '../../../../types/dtos/road/RoadDtos';

// KNG-234: the item rule (material + display name) of the navigation compass and where it works. #26: the card
// only edits; the Road network page saves it (RoadsAdminPage.settings.test.tsx).

const defaults: NavigationCompassSettingsDto = {
    enabled: true,
    material: 'COMPASS',
    displayName: 'Navigation Compass',
    nameMatch: 'Exact',
    siegeEnabled: true,
    generalEnabled: false,
    generalTargets: '',
    updatedAt: null,
};

/** The card with the page's state around it. */
const Harness: React.FC<{ onDraft?: (draft: CompassDraft) => void }> = ({ onDraft }) => {
    const saved = toCompassDraft(defaults);
    const [draft, setDraft] = React.useState<CompassDraft>(saved);
    return (
        <NavigationCompassCard
            saved={saved}
            draft={draft}
            onEdit={change => setDraft(current => {
                const next = { ...current, ...change };
                onDraft?.(next);
                return next;
            })}
        />
    );
};

describe('NavigationCompassCard', () => {
    it('shows the saved item rule with labelled fields', () => {
        render(<Harness />);
        expect(screen.getByLabelText('Material')).toHaveValue('COMPASS');
        expect(screen.getByLabelText('Display name')).toHaveValue('Navigation Compass');
        expect(screen.getByText(/Matches a COMPASS whose name is “Navigation Compass”/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    });

    it('reports every edit and marks the changed field', () => {
        const onDraft = jest.fn();
        render(<Harness onDraft={onDraft} />);
        fireEvent.change(screen.getByLabelText('Material'), { target: { value: 'RECOVERY_COMPASS' } });
        expect(onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ material: 'RECOVERY_COMPASS' }));
        expect(screen.getByLabelText('Material')).toHaveClass('border-warning');
        expect(screen.getByLabelText('Display name')).not.toHaveClass('border-warning');
    });

    it('only lets the destinations outside sieges be edited while the compass works there', () => {
        render(<Harness />);
        const targets = screen.getByLabelText('Destinations outside sieges');
        expect(targets).toBeDisabled();
        fireEvent.click(screen.getByLabelText('Works outside sieges'));
        expect(targets).toBeEnabled();
    });

    it('says when the settings could not be loaded, and waits while loading', () => {
        const { rerender } = render(<NavigationCompassCard saved={null} draft={null} onEdit={jest.fn()} />);
        expect(screen.getByRole('status')).toHaveTextContent('Loading');
        rerender(<NavigationCompassCard saved={null} draft={null} loadError="Could not load the navigation compass settings." onEdit={jest.fn()} />);
        expect(screen.getByRole('alert')).toHaveTextContent('Could not load the navigation compass settings.');
    });

    it('counts the changed settings', () => {
        const saved = toCompassDraft(defaults);
        expect(compassChangedKeys(saved, saved)).toEqual([]);
        expect(compassChangedKeys(saved, { ...saved, material: 'X', siegeEnabled: false })).toEqual(['material', 'siegeEnabled']);
        expect(compassChangedKeys(null, saved)).toEqual([]);
    });

    it('describes an empty display name as material only', () => {
        expect(describeCompassRule({ ...defaults, displayName: ' ' })).toBe('any COMPASS (whatever its name)');
        expect(describeCompassRule({ ...defaults, nameMatch: 'Contains' })).toBe('a COMPASS whose name contains “Navigation Compass”');
    });
});
