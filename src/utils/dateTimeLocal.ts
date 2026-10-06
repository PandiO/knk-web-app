// Value helpers for <input type="datetime-local">, which takes local wall-clock time as
// "YYYY-MM-DDTHH:mm" (no zone) - Date.toISOString() would be UTC and shift the shown time.

const pad = (n: number): string => String(n).padStart(2, '0');

/** Formats a Date as a datetime-local input value in the browser's local time. */
export const toDateTimeLocalValue = (date: Date): string =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** A datetime-local input value `days` days from `from` (default: now). */
export const dateTimeLocalDaysFromNow = (days: number, from: Date = new Date()): string => {
    const date = new Date(from.getTime());
    date.setDate(date.getDate() + days);
    return toDateTimeLocalValue(date);
};
