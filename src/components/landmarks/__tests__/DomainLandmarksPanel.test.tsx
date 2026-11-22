import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DomainLandmarksPanel, showsDomainLandmarks } from '../DomainLandmarksPanel';
import { landmarkClient } from '../../../apiClients/landmarkClient';

const mockNavigate = jest.fn();
// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
        <a href={to} className={className}>{children}</a>
    ),
}), { virtual: true });
let mockAllowed = true;
jest.mock('../../../hooks/useStaffAccess', () => ({
    usePermissions: (nodes: string[]) => Object.fromEntries(nodes.map(node => [node, mockAllowed ? 'allowed' : 'denied'])),
}));
jest.mock('../../../apiClients/landmarkClient', () => ({ landmarkClient: { getByDomain: jest.fn() } }));

const getByDomain = landmarkClient.getByDomain as jest.Mock;

describe('DomainLandmarksPanel (PandiO/knk-workspace#708)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAllowed = true;
    });

    it('lists the landmarks of the domain with their area and point', async () => {
        getByDomain.mockResolvedValue({
            items: [
                { id: 3, name: 'Throne room', world: 'world', x: 10, y: 64, z: 20, areaKind: 'OwnRegion', wgRegionId: 'domain_3', preference: 1, navigationEnabled: true, kind: 'General' },
                { id: 4, name: 'Well', world: 'world', x: 1, y: 60, z: 2, areaKind: 'LinkedDomain', preference: 1, navigationEnabled: false, kind: 'General' },
            ],
            totalCount: 2,
        });
        render(<DomainLandmarksPanel domainId={7} domainName="Keep" returnTo="/display/Structure/7" />);

        expect(getByDomain).toHaveBeenCalledWith(7);
        const link = await screen.findByRole('link', { name: 'Throne room' });
        expect(link).toHaveAttribute('href', `/display/Landmark/3?returnTo=${encodeURIComponent('/display/Structure/7')}`);
        expect(screen.getByText('Own region · 10 64 20 · world')).toBeInTheDocument();
        expect(screen.getByText("Linked domain's area · 1 60 2 · world · not in /navigate")).toBeInTheDocument();
        expect(screen.getByText(/not in \/navigate/)).toBeInTheDocument();
    });

    it('says when the domain has none', async () => {
        getByDomain.mockResolvedValue({ items: [], totalCount: 0 });
        render(<DomainLandmarksPanel domainId={7} domainName="Keep" returnTo={null} />);
        expect(await screen.findByText('No landmarks have Keep as their parent.')).toBeInTheDocument();
    });

    it('shows the refusal when the list is not allowed', async () => {
        getByDomain.mockRejectedValue(Object.assign(new Error('Requires knk.admin.world.'), { status: 403 }));
        render(<DomainLandmarksPanel domainId={7} domainName="Keep" returnTo={null} />);
        expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    it('opens the landmark form from Add landmark, and keeps it off without the nodes', async () => {
        getByDomain.mockResolvedValue({ items: [], totalCount: 0 });
        const { unmount } = render(<DomainLandmarksPanel domainId={7} domainName="Keep" returnTo="/display/Town/7" />);
        fireEvent.click(screen.getByRole('button', { name: 'Add landmark' }));
        expect(mockNavigate).toHaveBeenCalledWith(`/forms/Landmark?autoOpen=true&returnTo=${encodeURIComponent('/display/Town/7')}`);
        await screen.findByText('No landmarks have Keep as their parent.');
        unmount();

        mockAllowed = false;
        render(<DomainLandmarksPanel domainId={7} domainName="Keep" returnTo={null} />);
        const add = screen.getByRole('button', { name: 'Add landmark' });
        expect(add).toBeDisabled();
        expect(add).toHaveAttribute('title', 'Requires knk.admin.world.landmark and knk.admin.content');
        await screen.findByText('No landmarks have Keep as their parent.');
    });

    it('is shown on every domain type, a landmark too, and nowhere else', () => {
        expect(['Town', 'District', 'Structure', 'GateStructure', 'Domain', 'Landmark'].every(showsDomainLandmarks)).toBe(true);
        expect(showsDomainLandmarks('Location')).toBe(false);
        expect(showsDomainLandmarks(undefined)).toBe(false);
    });

    it("lists a landmark's child landmarks on its page, never the landmark itself (landmark-domain #986)", async () => {
        getByDomain.mockResolvedValue({
            items: [
                { id: 9, name: 'Tower', world: 'world', x: 0, y: 70, z: 0, areaKind: 'OwnRegion', preference: 1, navigationEnabled: true, kind: 'General' },
                { id: 10, name: 'Dais', world: 'world', x: 1, y: 71, z: 1, areaKind: 'None', preference: 1, navigationEnabled: true, kind: 'General' },
            ],
            totalCount: 2,
        });
        render(<DomainLandmarksPanel domainId={9} domainName="Tower" returnTo="/display/Landmark/9" />);
        expect(await screen.findByRole('link', { name: 'Dais' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Tower' })).not.toBeInTheDocument();
        expect(screen.queryByText(/more; the dashboard/)).not.toBeInTheDocument();
    });
});
