/**
 * The Display description an ItemScan / KitScan result offers for an item blueprint
 * (PandiO/knk-workspace#40).
 *
 * The plugin's scan sends the item's raw `lore` and, since #40, a cleaned `descriptionLore`: the
 * lore without the lines the plugin generates itself when it builds the item (custom-enchantment
 * lines, the grade line, origin lines and the blank spacers around them), with lines the plugin
 * wrapped (#212) joined back. Those generated lines would otherwise be stored in the description
 * and show up twice on the next build. A plugin from before #40 sends no `descriptionLore`; the raw
 * lore is used then, as before.
 */
export function scannedItemDescription(scan: unknown): string {
    if (!scan || typeof scan !== 'object') return '';
    const { descriptionLore, lore } = scan as { descriptionLore?: unknown; lore?: unknown };
    const lines = Array.isArray(descriptionLore) ? descriptionLore : Array.isArray(lore) ? lore : [];
    return lines.filter((line): line is string => typeof line === 'string').join('\n');
}
