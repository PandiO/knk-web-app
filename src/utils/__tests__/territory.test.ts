import { defaultTransportSettings } from '../transport';
import {
    conflictAreaLabel,
    conflictStateLabel,
    districtCapitalPayload,
    holderLabel,
    normalizeProductionSettings,
    parsePower,
    rangeFormula,
    territoryFlagLabel,
    territorySettingsErrors,
    townRange,
    townTerritoryPayload,
} from '../territory';

/**
 * Territory V1 helpers (PandiO/knk-workspace#690; territory DESIGN § 1-4, G11): the range rule matches knk-web-api
 * `TerritoryRules`, the partial saves leave every "not on this form" group alone, and the labels say what the page shows.
 */
describe('territory helpers', () => {
    const settings = { baseRange: 100, powerFactor: 2, capitalMultiplier: 1.5 };

    it('range is base + power × factor, and the capital is multiplied (G11)', () => {
        expect(townRange(settings, 50)).toBe(200);
        expect(townRange(settings, 50, true)).toBe(300);
        expect(townRange(settings, 0)).toBe(100);
        expect(rangeFormula(settings, 50)).toBe('(100 + 50 × 2) = 200');
        expect(rangeFormula(settings, 50, true)).toBe('(100 + 50 × 2) × 1.5 = 300');
    });

    it('fills a missing production section with the design defaults, flag off', () => {
        const engine = { baseCycleMinutes: 10, catchUpCapHours: 24, weatherDayMinutes: 20 };
        const transport = defaultTransportSettings();
        expect(normalizeProductionSettings(undefined)).toEqual({ enabled: false, territory: settings, engine, transport });
        expect(normalizeProductionSettings({ enabled: true, territory: { baseRange: 50 } as any }))
            .toEqual({ enabled: true, territory: { ...settings, baseRange: 50 }, engine, transport });
    });

    it('keeps the production engine timing, so a save does not reset it (#678)', () => {
        const engine = { baseCycleMinutes: 5, catchUpCapHours: 48, weatherDayMinutes: 30 };
        expect(normalizeProductionSettings({ enabled: true, territory: settings, engine }).engine).toEqual(engine);
    });

    it('keeps the transport settings, so a save does not reset them (#682)', () => {
        const transport = { ...defaultTransportSettings(), walkingSpeedBlocksPerSecond: 6, maxReroutes: 0 };
        expect(normalizeProductionSettings({ enabled: true, territory: settings, transport }).transport).toEqual(transport);
    });

    it('reports the settings the API would refuse, in its words', () => {
        expect(territorySettingsErrors(settings)).toEqual([]);
        expect(territorySettingsErrors({ ...settings, capitalMultiplier: 0.5 }))
            .toEqual(['production.territory.capitalMultiplier must be between 1 and 10.']);
        expect(territorySettingsErrors({ baseRange: -1, powerFactor: Number.NaN, capitalMultiplier: 11 })).toHaveLength(3);
    });

    it('accepts whole powers from 0 to 1,000,000 only', () => {
        expect(parsePower('50')).toBe(50);
        expect(parsePower('0')).toBe(0);
        expect(parsePower('')).toBeNull();
        expect(parsePower('-1')).toBeNull();
        expect(parsePower('2.5')).toBeNull();
        expect(parsePower('1000001')).toBeNull();
    });

    it('a town save sends its own fields, the territory change, and null for every other group', () => {
        const town = {
            id: 4, name: 'Phoenix', description: 'Capital', allowEntry: true, allowExit: false, wgRegionId: 'domain_4',
            worldName: 'world', locationId: 9, location: { id: 9, x: 1 }, teleportEnabled: true, teleportPriceGems: 5,
            navigationDefaultOverride: 'Spawn', roadAccessOverride: 'Applies', streetIds: [1, 2], power: 10,
        };
        expect(townTerritoryPayload(town, { power: 50, kingdomId: 1, provinceId: 2 })).toEqual({
            id: 4, name: 'Phoenix', description: 'Capital', allowEntry: true, allowExit: false, wgRegionId: 'domain_4',
            worldName: 'world', locationId: 9, location: null, teleportEnabled: null, navigationDefaultOverride: null,
            roadAccessOverride: null, power: 50, kingdomId: 1, provinceId: 2,
        });
        // No kingdom = no province either (the API checks the province is in the town's kingdom).
        expect(townTerritoryPayload(town, { power: 5, kingdomId: null, provinceId: 2 }).provinceId).toBeNull();
    });

    it('a district save changes only the capital flag and keeps its streets (null)', () => {
        const payload = districtCapitalPayload({ id: 7, name: 'Old Town', townId: 4, wgRegionId: 'domain_7', streetIds: [3] }, true);
        expect(payload).toMatchObject({ id: 7, name: 'Old Town', townId: 4, wgRegionId: 'domain_7', isCapital: true, streetIds: null, location: null, teleportEnabled: null });
    });

    it('labels holders, conflict states, areas and flags', () => {
        expect(holderLabel({ kind: 'Town', id: 4, name: 'Phoenix' })).toBe('Phoenix (town)');
        expect(holderLabel({ kind: 'Kingdom', id: 1, name: null })).toBe('Kingdom #1 (deleted)');
        expect(conflictStateLabel({ status: 'Open', resolution: 'None' })).toBe('Open');
        expect(conflictStateLabel({ status: 'Resolved', resolution: 'Awarded', awardedHolder: { kind: 'Town', id: 4, name: 'Phoenix' } }))
            .toBe('Resolved: awarded to Phoenix (town)');
        expect(conflictStateLabel({ status: 'Resolved', resolution: 'Redrawn' })).toBe('Resolved: lines redrawn');
        expect(conflictAreaLabel({ minChunkX: 4, maxChunkX: 6, minChunkZ: 2, maxChunkZ: 2 }))
            .toBe('chunks x 4..6, z 2..2 · blocks x 64..111, z 32..47');
        expect(territoryFlagLabel('Contested')).toBe('In a contested zone');
        expect(territoryFlagLabel('OutsideTerritory')).toBe("Outside its town's territory");
        expect(territoryFlagLabel(undefined)).toBe("Inside its town's territory");
    });
});
