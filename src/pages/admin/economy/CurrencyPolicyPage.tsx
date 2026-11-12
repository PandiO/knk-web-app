import React from 'react';
import { Link } from 'react-router-dom';
import { currencyClient } from '../../../apiClients/currencyClient';
import { titleBracketClient } from '../../../apiClients/titleBracketClient';
import { CurrencyPolicyDto } from '../../../types/dtos/currency/CurrencyDtos';
import { TitleBracketDto } from '../../../types/dtos/title/TitleBracketDto';
import { apiRefusalReason } from '../../../utils/apiRefusalReason';
import { formatDateTime, numberFormat } from '../../../utils/format';
import { SettingsPage, SettingsSection } from '../../../components/SettingsPage';
import { Field } from '../../../components/Field';
import type { ConfirmOptions } from '../../../hooks/useConfirm';
import { UNIT, describeBasisPoints, describeHours, describeSeconds, joinHint } from '../../../utils/settingsUnits';

type Currency = CurrencyPolicyDto['currency'];

type NumberField = keyof Pick<CurrencyPolicyDto,
    'minTransfer' | 'maxTransfer' | 'dailySendCap' | 'dailyReceiveCap' | 'confirmThreshold' | 'confirmTtlSeconds'
    | 'cooldownSeconds' | 'maxTransfersPerHour' | 'minSenderAccountAgeHours' | 'transferFeeBasisPoints' | 'maxBalance'
    | 'adminDailyGrantCapPerActor' | 'signupGrant'>;

/** `amount`: the unit is the currency itself (coins/gems). */
type UnitKind = 'amount' | 'seconds' | 'hours' | 'basisPoints' | 'perHour';

interface NumberSpec {
    key: NumberField;
    label: string;
    help: string;
    unit: UnitKind;
}

/** The fields in groups, each with its unit and one line of help (#26 SET-5). */
const GROUPS: { title: string; fields: NumberSpec[] }[] = [
    {
        title: 'Payments',
        fields: [
            { key: 'minTransfer', label: 'Minimum payment', help: 'Smallest /pay amount.', unit: 'amount' },
            { key: 'maxTransfer', label: 'Maximum payment', help: 'Largest single /pay amount.', unit: 'amount' },
            { key: 'confirmThreshold', label: 'Confirm from', help: 'Payments of at least this ask the sender to confirm.', unit: 'amount' },
            { key: 'confirmTtlSeconds', label: 'Confirm window', help: 'How long the sender has to confirm; 10–600.', unit: 'seconds' },
            { key: 'transferFeeBasisPoints', label: 'Transfer fee', help: '100 bp = 1% of the payment; 0 = no fee.', unit: 'basisPoints' },
        ],
    },
    {
        title: 'Limits per player',
        fields: [
            { key: 'dailySendCap', label: 'Daily send cap', help: 'Per sender, rolling 24 h; 0 = no cap.', unit: 'amount' },
            { key: 'dailyReceiveCap', label: 'Daily receive cap', help: 'Per recipient, rolling 24 h; 0 = no cap.', unit: 'amount' },
            { key: 'cooldownSeconds', label: 'Cooldown', help: 'Between two payments of one sender; 0 = none.', unit: 'seconds' },
            { key: 'maxTransfersPerHour', label: 'Payments per hour', help: 'Per sender; 0 = no limit.', unit: 'perHour' },
            { key: 'minSenderAccountAgeHours', label: 'Sender account age', help: 'How old an account must be to send; receiving is never restricted.', unit: 'hours' },
        ],
    },
    {
        title: 'Balances and grants',
        fields: [
            { key: 'maxBalance', label: 'Maximum balance', help: 'May only be lower than the database cap.', unit: 'amount' },
            { key: 'adminDailyGrantCapPerActor', label: 'Staff daily grant cap', help: 'Per staff member, rolling 24 h; knk.admin.currency.unlimited bypasses it; 0 = no cap.', unit: 'amount' },
            { key: 'signupGrant', label: 'Signup grant', help: 'Starting balance of a new account.', unit: 'amount' },
        ],
    },
];

const NUMBER_FIELDS: NumberSpec[] = GROUPS.flatMap(g => g.fields);

type Draft = Record<NumberField, string> & {
    transfersEnabled: boolean;
    transferable: boolean;
    minSenderTitleBracketId: string;
};
type DraftKey = keyof Draft;

const toDraft = (p: CurrencyPolicyDto): Draft => ({
    ...(Object.fromEntries(NUMBER_FIELDS.map(f => [f.key, String(p[f.key])])) as Record<NumberField, string>),
    transfersEnabled: p.transfersEnabled,
    transferable: p.transferable,
    minSenderTitleBracketId: p.minSenderTitleBracketId != null ? String(p.minSenderTitleBracketId) : '',
});

