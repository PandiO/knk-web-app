import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { columnDefinitionsRegistry, objectConfigs } from '../objectConfigs';

// PandiO/knk-workspace#852: a permission group's default /navigate route mode on the dashboard and in the object config.

describe('permission group default route mode', () => {
  const column = () => columnDefinitionsRegistry.permissiongroup.default.find(c => c.key === 'defaultRouteMode')!;

  it('is a dashboard column after Parent', () => {
    const labels = columnDefinitionsRegistry.permissiongroup.default.map(c => c.label);
    expect(labels.slice(-2)).toEqual(['Parent', 'Default route']);
  });

  it.each([
    ['Efficient', 'Efficient'],
    [null, '-'],
    [undefined, '-'],
  ])('shows %s as %s', (mode, shown) => {
    render(<div data-testid="cell">{column().render!({ defaultRouteMode: mode })}</div>);
    expect(screen.getByTestId('cell')).toHaveTextContent(shown);
  });

  it('is a select of None and the three modes', () => {
    const field = objectConfigs.permissiongroup.fields.defaultRouteMode;
    expect(field.type).toBe('select');
    expect(field.required).toBe(false);
    expect(field.options).toEqual([
      { label: 'None (default: Preferred)', value: '' },
      { label: 'Shortest', value: 'Shortest' },
      { label: 'Efficient', value: 'Efficient' },
      { label: 'Preferred', value: 'Preferred' },
    ]);
  });
});
