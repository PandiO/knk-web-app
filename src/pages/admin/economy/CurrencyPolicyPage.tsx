import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, SlidersHorizontal } from 'lucide-react';
import { currencyClient } from '../../../apiClients/currencyClient';
import { CurrencyPolicyDto } from '../../../types/dtos/currency/CurrencyDtos';

type NumberField = keyof Pick<CurrencyPolicyDto,
    'minTransfer' | 'maxTransfer' | 'dailySendCap' | 'dailyReceiveCap' | 'confirmThreshold' | 'confirmTtlSeconds'
    | 'cooldownSeconds' | 'maxTransfersPerHour' | 'minSenderAccountAgeHours' | 'transferFeeBasisPoints' | 'maxBalance'
    | 'adminDailyGrantCapPerActor' | 'signupGrant'>;

const NUMBER_FIELDS: { key: NumberField; label: string; help: string }[] = [
    { key: 'minTransfer', label: 'Minimum payment', help: 'Smallest /pay amount.' },
    { key: 'maxTransfer', label: 'Maximum payment', help: 'Largest single /pay amount.' },
    { key: 'dailySendCap', label: 'Daily send cap', help: 'Rolling 24 h per sender; 0 = no cap.' },
    { key: 'dailyReceiveCap', label: 'Daily receive cap', help: 'Rolling 24 h per recipient; 0 = no cap.' },
    { key: 'confirmThreshold', label: 'Confirm from', help: 'Payments of at least this ask the sender to confirm.' },
    { key: 'confirmTtlSeconds', label: 'Confirm window (s)', help: '10–600 seconds.' },
    { key: 'cooldownSeconds', label: 'Cooldown (s)', help: 'Between two payments of one sender; 0 = none.' },
    { key: 'maxTransfersPerHour', label: 'Payments per hour', help: 'Per sender; 0 = no limit.' },
    { key: 'minSenderAccountAgeHours', label: 'Sender account age (h)', help: 'Receiving is never restricted.' },
    { key: 'transferFeeBasisPoints', label: 'Transfer fee (basis points)', help: '100 = 1 %; 0 = no fee.' },
    { key: 'maxBalance', label: 'Maximum balance', help: 'May only be lower than the database cap.' },
    { key: 'adminDailyGrantCapPerActor', label: 'Staff daily grant cap', help: 'Per staff member, rolling 24 h; knk.admin.currency.unlimited bypasses it; 0 = no cap.' },
    { key: 'signupGrant', label: 'Signup grant', help: 'Starting balance of a new account.' },
];

const numberFormat = new Intl.NumberFormat('en-US');

type Draft = Record<NumberField, string> & {
    transfersEnabled: boolean;
    transferable: boolean;
    minSenderTitleBracketId: string;
};

const toDraft = (p: CurrencyPolicyDto): Draft => ({
    ...(Object.fromEntries(NUMBER_FIELDS.map(f => [f.key, String(p[f.key])])) as Record<NumberField, string>),
    transfersEnabled: p.transfersEnabled,
    transferable: p.transferable,
    minSenderTitleBracketId: p.minSenderTitleBracketId != null ? String(p.minSenderTitleBracketId) : '',
});

const isWhole = (value: string): boolean => /^\d+$/.test(value.trim());

/**
 * Staff → Currency policy (currency-payments Phase 4, DESIGN.md §3.5/§3.7): the coin and gem
 * rules the API enforces - transfer limits, the gem transfer switch, the fee, the staff grant cap
 * and the signup grant. Every saved change is audit-logged (CurrencyPolicyChanged). Needs
 * knk.admin.currency.policy (StaffRoute node); the API checks it too.
 */
