import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, SlidersHorizontal } from 'lucide-react';
import { duelMatchClient } from '../../../apiClients/duelMatchClient';
import { DuelPolicyDto } from '../../../types/dtos/duels/DuelDtos';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { apiRefusalReason } from '../../../utils/apiRefusalReason';
import { formatWhen } from './duelFormat';

type NumberField = keyof Pick<DuelPolicyDto,
    's1LoserDamagePercent' | 's2ShortFightSeconds' | 's4MaxLoserAttackAttempts' | 's5PairDuels'
    | 's6MinYoungOpponents' | 's6YoungAccountDays' | 's6WindowDays' | 'escalationFlagCount' | 'escalationWindowDays'>;
type SwitchField = keyof Pick<DuelPolicyDto, 's1Enabled' | 's2Enabled' | 's3Enabled' | 's4Enabled' | 's5Enabled' | 's6Enabled'>;

/** The signals (DESIGN §10.3), each with its switch and thresholds. */
const SIGNALS: { key: string; on: SwitchField; title: string; fields: { key: NumberField; label: string; help: string }[] }[] = [
    { key: 'S1', on: 's1Enabled', title: 'One-sided damage', fields: [
        { key: 's1LoserDamagePercent', label: 'Loser dealt less than (% of the winner\'s damage)', help: 'Default 10.' }] },
    { key: 'S2', on: 's2Enabled', title: 'Short fight', fields: [
        { key: 's2ShortFightSeconds', label: 'Fight shorter than (seconds)', help: 'Default 10.' }] },
    { key: 'S3', on: 's3Enabled', title: 'Unarmed loser (own-gear modes: no weapon and no armour)', fields: [] },
    { key: 'S4', on: 's4Enabled', title: 'Passive loser', fields: [
        { key: 's4MaxLoserAttackAttempts', label: 'Loser made at most (attack attempts)', help: 'Default 0: no swing at all.' }] },
    { key: 'S5', on: 's5Enabled', title: 'One-way pair', fields: [
        { key: 's5PairDuels', label: 'Same winner in the pair\'s last (value-moving duels)', help: 'Default 3.' }] },
    { key: 'S6', on: 's6Enabled', title: 'Funnel from young accounts', fields: [
        { key: 's6MinYoungOpponents', label: 'Winner took value from at least (young opponents)', help: 'Default 3.' },
        { key: 's6YoungAccountDays', label: 'Young = account younger than (days)', help: 'Default 7.' },
        { key: 's6WindowDays', label: 'Within (days)', help: 'Default 7.' }] },
];

const ESCALATION: { key: NumberField; label: string; help: string }[] = [
    { key: 'escalationFlagCount', label: 'Hold from flag number', help: '2–20; default 2. A first flag never holds.' },
    { key: 'escalationWindowDays', label: 'Counting flags of the last (days)', help: 'Default 7.' },
];

const ALL_NUMBERS: NumberField[] = [...SIGNALS.flatMap(s => s.fields.map(f => f.key)), ...ESCALATION.map(f => f.key)];

type Draft = Record<NumberField, string> & Record<SwitchField, boolean>;

const toDraft = (p: DuelPolicyDto): Draft => ({
    ...(Object.fromEntries(ALL_NUMBERS.map(k => [k, String(p[k])])) as Record<NumberField, string>),
    ...(Object.fromEntries(SIGNALS.map(s => [s.on, p[s.on]])) as Record<SwitchField, boolean>),
});

const isWhole = (value: string): boolean => /^\d+$/.test(value.trim());

/** What staff see when the API refuses a save because the policy changed since the form loaded (409 PolicyChanged). */
export const DUEL_POLICY_CHANGED_MESSAGE =
    'The review policy was changed since you loaded it. Reload it and review the current values before saving again.';

/**
 * Staff → Duels → Review policy (arena duels P7, KNG-221, DESIGN §10.3): the cross-arena DuelPolicy — which
 * signals flag a value-moving result and their thresholds, and when repeated flags of the same players
 * hold the next result. The per-arena limits (stake caps, fee, pair limits) are in the arena's own form.
 * Needs knk.admin.duel.review; every save is audited by the API.
 */
