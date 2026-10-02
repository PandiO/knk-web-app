import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { roadClient } from '../../../../apiClients/roadClient';
import { RoadProfilesCard } from '../RoadProfilesCard';
import { RoadProfileDto } from '../../../../types/dtos/road/RoadDtos';

// KNG-27 smoke test fix plan item 1: deleting a profile confirms through FeedbackModal, never window.confirm().

jest.mock('../../../../apiClients/roadClient', () => ({
    roadClient: { deleteProfile: jest.fn() },
}));

jest.mock('../../../../apiClients/townClient', () => ({
    townClient: { searchPaged: jest.fn().mockResolvedValue({ items: [] }) },
}));

const deleteProfile = roadClient.deleteProfile as jest.Mock;

const profile: RoadProfileDto = {
    id: 3,
    name: 'Cinix rural road',
    roadClass: 'Road',
    costMultiplier: 1,
    materials: [{ material: 'GRAVEL', role: 'Surface', ambiguous: false, centreShare: 0.8, edgeShare: 0.1, samples: 120 }],
    widthMin: 1,
    widthMax: 5,
    sampleCount: 120,
    enabled: true,
    scopeTownIds: null,
    createdAt: '2026-09-29T18:00:00Z',
    updatedAt: '2026-09-29T18:00:00Z',
};

describe('RoadProfilesCard delete', () => {
    let confirmSpy: jest.SpyInstance;

    beforeEach(() => {
        deleteProfile.mockReset();
        confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);
    });

    afterEach(() => {
        confirmSpy.mockRestore();
    });

    it('asks in a FeedbackModal and deletes on confirm', async () => {
        deleteProfile.mockResolvedValue(undefined);
        const onChanged = jest.fn();
        render(<RoadProfilesCard profiles={[profile]} onChanged={onChanged} />);

        fireEvent.click(screen.getByLabelText('Delete Cinix rural road profile'));

        expect(confirmSpy).not.toHaveBeenCalled();
        expect(deleteProfile).not.toHaveBeenCalled();
        const dialog = screen.getByRole('dialog', { name: 'Delete road profile' });
        expect(dialog).toHaveTextContent('Delete the road profile "Cinix rural road"?');

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(deleteProfile).toHaveBeenCalledWith(3));
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('does nothing when the modal is closed', () => {
        render(<RoadProfilesCard profiles={[profile]} onChanged={jest.fn()} />);

        fireEvent.click(screen.getByLabelText('Delete Cinix rural road profile'));
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(deleteProfile).not.toHaveBeenCalled();
    });

    it('keeps the modal open with the API message when the delete fails', async () => {
        deleteProfile.mockRejectedValue(Object.assign(new Error('Profile is in use.'), { status: 409 }));
        const onChanged = jest.fn();
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        render(<RoadProfilesCard profiles={[profile]} onChanged={onChanged} />);

        fireEvent.click(screen.getByLabelText('Delete Cinix rural road profile'));
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        const dialog = await screen.findByRole('dialog', { name: 'Delete failed' });
        expect(dialog).toHaveTextContent('Profile is in use.');
        expect(onChanged).not.toHaveBeenCalled();
        (console.error as jest.Mock).mockRestore();
    });
});
