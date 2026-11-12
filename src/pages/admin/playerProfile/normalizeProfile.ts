import { UserProfileSummaryDto } from '../../../types/dtos/userManagement/UserProfileSummaryDtos';

/**
 * #119: the profile summary with every part the page reads filled in. An older API, a partly seeded account or a
 * thin test stub can leave out `groups`, `permissions`, `title` or `salary` (or numbers in them), and the page
 * used to crash on the first `.filter` or `.toFixed`. Missing numbers read as 0, missing lists as empty; the page
 * then shows "-" or "none" instead of a blank screen. Returns null when there is no account at all.
 */
export function normalizeProfileSummary(raw: unknown): UserProfileSummaryDto | null {
    const s = (raw ?? {}) as Partial<UserProfileSummaryDto>;
    const a = s.account as Partial<UserProfileSummaryDto['account']> | undefined;
    if (!a || typeof a !== 'object' || a.id == null) return null;
    const num = (value: unknown, fallback = 0): number => {
        const n = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(n) ? n : fallback;
    };
    const account = {
        ...a,
        id: num(a.id),
        username: typeof a.username === 'string' && a.username ? a.username : `User #${a.id}`,
        coins: num(a.coins),
        gems: num(a.gems),
        experiencePoints: num(a.experiencePoints),
        prestigeExperience: num(a.prestigeExperience),
        personalSalaryMultiplier: num(a.personalSalaryMultiplier, 1),
        emailVerified: a.emailVerified === true,
        isFullAccount: a.isFullAccount === true,
        isActive: a.isActive !== false,
        activeMode: a.activeMode === 'Staff' || a.activeMode === 'Owner' ? a.activeMode : 'None',
    } as UserProfileSummaryDto['account'];

    const permissions = s.permissions && Array.isArray(s.permissions.permissions)
        ? s.permissions
        : { userId: account.id, permissions: [] };
    const groups = Array.isArray(s.groups) ? s.groups : [];
    const title = { ...(s.title ?? {}), prestigeExperience: num(s.title?.prestigeExperience) } as UserProfileSummaryDto['title'];
    const salary = {
        ...(s.salary ?? {}),
        titleSalary: num(s.salary?.titleSalary),
        globalMultiplier: num(s.salary?.globalMultiplier, 1),
        personalMultiplier: num(s.salary?.personalMultiplier, 1),
        rankMultiplier: num(s.salary?.rankMultiplier, 1),
        effectiveHourlyRate: num(s.salary?.effectiveHourlyRate),
    } as UserProfileSummaryDto['salary'];

    return { ...s, account, permissions, groups, title, salary } as UserProfileSummaryDto;
}
