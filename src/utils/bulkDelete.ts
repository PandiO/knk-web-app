import { BULK_DELETE_MAX_IDS, BulkDeleteRefusalDto, BulkDeleteResponseDto } from '../apiClients/dashboardClient';
import { apiRefusalReason } from './apiRefusalReason';
import { formatNumber } from './format';

/**
 * PandiO/knk-workspace#205 bulk delete (#280 DESIGN § 4.7): the selected ids go to `POST api/Dashboard/bulk-delete` in
 * chunks of 100, one after the other. Each row is deleted (or refused) on its own on the server, so a chunk's answer
 * lists both. When a call itself fails (a refusal of the whole call, the rate limit, the network), the run stops and
 * the ids not sent yet are reported as not tried, with the reason.
 */
export interface BulkDeleteOutcome {
    deleted: number[];
    refused: BulkDeleteRefusalDto[];
    /** Ids no call was made for (or whose call failed), with why. */
    notRun: { ids: number[]; reason: string } | null;
}

export async function runBulkDelete(
    ids: readonly number[],
    call: (ids: number[]) => Promise<BulkDeleteResponseDto>,
    onProgress?: (done: number, total: number) => void,
    chunkSize = BULK_DELETE_MAX_IDS
): Promise<BulkDeleteOutcome> {
    const outcome: BulkDeleteOutcome = { deleted: [], refused: [], notRun: null };
    for (let start = 0; start < ids.length; start += chunkSize) {
        const chunk = ids.slice(start, start + chunkSize);
        try {
            const answer = await call(chunk);
            outcome.deleted.push(...(answer?.deleted ?? []));
            outcome.refused.push(...(answer?.refused ?? []));
            // An id the answer doesn't mention (shouldn't happen) counts as refused rather than silently gone.
            const answered = new Set([...(answer?.deleted ?? []), ...(answer?.refused ?? []).map(r => r.id)]);
            chunk.filter(id => !answered.has(id)).forEach(id =>
                outcome.refused.push({ id, reason: 'The server gave no answer for this row.', code: 'Failed' }));
        } catch (error) {
            outcome.notRun = { ids: ids.slice(start), reason: bulkCallFailure(error) };
            break;
        }
        onProgress?.(Math.min(start + chunk.length, ids.length), ids.length);
    }
    return outcome;
}

/** Why a bulk delete call failed as a whole, in words. */
export function bulkCallFailure(error: unknown): string {
    const status = (error as { status?: number } | null)?.status;
    if (status === 429) return 'Too many bulk actions in a short time. Wait a minute and try again.';
    return apiRefusalReason(error) ?? "The server didn't answer or had a problem. Check your connection and try again.";
}

/** The plural of a type label ("Town" → "Towns", "Category" → "Categories", "Lootbox" → "Lootboxes"). */
export function pluralLabel(label: string): string {
    if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`;
    if (/(s|x|ch|sh)$/i.test(label)) return `${label}es`;
    return `${label}s`;
}

/** "3 Towns", "1 Town" (the label as the page names the type). */
export const countOf = (count: number, label: string): string =>
    `${formatNumber(count)} ${count === 1 ? label : pluralLabel(label)}`;
