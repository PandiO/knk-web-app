import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DisplayField } from '../DisplayField';
import { DisplayFieldDto } from '../../../types/dtos/displayConfig/DisplayModels';

// KNG-200 phase 4: a material shown in a display falls back to MinecraftIcon's placeholder when its
// icon is missing or fails to load, instead of hiding the image.

const field: DisplayFieldDto = {
  label: 'Icon material',
  fieldName: 'displayName',
  relatedEntityPropertyName: 'iconMaterialRef',
  relatedEntityTypeName: 'MinecraftMaterialRef',
  isReusable: false,
  isLinkedToSource: false,
};

const renderField = (iconUrl: string | null) =>
  render(
    <DisplayField
      field={field}
      data={{ id: 1, name: 'Royal Sword', iconMaterialRef: { id: 5, namespaceKey: 'minecraft:diamond_sword', displayName: 'Diamond Sword', iconUrl } }}
    />
  );

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DisplayField Minecraft icon', () => {
  it('shows the icon with the key and name', () => {
    renderField('https://example.org/diamond_sword.png');
    expect(screen.getByRole('img', { name: 'minecraft:diamond_sword' })).toHaveAttribute('src', 'https://example.org/diamond_sword.png');
    expect(screen.getByText('minecraft:diamond_sword')).toBeInTheDocument();
    expect(screen.getByText('Diamond Sword')).toBeInTheDocument();
  });

  it('falls back to the placeholder when the icon fails to load', () => {
    renderField('https://example.org/broken.png');
    fireEvent.error(screen.getByRole('img', { name: 'minecraft:diamond_sword' }));
    expect(screen.getByTestId('minecraft-icon-placeholder')).toHaveAccessibleName('minecraft:diamond_sword');
  });

  it('shows the placeholder when the material has no icon', () => {
    renderField(null);
    expect(screen.getByTestId('minecraft-icon-placeholder')).toBeInTheDocument();
    expect(screen.getByText('Diamond Sword')).toBeInTheDocument();
  });
});
