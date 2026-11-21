import {
    defaultLogisticsSettings,
    emptySettingForm,
    formatDaysOfCover,
    logisticsSettingsErrors,
    newRule,
    planOutcomeLabel,
    planOutcomeTone,
    policyScopeLabel,
    policyVersionLabel,
    ruleListErrors,
    settingFormErrors,
    supplyLineIsLow,
    toPolicySave,
    toRuleRequest,
} from '../logistics';
import { defaultProductionSettings, normalizeProductionSettings } from '../territory';
import type { LogisticsPolicyDto, LogisticsRuleDto } from '../../types/dtos/production/LogisticsDtos';

/** Town logistics P9b (PandiO/knk-workspace#686; TOWN_LOGISTICS § 3-5): the pure helpers of the logistics screens. */
describe('logistics helpers', () => {
    it('says the plan outcomes in words and sorts them into got it, partly, held and not needed', () => {
        expect(planOutcomeLabel('HeldByReserve')).toBe('Held by a reserve');
        expect(planOutcomeLabel('Mystery')).toBe('Mystery');
        expect(planOutcomeLabel(null)).toBe('-');
        expect(planOutcomeTone('Reserved')).toBe('ok');
        expect(planOutcomeTone('AlreadyReserved')).toBe('ok');
        expect(planOutcomeTone('PartlyReserved')).toBe('partial');
        expect(planOutcomeTone('NotNeeded')).toBe('neutral');
        expect(planOutcomeTone('NoStock')).toBe('held');
        expect(planOutcomeTone('NoWorker')).toBe('held');
    });

    it('formats days of cover, flags low supply and labels policies', () => {
        expect(formatDaysOfCover(null)).toBe('No outflow');
        expect(formatDaysOfCover(10)).toBe('10 days');
        expect(formatDaysOfCover(2.25)).toBe('2.3 days');
        expect(supplyLineIsLow({ available: 0, daysOfCover: 30 })).toBe(true);
        expect(supplyLineIsLow({ available: 10, daysOfCover: 2.5 })).toBe(true);
        expect(supplyLineIsLow({ available: 10, daysOfCover: null })).toBe(false);
        expect(policyVersionLabel({ version: 2, isCurrent: false })).toBe('v2 (superseded)');
        expect(policyScopeLabel({ scope: 'Town', townId: 4, town: { id: 4, name: 'Phoenix' } })).toBe('Town: Phoenix');
        expect(policyScopeLabel({ scope: 'Template', specialization: 'Crops', townSize: 'Village', isDefaultTemplate: true }))
            .toBe('Template: Crops, Village (default)');
        expect(policyScopeLabel({ scope: 'Template' })).toBe('Template: General, any size');
    });

    it('sends only the fields a rule type uses, numbered in list order', () => {
        const stale: LogisticsRuleDto = {
            ...newRule('Reserve', 'Town'), id: 9, summary: 'Keep 70 Coal', itemBlueprintId: 6, itemBlueprint: { id: 6, name: 'Coal' },
            units: 70, structureId: 21, priorityClass: 'High', areaKind: 'District', districtId: 8, reason: '  Keep some back ',
        };
        expect(toRuleRequest(stale, 1, 'Town')).toEqual({
            sequence: 1, type: 'Reserve', scope: 'Town', targetKind: 'Blueprint', itemBlueprintId: 6, units: 70,
            activeFrom: null, activeUntil: null, reason: 'Keep some back',
        });
        const area = { ...newRule('ServiceArea', 'Town'), districtId: 8, warehouseId: 52, itemBlueprintId: 6 };
        expect(toRuleRequest(area, 2, 'Town')).toEqual({
            sequence: 2, type: 'ServiceArea', areaKind: 'District', districtId: 8, warehouseId: 52, activeFrom: null, activeUntil: null, reason: null,
        });
        const days = { ...newRule('Reserve', 'Town'), itemBlueprintId: 7, units: null, daysOfCover: 14 };
        expect(toRuleRequest(days, 1, 'Town')).toMatchObject({ daysOfCover: 14 });
        expect(toRuleRequest(days, 1, 'Town')).not.toHaveProperty('units');
        // A warehouse policy's reserve is local to its own warehouse; the API fills the warehouse in.
        expect(toRuleRequest({ ...newRule('Reserve', 'Warehouse'), itemBlueprintId: 6, units: 90, warehouseId: 51 }, 1, 'Warehouse'))
            .toMatchObject({ scope: 'Warehouse', units: 90 });
        expect(toRuleRequest({ ...newRule('Reserve', 'Warehouse'), itemBlueprintId: 6, units: 90, warehouseId: 51 }, 1, 'Warehouse')).not.toHaveProperty('warehouseId');
        expect(toRuleRequest({ ...newRule('PriorityClass', 'Town'), structureId: 22 }, 3, 'Town')).toMatchObject({
            consumerKind: 'Structure', structureId: 22, priorityClass: 'High', targetKind: 'Any',
        });
    });

    it('lists every rule problem the API would refuse, rule by rule', () => {
        expect(ruleListErrors([newRule('Reserve', 'Town')], 'Town')).toEqual(['Rule 1: pick the blueprint.']);
        expect(ruleListErrors([
            { ...newRule('Reserve', 'Town'), itemBlueprintId: 6, units: null },
            { ...newRule('ServiceArea', 'Town') },
            { ...newRule('Replenishment', 'Town'), structureId: 21, itemBlueprintId: 6, reorderPoint: 9, targetLevel: 5 },
            { ...newRule('PriorityClass', 'Town'), structureId: 21, priorityClass: null },
            { ...newRule('Reserve', 'Town'), scope: 'Warehouse', itemBlueprintId: 6, units: 5 },
        ], 'Town')).toEqual([
            'Rule 1: a reserve has units or days of cover.',
            'Rule 2: pick the district.',
            'Rule 2: pick the warehouse that serves it.',
            'Rule 3: the min is above the max.',
            'Rule 4: pick the priority class.',
            'Rule 5: pick the warehouse of the local reserve.',
        ]);
        expect(ruleListErrors([{ ...newRule('PriorityClass', 'Warehouse'), structureId: 1 }], 'Warehouse'))
            .toContain('Rule 1: a warehouse policy holds local reserves and service areas only.');
        expect(ruleListErrors([{ ...newRule('ServiceArea', 'Template'), districtId: 1 }], 'Template'))
            .toContain('Rule 1: a template is for any town: no warehouse rules or service areas.');
        expect(ruleListErrors([{ ...newRule('Reserve', 'Town'), itemBlueprintId: 6, units: 1, activeFrom: '2026-11-22T10:00:00Z', activeUntil: '2026-11-21T10:00:00Z' }], 'Town'))
            .toEqual(['Rule 1: the end of the active window is before its start.']);
        expect(ruleListErrors([{ ...newRule('Reserve', 'Town'), itemBlueprintId: 6, units: 70 }], 'Town')).toEqual([]);
    });

    it('a save sends the whole rule list and a template its labels every time', () => {
        const template: LogisticsPolicyDto = {
            id: 40, name: 'Farming village', scope: 'Template', specialization: 'Crops', townSize: 'Village', isDefaultTemplate: true,
            version: 1, lineageId: 40, isCurrent: true, createdAt: '2026-11-21T10:00:00Z',
        };
        expect(toPolicySave(template, [{ ...newRule('Reserve', 'Template'), itemBlueprintId: 6, units: 80 }], ' More bread ')).toEqual({
            name: 'Farming village', reason: 'More bread', specialization: 'Crops', townSize: 'Village', isDefaultTemplate: true,
            rules: [{ sequence: 1, type: 'Reserve', scope: 'Town', targetKind: 'Blueprint', itemBlueprintId: 6, units: 80, activeFrom: null, activeUntil: null, reason: null }],
        });
        const town = { ...template, scope: 'Town', townId: 4, specialization: null, townSize: null, isDefaultTemplate: false };
        expect(toPolicySave(town, [], '')).toEqual({ name: 'Farming village', reason: null, rules: [] });
    });

    it('checks a replenishment setting before it is saved', () => {
        expect(settingFormErrors(emptySettingForm(undefined))).toEqual([
            'Pick the storage.', 'Pick the item.', 'The min is a whole number, 0 or more.', 'The max is a whole number above 0.',
        ]);
        const form = { ...emptySettingForm(91), blueprint: { id: 6, label: 'Coal' }, reorderPoint: '9', targetLevel: '5' };
        expect(settingFormErrors(form)).toEqual(['The min is above the max.']);
        expect(settingFormErrors({ ...form, reorderPoint: '20', targetLevel: '60' })).toEqual([]);
    });

    it('checks the logistics settings like the API and keeps them in the production section', () => {
        expect(logisticsSettingsErrors(defaultLogisticsSettings())).toEqual([]);
        expect(logisticsSettingsErrors({ ...defaultLogisticsSettings(), plannerIntervalMinutes: 0 }))
            .toEqual(['production.logistics.plannerIntervalMinutes must be a whole number between 1 and 1440.']);
        expect(logisticsSettingsErrors({ ...defaultLogisticsSettings(), defaultReorderHours: 20, defaultTargetHours: 10 }))
            .toEqual(['production.logistics.defaultReorderHours must be at most defaultTargetHours.']);
        expect(defaultProductionSettings().logistics).toEqual(defaultLogisticsSettings());
        expect(normalizeProductionSettings({ enabled: true }).logistics).toEqual(defaultLogisticsSettings());
        expect(normalizeProductionSettings({ logistics: { ...defaultLogisticsSettings(), plannerIntervalMinutes: 15 } }).logistics?.plannerIntervalMinutes).toBe(15);
    });
});
