import { renderHook } from '@testing-library/react';
import { accessNodesOf, entityAccessOf, useViewableTypes } from '../useEntityAccess';
import { PermissionStatus, usePermissions } from '../useStaffAccess';

jest.mock('../useStaffAccess', () => ({
    ...jest.requireActual('../useStaffAccess'),
    usePermissions: jest.fn(),
}));
jest.mock('../loadedEntityMetadata', () => ({ useLoadedEntityMetadata: () => [] }));

// PandiO/knk-workspace#280 (DESIGN § 4.7 web app): the gates of one type from its metadata.

const town = {
    accessNode: 'knk.admin.world',
    readNodes: ['knk.admin.world', 'knk.admin.config', 'knk.admin.road'],
    deletable: true,
    bulkDeletable: true,
    exportable: true,
    actionNodes: {
        view: ['knk.admin.world'],
        create: ['knk.admin.world'],
        edit: ['knk.admin.world'],
        delete: ['knk.admin.world', 'knk.admin.delete'],
        bulkDelete: ['knk.admin.world', 'knk.admin.delete', 'knk.admin.delete.bulk'],
        export: ['knk.admin.world', 'knk.admin.export'],
    },
};
const user = {
    accessNode: 'knk.admin.user.manage', readNodes: ['knk.admin.user.manage'], deletable: true, bulkDeletable: false, exportable: true,
    actionNodes: { view: ['knk.admin.user.manage'], create: ['knk.admin.user.manage'], edit: ['knk.admin.user.manage'],
        delete: ['knk.admin.user.manage', 'knk.admin.delete'], export: ['knk.admin.user.manage', 'knk.admin.export'] },
};

const held = (...nodes: string[]) => (all: string[]): Record<string, PermissionStatus> =>
    Object.fromEntries(all.map(node => [node, nodes.includes(node) ? 'allowed' : 'denied']));
const statusesFor = (meta: typeof town, ...nodes: string[]) => held(...nodes)(accessNodesOf([meta]));

describe('entityAccessOf', () => {
    it('gives an Admin (everything) every action', () => {
        const access = entityAccessOf(town, statusesFor(town, ...accessNodesOf([town]), 'knk.admin.delete', 'knk.admin.delete.bulk', 'knk.admin.export'));
        expect(['view', 'read', 'create', 'edit', 'delete', 'bulkDelete', 'export'].map(a => (access as any)[a].allowed)).toEqual(Array(7).fill(true));
    });

    it('gives an area holder without the action nodes create and edit, with hints for the rest (Staff-like)', () => {
        const access = entityAccessOf(town, statusesFor(town, 'knk.admin.world'), 'Town');
        expect(access.view.allowed && access.create.allowed && access.edit.allowed && access.read.allowed).toBe(true);
        expect(access.delete).toMatchObject({ allowed: false, hint: 'Requires knk.admin.delete' });
        expect(access.bulkDelete).toMatchObject({ allowed: false, hint: 'Requires knk.admin.delete and knk.admin.delete.bulk' });
        expect(access.export).toMatchObject({ allowed: false, hint: 'Requires knk.admin.export' });
    });

    it('lets a read node alone read, but not view, create or edit', () => {
        const access = entityAccessOf(town, statusesFor(town, 'knk.admin.config'));
        expect(access.read.allowed).toBe(true);
        expect(access.view).toMatchObject({ allowed: false, hint: 'Requires knk.admin.world' });
        expect(access.create.hint).toBe('Requires knk.admin.world');
    });

    it('says which read nodes would do', () => {
        const access = entityAccessOf(town, statusesFor(town, 'knk.admin.content'));
        expect(access.read).toMatchObject({ allowed: false, hint: 'Requires one of: knk.admin.world, knk.admin.config, knk.admin.road' });
    });

    it('never bulk deletes users, even for the owner', () => {
        const all = held('knk.admin.user.manage', 'knk.admin.delete', 'knk.admin.delete.bulk', 'knk.admin.export')(accessNodesOf([user]));
        const access = entityAccessOf(user as never, all, 'User');
        expect(access.delete.allowed).toBe(true);
        expect(access.bulkDelete).toMatchObject({ allowed: false, hint: 'User records can only be deleted one at a time.' });
    });

    it('asks for the fallback action nodes too when the metadata leaves an action out', () => {
        const partial = { accessNode: 'knk.admin.world', actionNodes: { edit: ['knk.admin.world'] } };
        expect(accessNodesOf([partial])).toEqual(['knk.admin.delete', 'knk.admin.delete.bulk', 'knk.admin.export', 'knk.admin.world']);
        const access = entityAccessOf(partial, held('knk.admin.world', 'knk.admin.export')(accessNodesOf([partial])));
        expect(access.export.allowed).toBe(true);
        expect(access.delete).toMatchObject({ allowed: false, hint: 'Requires knk.admin.delete' });
    });

    it('waits while a check runs and leaves an API before #280 to decide', () => {
        expect(entityAccessOf(town, {}).delete).toMatchObject({ allowed: false, checking: true, hint: null });
        const old = entityAccessOf({}, { 'knk.admin.export': 'allowed' });
        expect(old.known).toBe(false);
        expect(old.create.allowed && old.delete.allowed && old.export.allowed).toBe(true);
        expect(old.bulkDelete.allowed).toBe(false);
    });
});

describe('useViewableTypes', () => {
    it('keeps the types whose area node is held, and types without access fields', () => {
        (usePermissions as jest.Mock).mockImplementation((nodes: string[]) => held('knk.admin.world')(nodes));
        const metadata = [
            { entityName: 'Town', ...town },
            { entityName: 'User', ...user },
            { entityName: 'Legacy' },
        ];
        const { result } = renderHook(() => useViewableTypes(metadata as never[]));
        expect(result.current.types.map((m: any) => m.entityName)).toEqual(['Town', 'Legacy']);
        expect(result.current.checking).toBe(false);
    });
});