const isWhole = (value: string): boolean => /^\d+$/.test(value.trim());

const changedKeysOf = (saved: Draft, draft: Draft): DraftKey[] =>
    (Object.keys(draft) as DraftKey[]).filter(k => draft[k] !== saved[k]);

const unitLabel = (unit: UnitKind, currency: Currency): string => {
    switch (unit) {
        case 'amount': return currency === 'Gems' ? UNIT.gems : UNIT.coins;
        case 'seconds': return UNIT.seconds;
        case 'hours': return UNIT.hours;
        case 'basisPoints': return UNIT.basisPoints;
        case 'perHour': return 'per h';
    }
};

const describeValue = (unit: UnitKind, value: string): string | null => {
    switch (unit) {
        case 'seconds': return describeSeconds(value);
        case 'hours': return describeHours(value);
        case 'basisPoints': return describeBasisPoints(value, 'no fee');
        default: return null;
    }
};

/** What staff see when the API refuses a save because the policy changed since the form loaded (409 PolicyChanged). */
export const POLICY_CHANGED_MESSAGE =
    'This policy was changed since you loaded it (possibly by an automatic safety shut-off). Reload it and review the current values before saving again.';

/**
 * #26 (SET-6): the question before a save that flips a payments kill switch, stating the effect; null when no
 * switch changes.
 */
export function killSwitchQuestion(changes: { currency: Currency; on: boolean }[]): ConfirmOptions | null {
    if (changes.length === 0) return null;
    const sentence = ({ currency, on }: { currency: Currency; on: boolean }) => {
        const name = currency.toLowerCase();
        return on
            ? `${currency} payments switch on: players can send ${name} with /pay again, within the limits on this page.`
            : `${currency} payments switch off: no player can send ${name} with /pay until they are switched on again. Staff grants still work.`;
    };
    const title = changes.length === 1
        ? `Switch ${changes[0].currency.toLowerCase()} payments ${changes[0].on ? 'on' : 'off'}?`
        : 'Change both payment switches?';
    return {
        title,
        message: `${changes.map(sentence).join(' ')} It applies at once and is recorded in the audit log.`,
        confirmLabel: changes.length === 1 ? `Switch ${changes[0].on ? 'on' : 'off'} and save` : 'Save',
        // Switching on alone is the safe direction; anything that switches payments off is red.
        danger: changes.some(c => !c.on),
    };
}

/** The title choice's text: "Squire (from 1,000 XP)". */
const bracketLabel = (b: TitleBracketDto) => `${b.name} (from ${numberFormat.format(b.minExperience)} XP)`;

/**
 * Staff → Currency policy (currency-payments Phase 4, DESIGN.md §3.5/§3.7): the coin and gem rules the API
 * enforces - transfer limits, the gem transfer switch, the fee, the staff grant cap and the signup grant. Every
 * saved change is audit-logged (CurrencyPolicyChanged). Needs knk.admin.currency.policy (StaffRoute node); the
 * API checks it too.
 *
 * PandiO/knk-workspace#26: on the SettingsPage shell - one Save (n) for both currencies (each changed policy is
 * sent with the version it loaded; a 409 keeps the edits, says why in the header and holds Save until Reload),
 * "Leave without saving?", a toast; units and one line of help per field; the sender title as a choice of the
 * title brackets; switching payments off or on asks first.
 */
