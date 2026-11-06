/**
 * PandiO/knk-workspace#187 (X-10): one place for how dates, times and numbers look in the web app.
 *
 * **Locale policy** (LW3-1, developer's decision 2026-11-06: numbers follow the viewer's language, like dates)
 * - Numbers use the viewer's browser locale (`NUMBER_LOCALE` undefined = the browser's): `12,345` and `0.5` in an
 *   English browser, `12.345` and `0,5` in a Dutch one. Tests pin it with `setNumberLocale` (`setupTests.ts` pins
 *   `en-US`, so a test's expected text doesn't depend on the machine).
 * - Dates and times use the viewer's own locale and time zone (`DATE_LOCALE` undefined = the browser's), as most
 *   pages already did.
 * - API dates without a zone (`2026-11-05T20:52:02`, how the API sends a MySQL DATETIME) are **UTC**, so they are
 *   read with `parseApiDate` (was `parseUtc` in `components/currency/BalanceLedgerTable.tsx`). `new Date(value)`
 *   would read them as local time and shift them by the UTC offset.
 * - A missing or unreadable value shows as `EMPTY_VALUE` (`-`).
 *
 *     formatDateTime(user.lastSeenAt)        // "5-11-2026, 21:52" (nl-NL) / "11/5/2026, 9:52 PM" (en-US)
 *     formatDate(entry.createdAt)            // the date only
 *     formatNumber(1234567)                  // "1.234.567" (nl-NL) / "1,234,567" (en-US)
 *     formatNumber(0.4, { maximumFractionDigits: 2 })
 *     formatPercent(0.125)                   // "12,5%" (nl-NL) / "12.5%" (en-US)
 */

/** Locale for numbers; undefined = the viewer's browser locale (see the policy above). */
export const NUMBER_LOCALE: string | undefined = undefined;

let numberLocale: string | undefined = NUMBER_LOCALE;
let defaultNumberFormat: Intl.NumberFormat | null = null;

/**
 * Pins the locale numbers are formatted in; `undefined` goes back to the browser's. For tests (a fixed
 * expected text, or a check in another language); the app itself never calls it.
 */
export const setNumberLocale = (locale: string | undefined): void => {
    numberLocale = locale;
    defaultNumberFormat = null;
};

const numberFormatter = (options?: Intl.NumberFormatOptions): Intl.NumberFormat => {
    if (options) return new Intl.NumberFormat(numberLocale, options);
    if (!defaultNumberFormat) defaultNumberFormat = new Intl.NumberFormat(numberLocale);
    return defaultNumberFormat;
};

/** Locale for dates and times; undefined = the viewer's browser locale. */
export const DATE_LOCALE: string | undefined = undefined;

/** Shown for a missing or unreadable value. */
export const EMPTY_VALUE = '-';

export type DateInput = string | number | Date | null | undefined;

const HAS_ZONE = /(?:[zZ]|[+-]\d\d:?\d\d)$/;
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** An ISO 8601 date-time as the API sends it: `2026-11-05T20:52:02`, optionally with fractions and a zone. */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,7})?)?(?:[zZ]|[+-]\d\d:?\d\d)?$/;

/**
 * An API date string as a Date: without a zone it is UTC. Kept under its old name for the call sites that
 * imported it from BalanceLedgerTable; new code uses `parseApiDate`.
 */
export const parseUtc = (value: string): Date => {
    const trimmed = value.trim();
    if (ISO_DATE_ONLY.test(trimmed) || HAS_ZONE.test(trimmed)) return new Date(trimmed);
    return new Date(`${trimmed.replace(' ', 'T')}Z`);
};

/** Any date input as a Date, or null when it is missing or unreadable. Zone-less strings are UTC. */
export const parseApiDate = (value: DateInput): Date | null => {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : typeof value === 'number' ? new Date(value) : parseUtc(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

/** True for a string that looks like an ISO date-time (`2026-11-05T20:52:02`, with or without a zone). */
export const isIsoDateTimeString = (value: unknown): value is string =>
    typeof value === 'string' && ISO_DATE_TIME.test(value.trim());

const DATE_TIME_DEFAULT: Intl.DateTimeFormatOptions = {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit',
};
const DATE_DEFAULT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
const TIME_DEFAULT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

const formatWith = (value: DateInput, options: Intl.DateTimeFormatOptions, fallback: string): string => {
    const date = parseApiDate(value);
    return date ? date.toLocaleString(DATE_LOCALE, options) : fallback;
};

/** Date and time (to the minute) in the viewer's locale and zone; `options` replace the defaults. */
export const formatDateTime = (value: DateInput, options?: Intl.DateTimeFormatOptions, fallback = EMPTY_VALUE): string =>
    formatWith(value, options ?? DATE_TIME_DEFAULT, fallback);

/**
 * The date only. A bare `2026-11-05` is a calendar date, shown as that day everywhere (not moved by the zone).
 */
export const formatDate = (value: DateInput, options?: Intl.DateTimeFormatOptions, fallback = EMPTY_VALUE): string => {
    if (typeof value === 'string' && ISO_DATE_ONLY.test(value.trim())) {
        return formatWith(value, { ...(options ?? DATE_DEFAULT), timeZone: 'UTC' }, fallback);
    }
    return formatWith(value, options ?? DATE_DEFAULT, fallback);
};

/** The time only (to the minute). */
export const formatTime = (value: DateInput, options?: Intl.DateTimeFormatOptions, fallback = EMPTY_VALUE): string =>
    formatWith(value, options ?? TIME_DEFAULT, fallback);

/** One shared formatter for whole numbers and plain amounts (`1,234,567` / `1.234.567`), in the viewer's locale. */
export const numberFormat: { format: (value: number | bigint) => string } = {
    format: (value: number | bigint): string => numberFormatter().format(value),
};

const toNumber = (value: number | string | null | undefined): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
};

/** A number in the viewer's locale (grouping on, up to 3 fraction digits unless `options` say otherwise). */
export const formatNumber = (
    value: number | string | null | undefined,
    options?: Intl.NumberFormatOptions,
    fallback = EMPTY_VALUE
): string => {
    const n = toNumber(value);
    if (n === null) return fallback;
    return numberFormatter(options).format(n);
};

/** A fraction as a percentage: `0.125` → `12.5%` (up to `maximumFractionDigits`, default 1). */
export const formatPercent = (
    fraction: number | string | null | undefined,
    maximumFractionDigits = 1,
    fallback = EMPTY_VALUE
): string => formatNumber(fraction, { style: 'percent', maximumFractionDigits }, fallback);
