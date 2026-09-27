import React from 'react';
import { Coins, Loader2 } from 'lucide-react';
import { currencyClient } from '../../apiClients/currencyClient';
import { usePermission } from '../../hooks/useStaffAccess';
import {
    ADJUSTMENT_CATEGORIES,
    AdjustmentCategory,
    BALANCE_NODES,
    LedgerCurrency,
    MIN_STAFF_NOTE_LENGTH,
} from '../../types/dtos/currency/CurrencyDtos';
import { BalanceAdjustmentResultDto, BalanceMode } from '../../types/dtos/userManagement/UserProfileSummaryDtos';

type BalanceProperty = 'coins' | 'gems' | 'experiencePoints';

const PROPERTIES: { value: BalanceProperty; label: string; noun: string }[] = [
    { value: 'coins', label: 'Coins', noun: 'coins' },
    { value: 'gems', label: 'Gems', noun: 'gems' },
    { value: 'experiencePoints', label: 'XP', noun: 'XP' },
];

// The API's own explanation for a refused request (400/403/409/422), e.g. "Requires the
// knk.admin.user.coins permission." or a BalanceCapExceeded / AdminDailyCapExceeded message.
const clientErrorMessage = (err: unknown): string | null => {
    const status = (err as { status?: number } | null)?.status;
    const message = err instanceof Error ? err.message : null;
    return status !== undefined && status >= 400 && status < 500 && message ? message : null;
};

export interface AdjustBalanceCardProps {
    userId: number;
    /** The balances shown on the page; a Set sends the changed one as expectedCurrent. */
    balances: { coins: number; gems: number; experiencePoints: number };
    /** Called when a submission starts (e.g. to clear an earlier title-change notice). */
    onStart?: () => void;
    /** Called after the server applied the change. */
    onAdjusted: (result: BalanceAdjustmentResultDto) => void | Promise<void>;
    /** Shown at the bottom of the card, e.g. the title change the last adjustment caused. */
    children?: React.ReactNode;
}

/**
 * "Adjust balance" on the player profile (developer request 2026-09-25; currency Phase 4; made
 * its own titled card after the KNG-21 smoke test, where it wasn't found as an untitled row under
 * Account). POST api/currency/admin/adjustments: Add/Remove/Set of coins, gems or XP with a reason
 * category and a note of at least 10 characters, applied by the server through the currency
 * ledger. Shown to holders of knk.admin.user.coins, .gems or .xp, offering the balances they may
 * change; the API enforces the nodes (an XP increase needs all three) and the staff grant cap.
 */
