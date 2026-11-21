import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
import { logisticsPolicyClient } from '../../apiClients/logisticsPolicyClient';
import { useActionGate } from '../../hooks/useActionGate';
import {
    LOGISTICS_RULE_TYPES,
    LOGISTICS_TOWN_SIZES,
    LogisticsPolicyDto,
    LogisticsPolicyListDto,
    LogisticsRuleDto,
} from '../../types/dtos/production/LogisticsDtos';
import { formatDateTime } from '../../utils/format';
import { productionRefusalReason } from '../../utils/productionEngine';
import { displayPath } from '../../utils/returnTo';
import {
    LOGISTICS_NODE,
    LOGISTICS_SPECIALIZATIONS,
    newRule,
    policyScopeLabel,
    policyVersionLabel,
    ruleListErrors,
    ruleTypeLabel,
    toPolicySave,
} from '../../utils/logistics';
import { LookupPicker, LookupPick } from '../stock/LookupPicker';
import { LogisticsRuleEditor } from './LogisticsRuleEditor';

interface Props {
    policyId: number;
    /** This page, for links opened from here. */
    returnTo: string | null;
    /** Where this page came from: a saved version opens with the same Back. */
    pageReturnTo: string | null;
    refreshKey?: number;
    onChanged?: () => void;
}

/**
 * A logistics policy version and its rule editor (PandiO/knk-workspace#686; TOWN_LOGISTICS § 4, § 4.1, decisions D-L3,
 * G17): what it is for, the version and what it is based on; the rules (the V1 types) edited as one list, with the
 * problems the API would refuse listed before a save; Save as a new version with its reason (the old version stays and
 * the page opens the new one); every version of the policy; for a template, its specialization, size and default flag,
 * and Apply to a town. A superseded version is read only and links to the current one. Creating a policy is the
 * seeded LogisticsPolicy form; its rules are edited here.
 */
