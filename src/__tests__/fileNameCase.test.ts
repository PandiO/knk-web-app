// Windows and macOS file systems ignore case: two files whose paths differ only in case
// (e.g. pageBackground.ts and PageBackground.tsx, resolved as `./PageBackground`) break the
// dev server there while Linux CI stays green.
import fs from 'fs';
import path from 'path';

function walk(dir: string, out: string[]): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

describe('source file names', () => {
    it('has no two modules that differ only in case (ignoring the extension)', () => {
        const root = path.resolve(__dirname, '..');
        const seen = new Map<string, string>();
        const clashes: string[] = [];
        for (const file of walk(root, [])) {
            const rel = path.relative(root, file);
            const key = rel.replace(/\.(tsx?|jsx?)$/, '').toLowerCase();
            if (!/\.(tsx?|jsx?)$/.test(rel)) continue;
            const other = seen.get(key);
            if (other && other !== rel) clashes.push(`${other} <-> ${rel}`);
            else seen.set(key, rel);
        }
        expect(clashes).toEqual([]);
    });
});
