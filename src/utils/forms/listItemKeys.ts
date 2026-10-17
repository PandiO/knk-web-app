/**
 * KNG-134: stable React keys for the items a List relationship field holds. An item with an id is
 * keyed by it; an id-less item (an unsaved value from an old draft) gets a client key that stays
 * the same for as long as the item object does. Before, every id-less item was keyed `undefined`,
 * so React mixed them up, "remove" dropped all of them and "Edit instance" always opened the first.
 *
 * Keys are unique within one list even when the same id appears twice.
 */
const clientKeys = new WeakMap<object, string>();
let nextClientKey = 0;

function itemId(item: unknown): unknown {
    if (typeof item !== 'object' || item === null) {
        return undefined;
    }
    const record = item as Record<string, unknown>;
    return record.id ?? record.Id;
}

function baseKey(item: unknown, index: number): string {
    const id = itemId(item);
    if (id !== null && id !== undefined && id !== '') {
        return `id:${String(id)}`;
    }
    if (typeof item === 'object' && item !== null) {
        let key = clientKeys.get(item);
        if (!key) {
            nextClientKey += 1;
            key = `new:${nextClientKey}`;
            clientKeys.set(item, key);
        }
        return key;
    }
    return `index:${index}`;
}

export function listItemKeys(items: readonly unknown[]): string[] {
    const used = new Set<string>();
    return items.map((item, index) => {
        let key = baseKey(item, index);
        if (used.has(key)) {
            key = `${key}#${index}`;
        }
        used.add(key);
        return key;
    });
}
