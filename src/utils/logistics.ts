import {
    LogisticsPolicyDto,
    LogisticsPolicyUpdateDto,
    LogisticsRuleDto,
    ProductionLogisticsSettingsDto,
    TownSupplyLineDto,
} from '../types/dtos/production/LogisticsDtos';
import { formatNumber } from './productionEngine';

/**
 * Town logistics P9 helpers for the web app (PandiO/knk-workspace#686; TOWN_LOGISTICS § 2-5, decisions D-L1-D-L3).
 * Pure functions: the policy editor, the town, warehouse and consumer panels and the settings card use them, Jest tests
 * them.
 */

/** Logistics reads need the World area; writes (policies, settings, dry run, Run now, release) the same node. */
export const LOGISTICS_NODE = 'knk.admin.world';
/** Deleting a policy (every version) or a replenishment setting also needs this node. */
export const LOGISTICS_DELETE_NODE = 'knk.admin.delete';

/** The town specializations a template is made for (knk-web-api `ResourceCategory`); empty = general. */
export const LOGISTICS_SPECIALIZATIONS: readonly string[] = ['Crops', 'Wood', 'Stone', 'Ore', 'Fish', 'Flowers', 'Animals'];

const OUTCOME_WORDS: Record<string, string> = {
    Reserved: 'Reserved',
    PartlyReserved: 'Partly reserved',
    NotNeeded: 'Not needed',
    AlreadyReserved: 'Already reserved',
    NoStock: 'No stock',
    HeldByReserve: 'Held by a reserve',
    NoWarehouse: 'No warehouse',
    NoWorker: 'No worker',
    NoRoom: 'No room',
    NotConnected: 'Not connected',
    CarrierFull: "Carrier full",
};

/** A plan outcome in words ("HeldByReserve" → "Held by a reserve"); unknown values as sent. */
export function planOutcomeLabel(outcome: string | null | undefined): string {
    if (!outcome) return '-';
    return OUTCOME_WORDS[outcome] ?? outcome;
}

/** Whether the line got (some of) what it needed, nothing was needed, or it was held (the "why not" lines). */
export function planOutcomeTone(outcome: string | null | undefined): 'ok' | 'partial' | 'held' | 'neutral' {
    if (outcome === 'Reserved' || outcome === 'AlreadyReserved') return 'ok';
    if (outcome === 'PartlyReserved' || outcome === 'CarrierFull') return 'partial';
    if (outcome === 'NotNeeded') return 'neutral';
    return 'held';
}

const RULE_TYPE_WORDS: Record<string, string> = {
    Reserve: 'Reserve (saving rule)',
    PriorityClass: 'Priority class',
    ServiceArea: 'Service area',
    Replenishment: 'Replenishment defaults',
};

export function ruleTypeLabel(type: string | null | undefined): string {
    if (!type) return '-';
    return RULE_TYPE_WORDS[type] ?? type;
}

const SOURCE_WORDS: Record<string, string> = {
    Setting: 'its replenishment setting',
    Rule: 'a Replenishment rule',
    Inputs: 'its line inputs (4 h / 12 h)',
    // Shops P10 (PandiO/knk-workspace#248, #688): a shop's catalogue at its level's default min and max.
    ShopLevel: "its shop level's default min and max",
    Town: "the town's policy",
    DefaultTemplate: 'the default template',
    None: 'no policy',
    Nearest: 'nearest by road',
};

/** Where a min/max, a policy or a service area came from, in words. */
export function logisticsSourceLabel(source: string | null | undefined): string {
    if (!source) return '-';
    return SOURCE_WORDS[source] ?? source;
}

const RESERVATION_WORDS: Record<string, string> = {
    Open: 'Open (waiting for its worker)',
    Collected: 'Collected',
    Released: 'Released (expired or the order ended)',
    Cancelled: 'Cancelled',
};

export function reservationStatusLabel(status: string | null | undefined): string {
    if (!status) return '-';
    return RESERVATION_WORDS[status] ?? status;
}

/** Days of cover in words: "no outflow" when there is none (the API sends null). */
export function formatDaysOfCover(days: number | null | undefined): string {
    if (days == null) return 'No outflow';
    return `${formatNumber(days, 1)} days`;
}

