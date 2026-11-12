import { CSV_BOM, csvBlob, csvFileName, downloadCsv, escapeCsvField, isoLocalDate, neutralizeFormula, toCsv } from '../csv';

// PandiO/knk-workspace#205: the CSV the dashboard's Export CSV writes.

describe('csv (#205)', () => {
    it('quotes fields with commas, quotes and line breaks and doubles the quotes', () => {
        expect(escapeCsvField('plain')).toBe('plain');
        expect(escapeCsvField('a,b')).toBe('"a,b"');
        expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
        expect(escapeCsvField('two\nlines')).toBe('"two\nlines"');
        expect(escapeCsvField('cr\rhere')).toBe('"cr\rhere"');
        expect(escapeCsvField(null)).toBe('');
        expect(escapeCsvField(undefined)).toBe('');
        expect(escapeCsvField(12.5)).toBe('12.5');
        expect(escapeCsvField(false)).toBe('false');
    });

    it('makes texts that Excel would run as a formula inert, but keeps numbers and a lone dash', () => {
        expect(neutralizeFormula('=HYPERLINK("x")')).toBe('\'=HYPERLINK("x")');
        expect(neutralizeFormula('+cmd')).toBe("'+cmd");
        expect(neutralizeFormula('@SUM(A1)')).toBe("'@SUM(A1)");
        expect(neutralizeFormula('\tx')).toBe("'\tx");
        expect(neutralizeFormula('-2+3')).toBe("'-2+3");
        expect(neutralizeFormula('-5')).toBe('-5');
        expect(neutralizeFormula('-1,234.5')).toBe('-1,234.5');
        expect(neutralizeFormula('-')).toBe('-');
        expect(neutralizeFormula('North-watch')).toBe('North-watch');
        // Quoting comes after neutralizing, so the apostrophe sits inside the quotes.
        expect(escapeCsvField('=1,2')).toBe('"\'=1,2"');
    });

    it('joins rows with CRLF and ends with one', () => {
        expect(toCsv([['Name', 'Note'], ['Pandi', 'a, b'], ['Ünïcode ★', '']])).toBe('Name,Note\r\nPandi,"a, b"\r\nÜnïcode ★,\r\n');
        expect(toCsv([])).toBe('');
    });

    it('names the file <Type>-<yyyy-mm-dd>.csv by the local date', () => {
        const date = new Date(2026, 10, 8, 23, 59);
        expect(isoLocalDate(date)).toBe('2026-11-08');
        expect(csvFileName('Town', date)).toBe('Town-2026-11-08.csv');
        expect(csvFileName('Item Blueprint', new Date(2026, 0, 5))).toBe('Item-Blueprint-2026-01-05.csv');
        expect(csvFileName('a/b:c', date)).toBe('a-b-c-2026-11-08.csv');
        expect(csvFileName('  ', date)).toBe('export-2026-11-08.csv');
    });

    it('writes UTF-8 with a byte order mark as text/csv', async () => {
        const blob = csvBlob('Name\r\nÉ\r\n');
        expect(blob.type).toBe('text/csv;charset=utf-8');
        const bytes = new Uint8Array(await new Response(blob).arrayBuffer());
        expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
        expect(CSV_BOM).toBe('﻿');
    });

    it('downloads through a temporary link and frees the address afterwards', () => {
        jest.useFakeTimers();
        const createObjectURL = jest.fn(() => 'blob:csv');
        const revokeObjectURL = jest.fn();
        Object.assign(URL, { createObjectURL, revokeObjectURL });
        const clicks: Array<{ href: string; download: string }> = [];
        const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
            clicks.push({ href: this.href, download: this.download });
        });
        downloadCsv('Town-2026-11-08.csv', 'Name\r\n');
        expect(clicks).toEqual([{ href: 'blob:csv', download: 'Town-2026-11-08.csv' }]);
        expect(document.querySelector('a[download]')).toBeNull();
        expect(revokeObjectURL).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1000);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv');
        click.mockRestore();
        jest.useRealTimers();
    });
});