export const CurrencyPolicyPage: React.FC = () => {
    const [policies, setPolicies] = React.useState<CurrencyPolicyDto[]>([]);
    const [drafts, setDrafts] = React.useState<Partial<Record<Currency, Draft>>>({});
    const [stale, setStale] = React.useState<Currency[]>([]);
    const [brackets, setBrackets] = React.useState<TitleBracketDto[] | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);

    const applyLoaded = React.useCallback((loaded: CurrencyPolicyDto[]) => {
        setPolicies(loaded);
        setDrafts(Object.fromEntries(loaded.map(p => [p.currency, toDraft(p)])));
        setStale([]);
    }, []);

    const load = React.useCallback(async (): Promise<void> => {
        setLoading(true);
        setLoadError(null);
        try {
            applyLoaded(await currencyClient.getPolicies());
        } catch (err) {
            setLoadError(apiRefusalReason(err) ?? 'Could not load the currency policy.');
        } finally {
            setLoading(false);
        }
    }, [applyLoaded]);

    React.useEffect(() => {
        void load();
        // The title choice; without it the field stays a number (the bracket id).
        titleBracketClient.getAll()
            .then(list => setBrackets([...(list ?? [])].sort((a, b) => a.minExperience - b.minExperience)))
            .catch(err => {
                console.error('Failed to load the title brackets for the currency policy:', err);
                setBrackets(null);
            });
    }, [load]);

    const saved = React.useMemo(
        () => Object.fromEntries(policies.map(p => [p.currency, toDraft(p)])) as Partial<Record<Currency, Draft>>,
        [policies],
    );
    const changes = policies.map(p => {
        const draft = drafts[p.currency];
        const base = saved[p.currency];
        return { policy: p, draft, keys: draft && base ? changedKeysOf(base, draft) : [] };
    });
    const dirtyCount = changes.reduce((sum, c) => sum + c.keys.length, 0);

    const invalidOf = (draft: Draft | undefined) => {
        if (!draft) return [] as DraftKey[];
        const invalid: DraftKey[] = NUMBER_FIELDS.filter(f => !isWhole(draft[f.key])).map(f => f.key);
        if (draft.minSenderTitleBracketId.trim() !== '' && !isWhole(draft.minSenderTitleBracketId)) invalid.push('minSenderTitleBracketId');
        return invalid;
    };
    const hasErrors = changes.some(c => invalidOf(c.draft).length > 0);

    const edit = (currency: Currency, change: Partial<Draft>) =>
        setDrafts(prev => ({ ...prev, [currency]: { ...(prev[currency] as Draft), ...change } }));

    const handleSave = async (): Promise<string> => {
        const toSave = changes.filter(c => c.keys.length > 0 && c.draft);
        const savedNames: string[] = [];
        const refusals: string[] = [];
        for (const { policy, draft } of toSave) {
            const d = draft as Draft;
            // updatedAt is sent back exactly as loaded: the API refuses (409) an edit of an older version.
            const body: CurrencyPolicyDto = {
                ...policy,
                ...(Object.fromEntries(NUMBER_FIELDS.map(f => [f.key, Number(d[f.key])])) as Record<NumberField, number>),
                transfersEnabled: d.transfersEnabled,
                transferable: d.transferable,
                minSenderTitleBracketId: d.minSenderTitleBracketId.trim() === '' ? null : Number(d.minSenderTitleBracketId),
            };
            try {
                const result = await currencyClient.updatePolicy(policy.currency === 'Gems' ? 'gems' : 'coins', body);
                setPolicies(ps => ps.map(p => (p.currency === result.currency ? result : p)));
                setDrafts(prev => ({ ...prev, [result.currency]: toDraft(result) }));
                savedNames.push(policy.currency.toLowerCase());
            } catch (err) {
                if ((err as { status?: number })?.status === 409) {
                    setStale(prev => (prev.includes(policy.currency) ? prev : [...prev, policy.currency]));
                    refusals.push(`${policy.currency}: ${POLICY_CHANGED_MESSAGE}`);
                } else {
                    refusals.push(`${policy.currency}: ${apiRefusalReason(err) ?? 'Could not save the policy.'}`);
                }
            }
        }
        if (refusals.length > 0) {
            const prefix = savedNames.length > 0 ? `Saved the ${savedNames.join(' and ')} policy. ` : '';
            throw new Error(prefix + refusals.join(' '));
        }
        return `Saved the ${savedNames.join(' and ')} polic${savedNames.length === 1 ? 'y' : 'ies'}.`;
    };

    const switchQuestion = () => killSwitchQuestion(changes
        .filter(c => c.draft && c.draft.transfersEnabled !== c.policy.transfersEnabled)
        .map(c => ({ currency: c.policy.currency, on: (c.draft as Draft).transfersEnabled })));

    const newest = policies.reduce<string | undefined>((max, p) => (!max || p.updatedAt > max ? p.updatedAt : max), undefined);

    return (
        <SettingsPage
            title="Currency policy"
            description={<>
                The rules the server applies to payments and staff grants. Changes apply at once and are recorded in the
                audit log (<Link to="/admin/users/balance-log" className="text-primary hover:underline">Balance event log</Link>).
            </>}
            width="max-w-5xl"
            lastSaved={{ at: newest }}
            dirtyCount={dirtyCount}
            canSave={!hasErrors && stale.length === 0}
            onSave={handleSave}
            onDiscard={() => setDrafts(Object.fromEntries(policies.map(p => [p.currency, toDraft(p)])))}
            onReload={load}
            saveErrorMessage={err => (err instanceof Error && err.message ? err.message : apiRefusalReason(err) ?? 'Could not save the policy.')}
            confirmSave={switchQuestion}
            loading={loading && policies.length === 0}
            loadingLabel="Loading the currency policy…"
            loadError={policies.length === 0 && loadError ? loadError : undefined}
            onRetry={() => void load()}
        >
            {changes.map(({ policy, draft, keys }) => draft && (
                <PolicySection
                    key={policy.currency}
                    policy={policy}
                    draft={draft}
                    changedKeys={keys}
                    invalid={invalidOf(draft)}
                    stale={stale.includes(policy.currency)}
                    brackets={brackets}
                    onEdit={change => edit(policy.currency, change)}
                    onReload={() => void load()}
                />
            ))}
        </SettingsPage>
    );
};