/** A supply line that needs a look: nothing available, or under 3 days of cover. */
export function supplyLineIsLow(line: Pick<TownSupplyLineDto, 'available' | 'daysOfCover'>): boolean {
    return line.available <= 0 || (line.daysOfCover != null && line.daysOfCover < 3);
}

/** A policy's version in words: "v3 (current)" or "v2 (superseded)". */
export function policyVersionLabel(policy: Pick<LogisticsPolicyDto, 'version' | 'isCurrent'>): string {
    return `v${policy.version} (${policy.isCurrent ? 'current' : 'superseded'})`;
}

/** What a policy is for, in words ("Town: Phoenix", "Warehouse: North", "Template: Crops, Village (default)"). */
export function policyScopeLabel(policy: Pick<LogisticsPolicyDto, 'scope' | 'town' | 'townId' | 'warehouse' | 'warehouseId' | 'specialization' | 'townSize' | 'isDefaultTemplate'>): string {
    if (policy.scope === 'Town') return `Town: ${policy.town?.name ?? `#${policy.townId}`}`;
    if (policy.scope === 'Warehouse') return `Warehouse: ${policy.warehouse?.name ?? `#${policy.warehouseId}`}`;
    const parts = [policy.specialization || 'General', policy.townSize || 'any size'];
    return `Template: ${parts.join(', ')}${policy.isDefaultTemplate ? ' (default)' : ''}`;
}

// ---------------------------------------------------------------- the rule editor

/** A new rule of a type, with the fields that type needs at their defaults. */
export function newRule(type: string, policyScope: string | null | undefined): LogisticsRuleDto {
    const base: LogisticsRuleDto = { sequence: 0, type, scope: 'Town', targetKind: 'Any', consumerKind: 'Any' };
    switch (type) {
        case 'Reserve':
            return { ...base, scope: policyScope === 'Warehouse' ? 'Warehouse' : 'Town', targetKind: 'Blueprint', units: 0 };
        case 'PriorityClass':
            return { ...base, consumerKind: 'Structure', priorityClass: 'High' };
        case 'ServiceArea':
            return { ...base, targetKind: null, consumerKind: null, areaKind: 'District' };
        case 'Replenishment':
            return { ...base, consumerKind: 'Structure', targetKind: 'Blueprint', reorderPoint: 0, targetLevel: 1 };
        default:
            return base;
    }
}

const blank = (value: unknown) => value == null || (typeof value === 'number' && Number.isNaN(value));

/**
 * The rule as the API takes it: only the fields its type uses (a stale field from another type, target or consumer
 * kind would be refused or misread), numbered from 1 in list order. Read-only fields (`summary`, refs) are left out.
 */
export function toRuleRequest(rule: LogisticsRuleDto, sequence: number, policyScope: string | null | undefined): LogisticsRuleDto {
    const type = rule.type ?? '';
    const out: LogisticsRuleDto = {
        sequence,
        type,
        activeFrom: rule.activeFrom || null,
        activeUntil: rule.activeUntil || null,
        reason: rule.reason?.trim() || null,
    };
    if (type !== 'ServiceArea') {
        out.targetKind = rule.targetKind ?? 'Any';
        if (out.targetKind === 'Blueprint') out.itemBlueprintId = rule.itemBlueprintId ?? null;
        if (out.targetKind === 'Category') out.categoryId = rule.categoryId ?? null;
        if (out.targetKind === 'Tag') out.tagId = rule.tagId ?? null;
    }
    if (type === 'PriorityClass' || type === 'Replenishment') {
        out.consumerKind = rule.consumerKind ?? 'Any';
        if (out.consumerKind === 'Structure') out.structureId = rule.structureId ?? null;
        if (out.consumerKind === 'ProductionKind') out.productionKindId = rule.productionKindId ?? null;
    }
    switch (type) {
        case 'Reserve': {
            const scope = policyScope === 'Warehouse' ? 'Warehouse' : (rule.scope ?? 'Town');
            out.scope = scope;
            if (scope === 'Warehouse' && policyScope !== 'Warehouse') out.warehouseId = rule.warehouseId ?? null;
            if (!blank(rule.daysOfCover)) out.daysOfCover = rule.daysOfCover;
            else out.units = blank(rule.units) ? null : rule.units;
            break;
        }
        case 'PriorityClass':
            out.priorityClass = rule.priorityClass ?? null;
            break;
        case 'ServiceArea':
            out.areaKind = rule.areaKind ?? null;
            if (out.areaKind === 'District') out.districtId = rule.districtId ?? null;
            if (out.areaKind === 'Structure') out.structureId = rule.structureId ?? null;
            if (policyScope !== 'Warehouse') out.warehouseId = rule.warehouseId ?? null;
            break;
        case 'Replenishment':
            out.reorderPoint = blank(rule.reorderPoint) ? null : rule.reorderPoint;
            out.targetLevel = blank(rule.targetLevel) ? null : rule.targetLevel;
            break;
    }
    return out;
}