export const DuelPolicyPage: React.FC = () => {
    usePageTitle('Duel review policy');
    const [policy, setPolicy] = React.useState<DuelPolicyDto | null>(null);
    const [draft, setDraft] = React.useState<Draft | null>(null);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [stale, setStale] = React.useState(false);
    const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

    const load = React.useCallback(async () => {
        setLoadError(null);
        try {
            const loaded = await duelMatchClient.getPolicy();
            setPolicy(loaded);
            setDraft(toDraft(loaded));
            setStale(false);
            setMessage(null);
        } catch (err) {
            setLoadError(apiRefusalReason(err) ?? 'Could not load the duel review policy.');
        }
    }, []);

    React.useEffect(() => {
        void load();
    }, [load]);

    const invalid = draft ? ALL_NUMBERS.filter(k => !isWhole(draft[k])) : [];
    const dirty = !!policy && !!draft && JSON.stringify(toDraft(policy)) !== JSON.stringify(draft);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!policy || !draft || invalid.length > 0) return;
        setSaving(true);
        setMessage(null);
        try {
            // updatedAt goes back exactly as loaded: the API refuses (409) an edit of an older version.
            const body: DuelPolicyDto = {
                ...policy,
                ...(Object.fromEntries(ALL_NUMBERS.map(k => [k, Number(draft[k])])) as Record<NumberField, number>),
                ...(Object.fromEntries(SIGNALS.map(s => [s.on, draft[s.on]])) as Record<SwitchField, boolean>),
            };
            const saved = await duelMatchClient.updatePolicy(body);
            setPolicy(saved);
            setDraft(toDraft(saved));
            setMessage({ ok: true, text: 'Saved.' });
        } catch (err) {
            if ((err as { status?: number })?.status === 409) {
                setStale(true);
                setMessage({ ok: false, text: DUEL_POLICY_CHANGED_MESSAGE });
            } else {
                setMessage({ ok: false, text: apiRefusalReason(err) ?? 'Could not save the review policy.' });
            }
        } finally {
            setSaving(false);
        }
    };

    const numberInput = (f: { key: NumberField; label: string; help: string }) => draft && (
        <div key={f.key}>
            <label htmlFor={`duel-policy-${f.key}`} className="block text-xs text-gray-500 mb-1">{f.label}</label>
            <input id={`duel-policy-${f.key}`} inputMode="numeric"
                className={`border rounded-md px-2 py-1.5 text-sm w-full ${invalid.includes(f.key) ? 'border-red-400' : 'border-gray-300'}`}
                value={draft[f.key]} onChange={e => setDraft({ ...draft, [f.key]: e.target.value })} />
            <p className="text-xs text-gray-400 mt-0.5">{invalid.includes(f.key) ? 'Whole number required.' : f.help}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div>
                    <Link to="/admin/duels" className="text-sm text-gray-500 hover:underline inline-flex items-center">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Duels
                    </Link>
                    <h1 className="mt-2 text-2xl font-bold text-gray-900 flex items-center">
                        <SlidersHorizontal className="h-6 w-6 mr-2" />
                        Duel review policy
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Only decisive duels with coin or item stakes, or drop-mode spoils, are reviewed. Any signal flags the
                        result (paid, with a currency alert); when the same players collect enough flags within the window,
                        the next flagged result is held until staff release or void it. Stake caps, the fee and the pair
                        limits are set per arena.
                    </p>
                </div>
                {loadError && <p className="text-sm text-red-600">{loadError}</p>}
                {!draft && !loadError && (
                    <div className="flex items-center text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading…
                    </div>
                )}
                {policy && draft && (
                    <form className="space-y-6" onSubmit={e => void save(e)} aria-label="Duel review policy">
                        <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-4">
                            <h2 className="text-lg font-semibold text-gray-900">Signals</h2>
                            {SIGNALS.map(s => (
                                <div key={s.key} className="border-t border-gray-100 pt-3 first:border-0 first:pt-0 space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                                        <input type="checkbox" checked={draft[s.on]} onChange={e => setDraft({ ...draft, [s.on]: e.target.checked })} />
                                        {s.key} {s.title}
                                    </label>
                                    {s.fields.length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-6">{s.fields.map(numberInput)}</div>
                                    )}
                                </div>
                            ))}
                        </section>
                        <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-4">
                            <h2 className="text-lg font-semibold text-gray-900">Escalation to a hold</h2>
                            <p className="text-sm text-gray-500">
                                Flags count per pair (either direction) and per winner across opponents. Acknowledged alerts don&apos;t
                                count; voided and reverted results do.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{ESCALATION.map(numberInput)}</div>
                        </section>
                        <div className="flex items-center gap-3 flex-wrap">
                            <button type="submit" className="btn-primary text-sm" disabled={!dirty || saving || stale || invalid.length > 0}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save policy'}
                            </button>
                            {stale && (
                                <button type="button" className="btn-secondary text-sm" onClick={() => void load()}>
                                    Reload current policy
                                </button>
                            )}
                            <span className="text-xs text-gray-500">Last changed {formatWhen(policy.updatedAt)}</span>
                            {message && <span role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.text}</span>}
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default DuelPolicyPage;
