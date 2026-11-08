/**
 * PandiO/knk-workspace#205: CSV files the web app hands out (the dashboard's Export CSV).
 *
 * - **Format:** RFC 4180: fields separated by commas, rows by CRLF; a field with a comma, a quote, a CR or an LF
 *   is quoted and its quotes doubled.
 * - **Excel:** the file starts with a UTF-8 byte order mark, so Excel reads `é`, `★` and `§` as UTF-8 instead of the
 *   system code page. An Excel set to a `;` list separator (Dutch Windows) still opens a comma file as one column;
 *   Data → From Text/CSV reads it (LV2-5).
 * - **Formulas:** a text that Excel would run as a formula (`=…`, `+…`, `@…`, a tab or CR first, or `-` followed by
 *   something other than a number) gets a leading `'`, so a player-chosen name can't start a formula in the
 *   viewer's spreadsheet (OWASP "CSV injection"). Numbers such as `-5` and a lone `-` are kept as they are.
 *
 *     const text = toCsv([['Name', 'Coins'], ['Pandi', '1200']]);
 *     downloadCsv(csvFileName('Town'), text);   // Town-2026-11-08.csv
 */

/** The UTF-8 byte order mark that tells Excel the file is UTF-8. */
export const CSV_BOM = '﻿';

const NEEDS_QUOTES = /[",\r\n]/;
const FORMULA_START = /^[=+@\t\r]/;
const NUMBER = /^-\d+(?:[.,]\d+)*(?:[eE][+-]?\d+)?$/;

/** A text Excel would run as a formula, made inert with a leading apostrophe. */
export const neutralizeFormula = (value: string): string => {
    if (FORMULA_START.test(value)) return `'${value}`;
    if (value.startsWith('-') && value !== '-' && !NUMBER.test(value)) return `'${value}`;
    return value;
};

/** One field: formula-neutralized, then quoted when it holds a comma, quote or line break. */
export const escapeCsvField = (value: string | number | boolean | null | undefined): string => {
    const text = neutralizeFormula(value === null || value === undefined ? '' : String(value));
    return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** The rows (the first one usually the header) as CSV text with CRLF line ends, without the BOM. */
export const toCsv = (rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null | undefined>>): string =>
    rows.map(row => row.map(escapeCsvField).join(',')).join('\r\n') + (rows.length > 0 ? '\r\n' : '');

/** The local date as `yyyy-mm-dd`. */
export const isoLocalDate = (date: Date = new Date()): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** `<Type>-<yyyy-mm-dd>.csv` (local date); characters a file name can't hold become `-`. */
export const csvFileName = (typeName: string, date: Date = new Date()): string => {
    const safe = typeName.trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '') || 'export';
    return `${safe}-${isoLocalDate(date)}.csv`;
};

/** The CSV text as a file: UTF-8 with BOM, `text/csv`. */
export const csvBlob = (text: string): Blob => new Blob([CSV_BOM + text], { type: 'text/csv;charset=utf-8' });

/** Saves the CSV text through a temporary download link. */
export const downloadCsv = (fileName: string, text: string): void => {
    const url = URL.createObjectURL(csvBlob(text));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Some browsers read the address after click() returns; free it a moment later.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
