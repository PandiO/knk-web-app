import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorldBoundFieldRenderer, mergeTaskUpdate, offerNotice } from '../WorldBoundFieldRenderer';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { WorldTaskReadDto } from '../../../types/dtos/workflow/WorkflowDtos';
import { FieldType } from '../../../utils/enums';
import { worldTaskClient } from '../../../apiClients/worldTaskClient';
import { RealtimeContext, RealtimeContextValue, RealtimeHandler } from '../../../realtime/RealtimeProvider';

/**
 * PandiO/knk-workspace#181 (WT2, DESIGN §8.3, §8.5): "Send to Minecraft" with the busy check, "Hand off to…", the offer
 * shown with the task code folded away, and the panel following WorldTaskUpdated over the web hub.
 */

jest.mock('../../../apiClients/worldTaskClient', () => ({
    worldTaskClient: {
        create: jest.fn(), getById: jest.fn(), cancel: jest.fn(),
        getMyPresence: jest.fn(), getActiveForMe: jest.fn(), getOnlineStaff: jest.fn(),
    }
}));
jest.mock('../../../hooks/useEnrichedFormContext', () => ({
    useEnrichedFormContext: () => ({
        values: {}, fieldMetadata: new Map(), entityMetadata: new Map(), resolvedDependencies: new Map(),
        isLoading: false, error: null
    })
}));

const client = worldTaskClient as jest.Mocked<typeof worldTaskClient>;

const regionField = {
    id: '11', fieldName: 'WgRegionId', label: 'Region', fieldType: FieldType.String, isRequired: false, isReadOnly: false,
    order: 0, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, validations: []
} as unknown as FormFieldDto;

const task = (overrides: Partial<WorldTaskReadDto> = {}): WorldTaskReadDto => ({
    id: 41, workflowSessionId: 7, fieldName: 'WgRegionId', taskType: 'WgRegionId', status: 'Pending', linkCode: 'AB12CD',
    createdAt: '2026-11-02T12:00:00Z', createdByUserId: 5, ...overrides,
});

/** A connected (or not) web hub whose events the test sends. */
function fakeRealtime(connected: boolean) {
    const handlers = new Map<string, Set<RealtimeHandler<any>>>();
    const value: RealtimeContextValue = {
        connected,
        subscribe: (type, handler) => {
            if (!handlers.has(type)) handlers.set(type, new Set());
            handlers.get(type)!.add(handler as RealtimeHandler<any>);
            return () => handlers.get(type)!.delete(handler as RealtimeHandler<any>);
        },
        onReconnected: () => () => undefined,
        joinTask: jest.fn(async () => true),
        leaveTask: jest.fn(),
    };
    const emit = (type: string, payload: unknown) =>
        handlers.get(type)?.forEach(h => h(payload, { v: 1, seq: 2, type, at: '', payload } as never));
    return { value, emit };
}

function renderPanel(connected: boolean, props: Partial<React.ComponentProps<typeof WorldBoundFieldRenderer>> = {}) {
    const realtime = fakeRealtime(connected);
    const onChange = jest.fn();
    render(
        <RealtimeContext.Provider value={realtime.value}>
            <WorldBoundFieldRenderer field={regionField} value={null} onChange={onChange} taskType="WgRegionId"
                workflowSessionId={7} {...props} />
        </RealtimeContext.Provider>
    );
    return { ...realtime, onChange };
}

