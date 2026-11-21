import React from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { LookupPicker, LookupPick } from '../stock/LookupPicker';
import {
    LOGISTICS_AREA_KINDS,
    LOGISTICS_CONSUMER_KINDS,
    LOGISTICS_PRIORITY_CLASSES,
    LOGISTICS_RULE_TYPES,
    LOGISTICS_TARGET_KINDS,
    LogisticsRuleDto,
} from '../../types/dtos/production/LogisticsDtos';
import { NamedRefDto } from '../../types/dtos/production/ProductionEngineDtos';
import { fromLocalInput, newRule, ruleTypeLabel, toLocalInput } from '../../utils/logistics';

interface Props {
    rule: LogisticsRuleDto;
    index: number;
    count: number;
    /** Town, Warehouse or Template: what the rule may name. */
    policyScope: string | null | undefined;
    disabled?: boolean;
    onChange: (rule: LogisticsRuleDto) => void;
    onMove: (delta: -1 | 1) => void;
    onRemove: () => void;
}

const pickOf = (id: number | null | undefined, ref: NamedRefDto | null | undefined): LookupPick | null =>
    id == null ? null : { id, label: ref?.name ?? `#${id}` };

const refOf = (pick: LookupPick | null): NamedRefDto | null => (pick ? { id: pick.id, name: pick.label } : null);

/** A number from an input; empty becomes null (the field is left out). */
const numberOrNull = (raw: string): number | null => (raw.trim() === '' ? null : Number(raw));

/** An input's value: empty for null or a half-typed number. */
const numberValue = (value: number | null | undefined): number | string => (value == null || Number.isNaN(value) ? '' : value);

const TARGET_WORDS: Record<string, string> = { Any: 'Every item', Blueprint: 'One blueprint', Category: 'A category', Tag: 'A tag' };
const CONSUMER_WORDS: Record<string, string> = { Any: 'Every consumer', Structure: 'One structure', ProductionKind: 'A production kind' };
const AREA_WORDS: Record<string, string> = { District: 'A district', Rural: 'The rural territory', Structure: 'One structure' };

/**
 * One rule of a policy in the editor (PandiO/knk-workspace#686; TOWN_LOGISTICS § 4, the V1 types): the type, then only
 * the fields that type uses (a reserve's scope, item and units or days of cover; a priority class's consumers, items
 * and class; a service area's area and warehouse; a replenishment rule's consumers, items, min and max), the active
 * window and the reason shown in the planner's explanation. A template names no structure, district or warehouse; a
 * warehouse policy holds local reserves and service areas only.
 */
