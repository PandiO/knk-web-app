import { DuelMatchDto, DuelPolicyDto } from '../../../../types/dtos/duels/DuelDtos';

/** alice (1) beat bob (2) in a staked own-gear duel; paid and flagged S1 + S4. */
export const PAID: DuelMatchDto = {
    id: 7, publicToken: '9d1c2f6e-0000-4000-8000-000000000007', arenaId: 3, arenaKey: 'arena_2', arenaName: 'Old Arena',
    battlegroundId: 11, battlegroundKey: 'arena_2_bg_1', challengerUserId: 1, challengerUsername: 'alice', opponentUserId: 2,
    opponentUsername: 'bob', gearMode: 'OWN_GEAR_KEEP', status: 'Completed', endReason: 'Win', winnerUserId: 1,
    challengerCoins: 1000, opponentCoins: 800, feePercent: 5, feeCoins: 90, valueMoving: true,
    stakeItems: [{ ownerUserId: 2, material: 'DIAMOND_SWORD', amount: 1, name: 'Edge', grade: 'B', instanceId: 55 }],
    spoilsItems: [], stakeTransactionId: 100, settlementTransactionId: 101, feeTransactionId: 102, refundTransactionId: null,
    review: 'Flagged', reviewTier: 1, reviewSignals: ['S1', 'S4'],
    reviewDetails: { signals: ['S1', 'S4'], escalatedByPair: false, escalatedByBeneficiary: false, values: { loserDamagePercent: 2.5, loserAttackAttempts: 0 } },
    alertId: 501, reviewedByUserId: null, reviewedAt: null, reviewReason: null, revertResult: null, undeliveredItems: 'None',
    telemetry: {
        durationSeconds: 8,
        challenger: { damageDealt: 20, damageTaken: 0.5, hits: 7, attackAttempts: 9, armorPoints: 20, mainHand: 'DIAMOND_SWORD', hadWeapon: true },
        opponent: { damageDealt: 0.5, damageTaken: 20, hits: 0, attackAttempts: 0, armorPoints: 0, mainHand: null, hadWeapon: false },
    },
    offerCount: 2, createdAt: '2026-10-21T10:00:00', lockedAt: '2026-10-21T10:00:00', fightStartedAt: '2026-10-21T10:01:00',
    endedAt: '2026-10-21T10:01:08',
};

export const HELD: DuelMatchDto = {
    ...PAID, id: 8, review: 'Held', reviewTier: 2, settlementTransactionId: null, feeTransactionId: null, feeCoins: 0,
    reviewDetails: { signals: ['S2'], escalatedByPair: true, escalatedByBeneficiary: false, values: { durationSeconds: 4 } },
    reviewSignals: ['S2'],
};

export const FRIENDLY_DRAW: DuelMatchDto = {
    ...PAID, id: 9, challengerCoins: 0, opponentCoins: 0, stakeItems: [], valueMoving: false, endReason: 'AgreedDraw',
    winnerUserId: null, review: 'None', reviewTier: null, reviewSignals: [], reviewDetails: null, alertId: null, feeCoins: 0,
    stakeTransactionId: null, settlementTransactionId: null, feeTransactionId: null,
};

export const POLICY: DuelPolicyDto = {
    s1Enabled: true, s1LoserDamagePercent: 10, s2Enabled: true, s2ShortFightSeconds: 10, s3Enabled: true, s4Enabled: true,
    s4MaxLoserAttackAttempts: 0, s5Enabled: true, s5PairDuels: 3, s6Enabled: true, s6MinYoungOpponents: 3, s6YoungAccountDays: 7,
    s6WindowDays: 7, escalationFlagCount: 2, escalationWindowDays: 7, updatedAt: '2026-10-21T08:00:00.123456', updatedByUserId: null,
};
