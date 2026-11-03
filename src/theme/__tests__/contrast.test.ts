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
    [`color-primary-text`, `color-${bg}`, TEXT, 'links and text-primary'],
    [`color-primary-line`, `color-${bg}`, UI, 'border-primary / ring-primary (active tab, selection)'],
    [`color-danger`, `color-${bg}`, TEXT, 'field errors and danger text'],
    [`color-success`, `color-${bg}`, TEXT, 'success text'],
    [`color-warning`, `color-${bg}`, TEXT, 'warning text'],
    [`color-info`, `color-${bg}`, TEXT, 'info text'],
    [`color-field`, `color-${bg}`, UI, 'form field border'],
    [`color-focus`, `color-${bg}`, UI, 'focus ring'],
  ] as Array<[string, string, number, string]>),
  ['color-primary-text-dark', 'color-surface', TEXT, 'link hover'],
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
  ['color-primary-text', 'color-info-soft', TEXT, 'a link inside an info box'],
  ['color-nav-focus', 'color-nav', UI, 'focus ring on the bar\'s controls'],
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

// ── #231: landing image 1 behind every page (pageBackground.css, data-page-bg="on") ──────────────────────
// The layers over the image are translucent, so the colour behind a letter depends on the pixel under it.
// Image 1 has both extremes (its darkest pixel is 0 0 5, its lightest 255 255 218), so every pair is checked
// over pure black and pure white: then it holds wherever the text lands, and for another image too.
const IMAGE_EXTREMES: Rgb[] = [[0, 0, 0], [255, 255, 255]];

function alpha(vars: Record<string, string>, token: string): number {
  const value = Number(vars[token]);
  if (!vars[token] || Number.isNaN(value) || value < 0 || value > 1) {
    throw new Error(`Token --${token} is not an alpha between 0 and 1: ${vars[token]}`);
  }
  return value;
}

/** `top` at `a` over `under`, per 8-bit channel as the browser composites it. */
function over(top: Rgb, a: number, under: Rgb): Rgb {
  return top.map((c, i) => Math.round(c * a + under[i] * (1 - a))) as Rgb;
}

/** Text straight on the page backdrop, after pageBackground.css's remap there (muted and the 500/600 greys take the
 * 700 grey; links, border-primary and focus rings take --color-canvas-link; field borders the 700 grey). */
const ON_CANVAS: Array<[string, number, string]> = [
  ['color-fg', TEXT, 'body text and headings'],
  ...['gray', 'slate'].flatMap(ramp => ['700', '800', '900'].map(step =>
    [`${ramp}-${step}`, TEXT, `text-${ramp}-${step}; muted and ${ramp}-500/600 show as ${ramp}-700`] as [string, number, string])),
  ['color-canvas-link', TEXT, 'links (text-primary)'],
  ['color-canvas-link', UI, 'border-primary, ring-primary and focus rings'],
  ['gray-700', UI, 'form field border against the backdrop'],
];

/** Dark backdrops fill the window in these themes (.public-full-bleed); pageBackground.css names the same three. */
const DARK_BACKDROP_THEMES = ['brand', 'brand-red', 'proposal'];
const isDark = (color: Rgb) => luminance(color) < 0.18;

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

  describe.each(Object.keys(themes))('theme %s with the page background on (#231)', name => {
    const vars = themes[name];
    const canvasAlpha = alpha(vars, 'page-bg-canvas-alpha');
    const surfaceAlpha = alpha(vars, 'page-bg-surface-alpha');
    const backdropAlpha = alpha(vars, 'page-bg-backdrop-alpha');
    const canvas = IMAGE_EXTREMES.map(pixel => over(rgb(vars, 'color-canvas'), canvasAlpha, pixel));
    const backdrop = rgb(vars, 'color-backdrop');
    const ratio = (fg: string, bg: Rgb) => Math.floor(contrast(rgb(vars, fg), bg) * 100) / 100;

    it('keeps the cards more opaque than the page backdrop', () => {
      expect(surfaceAlpha).toBeGreaterThan(canvasAlpha);
    });

    it('has a dark full-window backdrop exactly in the themes pageBackground.css treats so', () => {
      expect(isDark(backdrop)).toBe(DARK_BACKDROP_THEMES.includes(name));
    });

    it.each(ON_CANVAS)('--%s on the page backdrop passes %s:1 (%s)', (fg, minimum) => {
      for (const bg of canvas) expect(ratio(fg, bg)).toBeGreaterThanOrEqual(minimum);
    });

    it('draws the field border on the backdrop at 3:1 against the white field too', () => {
      expect(ratio('gray-700', rgb(vars, 'color-surface'))).toBeGreaterThanOrEqual(UI);
    });

    // A card on the page backdrop, or (light backdrop, `current`) on the auth backdrop inside it. On a dark
    // backdrop the cards stay solid, which the pairs above already cover.
    const cardUnders = isDark(backdrop)
      ? canvas
      : [...canvas, ...canvas.map(under => over(backdrop, backdropAlpha, under))];
    const cards = cardUnders.map(under => over(rgb(vars, 'color-surface'), surfaceAlpha, under));
    const onCard = PAIRS.filter(([, bg]) => bg === 'color-surface').map(([fg, , minimum, use]) => [fg, minimum, use] as [string, number, string]);
    it.each(onCard)('--%s on a card passes %s:1 (%s)', (fg, minimum) => {
      for (const bg of cards) expect(ratio(fg, bg)).toBeGreaterThanOrEqual(minimum);
    });

    it('keeps the text on the auth backdrop readable', () => {
      // Dark: straight on the image, and over the page backdrop where :has() is missing. Light: inside it.
      const unders = isDark(backdrop) ? [...IMAGE_EXTREMES, ...canvas] : canvas;
      for (const under of unders) {
        const bg = over(backdrop, backdropAlpha, under);
        expect(ratio('color-backdrop-fg', bg)).toBeGreaterThanOrEqual(TEXT);
        if (!isDark(backdrop)) for (const [fg, minimum] of ON_CANVAS) expect(ratio(fg, bg)).toBeGreaterThanOrEqual(minimum);
      }
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
