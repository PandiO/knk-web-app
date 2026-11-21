import type { ShopTradeStatListDto } from '../../types/dtos/production/ShopDtos';
import {
    catalogueBody,
    catalogueFormErrors,
    emptyCatalogueForm,
    formatCoins,
    formatUtcHour,
    hourlySeries,
    levelBody,
    levelForm,
    levelFormErrors,
    reasonLabel,
    seriesTotals,
    statBlueprints,
    tradeStatsWindow,
} from '../shops';

/** Shops P10c (PandiO/knk-workspace#688): the editors' checks mirror the API's; the trade stats series covers every hour. */
describe('shops helpers', () => {
    const stat = (values: Partial<ShopTradeStatListDto>): ShopTradeStatListDto => ({
        id: 1, shopId: 31, itemBlueprintId: 6, itemBlueprintName: 'Bread', hourStart: '2026-11-21T10:00:00Z',
        unitsSold: 0, revenue: 0, unitsBoughtBack: 0, buyBackPaid: 0, unitsSupplied: 0, stockAtEnd: 0, ...values,
    });

    it('formats coins, UTC hours and reasons', () => {
        expect(formatCoins(1250)).toBe('1,250 coins');
        expect(formatCoins(null)).toBe('-');
        expect(formatUtcHour('2026-11-21T09:00:00Z')).toBe('2026-11-21 09:00 UTC');
        expect(reasonLabel('SHOP_PURCHASE')).toBe('Shop purchase');
        expect(reasonLabel('ShopBuyBack')).toBe('Shop buy back');
    });

    it('a catalogue entry needs an item; a unique item is never Unlimited; prices are whole coins', () => {
        const form = emptyCatalogueForm();
        expect(catalogueFormErrors(form)).toEqual(["Pick an item, or give a unique item's instance id."]);
        expect(catalogueFormErrors({ ...form, itemInstanceId: '77', stockMode: 'Unlimited' })).toEqual(["A unique item is one item: it can't be Unlimited."]);
        expect(catalogueFormErrors({ ...form, blueprint: { id: 6, label: 'Bread' }, staticPrice: '2.5' })[0]).toMatch(/whole number of coins/);
        expect(catalogueFormErrors({ ...form, blueprint: { id: 6, label: 'Bread' }, staticPrice: '12' })).toEqual([]);
    });

    it('a new entry sends its shop and item; an edit keeps them; an empty price is the formula (0)', () => {
        const form = { ...emptyCatalogueForm(), blueprint: { id: 6, label: 'Bread' }, staticPrice: '' };
        expect(catalogueBody(form, 31)).toEqual({
            id: null, shopId: 31, itemBlueprintId: 6, itemInstanceId: null, staticPrice: 0, stockMode: 'Stocked', pinned: false, sortOrder: 0, enabled: true,
        });
        expect(catalogueBody({ ...form, itemInstanceId: '77', blueprint: null }, 31)).toMatchObject({ itemBlueprintId: null, itemInstanceId: 77 });
        expect(catalogueBody({ ...form, id: 5, staticPrice: '9' }, 31)).toMatchObject({ id: 5, shopId: null, itemBlueprintId: null, itemInstanceId: null, staticPrice: 9 });
    });

    it('a level is 1 to 100, not taken, with multipliers above 0 and a max at or above the min', () => {
        const form = levelForm(null, 2);
        expect(form.level).toBe('2');
        expect(levelFormErrors(form, [1])).toEqual([]);
        expect(levelFormErrors({ ...form, level: '1' }, [1])).toEqual(['The shop type already has level 1.']);
        expect(levelFormErrors({ ...form, priceMultiplier: '0' }, [])).toEqual(['The price multiplier is above 0 and at most 100.']);
        expect(levelFormErrors({ ...form, reorderPointUnits: '20', targetUnits: '10' }, [])).toEqual(['The default max is below the default min.']);
        expect(levelBody({ ...form, merchandiseMaxUnits: '' , targetUnits: '64' }, 9)).toMatchObject({ shopTypeId: 9, level: 2, merchandiseMaxUnits: 0, targetUnits: 64 });
    });

    it('the series has every hour of the window, sums the items of an hour and filters one item', () => {
        const window = tradeStatsWindow('24h', new Date('2026-11-21T12:34:00Z'));
        expect(window.from.toISOString()).toBe('2026-11-20T13:00:00.000Z');
        expect(window.to.toISOString()).toBe('2026-11-21T13:00:00.000Z');
        const rows = [
            stat({ id: 1, hourStart: '2026-11-21T10:00:00Z', unitsSold: 4, revenue: 40 }),
            stat({ id: 2, hourStart: '2026-11-21T10:00:00Z', itemBlueprintId: 7, itemBlueprintName: 'Apple', unitsSold: 2, revenue: 6, unitsBoughtBack: 1, buyBackPaid: 2 }),
            stat({ id: 3, hourStart: '2026-11-21T12:00:00Z', unitsSupplied: 20 }),
            stat({ id: 4, hourStart: '2026-11-19T10:00:00Z', unitsSold: 99 }),
        ];
        const series = hourlySeries(rows, window.from, window.hours);
        expect(series).toHaveLength(24);
        expect(series[21]).toMatchObject({ unitsSold: 6, revenue: 46, unitsBoughtBack: 1 });
        expect(seriesTotals(series)).toEqual({ unitsSold: 6, revenue: 46, unitsBoughtBack: 1, buyBackPaid: 2, unitsSupplied: 20 });
        expect(seriesTotals(hourlySeries(rows, window.from, window.hours, 7)).unitsSold).toBe(2);
        expect(statBlueprints(rows)).toEqual([{ id: 7, name: 'Apple' }, { id: 6, name: 'Bread' }]);
    });
});
