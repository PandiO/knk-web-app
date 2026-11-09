#!/usr/bin/env node
/*
 * Reports raw Tailwind palette classes (bg-blue-600, text-gray-500, border-slate-200, ...) that are new
 * since the baseline, so screens move to the theme tokens over time (PandiO/knk-workspace#95).
 *
 *   npm run lint:colors                  report files with more raw colour classes than the baseline
 *   npm run lint:colors -- --all         list every file with raw colour classes
 *   npm run lint:colors -- --update      write the current counts as the new baseline
 *   npm run lint:colors -- --strict      exit 1 when something is new
 *
 * `npm run test:ci` fails as well when a file is over its baseline (src/__tests__/rawColorsBaseline.test.ts, #263).
 *
 * Use the semantic tokens instead (tailwind.config.js, src/theme/tokens.css): primary, primary-dark,
 * surface, fg, muted, line, field, danger, success, warning, info, ... Test files are not counted.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const BASELINE = path.join(__dirname, 'raw-colors-baseline.json');

const PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const UTILITIES = 'text|bg|border(?:-[xytrbl])?|divide|ring|ring-offset|outline|from|via|to|fill|stroke|decoration|accent|caret|placeholder|shadow';
const RAW = new RegExp(`(?<![\\w-])(?:[a-z0-9-]+:)*(?:${UTILITIES})-(?:${PALETTE})-(?:50|[1-9]00|950)(?:\\/\\d+)?(?![\\w-])`, 'g');

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(tsx?|jsx?|css)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

function count() {
  const counts = {};
  for (const file of sourceFiles(SRC)) {
    const matches = fs.readFileSync(file, 'utf8').match(RAW);
    if (matches) counts[path.relative(ROOT, file).split(path.sep).join('/')] = matches.length;
  }
  return counts;
}

function readBaseline() {
  return fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
}

/** Files with more raw colour classes than the baseline, as [file, count, baseline] sorted by path. */
function overBaseline(counts = count(), baseline = readBaseline()) {
  return Object.entries(counts)
    .filter(([file, n]) => n > (baseline[file] ?? 0))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, n]) => [file, n, baseline[file] ?? 0]);
}

function main(args) {
  const counts = count();
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (args.includes('--update')) {
    fs.writeFileSync(BASELINE, `${JSON.stringify(counts, Object.keys(counts).sort(), 2)}\n`);
    console.log(`Baseline written: ${total} raw colour classes in ${Object.keys(counts).length} files.`);
    return 0;
  }
  const baseline = readBaseline();
  const grown = overBaseline(counts, baseline);
  if (args.includes('--all')) {
    Object.entries(counts).sort(([, a], [, b]) => b - a).forEach(([file, n]) => console.log(`${String(n).padStart(5)}  ${file}`));
  }
  const baselineTotal = Object.values(baseline).reduce((sum, n) => sum + n, 0);
  console.log(`Raw colour classes: ${total} (baseline ${baselineTotal}).`);
  if (grown.length === 0) {
    console.log('No file has more raw colour classes than the baseline.');
    return 0;
  }
  console.log('More raw colour classes than the baseline - use the theme tokens (#95):');
  for (const [file, n, base] of grown) console.log(`  ${file}: ${n} (baseline ${base})`);
  return args.includes('--strict') ? 1 : 0;
}

// src/__tests__/rawColorsBaseline.test.ts runs overBaseline() in `npm run test:ci`, so a merge that adds raw
// colour classes turns the tests red instead of only this report (PandiO/knk-workspace#263).
if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { count, readBaseline, overBaseline };
