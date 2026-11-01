/**
 * #109: whether a String field is a text area (several lines) or a one-line input.
 *
 * `"multiline": true|false` in settingsJson (the field editor's "Multi-line text" toggle) decides.
 * Without it, a field whose name ends in "Description" or "Lore" is several lines and every other
 * field one line. A value that already holds a line break always gets the text area, so existing
 * multi-line text is never squashed into one line.
 */
export function isMultilineStringField(settingsJson: string | undefined, fieldName: string, value?: unknown): boolean {
    if (typeof value === 'string' && /[\r\n]/.test(value)) return true;
    return resolveMultilineSetting(settingsJson, fieldName);
}

const MULTILINE_BY_NAME = /(description|lore)$/i;

/** The setting, else the default by field name (what the field editor's toggle shows). */
export function resolveMultilineSetting(settingsJson: string | undefined, fieldName: string): boolean {
    const explicit = parseMultilineSetting(settingsJson);
    return explicit ?? MULTILINE_BY_NAME.test(fieldName);
}

/** `true`/`false` when the settings say so, else undefined. */
export function parseMultilineSetting(settingsJson: string | undefined): boolean | undefined {
    if (!settingsJson) return undefined;
    try {
        const parsed = JSON.parse(settingsJson);
        return typeof parsed?.multiline === 'boolean' ? parsed.multiline : undefined;
    } catch {
        return undefined;
    }
}
