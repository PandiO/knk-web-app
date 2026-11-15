import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReferenceDetails, useReferenceDetailsToggle, ReferenceDetailsToggleOptions } from '../ReferenceDetails';
import { entityReferenceClient } from '../../apiClients/entityReferenceClient';

jest.mock('../../apiClients/entityReferenceClient', () => ({ entityReferenceClient: { getRows: jest.fn() } }));
import { isReferenceRefusal, referenceNoun } from '../../utils/referenceDetails';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });

/** PandiO/knk-workspace#44: what uses a record, as far as the viewer may see it (the API trims; the page shows it). */
describe('ReferenceDetails', () => {
    const data = {
        entityTypeName: 'Street',
        id: 12,
        groups: [
            {
                referencedBy: 'Structure.StreetId', entityType: 'Structure', count: 23, listed: true, readable: true,
                nodes: ['knk.admin.world'], rows: [{ id: 3, label: 'Smithy', detail: 'Main Street · 4' }, { id: 9, label: 'Bakery' }], more: true,
            },
            {
                referencedBy: 'Kit.StreetId', entityType: 'Kit', count: 1, listed: true, readable: false,
                nodes: ['knk.admin.kits'], rows: [{ id: 4, label: 'Starter kit' }], more: false,
            },
            {
                referencedBy: 'FormSubmissionProgress.StreetId', entityType: 'FormSubmissionProgress', count: 2, listed: false,
                readable: false, nodes: [], rows: [], more: false, reason: "These records aren't listed here.",
            },
        ],
    };

    beforeEach(() => mockNavigate.mockClear());

    it('groups the rows in words, links readable ones to their page and says how many more there are', () => {
        const onFollow = jest.fn();
        render(<ReferenceDetails data={data} returnTo="/dashboard/Street" onFollow={onFollow} typeLabel={type => type} />);

        expect(screen.getByRole('heading', { name: '23 structures' })).toBeInTheDocument();
        const link = screen.getByRole('link', { name: 'Smithy' });
        expect(link).toHaveAttribute('href', expect.stringContaining('/display/Structure/3'));
        expect(screen.getByText('Main Street · 4')).toBeInTheDocument();
        expect(screen.getByText('… and 21 more.')).toBeInTheDocument();

        fireEvent.click(link, { button: 0 });
        expect(onFollow).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/display/Structure/3'));
    });

    it('names rows of a type the viewer can not open without a link, with the nodes; counts the rest', () => {
        render(<ReferenceDetails data={data} typeLabel={type => type} />);

        expect(screen.getByRole('heading', { name: '1 kit' })).toBeInTheDocument();
        expect(screen.getByText('Starter kit').tagName).toBe('SPAN');
        expect(screen.getByText('Opening kits requires one of: knk.admin.kits')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '2 saved drafts' })).toBeInTheDocument();
        expect(screen.getByText("These records aren't listed here.")).toBeInTheDocument();
    });

    it('says so when nothing blocks any more', () => {
        render(<ReferenceDetails data={{ entityTypeName: 'Street', id: 12, groups: [] }} />);
        expect(screen.getByText('Nothing blocks the delete any more. Try again.')).toBeInTheDocument();
    });
});

describe('useReferenceDetailsToggle (PandiO/knk-workspace#289)', () => {
    const Row: React.FC<{ options?: ReferenceDetailsToggleOptions }> = ({ options }) => {
        const uses = useReferenceDetailsToggle('District', 5, options);
        return <li>{uses.button}{uses.panel}</li>;
    };
    const oneStreet = {
        entityTypeName: 'District', id: 5, groups: [{
            referencedBy: 'Street (link)', entityType: 'Street', count: 1, listed: true, readable: false,
            nodes: ['knk.admin.world'], rows: [{ id: 7, label: 'Gatestraat' }], more: false,
        }],
    };

    beforeEach(() => (entityReferenceClient.getRows as jest.Mock).mockReset());

    it('loads once on request, with every reference when asked, and Hide keeps the list', async () => {
        (entityReferenceClient.getRows as jest.Mock).mockResolvedValue(oneStreet);
        render(<Row options={{ all: true }} />);

        expect(entityReferenceClient.getRows).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Show what uses it' }));
        expect(await screen.findByText('Gatestraat')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
        expect(screen.queryByText('Gatestraat')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Show what uses it' }));
        expect(screen.getByText('Gatestraat')).toBeInTheDocument();
        expect(entityReferenceClient.getRows).toHaveBeenCalledTimes(1);
        expect(entityReferenceClient.getRows).toHaveBeenCalledWith('District', 5, { all: true });
    });

    it('asks only for what stops a delete by default, and says so in its own words when nothing is left', async () => {
        (entityReferenceClient.getRows as jest.Mock).mockResolvedValue({ entityTypeName: 'District', id: 5, groups: [] });
        render(<Row options={{ emptyText: 'Nothing uses it any more.' }} />);

        fireEvent.click(screen.getByRole('button', { name: 'Show what uses it' }));
        expect(await screen.findByText('Nothing uses it any more.')).toBeInTheDocument();
        expect(entityReferenceClient.getRows).toHaveBeenCalledWith('District', 5, {});
    });

    it("shows the API's reason when the list can't be loaded", async () => {
        (entityReferenceClient.getRows as jest.Mock).mockRejectedValue({
            status: 403, response: { code: 'NoReadAccess', message: "You don't have access to District. Requires one of: knk.admin.world." },
        });
        render(<Row />);

        fireEvent.click(screen.getByRole('button', { name: 'Show what uses it' }));
        expect(await screen.findByText("You don't have access to District. Requires one of: knk.admin.world.")).toBeInTheDocument();
    });
});

describe('referenceDetails helpers', () => {
    it('recognises only the "still in use" refusal', () => {
        expect(isReferenceRefusal({ status: 409, response: { code: 'DbConstraint', message: 'x' } })).toBe(true);
        expect(isReferenceRefusal({ status: 409, response: { code: 'AlreadyLinked' } })).toBe(false);
        expect(isReferenceRefusal({ status: 400, response: { code: 'DbConstraint' } })).toBe(false);
        expect(isReferenceRefusal(new Error('x'))).toBe(false);
    });

    it('words a group like the refusal message', () => {
        expect(referenceNoun({ referencedBy: 'GateStructure.DistrictId', entityType: 'GateStructure' }, 2)).toBe('gate structures');
        expect(referenceNoun({ referencedBy: 'District (link)', entityType: 'District' }, 1)).toBe('district');
        expect(referenceNoun({ referencedBy: 'Category.ParentCategoryId', entityType: 'Category' }, 3)).toBe('categories');
        expect(referenceNoun({ referencedBy: 'FormStep.SubConfigurationId', entityType: null }, 2)).toBe('form steps that use it as a sub-form');
        expect(referenceNoun({ referencedBy: 'FormSubmissionProgress.StreetId', entityType: 'FormSubmissionProgress' }, 2)).toBe('saved drafts');
    });
});
