import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DisplayWizardPage } from '../DisplayWizardPage';
import { getDeleteFunctionForEntity } from '../../utils/entityApiMapping';
import { toast } from '../../utils/toast';

/** #81 (in #177 link 2): the detail page header - entity name, Back / Edit / Delete, breadcrumb, tab title. */

const mockNavigate = jest.fn();
let mockParams: { entityName?: string; id?: string } = { entityName: 'town', id: '4' };
let mockSearch = 'returnTo=%2Fdashboard%2FTown';
// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => ({ pathname: `/display/${mockParams.entityName}/${mockParams.id}`, search: mockSearch ? `?${mockSearch}` : '' }),
    useSearchParams: () => [new URLSearchParams(mockSearch)],
}), { virtual: true });
const mockMetadata = { baseMetadata: [{ entityName: 'Town', displayName: 'Town', fields: [] }, { entityName: 'User', displayName: 'User', fields: [] }] };
jest.mock('../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => mockMetadata,
}));
jest.mock('../../utils/entityApiMapping', () => ({
    getDeleteFunctionForEntity: jest.fn(),
}));
jest.mock('../../utils/toast', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
// The wizard as the page sees it: it loaded the entity and renders the page's header.
let mockEntity: Record<string, unknown> = { id: 4, name: 'Cinix' };
jest.mock('../../components/DisplayWizard/DisplayWizard', () => ({
    __esModule: true,
    default: ({ renderHeader }: { renderHeader?: (entity: Record<string, unknown>) => unknown }) => (
        <div>{renderHeader?.(mockEntity) as never}</div>
    ),
}));

const here = encodeURIComponent('/display/town/4?returnTo=%2Fdashboard%2FTown');

describe('DisplayWizardPage header (#81)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockParams = { entityName: 'town', id: '4' };
        mockSearch = 'returnTo=%2Fdashboard%2FTown';
        mockEntity = { id: 4, name: 'Cinix' };
    });

    it("shows the entity's name, its type, the breadcrumb and an entity-specific tab title", async () => {
        render(<DisplayWizardPage />);

        expect(screen.getByRole('heading', { name: 'Cinix' })).toBeInTheDocument();
        expect(screen.getByText('Town', { selector: 'p' })).toBeInTheDocument();
        const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getAllByRole('listitem');
        expect(crumbs.map(item => item.textContent)).toEqual(['Dashboard', 'Town', 'Cinix']);
        await waitFor(() => expect(document.title).toBe('Cinix · Town · Knights & Kings'));
    });

    it('goes Back to returnTo, else the dashboard on the type', () => {
        const { unmount } = render(<DisplayWizardPage />);
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(mockNavigate).toHaveBeenLastCalledWith('/dashboard/Town');
        unmount();

        mockSearch = '';
        render(<DisplayWizardPage />);
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(mockNavigate).toHaveBeenLastCalledWith('/dashboard/town');
    });

    it('opens Edit coming back to this page; a User goes to the player profile', () => {
        const { unmount } = render(<DisplayWizardPage />);
        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
        expect(mockNavigate).toHaveBeenLastCalledWith(`/forms/town/edit/4?returnTo=${here}`);
        unmount();

        mockParams = { entityName: 'user', id: '9' };
        mockEntity = { id: 9, username: 'Pandi' };
        render(<DisplayWizardPage />);
        expect(screen.getByRole('heading', { name: 'Pandi' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
        expect(mockNavigate).toHaveBeenLastCalledWith('/admin/users/9');
    });

    it('deletes after a confirmation naming the entity, then goes back with a toast', async () => {
        const deleteFn = jest.fn().mockResolvedValue(undefined);
        (getDeleteFunctionForEntity as jest.Mock).mockReturnValue(deleteFn);
        render(<DisplayWizardPage />);

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        expect(await screen.findByText('Delete Town "Cinix"?')).toBeInTheDocument();
        const dialogButtons = screen.getAllByRole('button', { name: 'Delete' });
        await act(async () => { fireEvent.click(dialogButtons[dialogButtons.length - 1]); });

        await waitFor(() => expect(deleteFn).toHaveBeenCalledWith('4'));
        expect(toast.success).toHaveBeenCalledWith('Town "Cinix" deleted.');
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard/Town');
    });

    it('stays on the page with the reason when the delete is refused, and does nothing on Cancel', async () => {
        const deleteFn = jest.fn().mockRejectedValue(new Error('Town is used by 3 districts.'));
        (getDeleteFunctionForEntity as jest.Mock).mockReturnValue(deleteFn);
        render(<DisplayWizardPage />);

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByText('Delete Town "Cinix"?')).not.toBeInTheDocument());
        expect(deleteFn).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        await screen.findByText('Delete Town "Cinix"?');
        const dialogButtons = screen.getAllByRole('button', { name: 'Delete' });
        await act(async () => { fireEvent.click(dialogButtons[dialogButtons.length - 1]); });

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
