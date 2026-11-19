import {
    allowedYieldSources,
    areaOverCap,
    areaSizeLabel,
    compositionRows,
    footprintOf,
    isSurveyed,
    overrideErrors,
    overrideLabel,
    plotBox,
    primaryOutputErrors,
    signedChange,
    trendRows,
    yieldRowErrors,
    yieldSourceText,
} from '../productionYield';

/** Yield areas P4 in the web app (PandiO/knk-workspace#680): the helpers behind the area, survey and yield screens. */
describe('productionYield', () => {
    it('surveys Derived and Hybrid structures only (G5)', () => {
        expect(isSurveyed('Hybrid')).toBe(true);
        expect(isSurveyed('Derived')).toBe(true);
        expect(isSurveyed('Configured')).toBe(false);
        expect(isSurveyed(null)).toBe(false);
        expect(yieldSourceText('Configured')).toContain('never surveyed');
    });

    it('lists the yield sources a kind allows, Hybrid first', () => {
        expect(allowedYieldSources(null)).toEqual(['Hybrid', 'Derived', 'Configured']);
        expect(allowedYieldSources({ allowsDerived: true, allowsConfigured: false, allowsHybrid: true })).toEqual(['Hybrid', 'Derived']);
    });

    it('labels the size against the level cap', () => {
        expect(areaSizeLabel({ size: 320, sizeUnit: 'blocks', maxSize: 400 })).toBe('320 of 400 blocks');
        expect(areaSizeLabel({ size: 18, sizeUnit: 'radius', maxSize: null })).toBe('18 radius (no cap)');
        expect(areaOverCap({ size: 401, maxSize: 400 })).toBe(true);
        expect(areaOverCap({ size: 400, maxSize: 400 })).toBe(false);
        expect(areaOverCap({ size: 9000, maxSize: null })).toBe(false);
    });

    it('labels and checks overrides', () => {
        expect(overrideLabel('Pin', 12)).toBe('Pin 12/h');
        expect(overrideLabel('Scale', 0.5)).toBe('Scale × 0.5');
        expect(overrideLabel('Exclude', 0)).toBe('Exclude');
        expect(overrideErrors('Exclude', '')).toEqual([]);
        expect(overrideErrors('Pin', '')).toHaveLength(1);
        expect(overrideErrors('Pin', '0')).toHaveLength(1);
        expect(overrideErrors('Pin', '3.5')).toEqual([]);
        expect(overrideErrors('Scale', '101')).toHaveLength(1);
        expect(overrideErrors('Scale', '0')).toEqual([]);
    });

    it('checks yield rows like the API', () => {
        expect(yieldRowErrors([{ unitKey: 'TREE:OAK:*', itemBlueprintId: 5, ratePerUnitPerHour: 0.5, byproductChance: 1, minLevel: 1 }])).toEqual([]);
        expect(yieldRowErrors([{ unitKey: '*', itemBlueprintId: 5, ratePerUnitPerHour: 0, byproductChance: 0, minLevel: 10 }])).toEqual([]);
        const problems = yieldRowErrors([
            { unitKey: 'TREE:*:OAK', itemBlueprintId: 0, ratePerUnitPerHour: -1, byproductChance: 2, minLevel: 11 },
        ]);
        expect(problems).toHaveLength(5);
        expect(yieldRowErrors([
            { unitKey: 'BLOCK:COAL_ORE', itemBlueprintId: 6, ratePerUnitPerHour: 1 },
            { unitKey: 'block:coal_ore', itemBlueprintId: 6, ratePerUnitPerHour: 2 },
        ])).toEqual(['Row 2: the same unit key and output are already in the table.']);
        expect(primaryOutputErrors([{ itemBlueprintId: 6 }, { itemBlueprintId: 6 }, { itemBlueprintId: 0 }])).toHaveLength(2);
    });

    it('sorts the composition largest first with each share', () => {
        const rows = compositionRows([
            { unitKey: 'BLOCK:STONE', count: 300 },
            { unitKey: 'BLOCK:COAL_ORE', count: 100, sharedBy: 2 },
        ], 400);
        expect(rows.map(r => r.unitKey)).toEqual(['BLOCK:STONE', 'BLOCK:COAL_ORE']);
        expect(rows[0].percent).toBe(75);
        expect(rows[1].sharedBy).toBe(2);
        expect(compositionRows(null)).toEqual([]);
    });

    it('reads the trend, largest now first, with the change', () => {
        const rows = trendRows({
            productionAreaId: 4,
            surveys: [],
            series: { 'TREE:OAK:LARGE': [12, 8, 5], 'TREE:BIRCH:SMALL': [1, 2, 9] },
        });
        expect(rows.map(r => r.unitKey)).toEqual(['TREE:BIRCH:SMALL', 'TREE:OAK:LARGE']);
        expect(rows[1].change).toBe(-7);
        expect(signedChange(8)).toBe('+8');
        expect(signedChange(-7)).toBe('-7');
        expect(trendRows(null)).toEqual([]);
    });

    it('draws each shape from above and fits them in one box', () => {
        const circle = footprintOf({ shape: 'Radius', centerX: 0, centerZ: 0, radius: 10 });
        const rect = footprintOf({ shape: 'Cuboid', minX: 5, minZ: 5, maxX: 24, maxZ: 14 });
        const polygon = footprintOf({ shape: 'Polygon', points: [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 0, z: 4 }] });
        expect(circle).toEqual({ kind: 'circle', cx: 0, cz: 0, r: 10 });
        expect(rect).toEqual({ kind: 'rect', minX: 5, minZ: 5, maxX: 24, maxZ: 14 });
        expect(polygon?.kind).toBe('polygon');
        expect(footprintOf({ shape: 'Region' })).toBeNull();
        const box = plotBox([circle!, rect!]);
        expect(box).toEqual({ minX: -14, minZ: -14, width: 43, height: 33 });
        expect(plotBox([])).toBeNull();
    });
});
