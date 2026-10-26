import { readDashboardFavourites, toggleFavourite, writeDashboardFavourites } from '../dashboardFavourites';

const KEY = 'knk.dashboard.favouriteEntityTypes';

describe('dashboard favourites (PandiO/knk-workspace#194)', () => {
    beforeEach(() => {
        window.localStorage.clear();
        jest.restoreAllMocks();
    });

    it('stores and reads the starred types per browser', () => {
        writeDashboardFavourites(['Town', 'Street']);

        expect(window.localStorage.getItem(KEY)).toBe('["Town","Street"]');
        expect(readDashboardFavourites()).toEqual(['Town', 'Street']);
    });

    it('reads nothing from missing, corrupt or wrongly shaped storage, and drops duplicates', () => {
        expect(readDashboardFavourites()).toEqual([]);
        window.localStorage.setItem(KEY, '{not json');
        expect(readDashboardFavourites()).toEqual([]);
        window.localStorage.setItem(KEY, '{"Town":true}');
        expect(readDashboardFavourites()).toEqual([]);
        window.localStorage.setItem(KEY, '["Town", 3, "", "town", "Street"]');
        expect(readDashboardFavourites()).toEqual(['Town', 'Street']);
    });

    it('keeps working when storage throws', () => {
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });

        expect(() => writeDashboardFavourites(['Town'])).not.toThrow();
        expect(readDashboardFavourites()).toEqual([]);
    });

    it('toggles a type in or out, ignoring case', () => {
        expect(toggleFavourite([], 'Town')).toEqual(['Town']);
        expect(toggleFavourite(['Town', 'Street'], 'town')).toEqual(['Street']);
    });
});
