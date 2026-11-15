import type { EffectivePermissionEntryDto } from '../../../../types/dtos/userManagement/UserProfileSummaryDtos';
import {
    filterEffectivePermissions,
    permissionSourceLabel,
    sortEffectivePermissions,
} from '../effectivePermissions';

// PandiO/knk-workspace#407: search and sort of the player profile's Effective Permissions list.

const direct = (node: string, value = true): EffectivePermissionEntryDto =>
    ({ node, value, sourceHolderId: 42, sourceHolderType: 'User' });
const fromGroup = (node: string, name: string | null, id = 2, value = true): EffectivePermissionEntryDto =>
    ({ node, value, sourceHolderId: id, sourceHolderType: 'PermissionGroup', sourceHolderName: name });

// The API's order, which the list keeps without a sort.
const entries: EffectivePermissionEntryDto[] = [
    fromGroup('knk.build.place', 'Builder'),
    direct('knk.gate.open'),
    fromGroup('knk.admin.user.manage', 'Staff', 3),
    direct('knk.chat.color', false),
    fromGroup('knk.town.join', null, 9),
];
const nodes = (list: EffectivePermissionEntryDto[]) => list.map(e => e.node);

describe('permissionSourceLabel', () => {
    it('names a direct grant, a group by name and a nameless group by id', () => {
        expect(permissionSourceLabel(direct('a'))).toBe('Direct grant');
        expect(permissionSourceLabel(fromGroup('a', 'Builder'))).toBe('Builder');
        expect(permissionSourceLabel(fromGroup('a', null, 9))).toBe('Group #9');
    });
});

describe('filterEffectivePermissions', () => {
    it('keeps every row in the given order for an empty or blank query', () => {
        expect(nodes(filterEffectivePermissions(entries, ''))).toEqual(nodes(entries));
        expect(nodes(filterEffectivePermissions(entries, '   '))).toEqual(nodes(entries));
    });

    it('matches part of the node, ignoring case and surrounding spaces', () => {
        expect(nodes(filterEffectivePermissions(entries, '  GATE '))).toEqual(['knk.gate.open']);
        expect(nodes(filterEffectivePermissions(entries, 'knk.admin'))).toEqual(['knk.admin.user.manage']);
    });

    it('matches the source: "direct" finds direct grants, a group name what that group gives', () => {
        expect(nodes(filterEffectivePermissions(entries, 'direct'))).toEqual(['knk.gate.open', 'knk.chat.color']);
        expect(nodes(filterEffectivePermissions(entries, 'builder'))).toEqual(['knk.build.place']);
        expect(nodes(filterEffectivePermissions(entries, 'group #9'))).toEqual(['knk.town.join']);
    });

    it('returns nothing when no node or source matches', () => {
        expect(filterEffectivePermissions(entries, 'nope')).toEqual([]);
    });
});

describe('sortEffectivePermissions', () => {
    it('keeps the given order without a sort or with an unknown column, and never changes the input', () => {
        const before = nodes(entries);
        expect(nodes(sortEffectivePermissions(entries, null))).toEqual(before);
        expect(nodes(sortEffectivePermissions(entries, { key: 'expires', descending: false }))).toEqual(before);
        sortEffectivePermissions(entries, { key: 'node', descending: true });
        expect(nodes(entries)).toEqual(before);
    });

    it('sorts by node both ways', () => {
        const asc = ['knk.admin.user.manage', 'knk.build.place', 'knk.chat.color', 'knk.gate.open', 'knk.town.join'];
        expect(nodes(sortEffectivePermissions(entries, { key: 'node', descending: false }))).toEqual(asc);
        expect(nodes(sortEffectivePermissions(entries, { key: 'node', descending: true }))).toEqual([...asc].reverse());
    });

    it('sorts by value as shown (Denied before Granted ascending), ties by node', () => {
        const asc = sortEffectivePermissions(entries, { key: 'value', descending: false });
        expect(nodes(asc)).toEqual(['knk.chat.color', 'knk.admin.user.manage', 'knk.build.place', 'knk.gate.open', 'knk.town.join']);
        const desc = sortEffectivePermissions(entries, { key: 'value', descending: true });
        expect(nodes(desc)).toEqual(['knk.town.join', 'knk.gate.open', 'knk.build.place', 'knk.admin.user.manage', 'knk.chat.color']);
    });

    it('sorts by the source shown, ignoring case, ties by node', () => {
        const asc = sortEffectivePermissions(entries, { key: 'source', descending: false });
        // Builder, Direct grant (chat, gate), Group #9, Staff
        expect(nodes(asc)).toEqual(['knk.build.place', 'knk.chat.color', 'knk.gate.open', 'knk.town.join', 'knk.admin.user.manage']);
        const desc = sortEffectivePermissions(entries, { key: 'source', descending: true });
        expect(nodes(desc)).toEqual([...nodes(asc)].reverse());
    });
});
