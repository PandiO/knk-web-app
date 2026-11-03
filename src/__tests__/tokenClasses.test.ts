/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';

// PandiO/knk-workspace#230: the #95 codemod's error-line rule matched `text-danger` inside
// `text-danger-strong` and left classes that don't exist (`field-error-strong`, a stray `-strong`).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { swap } = require('../../scripts/codemods/tokens-95.js');

const SRC = path.join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

describe('tokens-95 codemod (#230)', () => {
  it('leaves text-danger-strong alone in the error-line rule', () => {
    const source = '<p className="text-sm font-medium text-red-800">{errors.general}</p>';
    const { out } = swap(source, { sweepOnly: false });
    expect(out).toBe('<p className="text-sm font-medium text-danger-strong">{errors.general}</p>');
  });

  it('still gives a plain text-danger error line the field-error icon', () => {
    const { out } = swap('<p className="mt-1 text-sm text-red-600">{error}</p>', { sweepOnly: false });
    expect(out).toBe('<p className="field-error mt-1 text-sm">{error}</p>');
  });

  it('is idempotent on its own output', () => {
    const once = swap('<p className="mt-2 text-sm text-red-700" role="alert">{error}</p>', { sweepOnly: false }).out;
    expect(swap(once, { sweepOnly: false }).out).toBe(once);
  });
});

describe('class names in the source (#230)', () => {
  // A token class split by a codemod: `field-error-…` (only `field-error` exists) or a class that starts
  // with a bare `-strong` / `-soft` / ... token.
  const BROKEN = /(?<![\w-])(field-error-[\w-]+|-(?:strong|soft|muted|line|fg|dark|light|alt|hover|text)(?![\w-]))/;

  it('has no mangled token classes in className strings', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
        for (const match of Array.from(line.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g))) {
          const classes = match[1] ?? match[2];
          if (BROKEN.test(classes)) offenders.push(`${path.relative(SRC, file)}:${index + 1}: ${classes}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