/**
 * What the API would refuse in a rule list, "Rule n: ..." each, checked before a save so staff see every problem at
 * once. The API checks again (and checks that ids exist and belong to the town).
 */
export function ruleListErrors(rules: LogisticsRuleDto[], policyScope: string | null | undefined): string[] {
    const errors: string[] = [];
    rules.forEach((raw, index) => {
        const at = `Rule ${index + 1}: `;
        const rule = toRuleRequest(raw, index + 1, policyScope);
        if (policyScope === 'Warehouse' && rule.type !== 'Reserve' && rule.type !== 'ServiceArea') {
            errors.push(`${at}a warehouse policy holds local reserves and service areas only.`);
        }
        if (policyScope === 'Template') {
            if (rule.type === 'ServiceArea' || rule.scope === 'Warehouse') errors.push(`${at}a template is for any town: no warehouse rules or service areas.`);
            if (rule.consumerKind === 'Structure') errors.push(`${at}a template is for any town: pick a production kind, not a structure.`);
        }
        if (rule.type !== 'ServiceArea') {
            if (rule.targetKind === 'Blueprint' && rule.itemBlueprintId == null) errors.push(`${at}pick the blueprint.`);
            if (rule.targetKind === 'Category' && rule.categoryId == null) errors.push(`${at}pick the category.`);
            if (rule.targetKind === 'Tag' && rule.tagId == null) errors.push(`${at}pick the tag.`);
        }
        if ((rule.type === 'PriorityClass' || rule.type === 'Replenishment') && policyScope !== 'Template') {
            if (rule.consumerKind === 'Structure' && rule.structureId == null) errors.push(`${at}pick the consumer structure.`);
        }
        if ((rule.type === 'PriorityClass' || rule.type === 'Replenishment') && rule.consumerKind === 'ProductionKind' && rule.productionKindId == null) {
            errors.push(`${at}pick the production kind.`);
        }
        switch (rule.type) {
            case 'Reserve':
                if (rule.units == null && rule.daysOfCover == null) errors.push(`${at}a reserve has units or days of cover.`);
                if (rule.units != null && (rule.units < 0 || !Number.isInteger(rule.units))) errors.push(`${at}units must be a whole number, 0 or more.`);
                if (rule.daysOfCover != null && rule.daysOfCover <= 0) errors.push(`${at}days of cover must be above 0.`);
                if (rule.scope === 'Warehouse' && policyScope !== 'Warehouse' && rule.warehouseId == null) errors.push(`${at}pick the warehouse of the local reserve.`);
                break;
            case 'PriorityClass':
                if (!rule.priorityClass) errors.push(`${at}pick the priority class.`);
                break;
            case 'ServiceArea':
                if (!rule.areaKind) errors.push(`${at}pick the area.`);
                if (rule.areaKind === 'District' && rule.districtId == null) errors.push(`${at}pick the district.`);
                if (rule.areaKind === 'Structure' && rule.structureId == null) errors.push(`${at}pick the structure.`);
                if (policyScope !== 'Warehouse' && rule.warehouseId == null) errors.push(`${at}pick the warehouse that serves it.`);
                break;
            case 'Replenishment':
                if (rule.reorderPoint == null || rule.targetLevel == null || rule.reorderPoint < 0 || rule.targetLevel <= 0) {
                    errors.push(`${at}min (0 or more) and max (above 0) are required.`);
                } else if (rule.reorderPoint > rule.targetLevel) {
                    errors.push(`${at}the min is above the max.`);
                }
                break;
            default:
                errors.push(`${at}pick the rule type.`);
        }
        if (rule.activeFrom && rule.activeUntil && new Date(rule.activeUntil) <= new Date(rule.activeFrom)) {
            errors.push(`${at}the end of the active window is before its start.`);
        }
    });
    return errors;
}

