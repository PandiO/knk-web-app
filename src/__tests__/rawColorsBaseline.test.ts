/**
 * @jest-environment node
 */

// PandiO/knk-workspace#263: `npm run lint:colors` only reports, so three merges pushed files over their raw
// colour baseline (#95) without anyone noticing. This runs the same count in `npm run test:ci`: a file with more
// raw palette classes (bg-blue-600, text-gray-500, ...) than scripts/raw-colors-baseline.json fails here.
// Fix it with the theme tokens (scripts/codemods/tokens-95.js), not by raising the baseline.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { overBaseline } = require('../../scripts/report-raw-colors.js');

export {};

describe('raw colour classes (#95, #263)', () => {
    it('has no file over its baseline in scripts/raw-colors-baseline.json', () => {
        const over = (overBaseline() as [string, number, number][]).map(([file, n, base]) => `${file}: ${n} (baseline ${base})`);
        expect(over).toEqual([]);
    });

    it('counts a file the baseline does not know as over it', () => {
        expect(overBaseline({ 'src/New.tsx': 1, 'src/Old.tsx': 3 }, { 'src/Old.tsx': 3 })).toEqual([['src/New.tsx', 1, 0]]);
    });

    it('does not count a file that went down', () => {
        expect(overBaseline({ 'src/Old.tsx': 2 }, { 'src/Old.tsx': 5 })).toEqual([]);
    });
});
