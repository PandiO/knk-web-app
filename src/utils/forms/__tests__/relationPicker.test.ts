import { lookupFilterPlan, lookupFilterRefusal, lookupItemToValue, optionDetail, relationAccess } from '../relationPicker';

describe('relation picker access (#191 on the #280 model)', () => {
    const meta = { readNodes: ['knk.admin.world', 'knk.admin.config'], lookupSearchable: true };

    it('uses the full search when the metadata names no read node (an API before #280)', () => {
        expect(relationAccess(undefined, {})).toEqual({ mode: 'full' });
        expect(relationAccess({ readNodes: [] }, {})).toEqual({ mode: 'full' });
    });

    it('uses the full search with any one read node', () => {
        expect(relationAccess(meta, { 'knk.admin.world': 'denied', 'knk.admin.config': 'allowed' })).toEqual({ mode: 'full' });
    });

    it('waits while an answer is missing and none is allowed', () => {
        expect(relationAccess(meta, { 'knk.admin.world': 'denied' })).toEqual({ mode: 'checking' });
    });

    it('uses the lookup without a read node, or nothing when the type has no lookup', () => {
        const denied = { 'knk.admin.world': 'denied', 'knk.admin.config': 'error' } as const;
        expect(relationAccess(meta, denied)).toEqual({ mode: 'lookup', nodes: meta.readNodes });
        expect(relationAccess({ ...meta, lookupSearchable: false }, denied)).toEqual({ mode: 'none', nodes: meta.readNodes });
    });
});

describe('lookupFilterPlan (#288: the lookup applies the narrowing filters its type accepts)', () => {
    it('sends every filter with a value, prefer filters included, and keeps excludeIds for the page', () => {
        const plan = lookupFilterPlan({ preferTownId: '5', excludeIds: '3, 4', siegeScenarioId: ' 1 ', empty: '' });
        expect(Array.from(plan.excludeIds)).toEqual(['3', '4']);
        expect(plan.filters).toEqual({ preferTownId: '5', siegeScenarioId: '1' });
    });

    it('sends nothing without filters', () => {
        expect(lookupFilterPlan(undefined)).toEqual({ excludeIds: new Set(), filters: {} });
        expect(lookupFilterPlan({ ExcludeIds: '7' })).toEqual({ excludeIds: new Set(['7']), filters: {} });
    });
});

describe('lookupFilterRefusal', () => {
    const refusal = (status: number, response: unknown) => Object.assign(new Error('x'), { status, response });

    it('names the filters a lookup refused because its type does not take them', () => {
        expect(lookupFilterRefusal(refusal(400, { error: 'LookupFilterNotAllowed', filters: ['gateType', 'isOpened'] })))
            .toEqual(['gateType', 'isOpened']);
        expect(lookupFilterRefusal(refusal(400, { error: 'LookupFilterNotAllowed' }))).toEqual(['a filter']);
    });

    it('leaves every other answer to the normal error text', () => {
        expect(lookupFilterRefusal(refusal(400, { error: 'LookupFilterInvalid', filters: ['townId'] }))).toBeUndefined();
        expect(lookupFilterRefusal(refusal(400, { error: 'LookupNotAvailable' }))).toBeUndefined();
        expect(lookupFilterRefusal(refusal(403, { error: 'LookupFilterNotAllowed', filters: ['x'] }))).toBeUndefined();
        expect(lookupFilterRefusal(new Error('network'))).toBeUndefined();
        expect(lookupFilterRefusal(null)).toBeUndefined();
    });
});

describe('lookupItemToValue and optionDetail', () => {
    it('keeps a lookup row as a bare reference', () => {
        expect(lookupItemToValue({ id: 4, label: 'Castle Hill', detail: 'Cinix' })).toEqual({ id: 4, name: 'Castle Hill' });
    });

    it('shows the first two table columns that are not the label or the id', () => {
        const columns = [
            { key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'description', label: 'Description' },
            { key: 'townName', label: 'Town' }, { key: 'wgRegionId', label: 'Region' }, { key: 'houseNumber', label: 'No.' },
        ];
        const row = { id: 1, name: 'Smithy', description: '', townName: 'Cinix', wgRegionId: 's_smithy', houseNumber: 4 };
        expect(optionDetail(row, columns)).toBe('Town: Cinix · Region: s_smithy');
        expect(optionDetail({ id: 1, name: 'x' }, columns)).toBeUndefined();
    });
});