const PolicySection: React.FC<{
    policy: CurrencyPolicyDto;
    draft: Draft;
    changedKeys: DraftKey[];
    invalid: DraftKey[];
    stale: boolean;
    brackets: TitleBracketDto[] | null;
    onEdit: (change: Partial<Draft>) => void;
    /** The stale notice's button: loads the current policies (the refused edits go). */
    onReload: () => void;
}> = ({ policy, draft, changedKeys, invalid, stale, brackets, onEdit, onReload }) => {
    const currency = policy.currency;
    const name = currency.toLowerCase();
    const inputClass = (key: DraftKey) =>
        `input px-3 py-2 ${invalid.includes(key) ? 'border-danger' : changedKeys.includes(key) ? 'border-warning' : ''}`;
    const titleId = draft.minSenderTitleBracketId.trim();
    const knownBracket = brackets?.some(b => String(b.id) === titleId) ?? false;

    return (
        <SettingsSection
            title={currency}
            description={`Database cap ${numberFormat.format(policy.hardMaxBalance)} ${name} · last changed ${formatDateTime(policy.updatedAt)}`}
            changed={changedKeys.length > 0}
        >
            {stale && (
                <div className="rounded-md border border-danger-line bg-danger-soft p-3 text-sm text-danger-strong space-y-2">
                    <p>{POLICY_CHANGED_MESSAGE}</p>
                    <button type="button" className="btn-secondary text-sm" onClick={onReload}>Reload current policy</button>
                </div>
            )}
            <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-fg mb-2">Switches</legend>
                <Field
                    label="Payments switched on (kill switch)"
                    inline
                    hint={`Off stops every /pay in ${name} at once; the currency monitor can switch it off by itself. Saving a switch asks first.`}
                >
                    <input type="checkbox" checked={draft.transfersEnabled}
                        onChange={e => onEdit({ transfersEnabled: e.target.checked })}
                        className="h-4 w-4 rounded border-field text-primary focus:ring-primary" />
                </Field>
                <Field label={`Players may send ${name}`} inline hint={`Off: ${name} can't be sent at all, whatever the kill switch says.`}>
                    <input type="checkbox" checked={draft.transferable}
                        onChange={e => onEdit({ transferable: e.target.checked })}
                        className="h-4 w-4 rounded border-field text-primary focus:ring-primary" />
                </Field>
            </fieldset>
            {GROUPS.map(group => (
                <fieldset key={group.title}>
                    <legend className="text-sm font-semibold text-fg mb-2">{group.title}</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.fields.map(f => (
                            <Field
                                key={f.key}
                                id={`${currency}-${f.key}`}
                                label={f.label}
                                unit={unitLabel(f.unit, currency)}
                                hint={joinHint(f.help, describeValue(f.unit, draft[f.key]))}
                                error={invalid.includes(f.key) ? 'Whole number required.' : undefined}
                            >
                                <input inputMode="numeric" className={inputClass(f.key)}
                                    value={draft[f.key]} onChange={e => onEdit({ [f.key]: e.target.value } as Partial<Draft>)} />
                            </Field>
                        ))}
                        {group.title === 'Limits per player' && (
                            <Field
                                id={`${currency}-title`}
                                label="Lowest sender title"
                                hint="A sender needs at least this title; receiving is never restricted."
                                error={invalid.includes('minSenderTitleBracketId') ? 'Whole number required.' : undefined}
                            >
                                {brackets && (titleId === '' || knownBracket) ? (
                                    <select className={inputClass('minSenderTitleBracketId')} value={titleId}
                                        onChange={e => onEdit({ minSenderTitleBracketId: e.target.value })}>
                                        <option value="">None</option>
                                        {brackets.map(b => <option key={b.id} value={String(b.id)}>{bracketLabel(b)}</option>)}
                                    </select>
                                ) : (
                                    <input inputMode="numeric" className={inputClass('minSenderTitleBracketId')}
                                        placeholder="Title bracket id; empty = none"
                                        value={draft.minSenderTitleBracketId}
                                        onChange={e => onEdit({ minSenderTitleBracketId: e.target.value })} />
                                )}
                            </Field>
                        )}
                    </div>
                </fieldset>
            ))}
        </SettingsSection>
    );
};

export default CurrencyPolicyPage;
