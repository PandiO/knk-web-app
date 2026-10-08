import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { buildLocationOptions, filterLocationOptions } from '../locationReferenceOptions';
import { GroupOverridesCard, groupDepth, orderByPrecedence } from '../GroupOverridesCard';
import { LocationReferencePicker } from '../LocationReferencePicker';
import { deserializeLegacyText } from '../MinecraftLegacyPreview';
import { PermissionGroupGameSettingsDto } from '../../../../types/dtos/gameSettings/GameSettingsModels';

const loc = (id: number, name: string, x = 1) => ({ id, name, x, y: 64, z: 3, yaw: 0, pitch: 0, world: 'world' });

const options = buildLocationOptions(
    [loc(1, 'Kardenna square'), loc(2, 'Docks pier', 50), loc(3, 'Lounge door', 90)],
    [{ id: 4, name: 'Kardenna', locationId: 1 }],
    [{ id: 7, name: 'Docks', townId: 4, locationId: 2 }],
    [{ id: 9, name: 'Noble Lounge', districtId: 7, location: loc(3, 'Lounge door', 90) }],
);

describe('location reference options (KNG-52)', () => {
    it('lists locations and domains with their parent domains', () => {
        const structure = options.find(o => o.sourceType === 'Structure')!;
        expect(structure.parentLabel).toBe('District: Docks › Town: Kardenna');
        expect(options.find(o => o.sourceType === 'District')!.parentLabel).toBe('Town: Kardenna');
        expect(options.filter(o => o.sourceType === 'Location')).toHaveLength(3);
    });

    it('finds by id, name or parent domain, every word must match', () => {
        expect(filterLocationOptions(options, 'All', '#9').map(o => o.key)).toEqual(['Structure-9']);
        expect(filterLocationOptions(options, 'Structure', 'kardenna').map(o => o.key)).toEqual(['Structure-9']);
        expect(filterLocationOptions(options, 'All', 'docks').map(o => o.key).sort()).toEqual(['District-7', 'Location-2', 'Structure-9']);
        expect(filterLocationOptions(options, 'All', 'docks lounge').map(o => o.key)).toEqual(['Structure-9']);
        expect(filterLocationOptions(options, 'Town', '')).toHaveLength(1);
    });

    it('the picker selects a searched domain', () => {
        const onChange = jest.fn();
        render(<LocationReferencePicker value={null} options={options} onChange={onChange} />);

        fireEvent.change(screen.getByLabelText('Search spawn points'), { target: { value: 'noble' } });
        fireEvent.click(screen.getByRole('option', { name: /Structure #9: Noble Lounge/ }));

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'Structure', sourceId: 9 }));
    });
});

describe('group override precedence (KNG-52)', () => {
    const groups = [
        { id: 1, name: 'Default', weight: 0, parentGroupId: null },
        { id: 2, name: 'Noble', weight: 10, parentGroupId: 1 },
        { id: 3, name: 'Staff', weight: 100, parentGroupId: null },
        { id: 4, name: 'Admin', weight: 5, parentGroupId: 3 },
    ];

    it('counts parents and survives cycles', () => {
        expect(groupDepth(1, groups)).toBe(0);
        expect(groupDepth(2, groups)).toBe(1);
        expect(groupDepth(10, [{ id: 10, name: 'A', weight: 0, parentGroupId: 11 }, { id: 11, name: 'B', weight: 0, parentGroupId: 10 }])).toBe(1);
    });

    it('orders hierarchy first, then weight', () => {
        const ordered = orderByPrecedence([1, 2, 3, 4].map(id => ({ permissionGroupId: id })), groups);
        expect(ordered.map(o => o.permissionGroupId)).toEqual([2, 4, 3, 1]);
    });

    it('adds a group and edits its join message', () => {
        let overrides: PermissionGroupGameSettingsDto[] = [];
        const onChange = jest.fn((next: PermissionGroupGameSettingsDto[]) => { overrides = next; });
        const { rerender } = render(<GroupOverridesCard overrides={overrides} groups={groups as any} options={options} onChange={onChange} />);

        fireEvent.change(screen.getByLabelText('Group to add'), { target: { value: '2' } });
        fireEvent.click(screen.getByRole('button', { name: /Add override/ }));
        expect(overrides).toEqual([expect.objectContaining({ permissionGroupId: 2, joinAnnouncement: null })]);

        rerender(<GroupOverridesCard overrides={overrides} groups={groups as any} options={options} onChange={onChange} />);
        fireEvent.click(screen.getByLabelText('Own join message'));
        expect(overrides[0].joinAnnouncement).toContain('{player}');

        rerender(<GroupOverridesCard overrides={overrides} groups={groups as any} options={options} onChange={onChange} />);
        fireEvent.change(screen.getByLabelText('Noble join message'), { target: { value: '&6[{group}] {player}' } });
        expect(overrides[0].joinAnnouncement).toBe('&6[{group}] {player}');

        fireEvent.click(screen.getByLabelText('Own respawn (in every world; replaces the world\'s policy)'));
        expect(overrides[0].respawnPolicy).toEqual(expect.objectContaining({ mode: 'JoinSpawn' }));
    });
});

describe('legacy text preview', () => {
    it('renders several colours and hex', () => {
        const segments = deserializeLegacyText('§6Gold §x§f§f§a§a§0§0Hex §aGreen');
        expect(segments.map(s => [s.text, s.style.color])).toEqual([
            ['Gold ', '#FFAA00'],
            ['Hex ', '#FFAA00'],
            ['Green', '#55FF55'],
        ]);
    });
});
