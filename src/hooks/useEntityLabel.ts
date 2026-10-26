import { useEffect, useState } from 'react';
import { getFetchByIdFunctionForEntity } from '../utils/entityApiMapping';
import { entityDisplayLabel } from '../utils/entityLabel';

/**
 * The display label of one entity (#177 link 2: the "Edit {name}" crumb of an open form). Null
 * until it loaded, and when there is no id or the entity can't be fetched (the crumb then shows
 * "#{id}"). One extra GET of the entity; the form fetches it separately.
 */
export function useEntityLabel(entityTypeName: string | null | undefined, entityId: string | number | null | undefined): string | null {
    const [label, setLabel] = useState<string | null>(null);

    useEffect(() => {
        setLabel(null);
        if (!entityTypeName || entityId == null || String(entityId) === '') return undefined;
        let cancelled = false;
        (async () => {
            try {
                const fetchById = getFetchByIdFunctionForEntity(entityTypeName);
                if (typeof fetchById !== 'function') return;
                const entity = await fetchById(String(entityId));
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
