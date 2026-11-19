import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Sprout } from 'lucide-react';
import { productionStructureClient } from '../../apiClients/productionStructureClient';
import { productionYieldOverrideClient } from '../../apiClients/productionYieldOverrideClient';
import { useActionGate } from '../../hooks/useActionGate';
import type {
    ProductionYieldDto,
    ProductionYieldOverrideKind,
    ProductionYieldOverrideListDto,
    YieldOutputDto,
} from '../../types/dtos/production/ProductionYieldDtos';
import { YIELD_OVERRIDE_KINDS } from '../../types/dtos/production/ProductionYieldDtos';
import { formatDateTime } from '../../utils/format';
import { formatNumber, formatRate, PRODUCTION_WRITE_NODE, productionRefusalReason } from '../../utils/productionEngine';
import {
    areaOverCap,
    areaSizeLabel,
    isSurveyed,
    overrideErrors,
    overrideLabel,
    yieldSourceText,
} from '../../utils/productionYield';
import { displayPath, newFormPath } from '../../utils/returnTo';
import { toast } from '../../utils/toast';
import { LookupPick, LookupPicker } from '../stock/LookupPicker';

interface Props {
    structureId: number;
    returnTo: string | null;
    /** After an override or a survey request, so the production view and details are read again. */
    onChanged?: () => void;
    refreshKey?: number;
}

type OverrideChoice = ProductionYieldOverrideKind | 'None';

interface Draft {
    kind: OverrideChoice;
    value: string;
}

/**
 * A production structure's yield (PandiO/knk-workspace#680; PRODUCTION_KINDS § 3-4, decisions P-D1, G5, G7, acceptance
 * A10, insight #65): the yield source in words, the areas with their size against the level's cap, "Survey now" (not
 * for a Configured structure, which is never surveyed), every output with how its base rate comes about (survey units,
 * shared split, yield row, override), and for a Hybrid structure the overrides: pin, exclude or scale an output.
 */
