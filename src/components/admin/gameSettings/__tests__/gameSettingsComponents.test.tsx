import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { buildLocationOptions, filterLocationOptions, toReference } from '../locationReferenceOptions';
import { GroupOverridesCard, groupDepth, orderByPrecedence } from '../GroupOverridesCard';
import { LocationReferencePicker } from '../LocationReferencePicker';
import { deserializeLegacyText } from '../MinecraftLegacyPreview';
import { RespawnPolicyEditor, defaultRespawnPolicy } from '../RespawnPolicyEditor';
import { fillMessagePlaceholders } from '../messagePlaceholders';
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

        fireEvent.click(screen.getByRole('button', { name: /Choose a spawn point/ }));
        fireEvent.change(screen.getByLabelText('Search spawn points'), { target: { value: 'noble' } });
        fireEvent.click(screen.getByRole('option', { name: /Noble Lounge/ }));

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'Structure', sourceId: 9 }));
    });

    it('resolves a structure that only carries a locationId, and trims names', () => {
        const built = buildLocationOptions(
            [loc(5, 'Hall door\n', 1418.2067)],
            [{ id: 1, name: ' Cinix ' }],
            [{ id: 2, name: 'Residential District\n', townId: 1, location: loc(6, 'Plaza', -173.688) }],
            [{ id: 3, name: 'Guild  Hall', districtId: 2, locationId: 5 }],
        );
        const structure = built.find(o => o.key === 'Structure-3')!;
        expect(structure.name).toBe('Guild Hall');
        expect(structure.parents).toEqual(['Cinix', 'Residential District']);
        expect(structure.displayLabel).toBe('Structure: Guild Hall (District: Residential District › Town: Cinix) - world 1418.2, 64, 3');
        expect(toReference(built.find(o => o.key === 'District-2')!).displayLabel)
            .toBe('District: Residential District (Town: Cinix) - world -173.7, 64, 3');
    });
});