export const LogisticsPolicyPanel: React.FC<Props> = ({ policyId, returnTo, pageReturnTo, refreshKey, onChanged }) => {
    const gate = useActionGate(LOGISTICS_NODE);
    const navigate = useNavigate();
    const location = useLocation();
    /** "Saved as version n." after a save opened the new version's page. */
    const savedNotice = (location.state as { notice?: string } | null)?.notice ?? null;
    const [policy, setPolicy] = useState<LogisticsPolicyDto | null>(null);
    const [versions, setVersions] = useState<LogisticsPolicyListDto[] | null>(null);
    const [rules, setRules] = useState<LogisticsRuleDto[]>([]);
    const [head, setHead] = useState<Pick<LogisticsPolicyDto, 'specialization' | 'townSize' | 'isDefaultTemplate'>>({});
    const [dirty, setDirty] = useState(false);
    const [reason, setReason] = useState('');
    const [addType, setAddType] = useState<string>('Reserve');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [town, setTown] = useState<LookupPick | null>(null);
    const [applyReason, setApplyReason] = useState('');
    const [applying, setApplying] = useState(false);
    const [applyResult, setApplyResult] = useState<LogisticsPolicyDto | null>(null);
    const [applyError, setApplyError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const loaded = await logisticsPolicyClient.getById(policyId);
            setPolicy(loaded);
            setRules([...(loaded.rules ?? [])].sort((a, b) => a.sequence - b.sequence));
            setHead({ specialization: loaded.specialization, townSize: loaded.townSize, isDefaultTemplate: loaded.isDefaultTemplate });
            setDirty(false);
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the policy.");
            return;
        }
        try {
            setVersions(await logisticsPolicyClient.versions(policyId));
        } catch {
            setVersions(null);
        }
    }, [policyId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    const editable = !!policy?.isCurrent && gate.allowed;
    const scope = policy?.scope ?? null;
    const problems = policy ? ruleListErrors(rules, scope) : [];

    const change = (next: LogisticsRuleDto[]) => {
        setRules(next);
        setDirty(true);
        setSaveError(null);
    };

    const move = (index: number, delta: -1 | 1) => {
        const next = [...rules];
        const [rule] = next.splice(index, 1);
        next.splice(index + delta, 0, rule);
        change(next);
    };

    const save = async () => {
        if (!policy?.id) return;
        setSaving(true);
        setSaveError(null);
        try {
            const saved = await logisticsPolicyClient.saveVersion(policy.id, toPolicySave({ ...policy, ...head }, rules, reason));
            setReason('');
            onChanged?.();
            navigate(displayPath('LogisticsPolicy', saved.id ?? policy.id, pageReturnTo), { state: { notice: `Saved as version ${saved.version}.` } });
        } catch (err) {
            setSaveError(productionRefusalReason(err) ?? "Couldn't save the policy.");
        } finally {
            setSaving(false);
        }
    };

    const apply = async () => {
        if (!policy?.id || !town) return;
        setApplying(true);
        setApplyError(null);
        setApplyResult(null);
        try {
            setApplyResult(await logisticsPolicyClient.applyTemplate(policy.id, { townId: town.id, reason: applyReason.trim() || null }));
            setTown(null);
            setApplyReason('');
        } catch (err) {
            setApplyError(productionRefusalReason(err) ?? "Couldn't apply the template.");
        } finally {
            setApplying(false);
        }
    };

    const addableTypes = scope === 'Warehouse' ? LOGISTICS_RULE_TYPES.filter(t => t === 'Reserve' || t === 'ServiceArea')
        : scope === 'Template' ? LOGISTICS_RULE_TYPES.filter(t => t !== 'ServiceArea') : LOGISTICS_RULE_TYPES;

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="logistics-policy-heading" data-testid="logistics-policy">
            <h2 id="logistics-policy-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <ScrollText className="mr-2 h-5 w-5" aria-hidden="true" />
                Policy rules
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !policy && <p className="text-sm text-muted">Loading the policy…</p>}
            {savedNotice && policy && <p className="mb-3 text-sm text-fg" role="status">{savedNotice}</p>}
            {policy && (
                <>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div><dt className="text-muted">For</dt>
                            <dd data-testid="logistics-policy-scope">
                                {policy.scope === 'Town' && policy.townId != null
                                    ? <Link to={displayPath('Town', policy.townId, returnTo)} className="text-primary hover:underline">{policyScopeLabel(policy)}</Link>
                                    : policy.scope === 'Warehouse' && policy.warehouseId != null
                                        ? <Link to={displayPath('Warehouse', policy.warehouseId, returnTo)} className="text-primary hover:underline">{policyScopeLabel(policy)}</Link>
                                        : policyScopeLabel(policy)}
                            </dd></div>
                        <div><dt className="text-muted">Version</dt>
                            <dd data-testid="logistics-policy-version">
                                {policyVersionLabel(policy)}
                                {policy.basedOnPolicyId != null && <> · based on <Link to={displayPath('LogisticsPolicy', policy.basedOnPolicyId, returnTo)} className="text-primary hover:underline">#{policy.basedOnPolicyId}</Link></>}
                            </dd></div>
                        <div><dt className="text-muted">Saved</dt><dd>{formatDateTime(policy.createdAt)} by {policy.author ?? 'Admin'}</dd></div>
                        <div><dt className="text-muted">Reason</dt><dd data-testid="logistics-policy-reason">{policy.reason ?? '-'}</dd></div>
                    </dl>

                    {!policy.isCurrent && (
                        <p className="mt-3 rounded-md border border-warning-line bg-warning-muted px-4 py-2 text-sm text-warning-strong" data-testid="logistics-policy-superseded">
                            This version was replaced{policy.supersededAt ? ` on ${formatDateTime(policy.supersededAt)}` : ''}; it is kept for the history and can't be edited.
                            {policy.supersededByPolicyId != null && <> Next version: <Link to={displayPath('LogisticsPolicy', policy.supersededByPolicyId, pageReturnTo)} className="font-medium underline">#{policy.supersededByPolicyId}</Link>.</>}
                        </p>
                    )}
                    {policy.isCurrent && !gate.allowed && gate.hint && <p className="mt-3 text-sm text-muted">Read only: {gate.hint}.</p>}

                    {policy.scope === 'Template' && (
                        <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                            <div>
                                <label htmlFor="logistics-policy-specialization" className="mb-1 block font-medium text-fg">Specialization</label>
                                <select id="logistics-policy-specialization" className="input px-3 py-2" disabled={!editable} value={head.specialization ?? ''}
                                    onChange={e => { setHead({ ...head, specialization: e.target.value || null }); setDirty(true); }}>
                                    <option value="">General</option>
                                    {LOGISTICS_SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="logistics-policy-size" className="mb-1 block font-medium text-fg">Town size</label>
                                <select id="logistics-policy-size" className="input px-3 py-2" disabled={!editable} value={head.townSize ?? ''}
                                    onChange={e => { setHead({ ...head, townSize: e.target.value || null }); setDirty(true); }}>
                                    <option value="">Any size</option>
                                    {LOGISTICS_TOWN_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <label className="flex items-center gap-2 self-end pb-2">
                                <input type="checkbox" disabled={!editable} checked={!!head.isDefaultTemplate}
                                    onChange={e => { setHead({ ...head, isDefaultTemplate: e.target.checked }); setDirty(true); }} />
                                The default for towns without a policy (one default at a time)
                            </label>
                        </div>
                    )}

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Rules ({rules.length})</h3>
                    {!editable ? (
                        rules.length === 0 ? <p className="text-sm text-muted">No rules.</p> : (
                            <ol aria-label="Rules" className="list-decimal space-y-1 pl-6 text-sm">
                                {rules.map(rule => (
                                    <li key={rule.id ?? rule.sequence}>
                                        <span className="font-medium">{ruleTypeLabel(rule.type)}:</span> {rule.summary ?? '-'}
                                        {rule.reason && <span className="text-muted"> ({rule.reason})</span>}
                                    </li>
                                ))}
                            </ol>
                        )
                    ) : (
                        <>
                            {rules.length === 0 && <p className="text-sm text-muted">No rules yet: the planner serves consumers by distance only, with no reserves.</p>}
                            <ol aria-label="Rules" className="space-y-3">
                                {rules.map((rule, index) => (
                                    <LogisticsRuleEditor key={`${rule.id ?? 'new'}-${index}`} rule={rule} index={index} count={rules.length} policyScope={scope}
                                        disabled={saving}
                                        onChange={next => change(rules.map((r, i) => (i === index ? next : r)))}
                                        onMove={delta => move(index, delta)}
                                        onRemove={() => change(rules.filter((_, i) => i !== index))} />
                                ))}
                            </ol>
                            <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
                                <div>
                                    <label htmlFor="logistics-policy-add-type" className="mb-1 block font-medium text-fg">New rule</label>
                                    <select id="logistics-policy-add-type" className="input px-3 py-2" value={addType} onChange={e => setAddType(e.target.value)}>
                                        {addableTypes.map(type => <option key={type} value={type}>{ruleTypeLabel(type)}</option>)}
                                    </select>
                                </div>
                                <button type="button" className="btn-secondary text-sm" disabled={saving}
                                    onClick={() => change([...rules, newRule(addType, scope)])}>Add the rule</button>
                            </div>

                            <div className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
                                <label htmlFor="logistics-policy-save-reason" className="block font-medium text-fg">Reason for this version</label>
                                <input id="logistics-policy-save-reason" className="input w-full px-3 py-2" maxLength={200} value={reason}
                                    placeholder='Shown in the history, e.g. "Bread reserve 14 days"' onChange={e => setReason(e.target.value)} />
                                {problems.length > 0 && (
                                    <ul aria-label="Rule problems" className="list-disc pl-6 field-error">
                                        {problems.map(problem => <li key={problem}>{problem}</li>)}
                                    </ul>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                    <button type="button" className="btn-primary text-sm" disabled={saving || !dirty || problems.length > 0} onClick={() => void save()}>
                                        {saving ? 'Saving…' : 'Save as a new version'}
                                    </button>
                                    <button type="button" className="btn-secondary text-sm" disabled={saving || !dirty} onClick={() => void load()}>Discard changes</button>
                                    <span className="text-xs text-muted">Every save is a new version; this one stays in the history.</span>
                                </div>
                                {saveError && <p className="field-error" role="alert">{saveError}</p>}
                            </div>
                        </>
                    )}

                    {policy.scope === 'Template' && policy.isCurrent && gate.allowed && (
                        <div role="group" aria-label="Apply to a town" className="mt-6 space-y-2 border-t border-line pt-3 text-sm">
                            <h3 className="text-base font-semibold text-fg">Apply to a town</h3>
                            <p className="text-muted">Copies this template's rules into the town's policy as a new version (or its first one).</p>
                            <LookupPicker entityType="Town" label="Town" value={town} onChange={setTown} disabled={applying} />
                            <label htmlFor="logistics-policy-apply-reason" className="block font-medium text-fg">Reason (optional)</label>
                            <input id="logistics-policy-apply-reason" className="input w-full px-3 py-2" maxLength={200} value={applyReason} onChange={e => setApplyReason(e.target.value)} />
                            <button type="button" className="btn-primary text-sm" disabled={!town || applying || dirty} title={dirty ? 'Save or discard the changes first' : undefined}
                                onClick={() => void apply()}>
                                {applying ? 'Applying…' : 'Apply the template'}
                            </button>
                            {applyResult && (
                                <p role="status">
                                    Applied: <Link to={displayPath('LogisticsPolicy', applyResult.id ?? 0, returnTo)} className="text-primary hover:underline">{applyResult.name} v{applyResult.version}</Link>.
                                </p>
                            )}
                            {applyError && <p className="field-error" role="alert">{applyError}</p>}
                        </div>
                    )}

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Versions</h3>
                    {versions == null && <p className="text-sm text-muted">Couldn't load the versions.</p>}
                    {versions != null && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm" aria-label="Versions">
                                <thead>
                                    <tr className="text-muted">
                                        <th className="pr-4 font-medium">Version</th><th className="pr-4 font-medium">Saved</th>
                                        <th className="pr-4 font-medium">Rules</th><th className="font-medium">Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {versions.map(version => (
                                        <tr key={version.id} className="border-t border-line">
                                            <td className="pr-4 py-1">
                                                {version.id === policy.id
                                                    ? <span className="font-medium">{policyVersionLabel(version)} (this page)</span>
                                                    : <Link to={displayPath('LogisticsPolicy', version.id, pageReturnTo)} className="text-primary hover:underline">{policyVersionLabel(version)}</Link>}
                                            </td>
                                            <td className="pr-4 py-1">{formatDateTime(version.createdAt)}</td>
                                            <td className="pr-4 py-1">{version.ruleCount}</td>
                                            <td className="py-1">{version.reason ?? '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

export default LogisticsPolicyPanel;
