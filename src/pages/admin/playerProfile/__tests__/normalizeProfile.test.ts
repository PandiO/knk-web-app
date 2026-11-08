import { normalizeProfileSummary } from '../normalizeProfile';

// PandiO/knk-workspace#119: the profile crashed on a summary without groups, permissions, title or salary.

describe('normalizeProfileSummary', () => {
    it('fills in every part the page reads', () => {
        const s = normalizeProfileSummary({ account: { id: 3 } })!;
        expect(s.account).toMatchObject({ id: 3, username: 'User #3', coins: 0, gems: 0, experiencePoints: 0, activeMode: 'None', isActive: true, isFullAccount: false });
        expect(s.groups).toEqual([]);
        expect(s.permissions).toEqual({ userId: 3, permissions: [] });
        expect(s.title.prestigeExperience).toBe(0);
        expect(s.salary).toMatchObject({ titleSalary: 0, globalMultiplier: 1, personalMultiplier: 1, rankMultiplier: 1, effectiveHourlyRate: 0 });
        expect(() => s.salary.effectiveHourlyRate.toFixed(2)).not.toThrow();
    });

    it('keeps what is there', () => {
        const s = normalizeProfileSummary({
            account: { id: 3, username: 'Steve', coins: 12, activeMode: 'Staff', isActive: false, uuid: 'u' },
            groups: [{ permissionGroupId: 1 }],
            presence: { online: true },
            salary: { effectiveHourlyRate: 2.5, nextEligibleAt: 'x' },
        })!;
        expect(s.account).toMatchObject({ username: 'Steve', coins: 12, activeMode: 'Staff', isActive: false, uuid: 'u' });
        expect(s.groups).toHaveLength(1);
        expect(s.presence).toEqual({ online: true });
        expect(s.salary).toMatchObject({ effectiveHourlyRate: 2.5, nextEligibleAt: 'x' });
    });

    it('returns null without an account', () => {
        expect(normalizeProfileSummary(null)).toBeNull();
        expect(normalizeProfileSummary({})).toBeNull();
        expect(normalizeProfileSummary({ account: {} })).toBeNull();
    });
});
