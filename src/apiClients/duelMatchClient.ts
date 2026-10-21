import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import {
    DuelEscalationClearDto,
    DuelEscalationClearResultDto,
    DuelMatchDto,
    DuelMatchQuery,
    DuelPolicyDto,
    DuelRestrictionCreateDto,
    DuelRestrictionDto,
    DuelResultDto,
} from '../types/dtos/duels/DuelDtos';

// Arena duels (KNG-213 API, KNG-221 pages): the staff side of api/DuelMatches. The lifecycle writes
// (lock-in, start, complete, cancel) are the game server's only; staff actions need knk.admin.duel.review,
// which the API checks. Every staff action except a release needs a reason.
export class DuelMatchClient extends ObjectManager {
    private static instance: DuelMatchClient;

    public static getInstance() {
        if (!DuelMatchClient.instance) {
            DuelMatchClient.instance = new DuelMatchClient();
            DuelMatchClient.instance.logger = logging.getLogger('DuelMatchClient');
        }
        return DuelMatchClient.instance;
    }

    /** History, newest first (at most 200); userId matches either duelist. */
    query(query: DuelMatchQuery): Promise<DuelMatchDto[]> {
        const qs = queryString(query);
        return this.invokeServiceCall(null, qs ? `?${qs}` : '', Controllers.DuelMatches, HttpMethod.Get);
    }

    getById(id: number): Promise<DuelMatchDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.DuelMatches, HttpMethod.Get);
    }

    /** Pays out a held result. */
    release(id: number, reason?: string): Promise<DuelResultDto> {
        return this.invokeServiceCall({ reason: reason || null }, `${id}/release`, Controllers.DuelMatches, HttpMethod.Post);
    }

    /** Refunds both stakes of a held result. */
    voidHeld(id: number, reason: string): Promise<DuelResultDto> {
        return this.invokeServiceCall({ reason }, `${id}/void`, Controllers.DuelMatches, HttpMethod.Post);
    }

    /** Undoes a paid result: what can be recovered goes back to the loser first. */
    revert(id: number, reason: string): Promise<DuelResultDto> {
        return this.invokeServiceCall({ reason }, `${id}/revert`, Controllers.DuelMatches, HttpMethod.Post);
    }

    /** Like revert, but the recovered coins go to the sink and undelivered items are destroyed. */
    confiscate(id: number, reason: string): Promise<DuelResultDto> {
        return this.invokeServiceCall({ reason }, `${id}/confiscate`, Controllers.DuelMatches, HttpMethod.Post);
    }

    /** Acknowledges the open DUEL_FLAG alerts of a pair (both ids) or a beneficiary (one id). */
    clearEscalation(body: DuelEscalationClearDto): Promise<DuelEscalationClearResultDto> {
        return this.invokeServiceCall(body, 'escalation/clear', Controllers.DuelMatches, HttpMethod.Post);
    }

    getPolicy(): Promise<DuelPolicyDto> {
        return this.invokeServiceCall(null, 'policy', Controllers.DuelMatches, HttpMethod.Get);
    }

    /** 409 PolicyChanged when the policy changed since it was loaded (updatedAt is the version). */
    updatePolicy(policy: DuelPolicyDto): Promise<DuelPolicyDto> {
        return this.invokeServiceCall(policy, 'policy', Controllers.DuelMatches, HttpMethod.Put);
    }

    /** Restrictions where the player is either side; all of them, or only the active ones. */
    getRestrictions(userId?: number, activeOnly = true): Promise<DuelRestrictionDto[]> {
        const params = new URLSearchParams({ activeOnly: String(activeOnly) });
        if (userId != null) params.set('userId', String(userId));
        return this.invokeServiceCall(null, `restrictions?${params.toString()}`, Controllers.DuelMatches, HttpMethod.Get);
    }

    createRestriction(body: DuelRestrictionCreateDto): Promise<DuelRestrictionDto> {
        return this.invokeServiceCall(body, 'restrictions', Controllers.DuelMatches, HttpMethod.Post);
    }

    liftRestriction(id: number, reason?: string): Promise<DuelRestrictionDto> {
        return this.invokeServiceCall({ reason: reason || null }, `restrictions/${id}/lift`, Controllers.DuelMatches, HttpMethod.Post);
    }
}

/** The history query string: empty values are left out. */
export function queryString(query: DuelMatchQuery): string {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            params.set(key, String(value).trim());
        }
    });
    return params.toString();
}

export const duelMatchClient = DuelMatchClient.getInstance();