export const CurrencyPolicyPage: React.FC = () => {
    const [policies, setPolicies] = React.useState<CurrencyPolicyDto[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        currencyClient.getPolicies()
            .then(setPolicies)
            .catch((err: unknown) => setError(err instanceof Error && err.message ? err.message : 'Could not load the currency policy.'))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div>
                    <Link to="/admin/users/balance-log" className="text-sm text-gray-500 hover:underline inline-flex items-center">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Balance event log
                    </Link>
                    <h1 className="mt-2 text-2xl font-bold text-gray-900 flex items-center">
                        <SlidersHorizontal className="h-6 w-6 mr-2" />
                        Currency policy
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        The rules the server applies to payments and staff grants. Changes apply at once and are recorded in
                        the audit log.
                    </p>
                </div>
                {loading && (
                    <div className="flex items-center text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading…
                    </div>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
                {policies.map(policy => (
                    <PolicyForm key={policy.currency} policy={policy}
                        onSaved={saved => setPolicies(ps => ps.map(p => (p.currency === saved.currency ? saved : p)))} />
                ))}
            </div>
        </div>
    );
};

const PolicyForm: React.FC<{ policy: CurrencyPolicyDto; onSaved: (policy: CurrencyPolicyDto) => void }> = ({ policy, onSaved }) => {
    const [draft, setDraft] = React.useState<Draft>(() => toDraft(policy));
    const [saving, setSaving] = React.useState(false);
    const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

    React.useEffect(() => setDraft(toDraft(policy)), [policy]);

    const invalid = NUMBER_FIELDS.filter(f => !isWhole(draft[f.key])).map(f => f.key);
    const titleInvalid = draft.minSenderTitleBracketId.trim() !== '' && !isWhole(draft.minSenderTitleBracketId);
    const original = toDraft(policy);
    const dirty = JSON.stringify(original) !== JSON.stringify(draft);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (invalid.length > 0 || titleInvalid) return;
        setSaving(true);
        setMessage(null);
        try {
            const body: CurrencyPolicyDto = {
                ...policy,
                ...(Object.fromEntries(NUMBER_FIELDS.map(f => [f.key, Number(draft[f.key])])) as Record<NumberField, number>),
                transfersEnabled: draft.transfersEnabled,
                transferable: draft.transferable,
                minSenderTitleBracketId: draft.minSenderTitleBracketId.trim() === '' ? null : Number(draft.minSenderTitleBracketId),
            };
            const saved = await currencyClient.updatePolicy(policy.currency === 'Gems' ? 'gems' : 'coins', body);
            onSaved(saved);
            setMessage({ ok: true, text: 'Saved.' });
        } catch (err) {
            setMessage({ ok: false, text: err instanceof Error && err.message ? err.message : 'Could not save the policy.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <form className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-4" onSubmit={(e) => void handleSave(e)}
            aria-label={`${policy.currency} policy`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{policy.currency}</h2>
                <span className="text-xs text-gray-500">
                    Database cap {numberFormat.format(policy.hardMaxBalance)} · last changed {new Date(policy.updatedAt).toLocaleString()}
                </span>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={draft.transfersEnabled}
                        onChange={e => setDraft({ ...draft, transfersEnabled: e.target.checked })} />
                    Payments switched on (kill switch)
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={draft.transferable}
                        onChange={e => setDraft({ ...draft, transferable: e.target.checked })} />
                    Players may send {policy.currency.toLowerCase()}
                </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {NUMBER_FIELDS.map(f => (
                    <div key={f.key}>
                        <label htmlFor={`${policy.currency}-${f.key}`} className="block text-xs text-gray-500 mb-1">{f.label}</label>
                        <input id={`${policy.currency}-${f.key}`} inputMode="numeric"
                            className={`border rounded-md px-2 py-1.5 text-sm w-full ${invalid.includes(f.key) ? 'border-red-400' : 'border-gray-300'}`}
                            value={draft[f.key]} onChange={e => setDraft({ ...draft, [f.key]: e.target.value })} />
                        <p className="text-xs text-gray-400 mt-0.5">{invalid.includes(f.key) ? 'Whole number required.' : f.help}</p>
                    </div>
                ))}
                <div>
                    <label htmlFor={`${policy.currency}-title`} className="block text-xs text-gray-500 mb-1">Sender title bracket id</label>
                    <input id={`${policy.currency}-title`} inputMode="numeric"
                        className={`border rounded-md px-2 py-1.5 text-sm w-full ${titleInvalid ? 'border-red-400' : 'border-gray-300'}`}
                        value={draft.minSenderTitleBracketId} onChange={e => setDraft({ ...draft, minSenderTitleBracketId: e.target.value })} />
                    <p className="text-xs text-gray-400 mt-0.5">Lowest title a sender must hold; empty = none.</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button type="submit" className="btn-primary text-sm" disabled={!dirty || saving || invalid.length > 0 || titleInvalid}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Save ${policy.currency.toLowerCase()}`}
                </button>
                {message && <span className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.text}</span>}
            </div>
        </form>
    );
};

export default CurrencyPolicyPage;
