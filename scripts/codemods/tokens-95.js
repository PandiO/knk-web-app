#!/usr/bin/env node
/*
 * Codemod: raw Tailwind colour classes → semantic theme tokens (PandiO/knk-workspace#95).
 *
 *   node scripts/codemods/tokens-95.js --sweep-only <files...>   only text-gray-400 → text-muted
 *   node scripts/codemods/tokens-95.js <files...>                every mapping below
 *   node scripts/codemods/tokens-95.js --primary-fg-only <files...>  only the text on bg-primary (all files)
 *   add --dry-run to print the counts without writing
 *
 * The swaps are mechanical, one class for one class, so a branch that still has the old classes can be
 * merged and then fixed by running this again on the conflicting files. Test files are skipped (their
 * class assertions are updated by hand). The token values are in src/theme/tokens.css; in the `current`
 * theme a swap keeps the colour, except for the contrast fixes listed in the knk-workspace guide
 * docs/guides/design-themes-comparison.md.
 */
const fs = require('fs');

// Any utility: <colour>-<shade> → token.
const COMMON = {
  'blue-500': 'primary-light', 'blue-600': 'primary', 'blue-700': 'primary-dark',
  'blue-50': 'info-soft', 'blue-100': 'info-muted', 'blue-200': 'info-line', 'blue-800': 'info-strong', 'blue-900': 'info-strong',
  'red-50': 'danger-soft', 'red-100': 'danger-muted', 'red-200': 'danger-line',
  'red-600': 'danger', 'red-700': 'danger-strong', 'red-800': 'danger-strong',
  'green-50': 'success-soft', 'green-100': 'success-muted', 'green-200': 'success-line',
  'green-600': 'success', 'green-700': 'success', 'green-800': 'success-strong',
  'amber-50': 'warning-soft', 'amber-100': 'warning-muted', 'amber-200': 'warning-line',
  'amber-600': 'warning', 'amber-700': 'warning', 'amber-800': 'warning-strong', 'amber-900': 'warning-strong',
  'yellow-50': 'warning-soft', 'yellow-100': 'warning-muted', 'yellow-200': 'warning-line',
  'yellow-600': 'warning', 'yellow-700': 'warning', 'yellow-800': 'warning-strong', 'yellow-900': 'warning-strong',
};

// Utility-specific: checked before COMMON.
const BY_UTILITY = {
  text: {
    'gray-900': 'fg', 'slate-900': 'fg',
    'gray-500': 'muted', 'slate-500': 'muted',
    'gray-400': 'muted', 'slate-400': 'muted',
  },
  bg: {
    white: 'surface', 'gray-50': 'surface-alt', 'slate-50': 'surface-alt',
    // A filled -700 is the hover of a filled -600: keep it a shade darker.
    'green-700': 'success-strong', 'amber-700': 'warning-strong', 'yellow-700': 'warning-strong',
  },
  border: { 'gray-200': 'line', 'slate-200': 'line', 'red-300': 'danger' },
  divide: { 'gray-200': 'line', 'slate-200': 'line' },
  ring: { 'blue-500': 'focus', 'blue-600': 'focus' },
};

// Only the text-gray-400 contrast sweep (all files; 2.5:1 → text-muted 4.5:1+).
const SWEEP = { text: { 'gray-400': 'muted' } };

const UTILITIES = 'text|bg|border(?:-[xytrbl])?|divide|ring|ring-offset|outline|from|via|to|fill|stroke|decoration|accent|caret';
const COLOUR = 'white|(?:gray|slate|blue|red|green|amber|yellow)-(?:50|[1-9]00)';
const CLASS = new RegExp(`(?<![\\w-])((?:[a-z0-9-]+:)*)(${UTILITIES})-(${COLOUR})(\\/\\d+)?(?![\\w-])`, 'g');

// Text on a filled primary must use primary-fg: it is black in `brand` (white on orange is 2.4:1). In a class
// string that has a bg-primary / bg-primary-dark / bg-primary-light, text-white becomes text-primary-fg.
const CLASS_STRING = /(["'`])((?:(?!\1)[^\n])*?\bbg-primary(?:-dark|-light)?(?![\w/-])(?:(?!\1)[^\n])*?)\1/g;

function primaryFg(source) {
  let count = 0;
  const out = source.replace(CLASS_STRING, (match, quote, body) => {
    const swapped = body.replace(/(?<![\w-])((?:[a-z0-9-]+:)*)text-white(?![\w/-])/g, (m, variants) => {
      count++;
      return `${variants}text-primary-fg`;
    });
    return `${quote}${swapped}${quote}`;
  });
  return { out, count };
}

function swap(source, { sweepOnly, primaryFgOnly }) {
  if (primaryFgOnly) return primaryFg(source);
  let count = 0;
  const out = source.replace(CLASS, (match, variants, utility, colour, opacity = '') => {
    // Disabled controls and placeholders are exempt from WCAG contrast: leave them.
    if (/(^|:)(disabled|placeholder):/.test(variants)) return match;
    const base = utility.startsWith('border') ? 'border' : utility;
    const table = sweepOnly ? SWEEP : BY_UTILITY;
    const token = table[base]?.[colour] ?? (sweepOnly ? undefined : COMMON[colour]);
    if (!token) return match;
    count++;
    return `${variants}${utility}-${token}${opacity}`;
  });
  if (sweepOnly) return { out, count };
  // A field's error line gets the alert icon (.field-error in index.css): danger is never colour alone.
  // Matches a <p>/<span> in text-danger that shows an error: its id says "error", or it holds an
  // `{...error...}` expression.
  const withErrors = out.replace(
    /<(p|span)((?:\s+id="[^"]*")?)\s+className="([^"]*?)\btext-danger\b([^"]*)"([^>]*)>(\s*\{[^}]*[eE]rror[^}]*\}\s*<\/\1>)?/g,
    (match, tag, id, before, after, rest, body) => {
      if (!/error/i.test(id) && !body) return match;
      count++;
      const classes = `field-error ${before} ${after}`.replace(/\s+/g, ' ').trim();
      return `<${tag}${id} className="${classes}"${rest}>${body ?? ''}`;
    },
  );
  const fg = primaryFg(withErrors);
  return { out: fg.out, count: count + fg.count };
}

function main(argv) {
  const sweepOnly = argv.includes('--sweep-only');
  const primaryFgOnly = argv.includes('--primary-fg-only');
  const dryRun = argv.includes('--dry-run');
  const files = argv.filter(arg => !arg.startsWith('--') && !/\.test\.|__tests__/.test(arg));
  let total = 0;
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const { out, count } = swap(source, { sweepOnly, primaryFgOnly });
    if (count === 0) continue;
    total += count;
    console.log(`${String(count).padStart(4)}  ${file}`);
    if (!dryRun) fs.writeFileSync(file, out);
  }
  console.log(`${total} classes ${dryRun ? 'would change' : 'changed'} in ${files.length} files`);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { swap };
