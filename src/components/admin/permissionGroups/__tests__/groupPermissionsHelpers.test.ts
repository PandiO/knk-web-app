import { blastRadiusText, toLocalInput } from '../GroupPermissionsPanel';

// PandiO/knk-workspace#50: the confirmation's blast radius and the expiry field of the group Permissions panel.
describe('blastRadiusText', () => {
    it('names the players reached, the inheriting groups and how fast online players see it', () => {
        expect(blastRadiusText({ groupId: 2, directMembers: 2, totalMembers: 5, inheritingGroups: 2 }, 'Knight'))
            .toBe('This affects 5 players (members of Knight and of 2 groups that inherit from it). Online players get the change within seconds.');
    });

    it('speaks of one player and one inheriting group in the singular', () => {
        expect(blastRadiusText({ groupId: 2, directMembers: 0, totalMembers: 1, inheritingGroups: 1 }, 'Knight'))
            .toBe('This affects 1 player (members of Knight and of 1 group that inherits from it). Online players get the change within seconds.');
    });

    it('leaves out inheriting groups when there are none', () => {
        expect(blastRadiusText({ groupId: 3, directMembers: 0, totalMembers: 0, inheritingGroups: 0 }, 'Lord'))
            .toBe('This affects 0 players (members of Lord). Online players get the change within seconds.');
    });

    it("says so when the count couldn't be loaded", () => {
        expect(blastRadiusText(null, 'Knight')).toBe("Couldn't count the players this affects. Online players get the change within seconds.");
    });
});

describe('toLocalInput', () => {
    it('is empty for a permanent node or a bad date', () => {
        expect(toLocalInput(null)).toBe('');
        expect(toLocalInput(undefined)).toBe('');
        expect(toLocalInput('not a date')).toBe('');
    });

    it('gives the datetime-local value of the same instant', () => {
        const value = toLocalInput('2027-01-15T10:30:00Z');
        expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
        expect(new Date(value).toISOString()).toBe('2027-01-15T10:30:00.000Z');
    });
});