export const StructureYieldPanel: React.FC<Props> = ({ structureId, returnTo, onChanged, refreshKey }) => {
    const gate = useActionGate(PRODUCTION_WRITE_NODE);
    const [yieldDto, setYieldDto] = useState<ProductionYieldDto | null>(null);
    const [overrides, setOverrides] = useState<ProductionYieldOverrideListDto[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});
    const [drafts, setDrafts] = useState<Record<number, Draft>>({});
    const [newPin, setNewPin] = useState<{ blueprint: LookupPick | null; kind: ProductionYieldOverrideKind; value: string }>({ blueprint: null, kind: 'Pin', value: '' });

    const load = useCallback(async () => {
        setError(null);
        let dto: ProductionYieldDto;
        try {
            dto = await productionStructureClient.getYield(structureId);
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the yield.");
            return;
        }
        setYieldDto(dto);
        if (dto.yieldSource === 'Hybrid') {
            try {
                const page = await productionYieldOverrideClient.search({
                    pageNumber: 1, pageSize: 100, filters: { productionStructureId: String(structureId) },
                });
                setOverrides(page.items ?? []);
            } catch {
                setOverrides([]);
            }
        } else {
            setOverrides([]);
        }
        setDrafts({});
    }, [structureId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setActionError(null);
        try {
            await action();
            await load();
            onChanged?.();
        } catch (err) {
            setActionError(productionRefusalReason(err) ?? 'The change was refused.');
        } finally {
            setBusy(false);
        }
    };

    const surveyNow = () => run(async () => {
        const areas = await productionStructureClient.requestSurvey(structureId, {});
        toast.success(`Survey requested for ${areas.length} ${areas.length === 1 ? 'area' : 'areas'}: the game server surveys at its next poll.`);
    });

    const remakeLines = () => run(async () => {
        const result = await productionStructureClient.materialize(structureId);
        toast.success(`Lines made again: ${result.linesCreated.length} created, ${result.linesUpdated.length} updated.`);
    });

    const overrideOf = (blueprintId: number) => overrides.find(o => o.itemBlueprintId === blueprintId) ?? null;

    const draftOf = (output: YieldOutputDto): Draft => {
        const stored = overrideOf(output.itemBlueprintId);
        return drafts[output.itemBlueprintId] ?? {
            kind: (stored?.kind as ProductionYieldOverrideKind | undefined) ?? 'None',
            value: stored && stored.kind !== 'Exclude' ? String(stored.value) : '',
        };
    };

    const saveOverride = (blueprintId: number, draft: Draft) => run(async () => {
        const stored = overrideOf(blueprintId);
        if (draft.kind === 'None') {
            if (stored) await productionYieldOverrideClient.delete(stored.id);
            toast.success('Override removed.');
            return;
        }
        const body = {
            productionStructureId: structureId,
            itemBlueprintId: blueprintId,
            kind: draft.kind,
            value: draft.kind === 'Exclude' ? 0 : Number(draft.value),
        };
        if (stored) await productionYieldOverrideClient.update({ id: stored.id, ...body });
        else await productionYieldOverrideClient.create({ id: 0, ...body });
        toast.success(`Override saved: ${overrideLabel(draft.kind, body.value)}.`);
    });

    const canEdit = gate.allowed && !busy;
    const hybrid = yieldDto?.yieldSource === 'Hybrid';
    const surveyed = isSurveyed(yieldDto?.yieldSource);
    const enabledAreas = (yieldDto?.areas ?? []).filter(area => area.enabled !== false);
    const listedBlueprints = new Set((yieldDto?.outputs ?? []).map(o => o.itemBlueprintId));
    const newPinProblems = newPin.blueprint ? overrideErrors(newPin.kind, newPin.value) : ['Pick the output.'];

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="structure-yield-heading" data-testid="structure-yield">
            <h2 id="structure-yield-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <Sprout className="mr-2 h-5 w-5" aria-hidden="true" />
                Yield
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !yieldDto && <p className="text-sm text-muted">Loading the yield…</p>}
            {yieldDto && (
                <>
                    <p className="text-sm" data-testid="yield-source">
                        <span className="font-semibold text-fg">Yield source {yieldDto.yieldSource}.</span>{' '}
                        <span className="text-muted">{yieldSourceText(yieldDto.yieldSource)}</span>
                    </p>
                    {yieldDto.notes.length > 0 && (
                        <ul aria-label="Yield notes" className="mt-2 list-disc pl-6 text-sm text-muted">
                            {yieldDto.notes.map(note => <li key={note}>{note}</li>)}
                        </ul>
                    )}

                    <h3 className="mb-2 mt-5 text-base font-semibold text-fg">Areas</h3>
                    {yieldDto.areas.length === 0 && (
                        <p className="text-sm text-muted">
                            {surveyed ? 'No areas yet: the structure yields nothing from surveys until it has one.' : 'No areas (a Configured structure needs none).'}
                        </p>
                    )}
                    {yieldDto.areas.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm" aria-label="Areas">
                                <thead>
                                    <tr className="text-left text-muted">
                                        <th className="py-1 pr-4 font-medium">Area</th>
                                        <th className="py-1 pr-4 font-medium">Shape</th>
                                        <th className="py-1 pr-4 font-medium">Size</th>
                                        <th className="py-1 pr-4 font-medium">Kind of area</th>
                                        <th className="py-1 pr-4 font-medium">Last survey</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {yieldDto.areas.map(area => (
                                        <tr key={area.id} className="border-t border-line">
                                            <td className="py-1 pr-4">
                                                <Link className="link" to={displayPath('ProductionArea', area.id, returnTo)}>{area.name ?? `Area #${area.id}`}</Link>
                                                {area.enabled === false && <span className="ml-2 text-muted">(disabled)</span>}
                                            </td>
                                            <td className="py-1 pr-4">{area.shape}</td>
                                            <td className={`py-1 pr-4 ${areaOverCap(area) ? 'field-error' : ''}`}>{areaSizeLabel(area)}</td>
                                            <td className="py-1 pr-4">{area.exclusive ? 'Exclusive' : 'Shared'}</td>
                                            <td className="py-1 pr-4">
                                                {area.lastSurveyedAt ? formatDateTime(area.lastSurveyedAt) : 'Never'}
                                                {area.surveyRequestedAt && <span className="ml-2 text-muted">(survey requested)</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Link className="btn-secondary text-sm" to={newFormPath('ProductionArea', returnTo)}>Add area</Link>
                        {surveyed && (
                            <button type="button" className="btn-primary text-sm" disabled={!canEdit || enabledAreas.length === 0}
                                title={gate.hint ?? (enabledAreas.length === 0 ? 'Add or enable an area first.' : undefined)} onClick={() => void surveyNow()}>
                                Survey now
                            </button>
                        )}
                        {surveyed && (
                            <button type="button" className="btn-secondary text-sm" disabled={!canEdit} title={gate.hint ?? undefined}
                                onClick={() => void remakeLines()}>
                                Make lines again
                            </button>
                        )}
                    </div>
                    {!surveyed && <p className="mt-2 text-xs text-muted">A Configured structure is never surveyed, so there is no Survey now (G5).</p>}
                    {actionError && <p className="mt-3 text-sm field-error" role="alert">{actionError}</p>}

                    {surveyed && (
                        <>
                            <h3 className="mb-2 mt-5 text-base font-semibold text-fg">Outputs and why each rate is what it is</h3>
                            {!yieldDto.surveysRun && <p className="mb-2 text-sm text-muted">No survey has run yet.</p>}
                            {yieldDto.outputs.length === 0 && <p className="text-sm text-muted">No outputs yet.</p>}
                            {yieldDto.outputs.length > 0 && (
                                <ul className="space-y-3" aria-label="Outputs">
                                    {yieldDto.outputs.map(output => {
                                        const name = output.itemBlueprintName ?? `Blueprint #${output.itemBlueprintId}`;
                                        const draft = draftOf(output);
                                        const problems = draft.kind === 'None' ? [] : overrideErrors(draft.kind, draft.value);
                                        const open = !!expanded[output.itemBlueprintId];
                                        return (
                                            <li key={output.itemBlueprintId} className="rounded border border-line p-3" aria-label={`Output ${name}`}>
                                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                                    <p className="font-semibold text-fg">
                                                        {name}{output.isPrimary && <span className="ml-2 text-xs font-normal text-muted">primary</span>}
                                                    </p>
                                                    <p className="text-sm" data-testid="yield-base-rate">Base {formatRate(output.baseRatePerHour)}</p>
                                                </div>
                                                <p className="mt-1 text-sm text-muted" data-testid="yield-explanation">
                                                    Surveyed {formatRate(output.derivedRatePerHour)}
                                                    {output.override ? `, ${overrideLabel(output.override, output.overrideValue)}` : ''}
                                                    {` → base ${formatRate(output.baseRatePerHour)}`}
                                                    {output.isPrimary ? ', then the primary multiplier as a modifier' : ''}.
                                                    {output.productionLineId != null && (
                                                        <> {' '}<Link className="link" to={displayPath('ProductionLine', output.productionLineId, returnTo)}>Line #{output.productionLineId}</Link>
                                                            {output.lineRateSource ? ` (${output.lineRateSource})` : ''}</>
                                                    )}
                                                </p>
                                                {output.contributions.length > 0 && (
                                                    <button type="button" className="mt-2 text-sm link" aria-expanded={open}
                                                        onClick={() => setExpanded(previous => ({ ...previous, [output.itemBlueprintId]: !open }))}>
                                                        {open ? 'Hide the survey units' : `Show the ${output.contributions.length} survey ${output.contributions.length === 1 ? 'unit' : 'units'}`}
                                                    </button>
                                                )}
                                                {open && (
                                                    <div className="mt-2 overflow-x-auto">
                                                        <table className="min-w-full text-sm" aria-label={`Survey units of ${name}`}>
                                                            <thead>
                                                                <tr className="text-left text-muted">
                                                                    <th className="py-1 pr-3 font-medium">Area</th>
                                                                    <th className="py-1 pr-3 font-medium">Unit</th>
                                                                    <th className="py-1 pr-3 font-medium">Yield row</th>
                                                                    <th className="py-1 pr-3 font-medium">Count</th>
                                                                    <th className="py-1 pr-3 font-medium">Share</th>
                                                                    <th className="py-1 pr-3 font-medium">Rate per unit</th>
                                                                    <th className="py-1 pr-3 font-medium">Chance</th>
                                                                    <th className="py-1 pr-3 font-medium">Rate</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {output.contributions.map(c => (
                                                                    <tr key={`${c.productionAreaId}-${c.unitKey}-${c.sharedBy}`} className="border-t border-line">
                                                                        <td className="py-1 pr-3">{c.areaName}</td>
                                                                        <td className="py-1 pr-3 font-mono">{c.unitKey}</td>
                                                                        <td className="py-1 pr-3 font-mono">{c.yieldRowUnitKey}</td>
                                                                        <td className="py-1 pr-3">{c.count}</td>
                                                                        <td className="py-1 pr-3">{c.sharedBy > 1 ? `1/${c.sharedBy} (shared)` : formatNumber(c.share)}</td>
                                                                        <td className="py-1 pr-3">{formatNumber(c.ratePerUnitPerHour, 4)}</td>
                                                                        <td className="py-1 pr-3">{formatNumber(c.byproductChance)}</td>
                                                                        <td className="py-1 pr-3">{formatRate(c.ratePerHour)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                                {hybrid && (
                                                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[12rem_10rem_auto] sm:items-end">
                                                        <label className="text-sm">
                                                            <span className="mb-1 block font-medium text-fg">Override</span>
                                                            <select className="input w-full px-2 py-2" value={draft.kind} disabled={!canEdit} aria-label={`Override of ${name}`}
                                                                onChange={e => setDrafts(previous => ({ ...previous, [output.itemBlueprintId]: { ...draft, kind: e.target.value as OverrideChoice } }))}>
                                                                <option value="None">None (the survey's rate)</option>
                                                                {YIELD_OVERRIDE_KINDS.map(kind => <option key={kind} value={kind}>{kind}</option>)}
                                                            </select>
                                                        </label>
                                                        <label className="text-sm">
                                                            <span className="mb-1 block font-medium text-fg">{draft.kind === 'Scale' ? 'Factor' : 'Rate per hour'}</span>
                                                            <input type="number" min={0} step="any" className="input w-full px-2 py-2" value={draft.value}
                                                                aria-label={`Override value of ${name}`}
                                                                disabled={!canEdit || draft.kind === 'None' || draft.kind === 'Exclude'}
                                                                onChange={e => setDrafts(previous => ({ ...previous, [output.itemBlueprintId]: { ...draft, value: e.target.value } }))} />
                                                        </label>
                                                        <button type="button" className="btn-secondary text-sm" title={gate.hint ?? undefined}
                                                            disabled={!canEdit || !drafts[output.itemBlueprintId] || problems.length > 0}
                                                            onClick={() => void saveOverride(output.itemBlueprintId, draft)}>
                                                            Save override
                                                        </button>
                                                        {problems.length > 0 && <p className="text-sm field-error sm:col-span-3">{problems.join(' ')}</p>}
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                            {hybrid && (
                                <div className="mt-4 rounded border border-dashed border-line p-3" data-testid="new-override">
                                    <p className="mb-2 text-sm font-medium text-fg">Pin an output the survey doesn't yield</p>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_10rem_10rem_auto] sm:items-end">
                                        <LookupPicker entityType="ItemBlueprint" label="Output" value={newPin.blueprint} disabled={!canEdit}
                                            excludeIds={Array.from(listedBlueprints)} onChange={blueprint => setNewPin(previous => ({ ...previous, blueprint }))} />
                                        <label className="text-sm">
                                            <span className="mb-1 block font-medium text-fg">Override</span>
                                            <select className="input w-full px-2 py-2" value={newPin.kind} disabled={!canEdit} aria-label="New override"
                                                onChange={e => setNewPin(previous => ({ ...previous, kind: e.target.value as ProductionYieldOverrideKind }))}>
                                                {YIELD_OVERRIDE_KINDS.map(kind => <option key={kind} value={kind}>{kind}</option>)}
                                            </select>
                                        </label>
                                        <label className="text-sm">
                                            <span className="mb-1 block font-medium text-fg">{newPin.kind === 'Scale' ? 'Factor' : 'Rate per hour'}</span>
                                            <input type="number" min={0} step="any" className="input w-full px-2 py-2" value={newPin.value} aria-label="New override value"
                                                disabled={!canEdit || newPin.kind === 'Exclude'}
                                                onChange={e => setNewPin(previous => ({ ...previous, value: e.target.value }))} />
                                        </label>
                                        <button type="button" className="btn-secondary text-sm" disabled={!canEdit || newPinProblems.length > 0}
                                            title={gate.hint ?? undefined}
                                            onClick={() => {
                                                const blueprintId = newPin.blueprint!.id;
                                                void saveOverride(blueprintId, { kind: newPin.kind, value: newPin.value })
                                                    .then(() => setNewPin({ blueprint: null, kind: 'Pin', value: '' }));
                                            }}>
                                            Add override
                                        </button>
                                    </div>
                                </div>
                            )}
                            {yieldDto.unmatchedUnitKeys.length > 0 && (
                                <div className="mt-4 rounded-md border border-warning-line bg-warning-muted px-4 py-3 text-sm text-warning-strong">
                                    <p className="flex items-center font-semibold">
                                        <AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />Surveyed but producing nothing
                                    </p>
                                    <p className="mt-1">No row of the kind's yield table matches these units:</p>
                                    <ul aria-label="Unmatched survey units" className="mt-1 list-disc pl-6 font-mono">
                                        {yieldDto.unmatchedUnitKeys.map(key => <li key={key}>{key}</li>)}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                    {gate.hint && <p className="mt-3 text-xs text-muted">Editing: {gate.hint}.</p>}
                </>
            )}
        </section>
    );
};

export default StructureYieldPanel;
