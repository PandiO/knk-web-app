/**
 * KNG-200: the web app's notation of a Minecraft namespaced key, so "Stone", " minecraft:STONE "
 * and "minecraft:stone" count as the same catalogue entry. Mirrors the API's
 * `MinecraftNamespaceKey.TryNormalize` (trimmed, lower case, `minecraft:` added when there is no
 * namespace) without its validity check: the result is only used to compare rows.
 */

/** The normalised key, or '' for a blank or missing key. */
export function normalizeNamespaceKey(key: unknown): string {
    if (key === null || key === undefined) return '';
    const text = String(key).trim().toLowerCase();
    if (!text) return '';
    return text.includes(':') ? text : `minecraft:${text}`;
}

/**
 * A block state string in a comparable form (lower case, no whitespace), or '' when there is none.
 * Properties are not re-ordered: the API returns its canonical form, this only absorbs notation.
 */
export function normalizeBlockStateString(state: unknown): string {
    if (state === null || state === undefined) return '';
    return String(state).replace(/\s+/g, '').toLowerCase();
}
