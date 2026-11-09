import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReferenceDetails } from '../ReferenceDetails';
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