describe('spawn point picker (KNG-52 round 3)', () => {
    const openPicker = () => fireEvent.click(screen.getByRole('button', { name: /Choose a spawn point/ }));

    it('shows the whole list, grouped, as soon as it opens, with focus in the search box', () => {
        render(<LocationReferencePicker value={null} options={options} onChange={jest.fn()} onCreateLocation={jest.fn()} />);
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        openPicker();

        const search = screen.getByRole('combobox', { name: 'Search spawn points' });
        expect(search).toHaveFocus();
        expect(screen.getAllByRole('option')).toHaveLength(options.length);
        expect(screen.getByRole('group', { name: 'Structures' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Towns' })).toBeInTheDocument();
        expect(search).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[0].id);
    });

    it('a row press keeps focus in the search box, so the pick is not lost to a blur (regression)', () => {
        const onChange = jest.fn();
        render(<LocationReferencePicker value={null} options={options} onChange={onChange} />);
        openPicker();

        fireEvent.click(screen.getByRole('button', { name: 'Structures' }));
        const row = screen.getByRole('option', { name: /Noble Lounge/ });
        // fireEvent returns false when a handler called preventDefault (no focus change, no blur).
        expect(fireEvent.mouseDown(row)).toBe(false);
        fireEvent.click(row);

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'Structure', sourceId: 9 }));
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('type chips filter the list', () => {
        render(<LocationReferencePicker value={null} options={options} onChange={jest.fn()} />);
        openPicker();

        fireEvent.click(screen.getByRole('button', { name: 'Structures' }));
        expect(screen.getByRole('button', { name: 'Structures' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getAllByRole('option')).toHaveLength(1);
        expect(screen.getByRole('option', { name: /Noble Lounge/ })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Locations' }));
        expect(screen.getAllByRole('option')).toHaveLength(3);

        fireEvent.click(screen.getByRole('button', { name: 'All' }));
        expect(screen.getAllByRole('option')).toHaveLength(options.length);
    });

    it('opens and picks with the keyboard, closes on Escape', () => {
        const onChange = jest.fn();
        render(<LocationReferencePicker value={null} options={options} onChange={onChange} />);
        const trigger = screen.getByRole('button', { name: /Choose a spawn point/ });

        fireEvent.keyDown(trigger, { key: 'ArrowDown' });
        fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        fireEvent.keyDown(trigger, { key: 'Enter' });
        // Groups: Towns (Kardenna), Districts (Docks), ...; the first row starts active.
        fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
        expect(screen.getByRole('option', { selected: true })).toHaveTextContent(/^Docks/);
        fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'District', sourceId: 7 }));
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('closes on an outside click and shows an empty state', () => {
        render(<div><button type="button">outside</button><LocationReferencePicker value={null} options={options} onChange={jest.fn()} /></div>);
        openPicker();

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } });
        expect(screen.getByText(/No spawn points match/)).toHaveTextContent('No spawn points match ‘zzz’');

        fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('caps each group and asks to type to narrow down', () => {
        const many = buildLocationOptions(Array.from({ length: 60 }, (_, i) => loc(i + 1, `Spot ${i + 1}`)), [], [], []);
        render(<LocationReferencePicker value={null} options={many} onChange={jest.fn()} />);
        openPicker();

        expect(screen.getAllByRole('option')).toHaveLength(50);
        expect(screen.getByText(/10 more locations - type to narrow down/)).toBeInTheDocument();
    });

    it('offers "New Location..." at the bottom of the panel', () => {
        const onCreate = jest.fn();
        render(<LocationReferencePicker value={null} options={options} onChange={jest.fn()} onCreateLocation={onCreate} />);
        expect(screen.queryByRole('button', { name: /New Location/ })).not.toBeInTheDocument();

        openPicker();
        fireEvent.click(screen.getByRole('button', { name: /New Location/ }));
        expect(onCreate).toHaveBeenCalled();
    });

    it('shows the choice as a card with type, name, parents and rounded coordinates', () => {
        const onChange = jest.fn();
        const structure = options.find(o => o.key === 'Structure-9')!;
        render(<LocationReferencePicker value={toReference(structure)} options={options} onChange={onChange} />);

        const card = screen.getByTestId('location-reference-selected');
        expect(card).toHaveTextContent('Structure');
        expect(card).toHaveTextContent('Noble Lounge');
        expect(card).toHaveTextContent('Kardenna › Docks');
        expect(card).toHaveTextContent('world 90, 64, 3');
        expect(screen.queryByText(/saved coordinates/)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Change' }));
        expect(screen.getByRole('combobox')).toHaveFocus();

        fireEvent.click(screen.getByRole('button', { name: 'Clear spawn point' }));
        expect(onChange).toHaveBeenCalledWith(null);
    });

    it('warns when the saved reference no longer resolves', () => {
        render(
            <LocationReferencePicker
                value={{ sourceType: 'Structure', sourceId: 99, displayLabel: 'Structure: Old Mill\n - world 1.25, 2, 3', location: { x: 1.25, y: 2, z: 3, yaw: 0, pitch: 0, world: 'world' } }}
                options={options}
                onChange={jest.fn()}
            />
        );
        expect(screen.getByRole('status')).toHaveTextContent('the saved coordinates are used: world 1.3, 2, 3');
        expect(screen.getByTestId('location-reference-selected')).toHaveTextContent(/^StructureOld MillChange$/);
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

    it('gives a group its own leave message, with a {title} preview', () => {
        let overrides: PermissionGroupGameSettingsDto[] = [{ permissionGroupId: 2, joinAnnouncement: null, leaveAnnouncement: null }];
        const onChange = jest.fn((next: PermissionGroupGameSettingsDto[]) => { overrides = next; });
        const { rerender, container } = render(<GroupOverridesCard overrides={overrides} groups={groups as any} options={options} onChange={onChange} />);
        expect(screen.queryByLabelText('Noble leave message')).not.toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Own leave message'));
        expect(overrides[0].leaveAnnouncement).toContain('left the server');
        expect(overrides[0].joinAnnouncement).toBeNull();

        rerender(<GroupOverridesCard overrides={overrides} groups={groups as any} options={options} onChange={onChange} />);
        fireEvent.change(screen.getByLabelText('Noble leave message'), { target: { value: '&7{group} {title} {player} left' } });
        expect(overrides[0].leaveAnnouncement).toBe('&7{group} {title} {player} left');

        rerender(<GroupOverridesCard overrides={overrides} groups={groups as any} options={options} onChange={onChange} />);
        expect(container).toHaveTextContent('Noble Knight Steve left');

        // Empty = the group's members leave silently; unticked = not overridden.
        fireEvent.change(screen.getByLabelText('Noble leave message'), { target: { value: '' } });
        expect(overrides[0].leaveAnnouncement).toBe('');
        rerender(<GroupOverridesCard overrides={overrides} groups={groups as any} options={options} onChange={onChange} />);
        fireEvent.click(screen.getByLabelText('Own leave message'));
        expect(overrides[0].leaveAnnouncement).toBeNull();
    });

    it('own spawn waits for a chosen spot instead of taking the first one', () => {
        let overrides: PermissionGroupGameSettingsDto[] = [{ permissionGroupId: 2, joinSpawnReference: null }];
        const onChange = jest.fn((next: PermissionGroupGameSettingsDto[]) => { overrides = next; });
        const { rerender } = render(<GroupOverridesCard overrides={overrides} groups={groups as any} options={options} onChange={onChange} />);

        fireEvent.click(screen.getByLabelText(/Own spawn/));
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: /Choose a spawn point/ }));
        fireEvent.click(screen.getByRole('option', { name: /Noble Lounge/ }));
        expect(overrides[0].joinSpawnReference).toEqual(expect.objectContaining({ sourceType: 'Structure', sourceId: 9 }));

        rerender(<GroupOverridesCard overrides={overrides} groups={groups as any} options={options} onChange={onChange} />);
        expect(screen.getByTestId('location-reference-selected')).toHaveTextContent('Noble Lounge');
    });

    it('own spawn can be "where they logged out" instead of a chosen spot (round 4)', () => {
        const structure = options.find(o => o.key === 'Structure-9')!;
        let overrides: PermissionGroupGameSettingsDto[] = [{ permissionGroupId: 2, joinSpawnReference: toReference(structure), joinAtLastLocation: null }];
        const onChange = jest.fn((next: PermissionGroupGameSettingsDto[]) => { overrides = next; });
        const card = () => <GroupOverridesCard overrides={overrides} groups={groups as any} options={options} onChange={onChange} />;
        const { rerender } = render(card());

        expect(screen.getByLabelText(/Own spawn/)).toBeChecked();
        expect(screen.getByRole('radio', { name: 'A chosen spot' })).toBeChecked();

        fireEvent.click(screen.getByRole('radio', { name: 'Where they logged out (no join teleport)' }));
        expect(overrides[0]).toEqual(expect.objectContaining({ joinAtLastLocation: true, joinSpawnReference: null }));

        rerender(card());
        expect(screen.getByLabelText(/Own spawn/)).toBeChecked();
        expect(screen.getByRole('radio', { name: 'Where they logged out (no join teleport)' })).toBeChecked();
        expect(screen.getByText(/Members stay where they logged out, like owners\./)).toHaveTextContent(
            'Members stay where they logged out, like owners. /spawn still takes them to the server spawn.');
        expect(screen.queryByTestId('location-reference-selected')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Choose a spawn point/ })).not.toBeInTheDocument();

        // Back to a chosen spot: the picker returns, nothing is chosen yet.
        fireEvent.click(screen.getByRole('radio', { name: 'A chosen spot' }));
        expect(overrides[0].joinAtLastLocation).toBeNull();
        rerender(card());
        expect(screen.getByRole('button', { name: /Choose a spawn point/ })).toBeInTheDocument();

        // Unticked = both null.
        fireEvent.click(screen.getByRole('radio', { name: 'Where they logged out (no join teleport)' }));
        rerender(card());
        fireEvent.click(screen.getByLabelText(/Own spawn/));
        expect(overrides[0]).toEqual(expect.objectContaining({ joinAtLastLocation: null, joinSpawnReference: null }));
        rerender(card());
        expect(screen.getByLabelText(/Own spawn/)).not.toBeChecked();
        expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });

    it('the picker\'s search box looks the same in the group card as anywhere else (round 4 layout)', () => {
        // Ids from useId differ per instance.
        const searchRow = () => screen.getByTestId('spawn-search-row').outerHTML
            .replace(/id="[^"]*"|aria-(controls|activedescendant)="[^"]*"/g, '');
        const { unmount } = render(<LocationReferencePicker value={null} options={options} onChange={jest.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Choose a spawn point/ }));
        const standalone = searchRow();
        unmount();

        render(<GroupOverridesCard overrides={[{ permissionGroupId: 2, joinSpawnReference: null }]} groups={groups as any} options={options} onChange={jest.fn()} />);
        fireEvent.click(screen.getByLabelText(/Own spawn/));
        fireEvent.click(screen.getByRole('button', { name: /Choose a spawn point/ }));
        expect(searchRow()).toBe(standalone);

        // No @tailwindcss/forms here: the input brings its own box, padding and focus ring, and the
        // icon is centred on it rather than offset from the top.
        const search = screen.getByRole('combobox', { name: 'Search spawn points' });
        ['border', 'py-2', 'pl-9', 'h-9', 'focus:outline-none', 'focus:ring-2'].forEach(c => expect(search).toHaveClass(c));
        expect(screen.getByTestId('spawn-search-icon')).toHaveClass('top-1/2', '-translate-y-1/2', 'left-3');
    });
});

