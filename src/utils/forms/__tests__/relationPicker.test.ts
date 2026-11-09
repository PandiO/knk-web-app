import { lookupFilterPlan, lookupItemToValue, optionDetail, relationAccess } from '../relationPicker';

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

describe('lookupFilterPlan', () => {
    it('drops prefer filters, applies excludeIds itself and names every filter that would narrow the list', () => {
        const plan = lookupFilterPlan({ preferTownId: '5', excludeIds: '3, 4', siegeScenarioId: '1', empty: '' });
        expect(Array.from(plan.excludeIds)).toEqual(['3', '4']);
        expect(plan.unsupported).toEqual(['siegeScenarioId']);
        expect(lookupFilterPlan(undefined)).toEqual({ excludeIds: new Set(), unsupported: [] });
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
