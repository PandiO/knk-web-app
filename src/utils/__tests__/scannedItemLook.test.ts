import { describeShieldBanner, scannedArmorTrim, scannedShieldBanner } from '../scannedItemLook';

// PandiO/knk-workspace#232: a shield's banner and an armour piece's trim come out of the scan JSON.
describe('scannedShieldBanner', () => {
    it('reads the base colour and the layers in order', () => {
        expect(scannedShieldBanner({
            material: 'minecraft:shield',
            shieldBanner: {
                baseColor: 'RED',
                layers: [
                    { patternKey: 'minecraft:stripe_top', color: 'YELLOW' },
                    { patternKey: 'minecraft:cross', color: 'WHITE' },
                    { patternKey: 'minecraft:border', color: 'BLACK' }
                ]
            }
        })).toEqual({
            baseColor: 'RED',
            layers: [
                { patternKey: 'minecraft:stripe_top', color: 'YELLOW' },
                { patternKey: 'minecraft:cross', color: 'WHITE' },
                { patternKey: 'minecraft:border', color: 'BLACK' }
            ]
        });
    });

    it('keeps a banner item without a base colour, and drops broken layers', () => {
        expect(scannedShieldBanner({
            shieldBanner: { baseColor: null, layers: [{ patternKey: 'minecraft:globe', color: 'PINK' }, { patternKey: '', color: 'RED' }, null] }
        })).toEqual({ baseColor: null, layers: [{ patternKey: 'minecraft:globe', color: 'PINK' }] });
    });

    it('is null for a plain item, an older plugin or junk', () => {
        expect(scannedShieldBanner({ material: 'minecraft:diamond_sword' })).toBeNull();
        expect(scannedShieldBanner({ shieldBanner: { baseColor: null, layers: [] } })).toBeNull();
        expect(scannedShieldBanner({ shieldBanner: 'RED' })).toBeNull();
        expect(scannedShieldBanner(undefined)).toBeNull();
    });
});

describe('scannedArmorTrim', () => {
    it('reads a complete trim and refuses half of one', () => {
        expect(scannedArmorTrim({ armorTrim: { pattern: 'minecraft:silence', material: 'minecraft:netherite' } }))
            .toEqual({ pattern: 'minecraft:silence', material: 'minecraft:netherite' });
        expect(scannedArmorTrim({ armorTrim: { pattern: 'minecraft:silence' } })).toBeNull();
        expect(scannedArmorTrim({})).toBeNull();
    });
});

describe('describeShieldBanner', () => {
    it('is one readable line', () => {
        expect(describeShieldBanner('RED', [{ patternKey: 'minecraft:stripe_top', color: 'YELLOW' }, { patternKey: 'minecraft:border', color: 'BLACK' }]))
            .toBe('RED | stripe_top:YELLOW, border:BLACK');
        expect(describeShieldBanner('BLUE', [])).toBe('BLUE | no layers');
        expect(describeShieldBanner(null, undefined)).toBe('(none)');
    });
});
