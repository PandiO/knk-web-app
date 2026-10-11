import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HubSettingsCard, defaultHubSettings } from '../HubSettingsCard';
import { GroupOverridesCard } from '../GroupOverridesCard';
import { buildDomainOptions, buildLocationOptions } from '../locationReferenceOptions';
import { gameSettingsErrorMessage } from '../gameSettingsErrors';
import { gameSettingsClient } from '../../../../apiClients/gameSettingsClient';
import { HubDomainDto, HubSettingsDto, PermissionGroupGameSettingsDto } from '../../../../types/dtos/gameSettings/GameSettingsModels';

jest.mock('../../../../apiClients/gameSettingsClient', () => ({
    gameSettingsClient: {
        setHubEligible: jest.fn(),
        getHubDomains: jest.fn(),
    },
}));

const loc = (id: number, name: string, world = 'hub') => ({ id, name, x: 1, y: 64, z: 3, yaw: 0, pitch: 0, world });
const options = buildLocationOptions(
    [loc(1, 'Hub square'), loc(2, 'Oak square', 'world')],
    [{ id: 4, name: 'Hubtown', locationId: 1 }, { id: 5, name: 'Oakhaven', locationId: 2 }],
    [],
    [],
);
// Square has no Location of its own: it can still be flagged (Codex review of PR #6).
const domains = buildDomainOptions(
    [{ id: 4, name: 'Hubtown', locationId: 1 }, { id: 5, name: 'Oakhaven', locationId: 2 }],
    [{ id: 6, name: 'Square', townId: 4 }],
    [],
);
const hubtown: HubDomainDto = { id: 4, name: 'Hubtown', domainType: 'Town', worldName: 'hub', isHub: true, selected: false };

describe('HubSettingsCard (hub DESIGN §16 Phase 4)', () => {
    it('flags a domain at once and selects it as the hub', async () => {
        (gameSettingsClient.setHubEligible as jest.Mock).mockResolvedValue({ ...hubtown });
        (gameSettingsClient.getHubDomains as jest.Mock).mockResolvedValue([hubtown]);
        const onHubDomainsChange = jest.fn();
        let hub: HubSettingsDto = defaultHubSettings();
        const onChange = jest.fn((next: HubSettingsDto) => { hub = next; });
        const { rerender } = render(<HubSettingsCard hub={hub} hubDomains={[]} domainOptions={domains} options={options}
            onChange={onChange} onHubDomainsChange={onHubDomainsChange} />);

        fireEvent.change(screen.getByLabelText('Domain to flag as hub'), { target: { value: '4' } });
        fireEvent.click(screen.getByRole('button', { name: /Flag as hub/ }));
        await waitFor(() => expect(onHubDomainsChange).toHaveBeenCalledWith([hubtown]));
        expect(gameSettingsClient.setHubEligible).toHaveBeenCalledWith(4, true);

        rerender(<HubSettingsCard hub={hub} hubDomains={[hubtown]} domainOptions={domains} options={options}
            onChange={onChange} onHubDomainsChange={onHubDomainsChange} />);
        fireEvent.change(screen.getByLabelText('Selected hub'), { target: { value: '4' } });
        expect(hub.domainId).toBe(4);
        expect(hub.outageAction).toBe('SendToHub');
        expect(hub.rules.dropPickup && !hub.rules.damagePlayers).toBe(true);
    });

    it('warns when the spawn is in another world than the hub, and shows the API refusal of a nested hub', async () => {
        (gameSettingsClient.setHubEligible as jest.Mock).mockRejectedValue({ status: 400, response: { message: "'Square' and 'Hubtown' would be nested hubs" } });
        const hub: HubSettingsDto = {
            ...defaultHubSettings(),
            domainId: 4,
            spawnReference: { sourceType: 'Location', sourceId: 2, displayLabel: 'Oak square', location: loc(2, 'Oak square', 'world') },
        };
        render(<HubSettingsCard hub={hub} hubDomains={[{ ...hubtown, selected: true }]} domainOptions={domains} options={options}
            onChange={jest.fn()} onHubDomainsChange={jest.fn()} />);

        expect(screen.getByText(/The spawn is in world 'world', but the hub is in world 'hub'/)).toBeInTheDocument();
        expect(screen.getByLabelText('Remove the hub flag of Hubtown')).toBeDisabled();

        fireEvent.change(screen.getByLabelText('Domain to flag as hub'), { target: { value: '5' } });
        fireEvent.click(screen.getByRole('button', { name: /Flag as hub/ }));
        expect(await screen.findByRole('alert')).toHaveTextContent('would be nested hubs');
    });
});

