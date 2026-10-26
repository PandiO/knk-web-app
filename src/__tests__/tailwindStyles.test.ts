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
const USED = 'btn btn-primary btn-secondary btn-tertiary btn-danger input hover:bg-primary-dark hover:text-primary-dark';

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
    expect(rule('.hover\\:bg-primary-dark:hover')).toMatch(/background-color: rgb\(29 78 216/);
    expect(rule('.hover\\:text-primary-dark:hover')).toMatch(/color: rgb\(29 78 216/);
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
      /:where\(input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\), select, textarea\):where\(\[class\*="border-gray-300"\], \[class\*="border-slate-300"\]\)\s*\{\s*border-width: 1px/,
    );
  });
});
