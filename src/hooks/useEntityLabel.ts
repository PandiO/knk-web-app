import { useEffect, useState } from 'react';
import { fetchByIdOrLookup } from '../utils/fetchOrLookup';
import { entityDisplayLabel } from '../utils/entityLabel';

/**
 * The display label of one entity (#177 link 2: the "Edit {name}" crumb of an open form). Null
 * until it loaded, and when there is no id or the entity can't be fetched (the crumb then shows
 * "#{id}"). One extra GET of the entity (or of its lookup label without a read node, #280); the form fetches it separately.
 */
export function useEntityLabel(entityTypeName: string | null | undefined, entityId: string | number | null | undefined): string | null {
    const [label, setLabel] = useState<string | null>(null);

    useEffect(() => {
        setLabel(null);
        if (!entityTypeName || entityId == null || String(entityId) === '') return undefined;
        let cancelled = false;
        (async () => {
            try {
                // #280: without a read node of the type, the lookup's label.
                const entity = await fetchByIdOrLookup(entityTypeName, entityId);
                if (!cancelled && entity) setLabel(entityDisplayLabel(entity, entityId));
            } catch {
                // No label: the crumb falls back to the id.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [entityTypeName, entityId]);

    return label;
}
