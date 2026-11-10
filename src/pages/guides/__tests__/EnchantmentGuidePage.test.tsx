import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EnchantmentGuidePage, formatCooldown, formatEffect } from '../EnchantmentGuidePage';
import { GuidesPage } from '../GuidesPage';
import { enchantmentDefinitionClient } from '../../../apiClients/enchantmentDefinitionClient';
import { EnchantmentInfoDto, toRoman } from '../../../types/dtos/enchantmentInfo/EnchantmentInfoDtos';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../../apiClients/enchantmentDefinitionClient', () => ({ enchantmentDefinitionClient: { getPublicInfo: jest.fn() } }));

const mockedInfo = enchantmentDefinitionClient.getPublicInfo as jest.Mock;

const SHEETS: EnchantmentInfoDto[] = [
  {
    key: 'flash_chaos', displayName: 'Flash Chaos', maxLevel: 1, trigger: 'RightClick', application: 'Area',
    summary: 'Right-click to release a stronger blast.', damageRadiusBlocks: 3, knockbackRadiusBlocks: 5, armourReducesDamage: true,
    notes: ['In a siege, a defender\'s blast doesn\'t hurt their own gate.'],
    levels: [{
      level: 1, chancePercent: null, cooldownSeconds: 90, areaDamage: 60, gateDamage: 60,
      effects: [
        { name: 'Slowness', potionLevel: 1, durationSeconds: 5, appliesTo: 'PlayersInRange' },
        { name: 'Nausea', potionLevel: null, durationSeconds: 12.5, appliesTo: 'PlayersInRange' },
      ],
    }],
  },
  {
    key: 'poison', displayName: 'Poison', maxLevel: 3, trigger: 'OnHit', application: 'Target',
    summary: 'A melee hit can poison the player or creature you hit.', notes: [],
    levels: [1, 2, 3].map(level => ({
      level, chancePercent: 5 + 5 * level, cooldownSeconds: 8,
      effects: [{ name: 'Poison', potionLevel: 2, durationSeconds: 1.5 + 1.5 * level, appliesTo: 'Target',
        note: 'Poison can\'t kill: it stops at half a heart.' }],
    })),
  },
  {
    key: 'cleaving', displayName: 'Cleaving', maxLevel: 1, trigger: 'GateHit', application: 'Gate',
    summary: 'Made for sieges.', notes: [],
    levels: [{ level: 1, chancePercent: null, cooldownSeconds: 0, effects: [],
      detail: 'Melee hits on gate doors deal +25 % gate damage; the charged strike deals 5x that hit, then needs 60 s to recharge.' }],
  },
  {
    key: 'health_boost', displayName: 'Health Boost', maxLevel: 1, trigger: 'RightClick', application: 'Self',
    summary: 'Right-click to heal yourself.', notes: [],
    levels: [{ level: 1, chancePercent: null, cooldownSeconds: 120, effects: [], healAmount: 6 }],
  },
];

describe('EnchantmentGuidePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedInfo.mockResolvedValue(SHEETS);
  });

  it('groups the enchantments and shows their numbers per level', async () => {
    render(<EnchantmentGuidePage />);

    expect(await screen.findByRole('heading', { name: 'Flash Chaos' })).toBeInTheDocument();
    expect(mockedInfo).toHaveBeenCalledTimes(1);

    const onHit = screen.getByRole('region', { name: 'On-hit enchantments' });
    const abilities = screen.getByRole('region', { name: 'Right-click abilities' });
    expect(within(onHit).getByRole('heading', { name: 'Poison' })).toBeInTheDocument();
    expect(within(abilities).getByRole('heading', { name: 'Health Boost' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Other custom enchantments' })).not.toBeInTheDocument();

    const flash = screen.getByRole('table', { name: 'Flash Chaos per level' });
    expect(flash).toHaveTextContent('90 s');
    expect(flash).toHaveTextContent('Slowness I for 5 s (players in range)');
    expect(flash).toHaveTextContent('Nausea for 12.5 s (players in range)');
    expect(within(flash).getAllByText('60')).toHaveLength(2);
    expect(within(flash).queryByText('Chance per hit')).not.toBeInTheDocument();
    expect(screen.getByText(/knockback within/)).toHaveTextContent('Damage within 3 blocks, knockback within 5 blocks; armour lowers the damage.');

    const poison = screen.getByRole('table', { name: 'Poison per level' });
    expect(within(poison).getAllByRole('row')).toHaveLength(4);
    expect(poison).toHaveTextContent('15 %');
    expect(poison).toHaveTextContent('Poison II for 4.5 s (target)');
    expect(screen.getByText('Poison can\'t kill: it stops at half a heart.')).toBeInTheDocument();

    expect(screen.getByRole('table', { name: 'Health Boost per level' })).toHaveTextContent('6 health (3 hearts)');
    expect(screen.getByRole('link', { name: 'Poison' })).toHaveAttribute('href', '#enchantment-poison');

    const cleaving = screen.getByRole('table', { name: 'Cleaving per level' });
    expect(within(screen.getByRole('region', { name: 'Siege enchantments' })).getByRole('heading', { name: 'Cleaving' })).toBeInTheDocument();
    expect(within(cleaving).queryByText('Cooldown')).not.toBeInTheDocument();
    expect(cleaving).toHaveTextContent('needs 60 s to recharge');
  });

  it('says so when loading fails', async () => {
    mockedInfo.mockRejectedValue(new Error('down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<EnchantmentGuidePage />);
    expect(await screen.findByText('Could not load the enchantments.')).toBeInTheDocument();
  });

  it('formats cooldowns, effects and levels', () => {
    expect(formatCooldown(0)).toBe('None');
    expect(formatCooldown(90)).toBe('90 s');
    expect(formatCooldown(120)).toBe('2 min');
    expect(formatEffect({ name: 'Strength', potionLevel: 2, durationSeconds: 15, appliesTo: 'Self' })).toBe('Strength II for 15 s (you)');
    expect(formatEffect({ name: 'Frozen', potionLevel: null, durationSeconds: 2.25, appliesTo: 'Target' })).toBe('Frozen for 2.25 s (target)');
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(12)).toBe('12');
  });
});

describe('GuidesPage', () => {
  it('links the enchantment guide', () => {
    render(<GuidesPage />);
    expect(screen.getByRole('heading', { name: 'Guides' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Custom enchantments and abilities/ })).toHaveAttribute('href', '/guides/enchantments');
  });
});
