import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CreatedEntitiesPrompt } from '../CreatedEntitiesPrompt';
import { entityReferenceClient } from '../../../apiClients/entityReferenceClient';
import type { CreatedEntityRecord } from '../../../utils/forms/createdEntities';
import type { CreatedEntityDeleteResult } from '../../../utils/forms/deleteCreatedEntities';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('../../../apiClients/entityReferenceClient', () => ({ entityReferenceClient: { getRows: jest.fn() } }));

/**
 * PandiO/knk-workspace#289: after "Delete them" (a cancelled form, KNG-162) or "Delete draft and them", an entity
 * skipped as in use offers "Show what uses it", with every reference as the in-use check counted them.
 */
const record = (entityTypeName: string, id: number, name: string, sequence: number): CreatedEntityRecord => ({
    entityTypeName, id, display: { name }, origin: { formPath: [], fieldName: 'x' }, sequence,
});
const street = record('Street', 7, 'Gatestraat', 2);
const district = record('District', 5, 'Oostwijk', 1);

const results: CreatedEntityDeleteResult[] = [
    { record: street, outcome: 'deleted' },
    { record: district, outcome: 'in-use', detail: 'used by Structure.DistrictId' },
];

const renderPrompt = (onDone = jest.fn()) => {
    render(
        <CreatedEntitiesPrompt
            open
            title="Cancel this form?"
            intro="Created while filling out this form:"
            records={[district, street]}
            keepLabel="Keep them"
            deleteLabel="Delete them"
            onKeep={jest.fn()}
            onDelete={() => Promise.resolve(results)}
            onDone={onDone}
            onClose={jest.fn()}
        />
    );
    return onDone;
};

describe('CreatedEntitiesPrompt: "Show what uses it" for a skipped entity (#289)', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        (entityReferenceClient.getRows as jest.Mock).mockReset().mockResolvedValue({
            entityTypeName: 'District', id: 5, groups: [{
                referencedBy: 'Structure.DistrictId', entityType: 'Structure', count: 1, listed: true, readable: true,
                nodes: ['knk.admin.world'], rows: [{ id: 3, label: 'Smithy' }], more: false,
            }],
        });
    });

    it('only the skipped entity offers it; the list loads on request with every reference', async () => {
        renderPrompt();
        fireEvent.click(screen.getByRole('button', { name: 'Delete them' }));
        const report = await screen.findByRole('list', { name: 'Delete results' });

        const rows = within(report).getAllByRole('listitem');
        expect(within(rows[0]).queryByRole('button')).not.toBeInTheDocument();
        expect(rows[1]).toHaveTextContent("District 'Oostwijk': skipped: in use (used by Structure.DistrictId)");
        expect(entityReferenceClient.getRows).not.toHaveBeenCalled();

        fireEvent.click(within(rows[1]).getByRole('button', { name: 'Show what uses it' }));
        expect(await within(rows[1]).findByRole('link', { name: 'Smithy' })).toBeInTheDocument();
        expect(entityReferenceClient.getRows).toHaveBeenCalledWith('District', 5, { all: true });
    });

    it('following a row ends the prompt and opens the row', async () => {
        const onDone = renderPrompt();
        fireEvent.click(screen.getByRole('button', { name: 'Delete them' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Show what uses it' }));

        fireEvent.click(await screen.findByRole('link', { name: 'Smithy' }), { button: 0 });

        expect(onDone).toHaveBeenCalledWith(results);
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/display/Structure/3'));
    });
});
