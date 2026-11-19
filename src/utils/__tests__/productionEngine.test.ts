import {
    effectErrors,
    formatDuration,
    formatPercent,
    inputErrors,
    levelItemErrors,
    lineStatusIsProblem,
    lineStatusLabel,
    modifierStepLabel,
    modifierWindowLabel,
    nextLevelOf,
    oddsErrors,
    oddsTotal,
    productionEngineSettingsErrors,
    productionRefusalReason,
    rateSteps,
    upgradeCostItems,
} from '../productionEngine';
import type { ProductionKindLevelDto } from '../../types/dtos/production/ProductionEngineDtos';

/** Production engine P3 in the web app (PandiO/knk-workspace#678; PRODUCTION_KINDS § 4-5, A08, A09). */
describe('production engine helpers', () => {
    it('builds the rate formula step by step: base, modifiers in applied order, unlock, workers (A08)', () => {
        const steps = rateSteps({
            baseRatePerHour: 10,
            modifiers: [
                { source: 'Admin', name: 'Festival', scope: 'Town', effect: 'Add', value: 2 },
                { source: 'Level', name: 'Level 2', scope: 'Structure', effect: 'Multiply', value: 1.5 },
                { source: 'Weather', name: 'Rain', scope: 'Global', effect: 'Multiply', value: 0.5 },
            ],
            unlockFactor: 1,
            workerFactor: 0.5,
        });
        expect(steps.map(s => [s.label, s.change, s.rate])).toEqual([
            ['Base rate', '10/h', 10],
            ['Admin: Festival', '+2/h', 12],
            ['Level: Level 2', '× 1.5', 18],
            ['Weather: Rain', '× 0.5', 9],
            ['Workers present', '× 50%', 4.5],
        ]);
    });

    it('shows an output that is not unlocked at this level as a zero step', () => {
        const steps = rateSteps({ baseRatePerHour: 4, modifiers: [], unlockFactor: 0, workerFactor: 1 });
        expect(steps[1]).toEqual({ label: 'Unlock: not unlocked at this level', change: '× 0%', rate: 0 });
    });

    it('labels modifiers, factors, durations and windows', () => {
        expect(modifierStepLabel({ effect: 'Add', value: -1.25 })).toBe('−1.25/h');
        expect(modifierStepLabel({ effect: 'Multiply', value: 0.8 })).toBe('× 0.8');
        expect(formatPercent(1)).toBe('100%');
        expect(formatDuration(45)).toBe('45 s');
        expect(formatDuration(3900)).toBe('1 h 5 min');
        expect(formatDuration(7200)).toBe('2 h');
        expect(modifierWindowLabel(null, null)).toBe('Always');
        expect(modifierWindowLabel('2026-11-20T10:00:00Z', null)).toBe('From 2026-11-20 10:00');
        expect(modifierWindowLabel('2026-11-20T10:00:00Z', '2026-11-21T10:00:00Z')).toBe('2026-11-20 10:00 to 2026-11-21 10:00');
    });

    it('names the line states and flags the blocked ones (D4)', () => {
        expect(lineStatusLabel('BlockedFull')).toBe('Blocked: output storage full');
        expect(lineStatusLabel('Paused')).toBe('Paused by staff');
        expect(lineStatusLabel('Future')).toBe('Future');
        expect(lineStatusIsProblem('BlockedInputs')).toBe(true);
        expect(lineStatusIsProblem('Running')).toBe(false);
    });

    it('checks a zone\'s odds: a type on every row, each chance in range, no repeats, at most 100% together', () => {
        expect(oddsErrors([{ weatherTypeId: 1, chancePercent: 30 }, { weatherTypeId: 2, chancePercent: 20 }])).toEqual([]);
        expect(oddsTotal([{ chancePercent: 30 }, { chancePercent: 20 }])).toBe(50);
        expect(oddsErrors([{ weatherTypeId: 1, chancePercent: 70 }, { weatherTypeId: 2, chancePercent: 40 }]))
            .toEqual(['The chances add up to 110%: at most 100%.']);
        expect(oddsErrors([{ weatherTypeId: 1, chancePercent: 10 }, { weatherTypeId: 1, chancePercent: 10 }]))
            .toEqual(['A weather type is listed twice.']);
        expect(oddsErrors([{ weatherTypeId: 0, chancePercent: 0 }])).toHaveLength(2);
    });

    it('checks a level\'s items: an upgrade cost needs an amount, an unlock does not', () => {
        expect(levelItemErrors([{ role: 'Unlock', itemBlueprintId: 3, amount: 0 }, { role: 'UpgradeCost', itemBlueprintId: 3, amount: 64 }])).toEqual([]);
        expect(levelItemErrors([{ role: 'UpgradeCost', itemBlueprintId: 3, amount: 0 }])).toEqual(['An upgrade cost needs a whole amount above 0.']);
        expect(levelItemErrors([{ role: 'Unlock', itemBlueprintId: 3, amount: 0 }, { role: 'Unlock', itemBlueprintId: 3, amount: 0 }]))
            .toEqual(['A blueprint is listed twice with the same role.']);
    });

    it('checks a line\'s inputs and a weather type\'s effects', () => {
        expect(inputErrors([{ itemBlueprintId: 4, amountPerHour: 0.5 }])).toEqual([]);
        expect(inputErrors([{ itemBlueprintId: 4, amountPerHour: 0 }])).toEqual(['Each input needs an amount per hour above 0.']);
        expect(effectErrors([{ category: 'Crops', effect: 'Multiply', value: 1.2 }, { category: 'Crops', effect: 'Add', value: 1 }])).toEqual([]);
        expect(effectErrors([{ category: 'Crops', effect: 'Multiply', value: 1.2 }, { category: 'Crops', effect: 'Multiply', value: 0.8 }]))
            .toEqual(['A category has the same effect twice.']);
        expect(effectErrors([{ category: 'Ore', effect: 'Multiply', value: -1 }])).toEqual(["A multiplication can't be negative."]);
    });

    it('finds the next level and its upgrade cost; none at level 10 (A09)', () => {
        const levels = [1, 2, 10].map(level => ({
            id: level, productionKindId: 1, level, upgradeCoins: level * 100,
            items: [{ role: 'UpgradeCost', itemBlueprintId: 5, amount: 64 }, { role: 'Unlock', itemBlueprintId: 6, amount: 0 }],
        })) as ProductionKindLevelDto[];
        expect(nextLevelOf(levels, 1)?.level).toBe(2);
        expect(nextLevelOf(levels, 10)).toBeNull();
        expect(upgradeCostItems(nextLevelOf(levels, 1))).toEqual([{ role: 'UpgradeCost', itemBlueprintId: 5, amount: 64 }]);
    });

    it('checks the engine timing against the API\'s bounds', () => {
        expect(productionEngineSettingsErrors({ baseCycleMinutes: 10, catchUpCapHours: 24, weatherDayMinutes: 20 })).toEqual([]);
        expect(productionEngineSettingsErrors({ baseCycleMinutes: 0, catchUpCapHours: 721, weatherDayMinutes: 1.5 })).toHaveLength(3);
    });

    it('reads the API\'s { error } sentence of a refused call', () => {
        expect(productionRefusalReason({ status: 409, response: { error: 'Not enough coins: Steve has 10, the upgrade costs 500.' } }))
            .toBe('Not enough coins: Steve has 10, the upgrade costs 500.');
    });
});
