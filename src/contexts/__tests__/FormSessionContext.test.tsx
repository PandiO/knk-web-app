import React from 'react';
import { act, render } from '@testing-library/react';
import {
    FormSessionScope,
    FormSessionValue,
    upsertSessionEntity,
    useFormSession
} from '../FormSessionContext';
import { useSessionPinnedRows } from '../../hooks/useSessionPinnedRows';

/** Captures the session each nested wizard sees. */
const Probe: React.FC<{ name: string; sink: Record<string, FormSessionValue | null> }> = ({ name, sink }) => {
    sink[name] = useFormSession();
    return null;
};

const renderNested = () => {
    const sink: Record<string, FormSessionValue | null> = {};
    render(
        <FormSessionScope formName="GateStructure">
            <Probe name="root" sink={sink} />
            <FormSessionScope formName="Street">
                <Probe name="street" sink={sink} />
                <FormSessionScope formName="District">
                    <Probe name="district" sink={sink} />
                </FormSessionScope>
            </FormSessionScope>
        </FormSessionScope>
    );
    return sink;
};

describe('FormSessionContext (KNG-136)', () => {
    it('is null outside a wizard', () => {
        const sink: Record<string, FormSessionValue | null> = {};
        render(<Probe name="alone" sink={sink} />);
        expect(sink.alone).toBeNull();
    });

    it('shares one registry from the root down and tracks each form path', () => {
        const sink = renderNested();
        expect(sink.root!.formPath).toEqual(['GateStructure']);
        expect(sink.street!.formPath).toEqual(['GateStructure', 'Street']);

        act(() => {
            sink.street!.register({ entityTypeName: 'District', entity: { id: 501, name: 'Old Quarter' }, fieldName: 'Districts', status: 'created' });
        });

        // Registered two levels down, visible at the root.
        const [entry] = sink.root!.entitiesOfType('district');
        expect(entry).toMatchObject({
            key: 'district:501',
            entityTypeName: 'District',
            id: 501,
            display: { id: 501, name: 'Old Quarter' },
            origin: { formPath: ['GateStructure', 'Street'], fieldName: 'Districts' },
            status: 'created',
            embedded: false,
            sequence: 1
        });
        expect(sink.district!.entities).toHaveLength(1);
    });

    it('lists what the root form created, oldest first, without embedded or merely edited entities', () => {
        const sink = renderNested();
        act(() => {
            sink.district!.register({ entityTypeName: 'District', entity: { id: 501 }, fieldName: 'Districts', status: 'created' });
            sink.street!.register({ entityTypeName: 'Street', entity: { id: 77 }, fieldName: 'Street', status: 'created' });
            sink.root!.register({ entityTypeName: 'Location', entity: { x: 1, y: 2, z: 3 }, fieldName: 'Location', status: 'created', embedded: true });
            sink.root!.register({ entityTypeName: 'Town', entity: { id: 4 }, fieldName: 'Town', status: 'updated' });
        });

        expect(sink.root!.createdEntities().map(e => e.key)).toEqual(['district:501', 'street:77']);
        // The embedded Location got a concept key.
        expect(sink.root!.entitiesOfType('Location')[0].key).toMatch(/^concept:\d+$/);
    });

    it('re-registering refreshes the entry, keeps "created" and its origin, and bumps the revision', () => {
        const sink = renderNested();
        act(() => {
            sink.street!.register({ entityTypeName: 'District', entity: { id: 501, name: 'Old' }, fieldName: 'Districts', status: 'created' });
        });
        act(() => {
            sink.root!.register({ entityTypeName: 'District', entity: { id: 501, name: 'New name' }, fieldName: 'DistrictIds', status: 'updated' });
        });
        const entries = sink.root!.entitiesOfType('District');
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            status: 'created',
            display: { id: 501, name: 'New name' },
            origin: { formPath: ['GateStructure', 'Street'], fieldName: 'Districts' },
            revision: 2
        });
    });

    it('ignores a non-embedded entity without an id', () => {
        const sink = renderNested();
        let result: unknown;
        act(() => {
            result = sink.root!.register({ entityTypeName: 'District', entity: { name: 'unsaved' }, fieldName: 'Districts', status: 'created' });
        });
        expect(result).toBeNull();
        expect(sink.root!.entities).toHaveLength(0);
    });

    it('upsertSessionEntity rejects a missing type', () => {
        const { entities, entry } = upsertSessionEntity([], { entityTypeName: ' ', entity: { id: 1 }, fieldName: 'x', status: 'created' }, [], 1, () => 'concept:1');
        expect(entry).toBeNull();
        expect(entities).toEqual([]);
    });
});

describe('useSessionPinnedRows (KNG-136)', () => {
    const Pins: React.FC<{ type: string; sink: { value?: ReturnType<typeof useSessionPinnedRows> } }> = ({ type, sink }) => {
        sink.value = useSessionPinnedRows(type);
        return null;
    };

    it('pins created entities of the type, newest first, with a refresh key that follows edits', () => {
        const sessions: Record<string, FormSessionValue | null> = {};
        const pins: { value?: ReturnType<typeof useSessionPinnedRows> } = {};
        render(
            <FormSessionScope formName="GateStructure">
                <Probe name="root" sink={sessions} />
                <Pins type="District" sink={pins} />
            </FormSessionScope>
        );
        expect(pins.value).toEqual({ pinnedRows: [] });

        act(() => {
            sessions.root!.register({ entityTypeName: 'District', entity: { id: 501, name: 'A' }, fieldName: 'Districts', status: 'created' });
            sessions.root!.register({ entityTypeName: 'district', entity: { id: 502, name: 'B' }, fieldName: 'Districts', status: 'created' });
            sessions.root!.register({ entityTypeName: 'District', entity: { id: 9, name: 'edited only' }, fieldName: 'Districts', status: 'updated' });
            sessions.root!.register({ entityTypeName: 'Street', entity: { id: 77 }, fieldName: 'Street', status: 'created' });
        });
        expect(pins.value!.pinnedRows.map(p => p.row)).toEqual([{ id: 502, name: 'B' }, { id: 501, name: 'A' }]);
        const before = pins.value!.refreshKey;
        expect(before).toBeTruthy();

        act(() => {
            sessions.root!.register({ entityTypeName: 'District', entity: { id: 501, name: 'A2' }, fieldName: 'Districts', status: 'updated' });
        });
        expect(pins.value!.refreshKey).not.toEqual(before);
    });

    it('never pins Locations', () => {
        const sessions: Record<string, FormSessionValue | null> = {};
        const pins: { value?: ReturnType<typeof useSessionPinnedRows> } = {};
        render(
            <FormSessionScope formName="GateStructure">
                <Probe name="root" sink={sessions} />
                <Pins type="Location" sink={pins} />
            </FormSessionScope>
        );
        act(() => {
            sessions.root!.register({ entityTypeName: 'Location', entity: { id: 83 }, fieldName: 'GuardSpawnLocations', status: 'created' });
        });
        expect(pins.value!.pinnedRows).toEqual([]);
    });
});
