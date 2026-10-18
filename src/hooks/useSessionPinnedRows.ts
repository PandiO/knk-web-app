import { useMemo } from 'react';
import { useFormSession } from '../contexts/FormSessionContext';
import { PinnedRow } from '../utils/forms/sessionPinnedRows';

/**
 * KNG-136: the entities this form session created for one entity type, as pinned picker rows, plus a
 * refresh key that changes whenever one of them is registered or edited, so the picker refetches.
 *
 * Not pinned: embedded values (a single Object Location is saved with its owner) and Locations in
 * general - a Location belongs to one owner (architecture/location-retention.md), so one made for
 * another field is never offered elsewhere. Entities the session only edited are already database
 * rows and are not pinned either.
 */
export function useSessionPinnedRows(objectType?: string | null): {
    pinnedRows: Array<PinnedRow<Record<string, unknown>>>;
    refreshKey?: string;
} {
    const session = useFormSession();
    return useMemo(() => {
        if (!session || !objectType || objectType.toLowerCase() === 'location') {
            return { pinnedRows: [] };
        }
        const entries = session.entitiesOfType(objectType)
            .filter(entry => entry.status === 'created' && !entry.embedded && entry.id !== undefined);
        if (entries.length === 0) {
            return { pinnedRows: [] };
        }
        return {
            pinnedRows: entries
                .slice()
                .sort((a, b) => b.sequence - a.sequence) // newest first
                .map(entry => ({ key: entry.key, row: { ...entry.display, id: entry.id } })),
            refreshKey: entries.map(entry => `${entry.key}@${entry.revision}`).join('|')
        };
    }, [session, objectType]);
}