describe('respawn mode and message placeholders (KNG-52 round 3)', () => {
    it('labels WorldSpawn as the world spawn with beds and anchors ignored (D1)', () => {
        render(<RespawnPolicyEditor value={defaultRespawnPolicy()} options={options} onChange={jest.fn()} />);
        expect(screen.getByRole('option', { name: 'World spawn (beds and anchors ignored)' })).toBeInTheDocument();
        expect(screen.getByLabelText('Respawn mode')).toHaveDisplayValue('World spawn (beds and anchors ignored)');
        expect(screen.getByText(/beds and respawn anchors are ignored/)).toBeInTheDocument();
        expect(screen.queryByText(/beds and respawn anchors count/)).not.toBeInTheDocument();
    });

    it('offers ServerDefault as "Server decides", in the agreed order (round 4)', () => {
        const onChange = jest.fn();
        const { rerender } = render(<RespawnPolicyEditor value={defaultRespawnPolicy()} options={options} onChange={onChange} />);
        const modeOptions = within(screen.getByLabelText('Respawn mode')).getAllByRole('option') as HTMLOptionElement[];
        expect(modeOptions.map(o => o.value)).toEqual(['JoinSpawn', 'WorldSpawn', 'ServerDefault', 'ConfiguredReference', 'NearestTown']);
        expect(modeOptions[2]).toHaveTextContent('Server decides (bed / anchor, else world spawn)');

        fireEvent.change(screen.getByLabelText('Respawn mode'), { target: { value: 'ServerDefault' } });
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'ServerDefault' }));

        rerender(<RespawnPolicyEditor value={{ ...defaultRespawnPolicy(), mode: 'ServerDefault' }} options={options} onChange={onChange} />);
        expect(screen.getByText('Like staff and owners: beds and respawn anchors count.')).toBeInTheDocument();
        // The fallback checkbox stays with the chosen-spot and nearest-town modes.
        expect(screen.queryByText(/If no spot is found/)).not.toBeInTheDocument();
    });

    it('fills {title} and {titlename}, and an empty title takes a neighbouring space', () => {
        const values = { player: 'Steve', title: 'Knight', group: 'Noble' };
        expect(fillMessagePlaceholders('&6[{group}] {title} {player}', values)).toBe('&6[Noble] Knight Steve');
        expect(fillMessagePlaceholders('{titlename} {player}', values)).toBe('Knight Steve');
        expect(fillMessagePlaceholders('{group} {title} {player} joined', { ...values, title: '' })).toBe('Noble Steve joined');
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
