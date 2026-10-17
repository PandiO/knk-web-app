import React from 'react';
import { act, render } from '@testing-library/react';
import {
    FormSessionRoot,
    FormSessionScope,
    FormSessionValue,
    SessionEntity,
    seedSessionEntities,
    useFormSession
} from '../FormSessionContext';
import { isRootFormOfSession, useCreatedEntitiesProvenance } from '../../hooks/useCreatedEntitiesProvenance';
import { useSessionPinnedRows } from '../../hooks/useSessionPinnedRows';

const Probe: React.FC<{ name: string; sink: Record<string, FormSessionValue | null> }> = ({ name, sink }) => {
    sink[name] = useFormSession();
    return null;
};

const recorded = [
    { entityTypeName: 'Street', id: 77, display: { name: 'Gatestraat' }, origin: { formPath: ['gatestructure'], fieldName: 'StreetId' }, sequence: 2 },
    { entityTypeName: 'District', id: 501, display: { name: 'Oostwijk' }, origin: { formPath: ['gatestructure', 'Street'], fieldName: 'Districts' }, sequence: 1 }
];

describe('FormSessionContext seed (KNG-162, D3)', () => {
    it('seedSessionEntities adds recorded entities as created, in recorded order, skipping known keys', () => {
        const existing: SessionEntity = {
            key: 'district:501', entityTypeName: 'District', id: 501, display: { id: 501, name: 'Oostwijk (fresh)' },
            origin: { formPath: ['x'], fieldName: 'y' }, status: 'created', embedded: false, sequence: 1, revision: 3
        };

        const { entities, lastSequence } = seedSessionEntities([existing], recorded, 2);

        expect(entities).toHaveLength(2);
        expect(entities[0]).toBe(existing);
        expect(entities[1]).toEqual(expect.objectContaining({
            key: 'street:77', entityTypeName: 'Street', id: 77, display: { name: 'Gatestraat', id: 77 },
            status: 'created', embedded: false, sequence: 2, revision: 1
        }));
        expect(lastSequence).toBe(2);
    });

    it('seedSessionEntities ignores entries without a type or id', () => {
        const { entities } = seedSessionEntities([], [
            { entityTypeName: '', id: 1, display: {}, origin: { formPath: [], fieldName: '' }, sequence: 1 },
            { entityTypeName: 'Town', id: '', display: {}, origin: { formPath: [], fieldName: '' }, sequence: 2 }
        ], 1);
        expect(entities).toEqual([]);
    });

    it('FormSessionRoot starts a registry the wizard scope joins; seeded entities are created, pinned and numbered before later ones', () => {
        const sink: Record<string, FormSessionValue | null> = {};
        const pins: { value?: ReturnType<typeof useSessionPinnedRows> } = {};
        const Pins: React.FC = () => {
            pins.value = useSessionPinnedRows('District');
            return null;
        };
        render(
            <FormSessionRoot>
                <Probe name="page" sink={sink} />
                <FormSessionScope formName="gatestructure">
                    <Probe name="root" sink={sink} />
                    <Pins />
                </FormSessionScope>
            </FormSessionRoot>
        );
        expect(sink.page!.formPath).toEqual([]);
        expect(sink.root!.formPath).toEqual(['gatestructure']);

        act(() => sink.root!.seed(recorded));
        act(() => {
            sink.root!.register({ entityTypeName: 'Town', entity: { id: 9, name: 'Rivia' }, fieldName: 'TownId', status: 'created' });
        });

        // The page-level reader sees the same registry.
        expect(sink.page!.createdEntities().map(e => [e.key, e.sequence])).toEqual([
            ['district:501', 1], ['street:77', 2], ['town:9', 3]
        ]);
        expect(pins.value!.pinnedRows.map(row => row.row.id)).toEqual([501]);

        // Seeding again changes nothing.
        act(() => sink.root!.seed(recorded));
        expect(sink.page!.entities).toHaveLength(3);
    });

    it('FormSessionRoot inside an existing session joins it', () => {
        const sink: Record<string, FormSessionValue | null> = {};
        render(
            <FormSessionScope formName="outer">
                <Probe name="outer" sink={sink} />
                <FormSessionRoot>
                    <Probe name="inner" sink={sink} />
                </FormSessionRoot>
            </FormSessionScope>
        );
        act(() => {
            sink.inner!.register({ entityTypeName: 'Town', entity: { id: 9 }, fieldName: 'TownId', status: 'created' });
        });
        expect(sink.outer!.entities).toHaveLength(1);
    });
});

describe('useCreatedEntitiesProvenance (KNG-162)', () => {
    type Provenance = ReturnType<typeof useCreatedEntitiesProvenance>;
    const ProvenanceProbe: React.FC<{ sink: Record<string, Provenance>; name: string; parentProgressId?: string }> = ({ sink, name, parentProgressId }) => {
        sink[name] = useCreatedEntitiesProvenance(useFormSession(), parentProgressId);
        return null;
    };

    it('only the root form of a session records and seeds', () => {
        expect(isRootFormOfSession(null)).toBe(false);
        const sink: Record<string, Provenance> = {};
        const sessions: Record<string, FormSessionValue | null> = {};
        render(
            <FormSessionScope formName="gatestructure">
                <ProvenanceProbe name="root" sink={sink} />
                <Probe name="root" sink={sessions} />
                <ProvenanceProbe name="rootWithParent" sink={sink} parentProgressId="12" />
                <FormSessionScope formName="Street">
                    <ProvenanceProbe name="child" sink={sink} />
                </FormSessionScope>
            </FormSessionScope>
        );

        expect(sink.root.isRoot).toBe(true);
        expect(sink.rootWithParent.isRoot).toBe(false);
        expect(sink.child.isRoot).toBe(false);
        expect(sink.root.createdEntitiesJson()).toBe('[]');
        expect(sink.child.createdEntitiesJson()).toBeUndefined();

        // A child wizard never seeds.
        act(() => sink.child.seedFromProgress({ createdEntitiesJson: JSON.stringify(recorded) }));
        expect(sessions.root!.entities).toHaveLength(0);

        act(() => sink.root.seedFromProgress({ createdEntitiesJson: JSON.stringify(recorded) }));
        act(() => {
            sessions.root!.register({ entityTypeName: 'Town', entity: { id: 9, name: 'Rivia' }, fieldName: 'TownId', status: 'created' });
        });

        const json = JSON.parse(sink.root.createdEntitiesJson()!);
        expect(json.map((r: { entityTypeName: string; id: number; sequence: number }) => [r.entityTypeName, r.id, r.sequence])).toEqual([
            ['District', 501, 1], ['Street', 77, 2], ['Town', 9, 3]
        ]);
        expect(json[2]).toEqual({ entityTypeName: 'Town', id: 9, display: { name: 'Rivia' }, origin: { formPath: ['gatestructure'], fieldName: 'TownId' }, sequence: 3 });
    });

    it('a progress without a record seeds nothing', () => {
        const sink: Record<string, Provenance> = {};
        const sessions: Record<string, FormSessionValue | null> = {};
        render(
            <FormSessionScope formName="gatestructure">
                <ProvenanceProbe name="root" sink={sink} />
                <Probe name="root" sink={sessions} />
            </FormSessionScope>
        );
        act(() => sink.root.seedFromProgress({ createdEntitiesJson: null }));
        act(() => sink.root.seedFromProgress(undefined));
        expect(sessions.root!.entities).toHaveLength(0);
    });
});