export const LogisticsRuleEditor: React.FC<Props> = ({ rule, index, count, policyScope, disabled = false, onChange, onMove, onRemove }) => {
    const n = index + 1;
    const set = (patch: Partial<LogisticsRuleDto>) => onChange({ ...rule, ...patch });
    const isTemplate = policyScope === 'Template';
    const isWarehousePolicy = policyScope === 'Warehouse';
    const types = isWarehousePolicy ? LOGISTICS_RULE_TYPES.filter(t => t === 'Reserve' || t === 'ServiceArea')
        : isTemplate ? LOGISTICS_RULE_TYPES.filter(t => t !== 'ServiceArea') : LOGISTICS_RULE_TYPES;
    const consumerKinds = isTemplate ? LOGISTICS_CONSUMER_KINDS.filter(k => k !== 'Structure') : LOGISTICS_CONSUMER_KINDS;
    const id = (field: string) => `rule-${n}-${field}`;
    const reserveInDays = rule.daysOfCover != null;

    return (
        <li aria-label={`Rule ${n}: ${ruleTypeLabel(rule.type)}`} className="rounded border border-line p-3 text-sm" data-testid={`rule-${n}`}>
            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <label htmlFor={id('type')} className="mb-1 block font-medium text-fg">Rule {n} type</label>
                    <select id={id('type')} className="input px-3 py-2" value={rule.type ?? ''} disabled={disabled}
                        onChange={e => onChange({ ...newRule(e.target.value, policyScope), reason: rule.reason, activeFrom: rule.activeFrom, activeUntil: rule.activeUntil })}>
                        {types.map(type => <option key={type} value={type}>{ruleTypeLabel(type)}</option>)}
                    </select>
                </div>
                {rule.summary && <p className="flex-1 text-xs text-muted" data-testid={`rule-${n}-summary`}>Saved as: {rule.summary}</p>}
                <div className="ml-auto flex gap-1">
                    <button type="button" className="btn-secondary p-1" disabled={disabled || index === 0} onClick={() => onMove(-1)} aria-label={`Move rule ${n} up`}>
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button type="button" className="btn-secondary p-1" disabled={disabled || index === count - 1} onClick={() => onMove(1)} aria-label={`Move rule ${n} down`}>
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button type="button" className="btn-secondary p-1" disabled={disabled} onClick={onRemove} aria-label={`Remove rule ${n}`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                {rule.type === 'Reserve' && !isWarehousePolicy && !isTemplate && (
                    <div>
                        <label htmlFor={id('scope')} className="mb-1 block font-medium text-fg">Where</label>
                        <select id={id('scope')} className="input px-3 py-2" value={rule.scope ?? 'Town'} disabled={disabled}
                            onChange={e => set({ scope: e.target.value, warehouseId: null, warehouse: null })}>
                            <option value="Town">Town-wide</option>
                            <option value="Warehouse">One warehouse (local reserve)</option>
                        </select>
                    </div>
                )}
                {((rule.type === 'Reserve' && rule.scope === 'Warehouse' && !isWarehousePolicy) || (rule.type === 'ServiceArea' && !isWarehousePolicy)) && (
                    <LookupPicker entityType="Warehouse" label={rule.type === 'ServiceArea' ? `Rule ${n} served by warehouse` : `Rule ${n} warehouse`} disabled={disabled}
                        value={pickOf(rule.warehouseId, rule.warehouse)}
                        onChange={pick => set({ warehouseId: pick?.id ?? null, warehouse: refOf(pick) })} />
                )}

                {rule.type !== 'ServiceArea' && (
                    <>
                        <div>
                            <label htmlFor={id('target')} className="mb-1 block font-medium text-fg">Items</label>
                            <select id={id('target')} className="input px-3 py-2" value={rule.targetKind ?? 'Any'} disabled={disabled}
                                onChange={e => set({ targetKind: e.target.value, itemBlueprintId: null, itemBlueprint: null, categoryId: null, category: null, tagId: null, tag: null })}>
                                {LOGISTICS_TARGET_KINDS.map(kind => <option key={kind} value={kind}>{TARGET_WORDS[kind]}</option>)}
                            </select>
                        </div>
                        {rule.targetKind === 'Blueprint' && (
                            <LookupPicker entityType="ItemBlueprint" label={`Rule ${n} blueprint`} disabled={disabled}
                                value={pickOf(rule.itemBlueprintId, rule.itemBlueprint)}
                                onChange={pick => set({ itemBlueprintId: pick?.id ?? null, itemBlueprint: refOf(pick) })} />
                        )}
                        {rule.targetKind === 'Category' && (
                            <LookupPicker entityType="Category" label={`Rule ${n} category`} disabled={disabled}
                                value={pickOf(rule.categoryId, rule.category)}
                                onChange={pick => set({ categoryId: pick?.id ?? null, category: refOf(pick) })} />
                        )}
                        {rule.targetKind === 'Tag' && (
                            <LookupPicker entityType="Tag" label={`Rule ${n} tag`} disabled={disabled}
                                value={pickOf(rule.tagId, rule.tag)}
                                onChange={pick => set({ tagId: pick?.id ?? null, tag: refOf(pick) })} />
                        )}
                    </>
                )}

                {(rule.type === 'PriorityClass' || rule.type === 'Replenishment') && (
                    <>
                        <div>
                            <label htmlFor={id('consumer')} className="mb-1 block font-medium text-fg">Consumers</label>
                            <select id={id('consumer')} className="input px-3 py-2" value={rule.consumerKind ?? 'Any'} disabled={disabled}
                                onChange={e => set({ consumerKind: e.target.value, structureId: null, structure: null, productionKindId: null, productionKind: null })}>
                                {consumerKinds.map(kind => <option key={kind} value={kind}>{CONSUMER_WORDS[kind]}</option>)}
                            </select>
                        </div>
                        {rule.consumerKind === 'Structure' && (
                            <LookupPicker entityType="Structure" label={`Rule ${n} consumer`} disabled={disabled}
                                value={pickOf(rule.structureId, rule.structure)}
                                onChange={pick => set({ structureId: pick?.id ?? null, structure: refOf(pick) })} />
                        )}
                        {rule.consumerKind === 'ProductionKind' && (
                            <LookupPicker entityType="ProductionKind" label={`Rule ${n} production kind`} disabled={disabled}
                                value={pickOf(rule.productionKindId, rule.productionKind)}
                                onChange={pick => set({ productionKindId: pick?.id ?? null, productionKind: refOf(pick) })} />
                        )}
                    </>
                )}

                {rule.type === 'Reserve' && (
                    <>
                        <div>
                            <label htmlFor={id('measure')} className="mb-1 block font-medium text-fg">Keep</label>
                            <select id={id('measure')} className="input px-3 py-2" value={reserveInDays ? 'days' : 'units'} disabled={disabled}
                                onChange={e => set(e.target.value === 'days' ? { units: null, daysOfCover: 1 } : { daysOfCover: null, units: 0 })}>
                                <option value="units">Units</option>
                                <option value="days">Days of cover</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor={id('amount')} className="mb-1 block font-medium text-fg">{reserveInDays ? `Rule ${n} days of cover` : `Rule ${n} units`}</label>
                            <input id={id('amount')} type="number" min={0} step={reserveInDays ? 'any' : 1} className="input px-3 py-2" disabled={disabled}
                                value={numberValue(reserveInDays ? rule.daysOfCover : rule.units)}
                                onChange={e => set(reserveInDays ? { daysOfCover: numberOrNull(e.target.value) ?? Number.NaN } : { units: numberOrNull(e.target.value) })} />
                        </div>
                    </>
                )}

                {rule.type === 'PriorityClass' && (
                    <div>
                        <label htmlFor={id('class')} className="mb-1 block font-medium text-fg">Rule {n} priority class</label>
                        <select id={id('class')} className="input px-3 py-2" value={rule.priorityClass ?? ''} disabled={disabled}
                            onChange={e => set({ priorityClass: e.target.value || null })}>
                            <option value="">Pick a class</option>
                            {LOGISTICS_PRIORITY_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                )}

                {rule.type === 'ServiceArea' && (
                    <>
                        <div>
                            <label htmlFor={id('area')} className="mb-1 block font-medium text-fg">Area</label>
                            <select id={id('area')} className="input px-3 py-2" value={rule.areaKind ?? ''} disabled={disabled}
                                onChange={e => set({ areaKind: e.target.value || null, districtId: null, district: null, structureId: null, structure: null })}>
                                {LOGISTICS_AREA_KINDS.map(kind => <option key={kind} value={kind}>{AREA_WORDS[kind]}</option>)}
                            </select>
                        </div>
                        {rule.areaKind === 'District' && (
                            <LookupPicker entityType="District" label={`Rule ${n} district`} disabled={disabled}
                                value={pickOf(rule.districtId, rule.district)}
                                onChange={pick => set({ districtId: pick?.id ?? null, district: refOf(pick) })} />
                        )}
                        {rule.areaKind === 'Structure' && (
                            <LookupPicker entityType="Structure" label={`Rule ${n} structure`} disabled={disabled}
                                value={pickOf(rule.structureId, rule.structure)}
                                onChange={pick => set({ structureId: pick?.id ?? null, structure: refOf(pick) })} />
                        )}
                    </>
                )}

                {rule.type === 'Replenishment' && (
                    <>
                        <div>
                            <label htmlFor={id('min')} className="mb-1 block font-medium text-fg">Rule {n} min (reorder point)</label>
                            <input id={id('min')} type="number" min={0} step={1} className="input px-3 py-2" disabled={disabled}
                                value={rule.reorderPoint ?? ''} onChange={e => set({ reorderPoint: numberOrNull(e.target.value) })} />
                        </div>
                        <div>
                            <label htmlFor={id('max')} className="mb-1 block font-medium text-fg">Rule {n} max (target level)</label>
                            <input id={id('max')} type="number" min={1} step={1} className="input px-3 py-2" disabled={disabled}
                                value={rule.targetLevel ?? ''} onChange={e => set({ targetLevel: numberOrNull(e.target.value) })} />
                        </div>
                    </>
                )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                    <label htmlFor={id('from')} className="mb-1 block font-medium text-fg">Active from</label>
                    <input id={id('from')} type="datetime-local" className="input px-3 py-2" disabled={disabled}
                        value={toLocalInput(rule.activeFrom)} onChange={e => set({ activeFrom: fromLocalInput(e.target.value) })} />
                </div>
                <div>
                    <label htmlFor={id('until')} className="mb-1 block font-medium text-fg">Active until</label>
                    <input id={id('until')} type="datetime-local" className="input px-3 py-2" disabled={disabled}
                        value={toLocalInput(rule.activeUntil)} onChange={e => set({ activeUntil: fromLocalInput(e.target.value) })} />
                </div>
                <div>
                    <label htmlFor={id('reason')} className="mb-1 block font-medium text-fg">Rule {n} reason</label>
                    <input id={id('reason')} className="input px-3 py-2" maxLength={200} disabled={disabled}
                        placeholder="Shown in the planner's explanation" value={rule.reason ?? ''} onChange={e => set({ reason: e.target.value })} />
                </div>
            </div>
        </li>
    );
};

export default LogisticsRuleEditor;
