import { useEffect, useState } from 'react';
import { DomainClient } from '../apiClients/domainClient';
import { parentIdFromValue, parentRegionFromValue } from '../utils/forms/landmarkForm';

/**
 * Whether a landmark form's picked parent has a main region (landmark-domain A17, PandiO/knk-workspace#986): read from
 * the picked row when it says so, else looked up once per parent with `GET api/Domains/{id}`. `null` while unknown
 * (not a landmark form, still loading, or the lookup failed): the form then doesn't hold the area back, and the API's
 * own check still applies on save.
 */
export function useLandmarkParentRegion(enabled: boolean, parentValue: unknown): boolean | null {
    const known = enabled ? parentRegionFromValue(parentValue) : null;
    const parentId = enabled && known === null ? parentIdFromValue(parentValue) : null;
    const [looked, setLooked] = useState<{ id: number; hasRegion: boolean | null } | null>(null);

    useEffect(() => {
        if (parentId == null) return;
        let cancelled = false;
        DomainClient.getInstance().getById(String(parentId))
            .then(domain => {
                if (cancelled) return;
                const region = (domain as { wgRegionId?: string | null } | null)?.wgRegionId;
                setLooked({ id: parentId, hasRegion: typeof region === 'string' && region.trim() !== '' });
            })
            .catch(() => {
                if (!cancelled) setLooked({ id: parentId, hasRegion: null });
            });
        return () => { cancelled = true; };
    }, [parentId]);

    if (!enabled) return null;
    if (known !== null) return known;
    return looked && looked.id === parentId ? looked.hasRegion : null;
}
