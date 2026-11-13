import { getFetchByIdFunctionForEntity } from './entityApiMapping';
import { lookupClient } from '../apiClients/lookupClient';

/**
 * PandiO/knk-workspace#280 (DESIGN § 4.6.3): one record of `entityTypeName` for a label. The type's own GET first; when
 * the API refuses it (403, the viewer holds an area node but none of the type's read nodes) the minimal lookup
 * `GET api/Lookup/{type}/{id}`, as `{ id, name }` (the shape of an edit-loaded reference, LV6-4). Any other failure,
 * and a refused lookup, is passed on.
 */
export async function fetchByIdOrLookup(entityTypeName: string, id: string | number): Promise<Record<string, unknown> | null> {
    try {
        const fetchById = getFetchByIdFunctionForEntity(entityTypeName);
        if (typeof fetchById !== 'function') return null;
        const entity = await fetchById(String(id));
        return entity && typeof entity === 'object' ? entity as Record<string, unknown> : null;
    } catch (error) {
        if ((error as { status?: number } | null)?.status !== 403) throw error;
        const item = await lookupClient.get(entityTypeName, id);
        return item ? { id: item.id, name: item.label } : null;
    }
}
