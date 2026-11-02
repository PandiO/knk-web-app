/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../../tailwind.config';

// #38: compiles src/index.css with the project's Tailwind config (content: just the classes under
// test) and checks the button and input styles that used to be missing.
const CSS_PATH = path.join(__dirname, '..', 'index.css');
const USED = 'btn btn-primary btn-secondary btn-tertiary btn-danger btn-cta input field-error hover:bg-primary-dark hover:text-primary-dark bg-gray-100 text-muted';

let css = '';

beforeAll(async () => {
  const source = fs.readFileSync(CSS_PATH, 'utf8');
  const result = await postcss([
    tailwindcss({ ...tailwindConfig, content: [{ raw: `<div class="${USED}"></div>`, extension: 'html' }] }),
  ]).process(source, { from: CSS_PATH });
  css = result.css;
});

/** The declarations of every rule whose selector is exactly `selector` (@apply can split one). */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = Array.from(css.matchAll(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'gm')));
  if (matches.length === 0) throw new Error(`No rule for ${selector}`);
  return matches.map(match => match[1]).join('\n');
}

describe('Tailwind styles (#38)', () => {
  it('defines primary-dark, so the primary buttons and links get a hover colour', () => {
    // #95: the colour is a theme token (29 78 216 = blue-700 in the `current` theme, src/theme/tokens.css).
    expect(rule('.hover\\:bg-primary-dark:hover')).toMatch(/background-color: rgb\(var\(--color-primary-dark\) \/ var\(--tw-bg-opacity/);
    expect(rule('.hover\\:text-primary-dark:hover')).toMatch(/color: rgb\(var\(--color-primary-dark\) \/ var\(--tw-text-opacity/);
  });

  it('lays out every button as inline-flex, so an icon sits next to its label', () => {
    for (const selector of ['.btn', '.btn-primary', '.btn-secondary', '.btn-tertiary', '.btn-danger']) {
      const declarations = rule(selector);
      expect(declarations).toMatch(/display: inline-flex/);
      expect(declarations).toMatch(/align-items: center/);
      expect(declarations).toMatch(/gap: 0\.5rem/);
    }
    // The gap replaces the icon's own margin instead of adding to it.
    expect(css).toMatch(/\.btn-primary > svg\s*\{[^}]*margin-left: 0px;[^}]*margin-right: 0px/);
  });

  it('defines btn-tertiary (Save Draft)', () => {
    expect(rule('.btn-tertiary')).toMatch(/background-color: transparent/);
  });

  it('gives .input and colour-only bordered fields a visible border', () => {
    expect(rule('.input')).toMatch(/border-width: 1px/);
    expect(css).toMatch(
      /:where\(input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\), select, textarea\):where\(\[class\*="border-gray-300"\], \[class\*="border-slate-300"\], \[class\*="border-red-300"\][^)]*\)\s*\{\s*border-width: 1px/,
    );
  });
});

describe('Theme tokens in the stylesheet (#95)', () => {
  it('reads the neutral ramps and semantic colours from the theme variables', () => {
    expect(rule('.bg-gray-100')).toMatch(/background-color: rgb\(var\(--gray-100\) \/ var\(--tw-bg-opacity/);
    expect(rule('.text-muted')).toMatch(/color: rgb\(var\(--color-muted\) \/ var\(--tw-text-opacity/);
  });

  it('hovers the primary button with the darker shade and a solid focus ring', () => {
    const declarations = rule('.btn-primary');
    expect(declarations).toMatch(/var\(--color-primary\)/);
    expect(rule('.btn-primary:hover')).toMatch(/var\(--color-primary-dark\)/);
    expect(rule('.btn-primary:focus')).toMatch(/--tw-ring-color: rgb\(var\(--color-focus\) \/ var\(--tw-ring-opacity/);
    expect(rule('.btn-cta')).toMatch(/var\(--color-cta\)/);
  });

  it('gives every text field a focus ring, a 3:1 border and a visible error border', () => {
    expect(css).toMatch(/:is\(input, select, textarea\):where\([^{]*\):focus-visible\s*\{\s*box-shadow: 0 0 0 2px rgb\(var\(--color-focus\)\)/);
    expect(css).toMatch(/\[class\*="border-gray-300"\],[^{]*\[class\*="border-slate-300"\]\s*\{\s*border-color: rgb\(var\(--color-field\)\)/);
    expect(css).toMatch(/\[class\*="border-red-300"\]\s*\{\s*border-color: rgb\(var\(--color-danger\)\)/);
    expect(rule('.input')).toMatch(/border-color: rgb\(var\(--color-field\)/);
  });

  it('puts an icon in front of every field error (danger is never colour alone)', () => {
    expect(rule('.field-error')).toMatch(/color: rgb\(var\(--color-danger\)/);
    expect(css).toMatch(/\.field-error::before\s*\{[^}]*mask: var\(--icon-alert\)/);
  });
});
