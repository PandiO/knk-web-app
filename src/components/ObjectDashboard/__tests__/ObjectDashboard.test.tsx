import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ObjectDashboard, { getEntityNamesWithPublishedDefaultDisplay } from '../ObjectDashboard';
import { displayConfigClient } from '../../../apiClients/displayConfigClient';
import { DisplayConfigurationDto } from '../../../types/dtos/displayConfig/DisplayModels';
import { logging } from '../../../utils';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock('../../../apiClients/displayConfigClient', () => ({
    displayConfigClient: { getAll: jest.fn() },
}));

jest.mock('../../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => ({
        baseMetadata: [
            { entityName: 'Town', displayName: 'Town', fields: [] },
            { entityName: 'Street', displayName: 'Street', fields: [] },
            { entityName: 'District', displayName: 'District', fields: [] },
            { entityName: 'Category', displayName: 'Category', fields: [] },
        ],
        loading: false,
    }),
}));

jest.mock('../../PagedEntityTable/PagedEntityTable', () => ({
    PagedEntityTable: ({ entityTypeName }: { entityTypeName: string }) => <div data-testid="table">{entityTypeName}</div>,
}));

const getAll = displayConfigClient.getAll as jest.Mock;

const config = (entityTypeName: string, isDefault: boolean, isDraft: boolean): DisplayConfigurationDto => ({
    name: `${entityTypeName} display`,
    entityTypeName,
    isDefault,
    isDraft,
    sections: [],
});

const itemLabels = (container: HTMLElement) =>
    within(container).queryAllByRole('listitem').map(item => item.textContent?.trim());

describe('ObjectDashboard entity navigator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
    });

    it('keeps only published default configurations', () => {
        const names = getEntityNamesWithPublishedDefaultDisplay([
            config('Town', true, false),
            config('Street', true, true),
            config('District', false, false),
        ]);

        expect(Array.from(names)).toEqual(['town']);
    });

    it('loads display configurations once and groups entities by published default', async () => {
        getAll.mockResolvedValue([
            config('town', true, false),
            config('Street', true, true),
            config('District', false, false),
        ]);

        render(<ObjectDashboard objectTypes={[]} />);

        const entities = await screen.findByRole('region', { name: 'Entities' });
        expect(itemLabels(entities)).toEqual(['Town']);
        // Town is selected by default (first metadata entry), so the collapsed group stays closed.
        const toggle = screen.getByRole('button', { name: 'Without display configuration (3)' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        expect(getAll).toHaveBeenCalledTimes(1);
        expect(getAll).toHaveBeenCalledWith(false);
    });

    it('shows one flat list and logs when loading display configurations fails', async () => {
        const next = jest.spyOn(logging.errorHandler, 'next').mockImplementation(() => undefined);
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        getAll.mockRejectedValue(new Error('offline'));

        render(<ObjectDashboard objectTypes={[]} />);

        await waitFor(() => expect(next).toHaveBeenCalledWith('ErrorMessage.DisplayConfiguration.LoadFailed'));
        expect(screen.queryByRole('region')).not.toBeInTheDocument();
        expect(itemLabels(screen.getByRole('complementary', { name: 'Sidebar' }))).toEqual([
            'Category', 'District', 'Street', 'Town',
        ]);
        expect(getAll).toHaveBeenCalledTimes(1);

        next.mockRestore();
        consoleError.mockRestore();
    });
});
