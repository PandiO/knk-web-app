import { renderHook } from '@testing-library/react';
import { accessNodesOf, changeNodesOf, entityAccessOf, useCreateAllowed, useTypeChangeGate, useViewableTypes, withContentNode } from '../useEntityAccess';
import { PermissionStatus, usePermissions } from '../useStaffAccess';

jest.mock('../useStaffAccess', () => ({
    ...jest.requireActual('../useStaffAccess'),
    usePermissions: jest.fn(),
}));
const mockLoadedMetadata: { current: unknown[] } = { current: [] };
jest.mock('../loadedEntityMetadata', () => ({ useLoadedEntityMetadata: () => mockLoadedMetadata.current }));

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

    it('gives an area holder without the action nodes view and read, but create and edit only with knk.admin.content (#371)', () => {
        const access = entityAccessOf(town, statusesFor(town, 'knk.admin.world'), 'Town');
        expect(access.view.allowed && access.read.allowed).toBe(true);
        expect(access.create).toMatchObject({ allowed: false, hint: 'Requires knk.admin.content' });
        expect(access.edit).toMatchObject({ allowed: false, hint: 'Requires knk.admin.content' });
        expect(access.delete).toMatchObject({ allowed: false, hint: 'Requires knk.admin.delete' });
        expect(access.bulkDelete).toMatchObject({ allowed: false, hint: 'Requires knk.admin.delete and knk.admin.delete.bulk' });
        expect(access.export).toMatchObject({ allowed: false, hint: 'Requires knk.admin.export' });
    });

    it('gives the area node plus knk.admin.content create and edit (#371)', () => {
        const access = entityAccessOf(town, statusesFor(town, 'knk.admin.world', 'knk.admin.content'), 'Town');
        expect(access.create.allowed && access.edit.allowed).toBe(true);
        expect(access.create.nodes).toEqual(['knk.admin.world', 'knk.admin.content']);
    });

    it('keeps the type\'s own create and edit nodes for a content-only account (#371)', () => {
        const access = entityAccessOf(town, statusesFor(town, 'knk.admin.content'), 'Town');
        expect(access.create).toMatchObject({ allowed: false, hint: 'Requires knk.admin.world' });
        expect(access.edit).toMatchObject({ allowed: false, hint: 'Requires knk.admin.world' });
    });

    it('keeps a user\'s Edit (the player profile) on the user node, but New needs knk.admin.content (#371)', () => {
        const access = entityAccessOf({ entityName: 'User', ...user } as never, held('knk.admin.user.manage')(accessNodesOf([user])), 'User');
        expect(access.edit.allowed).toBe(true);
        expect(access.create).toMatchObject({ allowed: false, hint: 'Requires knk.admin.content' });
    });

    it('keeps delete and export on their own nodes without knk.admin.content (#371)', () => {
        const access = entityAccessOf(town, statusesFor(town, 'knk.admin.world', 'knk.admin.delete', 'knk.admin.export'), 'Town');
        expect(access.delete.allowed && access.export.allowed).toBe(true);
        expect(access.edit.allowed).toBe(false);
    });

    it('lets a read node alone read, but not view, create or edit', () => {
        const access = entityAccessOf(town, statusesFor(town, 'knk.admin.config'));
        expect(access.read.allowed).toBe(true);
        expect(access.view).toMatchObject({ allowed: false, hint: 'Requires knk.admin.world' });
        expect(access.create.hint).toBe('Requires knk.admin.world and knk.admin.content');
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
        expect(accessNodesOf([partial])).toEqual(['knk.admin.content', 'knk.admin.delete', 'knk.admin.delete.bulk', 'knk.admin.export', 'knk.admin.world']);
        const access = entityAccessOf(partial, held('knk.admin.world', 'knk.admin.export')(accessNodesOf([partial])));
        expect(access.export.allowed).toBe(true);
        expect(access.delete).toMatchObject({ allowed: false, hint: 'Requires knk.admin.delete' });
    });

    it('waits while a check runs and leaves an API before #280 to decide', () => {
        expect(entityAccessOf(town, {}).delete).toMatchObject({ allowed: false, checking: true, hint: null });
        const old = entityAccessOf({}, { 'knk.admin.export': 'allowed', 'knk.admin.content': 'allowed' });
        expect(old.known).toBe(false);
        expect(old.create.allowed && old.edit.allowed && old.delete.allowed && old.export.allowed).toBe(true);
        expect(old.bulkDelete.allowed).toBe(false);
        // #371: the wizard needs knk.admin.content even when the API has no access fields.
        const oldNoContent = entityAccessOf({}, { 'knk.admin.export': 'allowed', 'knk.admin.content': 'denied' });
        expect(oldNoContent.create).toMatchObject({ allowed: false, hint: 'Requires knk.admin.content' });
        expect(oldNoContent.delete.allowed).toBe(true);
    });
});

