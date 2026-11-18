import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DisplayWizard } from '../DisplayWizard';

/**
 * PandiO/knk-workspace#740 (overview map § 6.3.3, § 5 rule 10, O16): the compact form of the display renderer for the
 * map panel. No header, collections collapsed, values read-only with links to related records, and no buttons: no
 * hot edit, Select / Unlink / Add / Delete or Create New. It doesn't ask for the nodes of those actions either.
 */

jest.mock('react-router-dom', () => ({
    useNavigate: () => jest.fn(),
    useLocation: () => ({ pathname: '/map', search: '' }),
}), { virtual: true });

const mockAsked = new Set<string>();
jest.mock('../../../hooks/useStaffAccess', () => ({
    ...jest.requireActual('../../../hooks/useStaffAccess'),
    usePermissions: (nodes: string[]) => {
        nodes.forEach(node => mockAsked.add(node));
        return Object.fromEntries(nodes.map(node => [node, 'allowed']));
    },
    usePermission: () => ({ allowed: true, isChecking: false, status: 'allowed', retry: jest.fn() }),
}));

const world = ['knk.admin.world'];
const mockMetadata = [
    {
        entityName: 'District', displayName: 'District', fields: [], readNodes: world, lookupGettable: true,
        actionNodes: { edit: world, delete: ['knk.admin.world', 'knk.admin.delete'] },
        relationships: [
            { property: 'streets', relatedType: 'Street', kind: 'collection', storage: 'many', canLink: true, canUnlink: true, nodes: world },
            { property: 'town', relatedType: 'Town', kind: 'reference', storage: 'foreignKey', canLink: true, canUnlink: false, nodes: world },
        ],
    },
    { entityName: 'Street', displayName: 'Street', fields: [], readNodes: world, deletable: true, actionNodes: { delete: ['knk.admin.world', 'knk.admin.delete'] } },
    { entityName: 'Town', displayName: 'Town', fields: [], readNodes: world },
];
jest.mock('../../../hooks/useEntityMetadata', () => ({ useEntityMetadata: () => ({ baseMetadata: mockMetadata }) }));
jest.mock('../../../utils/entityApiMapping', () => ({ getDeleteFunctionForEntity: jest.fn(), getUpdateFunctionForEntity: jest.fn() }));

const field = (fieldGuid: string, label: string, fieldName: string, extra: Record<string, unknown> = {}) =>
    ({ fieldGuid, label, fieldName, isReusable: false, isLinkedToSource: false, ...extra });
const allButtons = JSON.stringify({
    showViewButton: true, showEditButton: true, showAddButton: true, showSelectButton: true, showRemoveButton: true,
    showUnlinkButton: true, showDeleteButton: true, showCreateButton: true,
});
const mockConfig = {
    name: 'District display (seed)', description: 'What a district shows.', sectionOrderJson: null,
    sections: [
        {
            sectionGuid: 's0', sectionName: 'General', isCollection: false, isReusable: false, isLinkedToSource: false,
            fields: [field('f0', 'Name', 'name', { fieldType: 'String', isEditableInDisplay: true })], subSections: [],
        },
        {
            sectionGuid: 's1', sectionName: 'Town', isCollection: false, isReusable: false, isLinkedToSource: false,
            relatedEntityPropertyName: 'Town', relatedEntityTypeName: 'Town', actionButtonsConfigJson: allButtons,
            fields: [field('f1', 'Town name', 'name')], subSections: [],
        },
        {
            sectionGuid: 's2', sectionName: 'Streets', isCollection: true, isReusable: false, isLinkedToSource: false,
            relatedEntityPropertyName: 'Streets', relatedEntityTypeName: 'Street', actionButtonsConfigJson: allButtons,
            fields: [field('f2', 'Street', 'name')], subSections: [],
        },
    ],
};
jest.mock('../hooks/useDisplayConfig', () => ({
    useDisplayConfig: () => ({ config: mockConfig, loading: false, error: null }),
}));
jest.mock('../hooks/useEntityData', () => ({
    useEntityData: () => ({
        data: {
            id: 4, name: 'Harbour', town: { id: 1, name: 'Aldmoor' },
            streets: [{ id: 7, name: 'Main Street' }, { id: 8, name: 'Harbour Road' }],
        },
        loading: false, error: null, refetch: jest.fn(),
    }),
}));

beforeEach(() => mockAsked.clear());

describe('DisplayWizard compact (#740)', () => {
    it('shows no header: neither the configuration name nor its description', () => {
        render(<DisplayWizard entityTypeName="District" entityId={4} compact />);
        expect(screen.queryByText('District display (seed)')).not.toBeInTheDocument();
        expect(screen.queryByText('What a district shows.')).not.toBeInTheDocument();
        expect(screen.getByText('Harbour')).toBeInTheDocument();
    });

    it('offers no buttons at all: no hot edit, no relationship actions, no Create New', () => {
        render(<DisplayWizard entityTypeName="District" entityId={4} compact />);
        expect(screen.queryAllByRole('button')).toHaveLength(0);
        expect(screen.queryByRole('button', { name: /Edit Name/ })).not.toBeInTheDocument();
    });

    it('shows a related record as a link to its detail page', () => {
        render(<DisplayWizard entityTypeName="District" entityId={4} compact />);
        const town = screen.getByRole('region', { name: 'Town' });
        expect(within(town).getByRole('link', { name: 'Aldmoor' })).toHaveAttribute('href', expect.stringContaining('/display/Town/1'));
    });

    it('collapses a collection under its name and count, and lists its items as links when opened', () => {
        render(<DisplayWizard entityTypeName="District" entityId={4} compact />);
        const streets = screen.getByRole('group', { name: 'Streets' });
        expect(streets).not.toHaveAttribute('open');
        expect(within(streets).getByLabelText('2 items')).toBeInTheDocument();

        fireEvent.click(within(streets).getByText('Streets'));
        expect(streets).toHaveAttribute('open');
        const list = within(streets).getByRole('list', { name: 'Streets' });
        expect(within(list).getByRole('link', { name: 'Main Street' })).toHaveAttribute('href', expect.stringContaining('/display/Street/7'));
        expect(within(list).getByRole('link', { name: 'Harbour Road' })).toBeInTheDocument();
    });

    it('asks only for the read nodes of the linked types, not for edit, link or delete nodes', () => {
        render(<DisplayWizard entityTypeName="District" entityId={4} compact />);
        expect(Array.from(mockAsked)).toEqual(['knk.admin.world']);
    });

    it('the full page keeps its header and buttons (default mode unchanged)', () => {
        render(<DisplayWizard entityTypeName="District" entityId={4} />);
        expect(screen.getByRole('heading', { name: 'District display (seed)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Edit Name' })).toBeInTheDocument();
        expect(mockAsked.has('knk.admin.content')).toBe(true);
    });
});
