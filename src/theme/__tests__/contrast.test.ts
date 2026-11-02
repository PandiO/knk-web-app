/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';
import { THEMES } from '../themes';

// PandiO/knk-workspace#95: every theme's text/background and UI pairs pass WCAG 2.x AA. The ratios come
// from the token values in tokens.css itself, so changing a colour into a failing pair breaks the build.
const TEXT = 4.5; // normal text
const UI = 3; // large text, icons, field borders, focus rings (WCAG 1.4.3 large / 1.4.11)

type Rgb = [number, number, number];

/** The variables of each `:root[data-theme="…"]` block; `current` also owns the bare `:root`. */
function parseThemes(css: string): Record<string, Record<string, string>> {
  const themes: Record<string, Record<string, string>> = {};
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const block of Array.from(withoutComments.matchAll(/([^{}]*?)\{([^{}]*)\}/g))) {
    const selectors = block[1].split(',').map(s => s.trim());
    const names = selectors
      .map(s => s.match(/^:root\[data-theme="([a-z-]+)"\]$/)?.[1] ?? null)
      .filter((name): name is string => !!name);
    if (names.length === 0) continue;
    const vars: Record<string, string> = {};
    for (const decl of Array.from(block[2].matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g))) {
      vars[decl[1]] = decl[2].trim();
    }
    for (const name of names) themes[name] = { ...(themes[name] ?? {}), ...vars };
  }
  return themes;
}

function rgb(vars: Record<string, string>, token: string): Rgb {
  let value = vars[token];
  for (let hops = 0; value?.startsWith('var(') && hops < 5; hops++) {
    value = vars[value.slice(6, -1)];
  }
  if (!value) throw new Error(`Token --${token} is not defined`);
  const parts = value.split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new Error(`Token --${token} is not an "R G B" triple: ${value}`);
  }
  return parts as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground, background, minimum ratio, what the pair is used for] */
const PAIRS: Array<[string, string, number, string]> = [
  // Text on the three backgrounds
  ...['canvas', 'surface', 'surface-alt'].flatMap(bg => [
    [`color-fg`, `color-${bg}`, TEXT, 'body text'],
    [`color-muted`, `color-${bg}`, TEXT, 'secondary text (was text-gray-400)'],
    [`color-primary`, `color-${bg}`, TEXT, 'links and text-primary'],
    [`color-danger`, `color-${bg}`, TEXT, 'field errors and danger text'],
    [`color-success`, `color-${bg}`, TEXT, 'success text'],
    [`color-warning`, `color-${bg}`, TEXT, 'warning text'],
    [`color-info`, `color-${bg}`, TEXT, 'info text'],
    [`color-field`, `color-${bg}`, UI, 'form field border'],
    [`color-focus`, `color-${bg}`, UI, 'focus ring'],
  ] as Array<[string, string, number, string]>),
  ['color-primary-dark', 'color-surface', TEXT, 'link hover'],
  ['color-primary-light', 'color-surface', UI, 'primary icons'],
  // Filled buttons
  ['color-primary-fg', 'color-primary', TEXT, 'primary button'],
  ['color-primary-fg', 'color-primary-dark', TEXT, 'primary button hover'],
  ['color-cta-fg', 'color-cta', TEXT, 'call-to-action button'],
  ['color-cta-fg', 'color-cta-dark', TEXT, 'call-to-action hover'],
  ['color-danger-fg', 'color-danger', TEXT, 'danger button'],
  ['color-danger-fg', 'color-danger-strong', TEXT, 'danger button hover'],
  ['color-success-fg', 'color-success', TEXT, 'success button / badge'],
  ['color-warning-fg', 'color-warning', TEXT, 'warning badge'],
  // Alerts and badges: strong text on the soft and muted tints
  ...['danger', 'success', 'warning', 'info'].flatMap(status => [
    [`color-${status}-strong`, `color-${status}-soft`, TEXT, `${status} alert text`],
    [`color-${status}-strong`, `color-${status}-muted`, TEXT, `${status} badge text`],
    [`color-${status}`, `color-${status}-soft`, UI, `${status} alert icon`],
  ] as Array<[string, string, number, string]>),
  ['color-primary', 'color-info-soft', TEXT, 'a link inside an info box'],
  // Public pages and navigation
  ['color-backdrop-fg', 'color-backdrop', TEXT, 'text on the auth backdrop'],
  ['color-nav-fg', 'color-nav', TEXT, 'navigation title and active link'],
  ['color-nav-fg', 'color-nav-hover', TEXT, 'navigation link hover'],
  ['color-nav-muted', 'color-nav', TEXT, 'navigation links'],
  ['color-nav-muted', 'color-nav-hover', TEXT, 'navigation link hover'],
  ['color-nav-accent', 'color-nav', UI, 'active-page underline'],
  ['color-nav-action-fg', 'color-nav-action', TEXT, 'Create New in the bar'],
  ['color-nav-action-fg', 'color-nav-action-hover', TEXT, 'Create New hover'],
  ['color-nav-action', 'color-nav', UI, 'Create New against the bar'],
  // The remapped neutral ramps: the steps used for text stay readable on white and the lightest step
  ...['gray', 'slate'].flatMap(ramp => ['500', '600', '700', '800', '900'].flatMap(step => [
    [`${ramp}-${step}`, 'color-surface', TEXT, `text-${ramp}-${step}`],
    [`${ramp}-${step}`, `${ramp}-50`, TEXT, `text-${ramp}-${step} on bg-${ramp}-50`],
  ] as Array<[string, string, number, string]>)),
];

const tokensCss = fs.readFileSync(path.join(__dirname, '..', 'tokens.css'), 'utf8');
const themes = parseThemes(tokensCss);

describe('design tokens (#95)', () => {
  it('defines a variable block for every theme the picker offers', () => {
    expect(Object.keys(themes).sort()).toEqual(THEMES.map(theme => theme.id).sort());
  });

  it('defines the same tokens in every theme', () => {
    const reference = Object.keys(themes.current).sort();
    for (const name of Object.keys(themes)) {
      expect({ theme: name, tokens: Object.keys(themes[name]).sort() }).toEqual({ theme: name, tokens: reference });
    }
  });

  describe.each(Object.keys(themes))('theme %s', name => {
    it.each(PAIRS)('--%s on --%s passes %s:1 (%s)', (fg, bg, minimum) => {
      const ratio = contrast(rgb(themes[name], fg), rgb(themes[name], bg));
      // Round down to two decimals, as contrast checkers report it.
      expect(Math.floor(ratio * 100) / 100).toBeGreaterThanOrEqual(minimum);
    });
  });

  it('computes the reference ratios (WCAG examples)', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    // Report §11.4: brand red on white 6.31, orange with black text 8.8, orange on charcoal 5.16.
    expect(contrast([190, 22, 34], [255, 255, 255])).toBeCloseTo(6.31, 1);
    expect(contrast([242, 145, 0], [0, 0, 0])).toBeCloseTo(8.83, 1);
    expect(contrast([242, 145, 0], [53, 53, 53])).toBeCloseTo(5.16, 1);
  });
});
