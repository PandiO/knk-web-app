import React from 'react';
import { Link } from 'react-router-dom';
import { parseUtc } from '../../../components/currency/BalanceLedgerTable';
import { DuelMatchDto, DuelReviewState, END_REASON_LABELS } from '../../../types/dtos/duels/DuelDtos';

// Shared bits of the staff duel pages (arena duels P7, KNG-221).

export const numberFormat = new Intl.NumberFormat('en-US');

export const formatWhen = (value?: string | null): string => {
    if (!value) return '—';
    const date = parseUtc(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const formatCoins = (value: number): string => `${numberFormat.format(value)} coins`;

const REVIEW_STYLES: Record<DuelReviewState, string> = {
    None: 'bg-gray-100 text-gray-700 border-gray-200',
    Flagged: 'bg-amber-50 text-amber-800 border-amber-200',
    Held: 'bg-orange-100 text-orange-800 border-orange-200',
    Released: 'bg-green-50 text-green-800 border-green-200',
    Voided: 'bg-red-100 text-red-800 border-red-200',
};

export const ReviewBadge: React.FC<{ review: DuelReviewState; tier?: number | null }> = ({ review, tier }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${REVIEW_STYLES[review] ?? REVIEW_STYLES.None}`}>
        {review === 'None' ? (tier === 0 ? 'Clean' : 'Not reviewed') : review}
    </span>
);

export const PlayerLink: React.FC<{ userId: number; username?: string | null }> = ({ userId, username }) => (
    <Link to={`/admin/users/${userId}`} className="text-primary hover:underline">{username ?? `#${userId}`}</Link>
);

/** "alice beat bob", "Draw: agreed", "Cancelled: teleport failed", "In progress". */
export function outcomeText(match: DuelMatchDto): string {
    if (match.status === 'Created') return 'Locked in';
    if (match.status === 'InProgress') return 'In progress';
    if (match.winnerUserId != null) {
        const winner = match.winnerUserId === match.challengerUserId ? match.challengerUsername : match.opponentUsername;
        const loser = match.winnerUserId === match.challengerUserId ? match.opponentUsername : match.challengerUsername;
        return `${winner ?? `#${match.winnerUserId}`} won${match.endReason === 'Forfeit' ? ' (forfeit by ' + (loser ?? 'the other') + ')' : ''}`;
    }
    return match.endReason ? END_REASON_LABELS[match.endReason] ?? match.endReason : match.status;
}

/** The two coin stakes and the item stacks, e.g. "1,000 + 800 coins, 3 item stacks" or "Friendly". */
export function stakeSummary(match: DuelMatchDto): string {
    const parts: string[] = [];
    if (match.challengerCoins > 0 || match.opponentCoins > 0) {
        parts.push(`${numberFormat.format(match.challengerCoins)} + ${numberFormat.format(match.opponentCoins)} coins`);
    }
    if (match.stakeItems.length > 0) parts.push(`${match.stakeItems.length} item stack${match.stakeItems.length === 1 ? '' : 's'}`);
    if (match.gearMode === 'OWN_GEAR_DROP') parts.push('drop mode');
    return parts.length > 0 ? parts.join(', ') : 'Friendly';
}
