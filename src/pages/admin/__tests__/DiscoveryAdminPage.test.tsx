import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { DiscoveryAdminPage } from '../DiscoveryAdminPage';
import { discoveryClient } from '../../../apiClients/discoveryClient';
import { DomainClient } from '../../../apiClients/domainClient';
import {
  DiscoveryRewardPreviewDto,
  DiscoveryRewardRuleDto,
  DiscoveryStatsDto,
  DomainDiscoveryOverrideDto,
} from '../../../types/dtos/discovery/DiscoveryDtos';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../../apiClients/discoveryClient', () => ({
  discoveryClient: {
    getRules: jest.fn(),
    updateRule: jest.fn(),
    getOverrides: jest.fn(),
    upsertOverride: jest.fn(),
    deleteOverride: jest.fn(),
    getPreview: jest.fn(),
    getStats: jest.fn(),
  },
}));
jest.mock('../../../apiClients/domainClient', () => {
  const searchPaged = jest.fn();
  return { DomainClient: { getInstance: () => ({ searchPaged }) } };
});

const client = discoveryClient as jest.Mocked<typeof discoveryClient>;
const searchDomains = DomainClient.getInstance().searchPaged as jest.Mock;

const rule = (domainType: string, overrides: Partial<DiscoveryRewardRuleDto> = {}): DiscoveryRewardRuleDto => ({
  domainType,
  isEnabled: true,
  expUnitsMin: 1,
  expUnitsMax: 4,
  coinSalaryHoursMin: 2,
  coinSalaryHoursMax: 8,
  gemsMin: 5,
  gemsMax: 15,
  includeAncestors: domainType !== 'Town',
  updatedAt: '2026-09-26T12:00:00Z',
  ...overrides,
});

const RULES = [
  rule('Town'),
  rule('District', { expUnitsMin: 0.5, expUnitsMax: 2, coinSalaryHoursMin: 0.5, coinSalaryHoursMax: 2, gemsMin: 1, gemsMax: 3 }),
  rule('Structure', { expUnitsMin: 0.05, expUnitsMax: 0.25, coinSalaryHoursMin: 0.05, coinSalaryHoursMax: 0.25, gemsMin: 0, gemsMax: 0 }),
  rule('GateStructure', { expUnitsMin: 0.05, expUnitsMax: 0.25, coinSalaryHoursMin: 0.05, coinSalaryHoursMax: 0.25, gemsMin: 0, gemsMax: 0 }),
];

const townPreview: DiscoveryRewardPreviewDto = {
  domainType: 'Town',
  domainId: null,
  rule: RULES[0],
  rows: [
    { titleBracketId: 1, titleName: 'Serf', minExperience: 0, expUnit: 25, salary: 650, expMin: 25, expMax: 100, coinsMin: 1300, coinsMax: 5200, gemsMin: 5, gemsMax: 15 },
    { titleBracketId: 2, titleName: 'Count', minExperience: 50000, expUnit: 100, salary: 10000, expMin: 100, expMax: 400, coinsMin: 20000, coinsMax: 80000, gemsMin: 5, gemsMax: 15 },
  ],
};

const stats: DiscoveryStatsDto = {
  domains: {
    items: [{
      domainId: 3, name: 'Rivia', domainType: 'Town', parentName: null, discoverers: 12, discovererPercent: 40,
      firstDiscovererUserId: 9, firstDiscovererUsername: 'Geralt', firstDiscoveredAt: '2026-09-20T12:00:00Z',
    }],
    totalCount: 1, pageNumber: 1, pageSize: 25,
  },
  linkedUserCount: 30,
  topExplorers: [{ userId: 9, username: 'Geralt', discoveries: 42 }],
};

const kaerMorhen: DomainDiscoveryOverrideDto = {
  domainId: 5, domainName: 'Kaer Morhen', domainType: 'Structure',
  isEnabled: null, expUnitsMin: null, expUnitsMax: null, coinSalaryHoursMin: 1, coinSalaryHoursMax: 2,
  gemsMin: null, gemsMax: null, includeAncestors: null,
};

const renderPage = () => render(<DiscoveryAdminPage />);

