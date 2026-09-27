import React from 'react';
import { Link } from 'react-router-dom';
import { Ban, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';
import { lootboxTokenClient } from '../../apiClients/lootboxTokenClient';
import { lootboxTypeClient } from '../../apiClients/lootboxTypeClient';
import { permissionGroupClient } from '../../apiClients/permissionGroupClient';
import { KitClient } from '../../apiClients/kitClient';
import {
    LootboxTokenDto,
    LootboxTokenGrantDto,
    LootboxTokenReason,
    LootboxTokenSearchFilters,
    LootboxTokenStatus,
    LootboxTypeDto,
    MAX_BOX_STARS,
} from '../../types/dtos/lootbox/LootboxDtos';
import { PermissionGroupDto } from '../../types/dtos/userManagement/PermissionGroupDto';
import { KitDto } from '../../types/dtos/kit/KitDtos';
import { apiErrorMessage, formatDateTime, starLabel } from '../../utils/lootbox';

/**
 * Lootbox token items (docs/specs/lootboxes/IMPLEMENTATION_PLAN.md Phase 5): v1's "Sword Box" consumables,
 * issued by the API and opened in game with a right-click. The item is recognised only by the token id in
 * its knk_lootbox_token tag, and each token opens once. Grant rules make premium tiers (on joining) and
 * kits (on every grant) issue tokens; staff issue them in game with /knk lootbox token. Opened tokens show
 * up in the drop log as "token item" rows.
 */

export const TOKENS_PAGE_SIZE = 25;

const REASONS: LootboxTokenReason[] = ['WorldPickup', 'Admin', 'PremiumTier', 'Kit', 'PvpKill', 'Referral', 'Other'];
const STATUSES: LootboxTokenStatus[] = ['Issued', 'Redeemed', 'Revoked'];

const REASON_LABELS: Record<LootboxTokenReason, string> = {
    Admin: 'Staff',
    PremiumTier: 'Premium tier',
    Kit: 'Kit',
    PvpKill: 'PvP kill',
    Referral: 'Referral',
    Other: 'Other',
    WorldPickup: 'World box',
};

const selectClass = 'rounded-md border-gray-300 shadow-sm text-sm';

/** Only the filters that are set. */
export function toTokenSearchFilters(status: '' | LootboxTokenStatus, reason: '' | LootboxTokenReason): LootboxTokenSearchFilters {
    const filters: LootboxTokenSearchFilters = {};
    if (status) filters.status = status;
    if (reason) filters.reason = reason;
    return filters;
}

type GrantTarget = 'tier' | 'kit';

interface GrantDraft {
    target: GrantTarget;
    targetId: string;
    lootboxTypeId: string;
    /** '' = rolled per token. */
    boxStars: string;
    quantity: string;
}

const EMPTY_DRAFT: GrantDraft = { target: 'tier', targetId: '', lootboxTypeId: '', boxStars: '', quantity: '1' };

const GrantRules: React.FC<{ types: LootboxTypeDto[] }> = ({ types }) => {
    const [grants, setGrants] = React.useState<LootboxTokenGrantDto[]>([]);
    const [tiers, setTiers] = React.useState<PermissionGroupDto[]>([]);
    const [kits, setKits] = React.useState<KitDto[]>([]);
    const [draft, setDraft] = React.useState<GrantDraft>(EMPTY_DRAFT);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setGrants(await lootboxTokenClient.getGrants());
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not load the token grant rules.'));
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void load();
        permissionGroupClient.getAll()
            .then(groups => setTiers(groups.filter(g => g.isPremiumTier)))
            .catch(err => console.error('Failed to load premium tiers for the token grant rules:', err));
        KitClient.getInstance().getAll()
            .then(setKits)
            .catch(err => console.error('Failed to load kits for the token grant rules:', err));
    }, [load]);

    const add = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!draft.targetId || !draft.lootboxTypeId) return;
        setSaving(true);
        setError(null);
        try {
            const created = await lootboxTokenClient.createGrant({
                lootboxTypeId: Number(draft.lootboxTypeId),
                boxStars: draft.boxStars ? Number(draft.boxStars) : null,
                quantity: Number(draft.quantity) || 1,
                permissionGroupId: draft.target === 'tier' ? Number(draft.targetId) : null,
                kitId: draft.target === 'kit' ? Number(draft.targetId) : null,
                enabled: true,
            });
            setGrants(prev => [...prev, created]);
            setDraft(EMPTY_DRAFT);
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not add the rule.'));
        } finally {
            setSaving(false);
        }
    };

    const toggle = async (grant: LootboxTokenGrantDto) => {
        setError(null);
        try {
            const updated = await lootboxTokenClient.updateGrant({ ...grant, enabled: !grant.enabled });
            setGrants(prev => prev.map(g => (g.id === grant.id ? updated : g)));
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not change the rule.'));
        }
    };

    const remove = async (grant: LootboxTokenGrantDto) => {
        if (grant.id == null) return;
        setError(null);
        try {
            await lootboxTokenClient.deleteGrant(grant.id);
            setGrants(prev => prev.filter(g => g.id !== grant.id));
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not delete the rule.'));
        }
    };

    const targets: { id: number; name: string }[] = (draft.target === 'tier' ? tiers : kits)
        .filter(t => t.id != null)
        .map(t => ({ id: t.id as number, name: t.name }));

    return (
        <section className="bg-white rounded-lg shadow p-4 space-y-3" aria-label="Token grant rules">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Grant rules</h2>
                <p className="text-sm text-gray-600">
                    Joining a premium tier (not extending it) or being granted a kit issues these tokens; the game server hands
                    them over when the player is online.
                </p>
            </div>
            {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <tr>
                        <th className="px-3 py-2">When</th>
                        <th className="px-3 py-2">Tokens</th>
                        <th className="px-3 py-2">Enabled</th>
                        <th className="px-3 py-2" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {grants.map(grant => (
                        <tr key={grant.id} data-testid="grant-row">
                            <td className="px-3 py-2">
                                {grant.permissionGroupId != null
                                    ? `Joins ${grant.permissionGroupName ?? `tier #${grant.permissionGroupId}`}`
                                    : `Gets kit ${grant.kitName ?? `#${grant.kitId}`}`}
                            </td>
                            <td className="px-3 py-2">
                                {grant.quantity}× {grant.lootboxTypeName ?? `Type #${grant.lootboxTypeId}`}{' '}
                                <span className="text-amber-600">{grant.boxStars ? starLabel(grant.boxStars) : 'rolled grade'}</span>
                            </td>
                            <td className="px-3 py-2">
                                <input type="checkbox" aria-label={`Rule ${grant.id} enabled`} checked={grant.enabled} onChange={() => void toggle(grant)} />
                            </td>
                            <td className="px-3 py-2 text-right">
                                <button type="button" onClick={() => void remove(grant)} className="text-red-600 hover:text-red-800" aria-label={`Delete rule ${grant.id}`}>
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {!loading && grants.length === 0 && (
                        <tr><td colSpan={4} className="px-3 py-4 text-center text-sm text-gray-500">No rules: tokens are only issued by staff.</td></tr>
                    )}
                </tbody>
            </table>
            <form className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3" onSubmit={add}>
                <label className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1">When a player</span>
                    <select aria-label="Grant trigger" value={draft.target} onChange={e => setDraft({ ...draft, target: e.target.value as GrantTarget, targetId: '' })} className={selectClass}>
                        <option value="tier">joins a premium tier</option>
                        <option value="kit">gets a kit</option>
                    </select>
                </label>
                <label className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1">{draft.target === 'tier' ? 'Premium tier' : 'Kit'}</span>
                    <select aria-label="Grant target" value={draft.targetId} onChange={e => setDraft({ ...draft, targetId: e.target.value })} className={selectClass}>
                        <option value="">Choose…</option>
                        {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </label>
                <label className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1">Box type</span>
                    <select aria-label="Grant box type" value={draft.lootboxTypeId} onChange={e => setDraft({ ...draft, lootboxTypeId: e.target.value })} className={selectClass}>
                        <option value="">Choose…</option>
                        {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </label>
                <label className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1">Box grade</span>
                    <select aria-label="Grant box grade" value={draft.boxStars} onChange={e => setDraft({ ...draft, boxStars: e.target.value })} className={selectClass}>
                        <option value="">Rolled</option>
                        {Array.from({ length: MAX_BOX_STARS }, (_, i) => i + 1).map(s => <option key={s} value={s}>{starLabel(s)}</option>)}
                    </select>
                </label>
                <label className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1">How many</span>
                    <input type="number" min={1} max={64} aria-label="Grant quantity" value={draft.quantity} onChange={e => setDraft({ ...draft, quantity: e.target.value })} className={`${selectClass} w-20`} />
                </label>
                <button type="submit" disabled={saving || !draft.targetId || !draft.lootboxTypeId} className="btn-primary inline-flex items-center gap-1 disabled:opacity-50">
                    <Plus className="h-4 w-4" /> Add rule
                </button>
            </form>
        </section>
    );
};

export const LootboxTokensTab: React.FC = () => {
    const [types, setTypes] = React.useState<LootboxTypeDto[]>([]);
    const [rows, setRows] = React.useState<LootboxTokenDto[]>([]);
    const [totalCount, setTotalCount] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [status, setStatus] = React.useState<'' | LootboxTokenStatus>('');
    const [reason, setReason] = React.useState<'' | LootboxTokenReason>('');
    const [searchDraft, setSearchDraft] = React.useState('');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [notice, setNotice] = React.useState<string | null>(null);
    const [confirmToken, setConfirmToken] = React.useState<string | null>(null);

    React.useEffect(() => {
        lootboxTypeClient.getAll()
            .then(loaded => setTypes([...loaded].sort((a, b) => a.name.localeCompare(b.name))))
            .catch(err => console.error('Failed to load lootbox types for the token rules:', err));
    }, []);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await lootboxTokenClient.search({
                pageNumber: page,
                pageSize: TOKENS_PAGE_SIZE,
                searchTerm: searchTerm.trim() || undefined,
                filters: toTokenSearchFilters(status, reason),
            });
            setRows(result?.items ?? []);
            setTotalCount(result?.totalCount ?? 0);
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not load the token items.'));
        } finally {
            setLoading(false);
        }
    }, [page, reason, searchTerm, status]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const revoke = async (row: LootboxTokenDto) => {
        setError(null);
        setNotice(null);
        try {
            const updated = await lootboxTokenClient.revoke(row.token);
            setRows(prev => prev.map(r => (r.id === row.id ? updated : r)));
            setNotice(`Token #${row.id} revoked - removed from online players within seconds, and from anyone offline when they next join.`);
        } catch (err) {
            setError(apiErrorMessage(err, `Could not revoke token #${row.id}.`));
        } finally {
            setConfirmToken(null);
        }
    };

    const totalPages = Math.max(1, Math.ceil(totalCount / TOKENS_PAGE_SIZE));

    return (
        <div className="space-y-4">
            <GrantRules types={types} />

            <section className="space-y-3" aria-label="Issued token items">
                <div className="bg-white rounded-lg shadow p-4">
                    <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={e => {
                            e.preventDefault();
                            setSearchTerm(searchDraft);
                            setPage(1);
                        }}
                    >
                        <label className="block">
                            <span className="block text-xs font-medium text-gray-600 mb-1">Player or token id</span>
                            <input type="search" aria-label="Player or token id" value={searchDraft} onChange={e => setSearchDraft(e.target.value)} className={selectClass} />
                        </label>
                        <button type="submit" className="btn-secondary inline-flex items-center gap-1"><Search className="h-4 w-4" /> Search</button>
                        <label className="block">
                            <span className="block text-xs font-medium text-gray-600 mb-1">Status</span>
                            <select aria-label="Token status filter" value={status} onChange={e => { setStatus(e.target.value as '' | LootboxTokenStatus); setPage(1); }} className={selectClass}>
                                <option value="">Any</option>
                                {STATUSES.map(s => <option key={s} value={s}>{s === 'Redeemed' ? 'Opened' : s}</option>)}
                            </select>
                        </label>
                        <label className="block">
                            <span className="block text-xs font-medium text-gray-600 mb-1">Issued by</span>
                            <select aria-label="Token reason filter" value={reason} onChange={e => { setReason(e.target.value as '' | LootboxTokenReason); setPage(1); }} className={selectClass}>
                                <option value="">Any</option>
                                {REASONS.map(r => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}
                            </select>
                        </label>
                    </form>
                </div>

                {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                {notice && <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

                <div className="bg-white rounded-lg shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="px-3 py-2">Issued</th>
                                <th className="px-3 py-2">Player</th>
                                <th className="px-3 py-2">Box</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map(row => (
                                <tr key={row.id} data-testid="token-row">
                                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                                        {formatDateTime(row.issuedAt)}
                                        <span className="block text-xs text-gray-400">
                                            #{row.id} · {REASON_LABELS[row.reason] ?? row.reason}{row.sourceSpawnId != null ? ` (box #${row.sourceSpawnId})` : ''}{row.deliveredAt ? '' : ' · not handed over yet'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        {row.issuedToUserId != null ? (
                                            <Link to={`/admin/users/${row.issuedToUserId}`} className="text-primary hover:underline">
                                                {row.issuedToUsername ?? `User #${row.issuedToUserId}`}
                                            </Link>
                                        ) : '-'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        {row.lootboxTypeName} <span className="text-amber-600">{starLabel(row.boxStars)}</span>
                                        <span className="block font-mono text-xs text-gray-400" title="The id in the item's knk_lootbox_token tag">{row.token}</span>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        {row.status === 'Redeemed' && (
                                            <span className="text-gray-700">
                                                Opened by {row.redeemedByUsername ?? `user #${row.redeemedByUserId}`}
                                                <span className="block text-xs text-gray-400">{formatDateTime(row.redeemedAt)}{row.claimId != null ? ` · claim #${row.claimId}` : ''}</span>
                                            </span>
                                        )}
                                        {row.status === 'Revoked' && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">Revoked</span>}
                                        {row.status === 'Issued' && <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">Unopened</span>}
                                    </td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                        {row.status === 'Issued' && (confirmToken === row.token ? (
                                            <span className="inline-flex gap-2">
                                                <button type="button" onClick={() => void revoke(row)} className="text-red-700 font-medium hover:underline">Revoke</button>
                                                <button type="button" onClick={() => setConfirmToken(null)} className="text-gray-500 hover:underline">Cancel</button>
                                            </span>
                                        ) : (
                                            <button type="button" onClick={() => setConfirmToken(row.token)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-800" aria-label={`Revoke token ${row.id}`}>
                                                <Ban className="h-4 w-4" /> Revoke
                                            </button>
                                        ))}
                                    </td>
                                </tr>
                            ))}
                            {!loading && rows.length === 0 && (
                                <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500">No token items match.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                        {loading ? <Loader2 className="inline h-4 w-4 animate-spin" /> : `${totalCount.toLocaleString('en-US')} token${totalCount === 1 ? '' : 's'}`}
                        {' '}· page {page} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-50" aria-label="Reload tokens">
                            <RefreshCcw className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={loading || page <= 1} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-50">
                            <ChevronLeft className="h-4 w-4" /> Previous
                        </button>
                        <button type="button" onClick={() => setPage(p => p + 1)} disabled={loading || page >= totalPages} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-50">
                            Next <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default LootboxTokensTab;