describe('Hub-eligible domains (Codex review of PR #6)', () => {
    it('lists every town, district and structure, also one without a Location', () => {
        expect(domains.map(d => `${d.sourceType}:${d.name}:${d.parents.join('/')}`))
            .toEqual(['Town:Hubtown:', 'Town:Oakhaven:', 'District:Square:Hubtown']);
        expect(options.some(o => o.name === 'Square')).toBe(false);
    });

    it('says the flagged domains could not be loaded instead of "none flagged", and locks the hub', () => {
        render(<HubSettingsCard hub={{ ...defaultHubSettings(), domainId: 4 }} hubDomains={[]} domainOptions={domains} options={options}
            hubDomainsError="The hub-eligible domains could not be loaded" onChange={jest.fn()} onHubDomainsChange={jest.fn()} />);

        expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded');
        expect(screen.queryByText('No domain is flagged yet.')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Selected hub')).toBeDisabled();
        expect(screen.getByRole('button', { name: /Flag as hub/ })).toBeDisabled();
    });

    it('formats a refused save without the lootbox wording', () => {
        expect(gameSettingsErrorMessage({ status: 400, response: "The hub spawn is in world 'world'" }, 'x')).toBe("The hub spawn is in world 'world'");
        expect(gameSettingsErrorMessage({ status: 403 }, 'x')).toContain('knk.admin.config');
        expect(gameSettingsErrorMessage({ status: 403 }, 'x')).not.toContain('lootbox');
        expect(gameSettingsErrorMessage({ status: 400, response: { errors: { Hub: ['Pick a spawn'] } } }, 'x')).toBe('Pick a spawn');
        expect(gameSettingsErrorMessage({ status: 500 }, 'Could not save')).toBe('Could not save');
    });
});

describe('GroupOverridesCard hub exemptions (KNG-116)', () => {
    const groups = [{ id: 1, name: 'Staff', weight: 100, parentGroupId: null }, { id: 2, name: 'Noble', weight: 10, parentGroupId: null }];

    it('shows an exemption box only for a group that has the mode node, and stores only a ticked box', () => {
        let overrides: PermissionGroupGameSettingsDto[] = [{ permissionGroupId: 1 }, { permissionGroupId: 2 }];
        const onChange = jest.fn((next: PermissionGroupGameSettingsDto[]) => { overrides = next; });
        render(<GroupOverridesCard overrides={overrides} groups={groups as any} options={options} onChange={onChange}
            eligibility={[
                { permissionGroupId: 1, groupName: 'Staff', canExemptStaffMode: true, staffModeSource: 'Staff', canExemptOwnerMode: false },
                { permissionGroupId: 2, groupName: 'Noble', canExemptStaffMode: false, canExemptOwnerMode: false },
            ]} />);

        expect(screen.getAllByText('Exempt while in staff mode')).toHaveLength(1);
        expect(screen.queryByText('Exempt while in owner mode')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Exempt while in staff mode'));
        expect(overrides.find(o => o.permissionGroupId === 1)?.exemptInStaffMode).toBe(true);
    });

    it('keeps a ticked box the group is no longer eligible for, so it can be unticked', () => {
        let overrides: PermissionGroupGameSettingsDto[] = [{ permissionGroupId: 2, exemptInStaffMode: true }];
        const onChange = jest.fn((next: PermissionGroupGameSettingsDto[]) => { overrides = next; });
        render(<GroupOverridesCard overrides={overrides} groups={groups as any} options={options} onChange={onChange}
            eligibility={[{ permissionGroupId: 2, groupName: 'Noble', canExemptStaffMode: false, canExemptOwnerMode: false }]} />);

        expect(screen.getByText(/no longer has knk.mode.staff/)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Exempt while in staff mode'));
        expect(overrides[0].exemptInStaffMode).toBeNull();
    });
});
