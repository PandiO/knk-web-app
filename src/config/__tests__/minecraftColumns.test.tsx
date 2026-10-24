import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  columnDefinitionsRegistry,
  defaultColumnDefinitions,
  getColumnDefinitions,
  minecraftMaterialKindLabel
} from '../objectConfigs';
import type { ColumnDefinition } from '../../types/common';

// KNG-200 phase 4: material, block and item blueprint columns show icons through MinecraftIcon, and
// the material picker shows the catalogue's name, kind and status.

const column = (type: string, key: string): ColumnDefinition<any> => {
  const found = columnDefinitionsRegistry[type].default.find(c => c.key === key);
  if (!found) throw new Error(`No ${key} column for ${type}`);
  return found;
};

const renderCell = (type: string, key: string, row: Record<string, unknown>) =>
  render(<div data-testid="cell">{column(type, key).render!(row)}</div>);

describe('material columns', () => {
  it('lists Name, Icon, Namespace Key, Kind and Status', () => {
    expect(columnDefinitionsRegistry.minecraftmaterialref.default.map(c => c.label))
      .toEqual(['ID', 'Name', 'Icon', 'Namespace Key', 'Kind', 'Status']);
  });

  it('shows the display name, falling back to the key', () => {
    renderCell('minecraftmaterialref', 'displayName', { namespaceKey: 'minecraft:oak_log', displayName: 'Oak Log' });
    expect(screen.getByTestId('cell')).toHaveTextContent('Oak Log');
  });

  it('falls back to the key without a display name', () => {
    renderCell('minecraftmaterialref', 'displayName', { namespaceKey: 'minecraft:oak_log', displayName: null });
    expect(screen.getByTestId('cell')).toHaveTextContent('minecraft:oak_log');
  });

  it('labels the kind', () => {
    expect(minecraftMaterialKindLabel({ isItem: true, isBlock: true })).toBe('Item & block');
    expect(minecraftMaterialKindLabel({ isItem: true, isBlock: false })).toBe('Item');
    expect(minecraftMaterialKindLabel({ isItem: false, isBlock: true })).toBe('Block');
    expect(minecraftMaterialKindLabel({ isItem: null, isBlock: null })).toBe('—');
    renderCell('minecraftmaterialref', 'kind', { isItem: false, isBlock: true });
    expect(screen.getByTestId('cell')).toHaveTextContent('Block');
  });

  it('shows the status, or a dash for a hybrid row', () => {
    const status = column('minecraftmaterialref', 'catalogStatus');
    expect(status.render!({ catalogStatus: 'Unverified' })).toBe('Unverified');
    expect(status.render!({})).toBe('—');
  });

  it('renders the icon, and the placeholder when it has none or it breaks', () => {
    const { unmount } = renderCell('minecraftmaterialref', 'iconUrl', {
      namespaceKey: 'minecraft:torch', displayName: 'Torch', iconUrl: 'https://example.org/torch.png'
    });
    const img = screen.getByRole('img', { name: 'Torch' });
    expect(img).toHaveAttribute('src', 'https://example.org/torch.png');
    fireEvent.error(img);
    expect(screen.getByTestId('minecraft-icon-placeholder')).toBeInTheDocument();
    unmount();

    renderCell('minecraftblockref', 'iconUrl', { namespaceKey: 'minecraft:stone', iconUrl: null });
    expect(screen.getByTestId('minecraft-icon-placeholder')).toHaveAccessibleName('minecraft:stone');
  });
});

describe('item blueprint columns', () => {
  it('has an Icon column right after the ID and the Category last (KNG-263)', () => {
    expect(columnDefinitionsRegistry.itemblueprint.default.map(c => c.key)).toEqual(['id', 'iconUrl', 'name', 'categoryName']);
  });

  it('renders the icon material picture', () => {
    renderCell('itemblueprint', 'iconUrl', { id: 3, name: 'Royal Sword', iconUrl: 'https://example.org/sword.png' });
    expect(screen.getByRole('img', { name: 'Royal Sword' })).toHaveAttribute('src', 'https://example.org/sword.png');
  });

  it('renders the placeholder for a blueprint without an icon', () => {
    renderCell('itemblueprint', 'iconUrl', { id: 3, name: 'Royal Sword', iconUrl: null });
    expect(screen.getByTestId('minecraft-icon-placeholder')).toHaveAccessibleName('Royal Sword');
  });
});

describe('getColumnDefinitions', () => {
  it('finds the columns whatever the case of the entity name', () => {
    expect(getColumnDefinitions('ItemBlueprint')).toBe(columnDefinitionsRegistry.itemblueprint.default);
    expect(getColumnDefinitions('itemblueprint')).toBe(columnDefinitionsRegistry.itemblueprint.default);
    expect(getColumnDefinitions('MinecraftMaterialRef')).toBe(columnDefinitionsRegistry.minecraftmaterialref.default);
  });

  it('falls back to the default columns', () => {
    expect(getColumnDefinitions('Unknown')).toBe(defaultColumnDefinitions.default);
    expect(getColumnDefinitions(undefined)).toBe(defaultColumnDefinitions.default);
  });
});
