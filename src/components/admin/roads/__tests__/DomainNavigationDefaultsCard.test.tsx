import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
    DomainNavigationDefaultsCard, NavigationDefaultDraft, navigationDefaultChanges, toNavigationDefaultDrafts,
} from '../DomainNavigationDefaultsCard';
import { DomainNavigationDefaultDto } from '../../../../types/dtos/road/RoadDtos';

// KNG-73: where /navigate <domain> leads without spawn/region, per domain type; rev. 7 Part C (KNG-92):
// whether each type's entry rule keeps routes off its roads. #26: a choice is a draft the page saves with its
// header (RoadsAdminPage.settings.test.tsx).

const defaults: DomainNavigationDefaultDto[] = [
    { domainType: 'Town', defaultMode: 'Spawn', overrideCount: 0, roadAccess: 'Applies', roadAccessOverrideCount: 0 },
    { domainType: 'District', defaultMode: 'Spawn', overrideCount: 2, roadAccess: 'Applies', roadAccessOverrideCount: 0 },
    { domainType: 'Structure', defaultMode: 'Spawn', overrideCount: 0, roadAccess: 'Ignored', roadAccessOverrideCount: 3 },
    { domainType: 'GateStructure', defaultMode: 'Region', overrideCount: 0, roadAccess: 'Applies', roadAccessOverrideCount: 0 },
];

const Harness: React.FC = () => {
    const [drafts, setDrafts] = React.useState<Record<string, NavigationDefaultDraft>>(() => toNavigationDefaultDrafts(defaults));
    return (
        <DomainNavigationDefaultsCard
            saved={defaults}
            drafts={drafts}
            onEdit={(type, change) => setDrafts(current => ({ ...current, [type]: { ...current[type], ...change } }))}
        />
    );
};

describe('DomainNavigationDefaultsCard', () => {
    it('lists every domain type with its default and override count', () => {
        render(<Harness />);
        expect(screen.getByLabelText('Towns navigation default')).toHaveValue('Spawn');
        expect(screen.getByLabelText('Gates navigation default')).toHaveValue('Region');
        expect(screen.getByText('Districts').closest('tr')).toHaveTextContent('2');
    });

    it('lists each type\'s entry rule on roads and its override count', () => {
        render(<Harness />);
        expect(screen.getByLabelText('Structures entry rule on roads')).toHaveValue('Ignored');
        expect(screen.getByLabelText('Towns entry rule on roads')).toHaveValue('Applies');
        expect(screen.getByText('Structures').closest('tr')).toHaveTextContent('3');
    });

    it('keeps a changed choice as a draft, marked, with its explanation', () => {
        render(<Harness />);
        const select = screen.getByLabelText('Districts navigation default');
        fireEvent.change(select, { target: { value: 'Region' } });
        expect(select).toHaveValue('Region');
        expect(select).toHaveClass('border-warning');
        expect(screen.getByText('Districts').closest('tr')).toHaveTextContent(/nearest edge of its region/);
        expect(screen.getByLabelText('Towns navigation default')).not.toHaveClass('border-warning');
    });

    it('explains both override counts with an (i)', () => {
        render(<Harness />);
        expect(screen.getByLabelText(/own "Navigation Default Override"/)).toHaveAttribute('title');
        expect(screen.getByLabelText(/own "Road Access Override"/)).toHaveAttribute('title');
    });

    it('says so when the defaults cannot be loaded', () => {
        render(<DomainNavigationDefaultsCard saved={null} drafts={{}} loadError="Could not load the navigation defaults." onEdit={jest.fn()} />);
        expect(screen.getByRole('alert')).toHaveTextContent('Could not load the navigation defaults.');
    });

    it('sends only the changed field of each changed type', () => {
        const drafts = toNavigationDefaultDrafts(defaults);
        expect(navigationDefaultChanges(defaults, drafts)).toEqual([]);
        drafts.Town = { ...drafts.Town, roadAccess: 'Ignored' };
        drafts.District = { defaultMode: 'Region', roadAccess: 'Ignored' };
        expect(navigationDefaultChanges(defaults, drafts)).toEqual([
            { domainType: 'Town', update: { roadAccess: 'Ignored' }, count: 1 },
            { domainType: 'District', update: { defaultMode: 'Region', roadAccess: 'Ignored' }, count: 2 },
        ]);
        expect(navigationDefaultChanges(null, drafts)).toEqual([]);
    });
});
