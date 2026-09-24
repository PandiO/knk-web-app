import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, RefreshCcw, ArrowLeft, ShieldCheck, Users, Award, Coins, EyeOff } from 'lucide-react';
import { logging } from '../../utils';
import { userManagementClient } from '../../apiClients/userManagementClient';
import {
    ActiveMode,
    UserProfileSummaryDto,
} from '../../types/dtos/userManagement/UserProfileSummaryDtos';

// docs/specs/user-management/DESIGN.md §2 - a read-first composite dashboard for one player,
// distinct from the generic /forms/user edit screen. Quick actions (assign/revoke group,
// grant/deny a node, toggle vanish) are Phase 2 (docs/specs/user-management/IMPLEMENTATION_PLAN.md);
// this page is read-only.

const activeModeLabel = (mode: ActiveMode): string => {
    switch (mode) {
        case 'Owner': return 'Owner mode';
        case 'Staff': return 'Staff mode';
        default: return 'Visible (no mode)';
    }
};

const formatDate = (iso?: string | null): string => {
    if (!iso) return '-';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

export const PlayerProfilePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const userId = Number(id);

    const [summary, setSummary] = React.useState<UserProfileSummaryDto | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        if (!Number.isFinite(userId) || userId <= 0) {
            setError('Invalid user id.');
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const result = await userManagementClient.getProfileSummary(userId);
            setSummary(result);
        } catch (err) {
            console.error('Failed to load player profile:', err);
            logging.errorHandler.next('ErrorMessage.PlayerProfile.LoadFailed');
            setError('Could not load this player’s profile. They may not exist, or the request failed.');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    React.useEffect(() => {
        void load();
    }, [load]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
            </div>
        );
    }

    if (error || !summary) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <p className="text-gray-600">{error || 'Player not found.'}</p>
                <button className="btn-secondary text-sm" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </button>
            </div>
        );
    }

    const { account, permissions, groups, title, salary } = summary;
    const activeGroups = groups.filter(g => g.isActive);
    const premiumGroups = groups.filter(g => g.isPremiumTier);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <button className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center" onClick={() => navigate(-1)}>
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Back
                            </button>
                            <h1 className="text-2xl font-bold text-gray-900">{account.username}</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                User #{account.id}
                                {account.uuid && <span className="font-mono"> &middot; {account.uuid}</span>}
                                {account.email && <span> &middot; {account.email}</span>}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {account.activeMode !== 'None' && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                    <EyeOff className="h-3.5 w-3.5 mr-1" />
                                    {activeModeLabel(account.activeMode)}
                                </span>
                            )}
                            <button className="btn-secondary text-sm" onClick={() => void load()}>
                                <RefreshCcw className="h-4 w-4 mr-2" />
                                Reload
                            </button>
                        </div>
                    </div>
                </div>

                {/* Account */}
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-gray-500">Coins</p>
                            <p className="font-semibold text-gray-900">{account.coins}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Gems</p>
                            <p className="font-semibold text-gray-900">{account.gems}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Experience</p>
                            <p className="font-semibold text-gray-900">{account.experiencePoints}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Account type</p>
                            <p className="font-semibold text-gray-900">{account.isFullAccount ? 'Full account' : 'Minecraft-only'}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Created</p>
                            <p className="font-semibold text-gray-900">{formatDate(account.createdAt)}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Status</p>
                            <p className="font-semibold text-gray-900">{account.isActive ? 'Active' : 'Deactivated'}</p>
                        </div>
                    </div>
                </div>

                {/* Title / XP */}
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Award className="h-5 w-5 mr-2" />
                        Title &amp; Experience
                    </h2>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-xl font-semibold text-gray-900">{title.titleName || 'No title'}</p>
                            <p className="text-sm text-gray-500">{account.experiencePoints} XP total</p>
                        </div>
                        {title.nextTitleName ? (
                            <div className="text-sm text-gray-600 text-right">
                                <p>Next: <span className="font-medium text-gray-900">{title.nextTitleName}</span></p>
                                <p>{Math.max(0, (title.nextTitleMinExperience ?? 0) - account.experiencePoints)} XP to go</p>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-600 text-right">
                                <p>Highest title reached</p>
                                <p>{title.prestigeExperience} prestige XP</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Premium tier */}
                {premiumGroups.length > 0 && (
                    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Premium Tier</h2>
                        <div className="flex flex-wrap gap-3">
                            {premiumGroups.map(g => (
                                <span
                                    key={g.permissionGroupId}
                                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                                        g.isActive ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-500 line-through'
                                    }`}
                                >
                                    {g.permissionGroupName}
                                    {g.expiresAt && <span className="ml-2 text-xs font-normal">until {formatDate(g.expiresAt)}</span>}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Groups */}
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Users className="h-5 w-5 mr-2" />
                        Groups ({activeGroups.length} active)
                    </h2>
                    {groups.length === 0 ? (
                        <p className="text-sm text-gray-500">No group memberships.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b border-gray-200">
                                        <th className="py-2 pr-4">Group</th>
                                        <th className="py-2 pr-4">Weight</th>
                                        <th className="py-2 pr-4">Premium</th>
                                        <th className="py-2 pr-4">Expires</th>
                                        <th className="py-2 pr-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groups.map(g => (
                                        <tr key={g.permissionGroupId} className="border-b border-gray-100">
                                            <td className="py-2 pr-4 font-medium text-gray-900">{g.permissionGroupName || `#${g.permissionGroupId}`}</td>
                                            <td className="py-2 pr-4 text-gray-700">{g.weight}</td>
                                            <td className="py-2 pr-4 text-gray-700">{g.isPremiumTier ? 'Yes' : '-'}</td>
                                            <td className="py-2 pr-4 text-gray-700">{g.expiresAt ? formatDate(g.expiresAt) : 'Never'}</td>
                                            <td className="py-2 pr-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    g.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                    {g.isActive ? 'Active' : 'Expired'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Salary */}
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Coins className="h-5 w-5 mr-2" />
                        Salary
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
                        <div>
                            <p className="text-gray-500">Global x Personal x Rank</p>
                            <p className="font-semibold text-gray-900">
                                {salary.globalMultiplier} &times; {salary.personalMultiplier} &times; {salary.rankMultiplier}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-500">Effective rate</p>
                            <p className="font-semibold text-gray-900">{salary.effectiveHourlyRate.toFixed(2)} coins/hr</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Last payout</p>
                            <p className="font-semibold text-gray-900">{formatDate(salary.lastSalaryPayoutAt)}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Next eligible</p>
                            <p className="font-semibold text-gray-900">{formatDate(salary.nextEligibleAt)}</p>
                        </div>
                    </div>
                </div>

                {/* Permissions */}
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <ShieldCheck className="h-5 w-5 mr-2" />
                        Effective Permissions ({permissions.permissions.length})
                    </h2>
                    {permissions.permissions.length === 0 ? (
                        <p className="text-sm text-gray-500">No declared permission nodes for this player.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b border-gray-200">
                                        <th className="py-2 pr-4">Node</th>
                                        <th className="py-2 pr-4">Value</th>
                                        <th className="py-2 pr-4">Source</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {permissions.permissions.map(p => (
                                        <tr key={p.node} className="border-b border-gray-100">
                                            <td className="py-2 pr-4 font-mono text-xs text-gray-900">{p.node}</td>
                                            <td className="py-2 pr-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    p.value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {p.value ? 'Granted' : 'Denied'}
                                                </span>
                                            </td>
                                            <td className="py-2 pr-4 text-gray-700">
                                                {p.sourceHolderType === 'User'
                                                    ? 'Direct grant'
                                                    : (p.sourceHolderName || `Group #${p.sourceHolderId}`)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
