import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DisplayWizard } from '../DisplayWizard';

/** #81: a page header given by the page replaces the heading with the display configuration's name. */

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock('../hooks/useDisplayConfig', () => ({
    useDisplayConfig: () => ({
        config: { name: 'Town display (seed)', description: 'What a town shows.', sections: [], sectionOrderJson: null },
        loading: false,
        error: null,
    }),
}));
jest.mock('../hooks/useEntityData', () => ({
    useEntityData: () => ({ data: { id: 4, name: 'Cinix' }, loading: false, error: null, refetch: jest.fn() }),
}));

describe('DisplayWizard header (#81)', () => {
    beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
    afterEach(() => (console.log as jest.Mock).mockRestore());

    it('renders the page header with the loaded entity instead of the configuration name', () => {
        render(
            <DisplayWizard
                entityTypeName="Town"
                entityId={4}
                renderHeader={entity => <h2>{String(entity.name)}</h2>}
            />
        );

        expect(screen.getByRole('heading', { name: 'Cinix' })).toBeInTheDocument();
        expect(screen.queryByText('Town display (seed)')).not.toBeInTheDocument();
        expect(screen.getByText('What a town shows.')).toBeInTheDocument();
    });

    it('keeps the configuration name without a page header', () => {
        render(<DisplayWizard entityTypeName="Town" entityId={4} />);
        expect(screen.getByRole('heading', { name: 'Town display (seed)' })).toBeInTheDocument();
    });
});