describe('WorldBoundFieldRenderer over the web hub (#181)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        client.create.mockResolvedValue(task({ offerState: 'Offered', targetUserId: 5, offeredAt: '2026-11-02T12:00:00Z' }));
    });

    it('without the hub sends as before: no busy check, no deliver, no "Hand off to…"', async () => {
        renderPanel(false);
        expect(screen.queryByText('Hand off to…')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Send to Minecraft'));

        await waitFor(() => expect(client.create).toHaveBeenCalled());
        expect(client.create.mock.calls[0][0]).not.toHaveProperty('deliver');
        expect(client.getMyPresence).not.toHaveBeenCalled();
        expect(client.getActiveForMe).not.toHaveBeenCalled();
    });

    it('online and free: sends with deliver auto and shows "Sent to you in game" with the code folded away', async () => {
        client.getMyPresence.mockResolvedValue({ online: true, serverId: 'survival-1', hasMinecraftAccount: true });
        client.getActiveForMe.mockResolvedValue({ task: null, queued: 0 });
        const { value } = renderPanel(true);

        fireEvent.click(screen.getByText('Send to Minecraft'));

        expect(await screen.findByText(/Sent to you in game/)).toBeInTheDocument();
        expect(client.create).toHaveBeenCalledWith(expect.objectContaining({ deliver: 'auto' }));
        expect(screen.queryByText('Ready for Minecraft!')).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('Or use task code AB12CD'));
        expect(screen.getByText('Ready for Minecraft!')).toBeInTheDocument();
        await waitFor(() => expect(value.joinTask).toHaveBeenCalledWith(41));
    });

    it('busy: asks Queue / Hand off / Replace / Cancel, naming the form; Replace sends deliver replace', async () => {
        client.getMyPresence.mockResolvedValue({ online: true, serverId: 'survival-1', hasMinecraftAccount: true });
        client.getActiveForMe.mockResolvedValue({ task: task({ id: 9, status: 'InProgress', fieldName: 'Location' }), formName: 'New town', queued: 1 });
        renderPanel(true);

        fireEvent.click(screen.getByText('Send to Minecraft'));

        expect(await screen.findByText('You already have a task open in game.')).toBeInTheDocument();
        expect(screen.getByText(/Location of “New town” · 1 more waiting/)).toBeInTheDocument();
        expect(client.create).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('Replace'));
        await waitFor(() => expect(client.create).toHaveBeenCalledWith(expect.objectContaining({ deliver: 'replace' })));
    });

    it('busy: Queue sends deliver queue, Cancel sends nothing', async () => {
        client.getMyPresence.mockResolvedValue({ online: true, hasMinecraftAccount: true });
        client.getActiveForMe.mockResolvedValue({ task: task({ id: 9, status: 'InProgress' }), queued: 0 });
        client.create.mockResolvedValue(task({ offerState: 'Queued', targetUserId: 5 }));
        renderPanel(true);

        fireEvent.click(screen.getByText('Send to Minecraft'));
        fireEvent.click(await screen.findByText('Cancel'));
        expect(screen.queryByText('You already have a task open in game.')).not.toBeInTheDocument();
        expect(client.create).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText('Send to Minecraft'));
        fireEvent.click(await screen.findByText('Queue'));
        await waitFor(() => expect(client.create).toHaveBeenCalledWith(expect.objectContaining({ deliver: 'queue' })));
        expect(await screen.findByText(/Queued: it is sent to you in game/)).toBeInTheDocument();
        expect(screen.getByText('Ready for Minecraft!')).toBeInTheDocument(); // the code stays visible
    });

    it('offline: no busy question, sent with deliver auto (the API shows the code)', async () => {
        client.getMyPresence.mockResolvedValue({ online: false, hasMinecraftAccount: true });
        client.getActiveForMe.mockResolvedValue({ task: task({ id: 9, status: 'InProgress' }), queued: 0 });
        client.create.mockResolvedValue(task());
        renderPanel(true);

        fireEvent.click(screen.getByText('Send to Minecraft'));

        await waitFor(() => expect(client.create).toHaveBeenCalledWith(expect.objectContaining({ deliver: 'auto' })));
        expect(await screen.findByText('Ready for Minecraft!')).toBeInTheDocument();
    });

    it('"Hand off to…" lists online players and sends to the one picked', async () => {
        client.getOnlineStaff.mockResolvedValue([{ userId: 9, username: 'Bob', serverId: 'survival-1', world: 'world' }]);
        client.create.mockResolvedValue(task({ offerState: 'Offered', targetUserId: 9, targetUsername: 'Bob' }));
        renderPanel(true);

        fireEvent.click(screen.getByText('Hand off to…'));
        fireEvent.click(await screen.findByText('Bob'));

        await waitFor(() => expect(client.create).toHaveBeenCalledWith(expect.objectContaining({ deliver: { userId: 9 } })));
        expect(await screen.findByText(/Sent to Bob in game, waiting for Accept or Decline/)).toBeInTheDocument();
    });

    it('follows WorldTaskUpdated: claimed in game, then declined shows the code; completed fills the field', async () => {
        const offered = task({ offerState: 'Offered', targetUserId: 9, targetUsername: 'Bob' });
        const { emit, onChange } = renderPanel(true, { initialTask: offered });
        expect(screen.getByText(/Sent to Bob in game/)).toBeInTheDocument();

        act(() => emit('WorldTaskUpdated', { taskId: 41, status: 'Pending', offerState: 'Declined', targetUserId: 9, targetUsername: 'Bob', releaseCount: 0 }));
        expect(screen.getByText(/Bob declined it in game/)).toBeInTheDocument();
        expect(screen.getByText('Ready for Minecraft!')).toBeInTheDocument();

        act(() => emit('WorldTaskUpdated', { taskId: 41, status: 'InProgress', offerState: 'None', claimedByMinecraftUsername: 'Alex', claimedByServerId: 'survival-1', releaseCount: 0 }));
        expect(screen.getByText('Alex')).toBeInTheDocument();

        act(() => emit('WorldTaskUpdated', { taskId: 99, status: 'Cancelled', offerState: 'None', releaseCount: 0 }));
        expect(screen.getByText('Alex')).toBeInTheDocument(); // someone else's task

        client.getById.mockResolvedValue(task({ status: 'Completed', outputJson: JSON.stringify({ regionId: 'tempregion_worldtask_41' }) }));
        act(() => emit('WorldTaskUpdated', { taskId: 41, status: 'Completed', offerState: 'None', releaseCount: 0 }));
        await waitFor(() => expect(onChange).toHaveBeenCalledWith('tempregion_worldtask_41'));
        expect(client.getById).toHaveBeenCalledWith(41);
    });

    it('offer notices and the merge', () => {
        expect(offerNotice(task({ offerState: 'TimedOut', targetUserId: 9, targetUsername: 'Bob' }))).toMatch(/No answer from Bob/);
        expect(offerNotice(task({ offerState: 'Busy', targetUserId: 5 }))).toMatch(/already had a task open/);
        expect(offerNotice(task({ offerState: 'None' }))).toBeNull();
        const merged = mergeTaskUpdate(task({ inputJson: '{"x":1}' }), {
            taskId: 41, status: 'InProgress', offerState: 'Accepted', claimedByMinecraftUsername: 'Steve', releaseCount: 1,
        });
        expect(merged).toEqual(expect.objectContaining({ status: 'InProgress', offerState: 'Accepted', claimedByMinecraftUsername: 'Steve', inputJson: '{"x":1}', linkCode: 'AB12CD', releaseCount: 1 }));
    });
});