describe('withContentNode (#371)', () => {
    it('adds knk.admin.content once and keeps the order', () => {
        expect(withContentNode(['knk.admin.world'])).toEqual(['knk.admin.world', 'knk.admin.content']);
        expect(withContentNode(['knk.admin.content', 'knk.admin.world'])).toEqual(['knk.admin.content', 'knk.admin.world']);
        expect(withContentNode(undefined)).toEqual(['knk.admin.content']);
        expect(withContentNode(['', 'knk.kit.manage'])).toEqual(['knk.kit.manage', 'knk.admin.content']);
    });
});

describe('useCreateAllowed (picker Create New, #371)', () => {
    afterEach(() => { mockLoadedMetadata.current = []; });

    it('hides Create New for an area holder without knk.admin.content', () => {
        mockLoadedMetadata.current = [{ entityName: 'Town', ...town }];
        (usePermissions as jest.Mock).mockImplementation((nodes: string[]) => held('knk.admin.world')(nodes));
        expect(renderHook(() => useCreateAllowed('town')).result.current).toBe(false);
    });

    it('shows Create New with the area node and knk.admin.content', () => {
        mockLoadedMetadata.current = [{ entityName: 'Town', ...town }];
        (usePermissions as jest.Mock).mockImplementation((nodes: string[]) => held('knk.admin.world', 'knk.admin.content')(nodes));
        expect(renderHook(() => useCreateAllowed('town')).result.current).toBe(true);
    });

    it('asks for knk.admin.content for a type without access fields too', () => {
        mockLoadedMetadata.current = [{ entityName: 'Legacy' }];
        (usePermissions as jest.Mock).mockImplementation((nodes: string[]) => held()(nodes));
        expect(renderHook(() => useCreateAllowed('Legacy')).result.current).toBe(false);
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

describe('changeNodesOf (#383: non-form saves through a gated create/update)', () => {
    it('adds knk.admin.content to the type\'s create and edit nodes', () => {
        expect(changeNodesOf({ entityName: 'Street', ...town }, 'create')).toEqual(['knk.admin.world', 'knk.admin.content']);
        expect(changeNodesOf({ entityName: 'Town', ...town }, 'edit')).toEqual(['knk.admin.world', 'knk.admin.content']);
    });

    it('does not add it twice against an API with #374', () => {
        const lootbox = { ...town, actionNodes: { ...town.actionNodes, edit: ['knk.admin.lootbox.manage', 'knk.admin.content'] } };
        expect(changeNodesOf(lootbox, 'edit', 'LootboxType')).toEqual(['knk.admin.lootbox.manage', 'knk.admin.content']);
    });

    it('falls back to the area node, and to knk.admin.content alone without access fields', () => {
        const noEdit = { ...town, actionNodes: { view: ['knk.admin.world'] } };
        expect(changeNodesOf(noEdit, 'edit', 'Town')).toEqual(['knk.admin.world', 'knk.admin.content']);
        expect(changeNodesOf(undefined, 'create', 'Street')).toEqual(['knk.admin.content']);
    });

    it('leaves a user\'s edit on its own nodes (User is exempt in the API)', () => {
        expect(changeNodesOf({ entityName: 'User', ...user }, 'edit')).toEqual(['knk.admin.user.manage']);
    });
});

describe('useTypeChangeGate (#383)', () => {
    afterEach(() => { mockLoadedMetadata.current = []; });

    it('says "Requires knk.admin.content" to an area holder without it', () => {
        mockLoadedMetadata.current = [{ entityName: 'Street', ...town }];
        (usePermissions as jest.Mock).mockImplementation((nodes: string[]) => held('knk.admin.world')(nodes));
        expect(renderHook(() => useTypeChangeGate('street', 'create')).result.current)
            .toMatchObject({ allowed: false, hint: 'Requires knk.admin.content' });
    });

    it('allows the area node plus knk.admin.content', () => {
        mockLoadedMetadata.current = [{ entityName: 'Street', ...town }];
        (usePermissions as jest.Mock).mockImplementation((nodes: string[]) => held('knk.admin.world', 'knk.admin.content')(nodes));
        expect(renderHook(() => useTypeChangeGate('Street', 'create')).result.current).toMatchObject({ allowed: true, hint: null });
    });
});
