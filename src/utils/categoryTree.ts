/**
 * KNG-263: item categories as a tree. A category filter includes every category below the chosen
 * one ("Weapons" also shows "Swords" and "Bows"); knk-web-api's item blueprint search expands a
 * `CategoryId` filter the same way (ItemBlueprintRepository.ResolveCategoryFilterAsync).
 */

export interface CategoryNode {
    id?: string | number;
    name: string;
    parentCategoryId?: string | number | null;
}

export interface CategoryOption {
    id: string;
    name: string;
    /** 0 for a top-level category, 1 for its children, ... */
    depth: number;
}

const key = (value: string | number | null | undefined): string | undefined =>
    value === undefined || value === null || String(value).trim() === '' ? undefined : String(value);

/** The ids of `rootId` and every category below it; just `rootId` when it is unknown. Cycles are ignored. */
export function categoryWithDescendants(categories: CategoryNode[], rootId: string | number): Set<string> {
    const root = String(rootId);
    const selected = new Set<string>([root]);
    const frontier = [root];
    while (frontier.length > 0) {
        const parent = frontier.shift() as string;
        categories.forEach(category => {
            const id = key(category.id);
            if (id !== undefined && key(category.parentCategoryId) === parent && !selected.has(id)) {
                selected.add(id);
                frontier.push(id);
            }
        });
    }
    return selected;
}

/**
 * Every category in tree order: each parent followed by its children, alphabetical within a level.
 * A category whose parent is missing (or part of a cycle) is listed at the top level.
 */
export function categoryOptions(categories: CategoryNode[]): CategoryOption[] {
    const withIds = categories.filter(category => key(category.id) !== undefined);
    const ids = new Set(withIds.map(category => key(category.id) as string));
    const byName = (a: CategoryNode, b: CategoryNode) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    const childrenOf = (parent: string | undefined) => withIds
        .filter(category => {
            const parentId = key(category.parentCategoryId);
            return parent === undefined ? parentId === undefined || !ids.has(parentId) : parentId === parent;
        })
        .sort(byName);

    const options: CategoryOption[] = [];
    const placed = new Set<string>();
    const visit = (category: CategoryNode, depth: number) => {
        const id = key(category.id) as string;
        if (placed.has(id)) return;
        placed.add(id);
        options.push({ id, name: category.name, depth });
        childrenOf(id).forEach(child => visit(child, depth + 1));
    };
    childrenOf(undefined).forEach(category => visit(category, 0));
    // Categories only reachable through a cycle have no top-level ancestor.
    withIds.filter(category => !placed.has(key(category.id) as string)).sort(byName).forEach(category => visit(category, 0));
    return options;
}