const ruleRow = (label: string) => screen.getAllByRole('row').find((r) => within(r).queryByText(label, { selector: 'td' }))!;

describe('DiscoveryAdminPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    client.getRules.mockResolvedValue(RULES);
    client.getOverrides.mockResolvedValue([]);
    client.getPreview.mockResolvedValue(townPreview);
    client.getStats.mockResolvedValue(stats);
    searchDomains.mockResolvedValue({
      items: [
        { id: 3, name: 'Rivia', domainType: 'Town', description: '', wgRegionId: 'rivia' },
        { id: 5, name: 'Kaer Morhen', domainType: 'Structure', description: '', wgRegionId: 'km' },
        { id: 8, name: 'Some Location', domainType: 'Location', description: '', wgRegionId: 'x' },
      ],
    });
  });

  it('shows the type rules, the per-title preview and the statistics', async () => {
    renderPage();

    expect(await screen.findByText('Serf')).toBeInTheDocument();
    expect(client.getPreview).toHaveBeenCalledWith({ domainType: 'Town' });
    expect(within(ruleRow('Town')).getByText('1 – 4')).toBeInTheDocument();
    expect(within(ruleRow('Gate')).getAllByText('0.05 – 0.25')).toHaveLength(2);

    const serf = screen.getAllByRole('row').find((r) => within(r).queryByText('Serf'))!;
    expect(within(serf).getByText('25 – 100')).toBeInTheDocument();
    expect(within(serf).getByText('1,300 – 5,200')).toBeInTheDocument();
    const count = screen.getAllByRole('row').find((r) => within(r).queryByText('Count'))!;
    expect(within(count).getByText('20,000 – 80,000')).toBeInTheDocument();

    expect(await screen.findByText(/30 active players/)).toBeInTheDocument();
    expect(screen.getByText('(40%)')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Geralt' })[0]).toHaveAttribute('href', '/admin/users/9');
  });

  it('updates the preview while a rule is edited, and saves it', async () => {
    client.updateRule.mockImplementation(async (domainType, body) => ({ ...rule(domainType), ...body }));
    renderPage();
    await screen.findByText('Serf');

    await userEvent.click(screen.getByRole('button', { name: 'Edit Town rule' }));
    const max = screen.getByLabelText('Town XP units max');
    await userEvent.clear(max);
    await userEvent.type(max, '8');

    // The preview follows the input before anything is saved: Serf 25 × 8 = 200, Count 100 × 8 = 800.
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.getByText('25 – 200')).toBeInTheDocument();
    expect(screen.getByText('100 – 800')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(client.updateRule).toHaveBeenCalledWith('Town', {
      isEnabled: true, includeAncestors: false,
      expUnitsMin: 1, expUnitsMax: 8, coinSalaryHoursMin: 2, coinSalaryHoursMax: 8, gemsMin: 5, gemsMax: 15,
    }));
    await waitFor(() => expect(within(ruleRow('Town')).getByText('1 – 8')).toBeInTheDocument());
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    // The saved rule is previewed again from the server.
    expect(client.getPreview).toHaveBeenCalledTimes(2);
  });

  it('refuses to save a min above its max', async () => {
    renderPage();
    await screen.findByText('Serf');

    await userEvent.click(screen.getByRole('button', { name: 'Edit District rule' }));
    const min = screen.getByLabelText('District Gems min');
    await userEvent.clear(min);
    await userEvent.type(min, '9');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Gems: min (9) cannot exceed max (3).')).toBeInTheDocument();
    expect(client.updateRule).not.toHaveBeenCalled();
  });

  it("shows the API's reason when a rule is refused", async () => {
    client.updateRule.mockRejectedValue(Object.assign(new Error('expUnitsMin and expUnitsMax cannot exceed 1000.'), { status: 400 }));
    renderPage();
    await screen.findByText('Serf');

    await userEvent.click(screen.getByRole('button', { name: 'Edit Town rule' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('expUnitsMin and expUnitsMax cannot exceed 1000.')).toBeInTheDocument();
  });

  describe('turning a type with subtypes on or off', () => {
    const saved = (domainType: string, body: object): DiscoveryRewardRuleDto => ({ ...rule(domainType), ...body });

    const turnOffStructure = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Edit Structure rule' }));
      await userEvent.click(screen.getByLabelText('Structure enabled'));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    };

    beforeEach(() => {
      client.updateRule.mockImplementation(async (domainType, body) => saved(domainType, body));
    });

    it('asks whether Gate structures follow when Structure is turned off', async () => {
      renderPage();
      await screen.findByText('Serf');

      await turnOffStructure();

      const dialog = screen.getByRole('dialog', { name: 'Also turn discovery off for Gate structures?' });
      expect(within(dialog).getByRole('button', { name: 'Also apply to Gate structures' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Only Structure' })).toBeInTheDocument();
      expect(client.updateRule).not.toHaveBeenCalled();

      // Closing goes back to editing without saving.
      await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Structure enabled')).not.toBeChecked();
      expect(client.updateRule).not.toHaveBeenCalled();
    });

    it('saves Structure and then the Gate rule with only Enabled changed', async () => {
      renderPage();
      await screen.findByText('Serf');

      await turnOffStructure();
      await userEvent.click(screen.getByRole('button', { name: 'Also apply to Gate structures' }));

      const gate = RULES[3];
      await waitFor(() => expect(client.updateRule).toHaveBeenCalledTimes(2));
      expect(client.updateRule).toHaveBeenNthCalledWith(1, 'Structure', expect.objectContaining({ isEnabled: false }));
      expect(client.updateRule).toHaveBeenNthCalledWith(2, 'GateStructure', {
        isEnabled: false, includeAncestors: gate.includeAncestors,
        expUnitsMin: gate.expUnitsMin, expUnitsMax: gate.expUnitsMax,
        coinSalaryHoursMin: gate.coinSalaryHoursMin, coinSalaryHoursMax: gate.coinSalaryHoursMax,
        gemsMin: gate.gemsMin, gemsMax: gate.gemsMax,
      });
      await waitFor(() => expect(within(ruleRow('Gate')).getByText('No', { selector: 'span' })).toBeInTheDocument());
      expect(within(ruleRow('Structure')).getByText('No', { selector: 'span' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('saves only Structure when asked to', async () => {
      renderPage();
      await screen.findByText('Serf');

      await turnOffStructure();
      await userEvent.click(screen.getByRole('button', { name: 'Only Structure' }));

      await waitFor(() => expect(within(ruleRow('Structure')).getByText('No', { selector: 'span' })).toBeInTheDocument());
      expect(client.updateRule).toHaveBeenCalledTimes(1);
      expect(client.updateRule).toHaveBeenCalledWith('Structure', expect.objectContaining({ isEnabled: false }));
      expect(within(ruleRow('Gate')).getByText('Yes', { selector: 'span' })).toBeInTheDocument();
    });

    it('keeps Structure saved and says so when the Gate rule cannot be saved', async () => {
      client.updateRule.mockImplementation(async (domainType, body) => {
        if (domainType === 'GateStructure') throw new Error('down');
        return saved(domainType, body);
      });
      renderPage();
      await screen.findByText('Serf');

      await turnOffStructure();
      await userEvent.click(screen.getByRole('button', { name: 'Also apply to Gate structures' }));

      expect(await screen.findByText('Gate: Could not save this rule.')).toBeInTheDocument();
      expect(within(ruleRow('Structure')).getByText('No', { selector: 'span' })).toBeInTheDocument();
      expect(within(ruleRow('Gate')).getByText('Yes', { selector: 'span' })).toBeInTheDocument();
    });

    it('does not ask when the Gate rule already matches', async () => {
      client.getRules.mockResolvedValue([RULES[0], RULES[1], RULES[2], { ...RULES[3], isEnabled: false }]);
      renderPage();
      await screen.findByText('Serf');

      await turnOffStructure();

      await waitFor(() => expect(client.updateRule).toHaveBeenCalledTimes(1));
      expect(client.updateRule).toHaveBeenCalledWith('Structure', expect.objectContaining({ isEnabled: false }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not ask for Town, whose districts are not a kind of town', async () => {
      renderPage();
      await screen.findByText('Serf');

      await userEvent.click(screen.getByRole('button', { name: 'Edit Town rule' }));
      await userEvent.click(screen.getByLabelText('Town enabled'));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(client.updateRule).toHaveBeenCalledTimes(1));
      expect(client.updateRule).toHaveBeenCalledWith('Town', expect.objectContaining({ isEnabled: false }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('previews another type', async () => {
    renderPage();
    await screen.findByText('Serf');

    await userEvent.selectOptions(screen.getByLabelText('Preview for'), 'type:District');

    await waitFor(() => expect(client.getPreview).toHaveBeenLastCalledWith({ domainType: 'District' }));
  });

  it('adds an override for a picked domain', async () => {
    client.upsertOverride.mockResolvedValue({ ...kaerMorhen, gemsMax: 40 });
    renderPage();
    await screen.findByText('Serf');
    expect(screen.getByText(/No overrides/)).toBeInTheDocument();

    // Only discoverable domains are offered.
    await userEvent.click(await screen.findByRole('button', { name: /Select Domain/ }));
    expect(screen.queryByText(/Some Location/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Create New/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Kaer Morhen (Structure) (5)'));
    await userEvent.click(screen.getByRole('button', { name: 'Add override' }));

    await userEvent.selectOptions(screen.getByLabelText('Kaer Morhen enabled'), 'false');
    await userEvent.type(screen.getByLabelText('Kaer Morhen Gems max'), '40');

    client.getOverrides.mockResolvedValue([{ ...kaerMorhen, isEnabled: false, gemsMax: 40 }]);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Gems min stays blank (inherits 0 from the Structure rule), so max 40 is valid.
    await waitFor(() => expect(client.upsertOverride).toHaveBeenCalledWith(5, {
      isEnabled: false, includeAncestors: null,
      expUnitsMin: null, expUnitsMax: null, coinSalaryHoursMin: null, coinSalaryHoursMax: null, gemsMin: null, gemsMax: 40,
    }));
    expect(await screen.findByRole('button', { name: 'Remove Kaer Morhen override' })).toBeInTheDocument();
  });

  it('removes an override after confirmation', async () => {
    client.getOverrides.mockResolvedValue([kaerMorhen]);
    client.deleteOverride.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('Serf');

    // Own values in the row; inherited ones come from the Structure rule.
    const row = screen.getAllByRole('row').find((r) => within(r).queryByText('Kaer Morhen'))!;
    expect(within(row).getByText('1 – 2')).toBeInTheDocument();

    client.getOverrides.mockResolvedValue([]);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Kaer Morhen override' }));

    // KNG-82: confirmed in a FeedbackModal, not window.confirm; nothing is removed until then.
    const dialog = await screen.findByRole('dialog', { name: 'Remove override?' });
    expect(within(dialog).getByText(/Remove the discovery override of Kaer Morhen\? It will use the Structure rule again\./)).toBeInTheDocument();
    expect(client.deleteOverride).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(client.deleteOverride).toHaveBeenCalledWith(5));
    expect(await screen.findByText(/No overrides/)).toBeInTheDocument();
  });

  it('previews an overridden domain', async () => {
    client.getOverrides.mockResolvedValue([kaerMorhen]);
    renderPage();
    await screen.findByText('Serf');

    await userEvent.click(screen.getByRole('button', { name: 'Preview Kaer Morhen' }));

    await waitFor(() => expect(client.getPreview).toHaveBeenLastCalledWith({ domainId: 5 }));
  });

  it('changes the statistics order and type', async () => {
    renderPage();
    await screen.findByText(/30 active players/);
    expect(client.getStats).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 25, domainType: undefined, sortBy: 'discoverers', sortDescending: true });

    await userEvent.selectOptions(screen.getByLabelText('Statistics order'), 'least');
    await userEvent.selectOptions(screen.getByLabelText('Statistics type'), 'District');

    await waitFor(() => expect(client.getStats).toHaveBeenLastCalledWith({
      pageNumber: 1, pageSize: 25, domainType: 'District', sortBy: 'discoverers', sortDescending: false,
    }));
  });

  it('says so when the configuration cannot be loaded', async () => {
    client.getRules.mockRejectedValue(new Error('down'));
    renderPage();
    expect(await screen.findByText('Could not load the discovery configuration.')).toBeInTheDocument();
  });
});
