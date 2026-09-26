import { pickNavLayout } from '../navLayout';

// logo 40 + title 100 + labels 900 (+ two 16px gaps) = 1072 for the roomiest layout.
const widths = { logo: 40, title: 100, labels: 900, icons: 300 };

describe('pickNavLayout', () => {
  it('shows labels and the title when both fit', () => {
    expect(pickNavLayout(1072, widths)).toBe('labels+title');
  });

  it('drops the title before the labels', () => {
    expect(pickNavLayout(1071, widths)).toBe('labels');
    expect(pickNavLayout(956, widths)).toBe('labels');
  });

  it('falls back to icons with the title, then icons alone', () => {
    expect(pickNavLayout(955, widths)).toBe('icons+title');
    expect(pickNavLayout(472, widths)).toBe('icons+title');
    expect(pickNavLayout(471, widths)).toBe('icons');
    expect(pickNavLayout(356, widths)).toBe('icons');
  });

  it('uses the menu when even the icons do not fit', () => {
    expect(pickNavLayout(355, widths)).toBe('menu');
    expect(pickNavLayout(0, widths)).toBe('menu');
  });
});