/**
 * The body of a save (`PUT api/LogisticsPolicies/{id}`): the whole rule list and the reason. A template's
 * specialization, size and default flag are sent every time, because the API takes them from the request.
 */
export function toPolicySave(policy: LogisticsPolicyDto, rules: LogisticsRuleDto[], reason: string): LogisticsPolicyUpdateDto {
    const body: LogisticsPolicyUpdateDto = {
        name: policy.name ?? null,
        reason: reason.trim() || null,
        rules: rules.map((rule, index) => toRuleRequest(rule, index + 1, policy.scope)),
    };
    if (policy.scope === 'Template') {
        body.specialization = policy.specialization || null;
        body.townSize = policy.townSize || null;
        body.isDefaultTemplate = policy.isDefaultTemplate ?? false;
    }
    return body;
}

/** A local `datetime-local` value from an API date (UTC), and back. Empty stays empty. */
export function toLocalInput(iso: string | null | undefined): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ---------------------------------------------------------------- consumer settings

/** The replenishment setting form on a consumer's page (PandiO/knk-workspace#686). */
export interface SettingForm {
    id: number | null;
    storageId: string;
    blueprint: { id: number; label: string } | null;
    reorderPoint: string;
    targetLevel: string;
    priorityClass: string;
    enabled: boolean;
    note: string;
}

export const emptySettingForm = (storageId: number | undefined): SettingForm => ({
    id: null, storageId: storageId != null ? String(storageId) : '', blueprint: null, reorderPoint: '', targetLevel: '', priorityClass: '', enabled: true, note: '',
});

/** What the API would refuse in a setting, one sentence each. */
export function settingFormErrors(form: SettingForm): string[] {
    const errors: string[] = [];
    if (!form.storageId) errors.push('Pick the storage.');
    if (!form.blueprint) errors.push('Pick the item.');
    const min = Number(form.reorderPoint);
    const max = Number(form.targetLevel);
    if (form.reorderPoint.trim() === '' || !Number.isInteger(min) || min < 0) errors.push('The min is a whole number, 0 or more.');
    if (form.targetLevel.trim() === '' || !Number.isInteger(max) || max <= 0) errors.push('The max is a whole number above 0.');
    if (Number.isInteger(min) && Number.isInteger(max) && min > max) errors.push('The min is above the max.');
    return errors;
}

// ---------------------------------------------------------------- settings

export const defaultLogisticsSettings = (): ProductionLogisticsSettingsDto => ({
    plannerIntervalMinutes: 10,
    reservationMinutes: 30,
    consumptionWindowDays: 7,
    defaultReorderHours: 4,
    defaultTargetHours: 12,
    runRetentionDays: 14,
});

/** The API's bounds for `production.logistics`: [min, max, whole numbers only]. */
export const LOGISTICS_SETTINGS_LIMITS: Record<keyof ProductionLogisticsSettingsDto, [number, number, boolean]> = {
    plannerIntervalMinutes: [1, 1440, true],
    reservationMinutes: [1, 10_080, true],
    consumptionWindowDays: [1, 90, true],
    defaultReorderHours: [0, 720, false],
    defaultTargetHours: [0.01, 720, false],
    runRetentionDays: [1, 365, true],
};

/** The logistics settings the API would refuse, one sentence each; empty when valid. */
export function logisticsSettingsErrors(settings: ProductionLogisticsSettingsDto): string[] {
    const errors: string[] = [];
    (Object.keys(LOGISTICS_SETTINGS_LIMITS) as (keyof ProductionLogisticsSettingsDto)[]).forEach(key => {
        const [min, max, whole] = LOGISTICS_SETTINGS_LIMITS[key];
        const value = settings[key];
        if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
            errors.push(`production.logistics.${key} must be ${whole ? 'a whole number' : 'a number'} between ${min} and ${max}.`);
        }
    });
    if (Number.isFinite(settings.defaultReorderHours) && Number.isFinite(settings.defaultTargetHours)
        && settings.defaultTargetHours < settings.defaultReorderHours) {
        errors.push('production.logistics.defaultReorderHours must be at most defaultTargetHours.');
    }
    return errors;
}

// ---------------------------------------------------------------- pages

export const LOGISTICS_PATH = '/admin/logistics';