export const AdjustBalanceCard: React.FC<AdjustBalanceCardProps> = ({ userId, balances, onStart, onAdjusted, children }) => {
    const coins = usePermission(BALANCE_NODES.coins);
    const gems = usePermission(BALANCE_NODES.gems);
    const xp = usePermission(BALANCE_NODES.xp);
    const held: Record<BalanceProperty, boolean> = { coins: coins.allowed, gems: gems.allowed, experiencePoints: xp.allowed };
    const available = PROPERTIES.filter(p => held[p.value]);

    const [property, setProperty] = React.useState<BalanceProperty>('coins');
    const [action, setAction] = React.useState<'set' | 'add' | 'remove'>('add');
    const [amount, setAmount] = React.useState('');
    const [category, setCategory] = React.useState<AdjustmentCategory | ''>('');
    const [note, setNote] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // One Idempotency-Key per submission (currency ledger, KNG-21 Phase 2): kept when the request
    // fails, so resubmitting the same values can't apply them twice if the first actually landed;
    // dropped on success and whenever the form changes.
    const keyRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        keyRef.current = null;
    }, [property, action, amount, category, note, userId]);

    // Start on a balance the staff member may change once their permissions are known.
    const firstAvailable = available[0]?.value;
    React.useEffect(() => {
        if (firstAvailable && !held[property]) {
            setProperty(firstAvailable);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firstAvailable]);

    if (available.length === 0) {
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const value = Number(amount);
        if (!amount.trim() || Number.isNaN(value) || value < 0) return;
        if (!category || note.trim().length < MIN_STAFF_NOTE_LENGTH) {
            setError(`Pick a category and say why in at least ${MIN_STAFF_NOTE_LENGTH} characters.`);
            return;
        }
        setSubmitting(true);
        setError(null);
        onStart?.();
        try {
            // The server applies the mode itself (a Set lands on exactly this value); no delta is
            // computed here. expectedCurrent makes it refuse a Set if the balance changed since
            // this page loaded, instead of overwriting that change.
            const currency: LedgerCurrency = property === 'coins' ? 'Coins' : property === 'gems' ? 'Gems' : 'Experience';
            const mode: BalanceMode = action === 'set' ? 'Set' : action === 'remove' ? 'Remove' : 'Add';
            if (!keyRef.current) {
                keyRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID?.())
                    || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            }
            const result = await currencyClient.adjust({
                targetUserId: userId,
                currency,
                mode,
                amount: value,
                ...(mode === 'Set' ? { expectedCurrent: balances[property] } : {}),
                category,
                note: note.trim(),
            }, keyRef.current);
            setAmount('');
            setNote('');
            keyRef.current = null;
            await onAdjusted(result);
        } catch (err) {
            console.error('Failed to adjust balance:', err);
            setError((err as { status?: number })?.status === 409
                ? 'This balance changed since the page loaded — refresh and try again.'
                : clientErrorMessage(err) ?? 'Could not adjust this balance — check the amount doesn\'t go below zero.');
        } finally {
            setSubmitting(false);
        }
    };

    const raisesXp = property === 'experiencePoints' && action !== 'remove';

    return (
        <section aria-labelledby="adjust-balance-heading" className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
            <h2 id="adjust-balance-heading" className="text-lg font-semibold text-gray-900 flex items-center">
                <Coins className="h-5 w-5 mr-2" />
                Adjust balance
            </h2>
            <p className="mt-1 text-sm text-gray-500">
                Add, remove or set this player's {available.map(p => p.noun).join(', ')}.
                Every change is recorded in the balance history with its category and reason
                (at least {MIN_STAFF_NOTE_LENGTH} characters).
            </p>
            <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => void handleSubmit(e)}>
                <div>
                    <label htmlFor="balance-property" className="block text-xs text-gray-500 mb-1">Balance</label>
                    <select
                        id="balance-property"
                        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                        value={property}
                        onChange={(e) => setProperty(e.target.value as BalanceProperty)}
                    >
                        {available.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="balance-action" className="block text-xs text-gray-500 mb-1">Action</label>
                    <select
                        id="balance-action"
                        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                        value={action}
                        onChange={(e) => setAction(e.target.value as typeof action)}
                    >
                        <option value="add">Add</option>
                        <option value="remove">Remove</option>
                        <option value="set">Set to</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="balance-amount" className="block text-xs text-gray-500 mb-1">Amount</label>
                    <input
                        id="balance-amount"
                        type="number"
                        min={0}
                        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-28"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                    />
                </div>
                <div>
                    <label htmlFor="balance-category" className="block text-xs text-gray-500 mb-1">Category</label>
                    <select
                        id="balance-category"
                        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                        value={category}
                        onChange={(e) => setCategory(e.target.value as AdjustmentCategory | '')}
                    >
                        <option value="">Choose…</option>
                        {ADJUSTMENT_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 min-w-[160px]">
                    <label htmlFor="balance-note" className="block text-xs text-gray-500 mb-1">Reason</label>
                    <input
                        id="balance-note"
                        type="text"
                        maxLength={450}
                        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={`Required, at least ${MIN_STAFF_NOTE_LENGTH} characters`}
                    />
                </div>
                <button type="submit" className="btn-primary text-sm"
                    disabled={!amount.trim() || !category || note.trim().length < MIN_STAFF_NOTE_LENGTH || submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply adjustment'}
                </button>
                {raisesXp && (
                    <span className="text-xs text-gray-500 w-full">
                        Raising XP can promote the player and pay title bonuses in coins and gems, so it also needs the
                        coins and gems permissions, and those bonuses count toward your daily staff grant limit.
                    </span>
                )}
                {error && <span className="text-xs text-red-600 w-full">{error}</span>}
            </form>
            {children}
        </section>
    );
};

export default AdjustBalanceCard;
