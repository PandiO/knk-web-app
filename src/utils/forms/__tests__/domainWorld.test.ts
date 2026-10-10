import { buildDomainWorldResolveRequest, isDomainEntityType } from '../domainWorld';

// KNG-111: the form sends the API what it knows about a domain's world before saving it.
describe('domainWorld', () => {
    it('recognises every domain type, in any case', () => {
        ['Town', 'district', 'Structure', 'GateStructure', 'Domain'].forEach(type =>
            expect(isDomainEntityType(type)).toBe(true));
        ['Location', 'GateDoor', '', undefined, null].forEach(type =>
            expect(isDomainEntityType(type as string)).toBe(false));
    });

    it('takes the region, an embedded location world and the district parent', () => {
        const request = buildDomainWorldResolveRequest('GateStructure', {
            WgRegionId: 'tempregion_worldtask_42',
            location: { id: 0, world: ' hub ' },
            districtId: '7',
            worldName: ''
        });

        expect(request).toEqual({
            entityType: 'GateStructure',
            id: null,
            worldName: null,
            wgRegionId: 'tempregion_worldtask_42',
            locationId: null,
            locationWorld: 'hub',
            townId: null,
            districtId: 7
        });
    });

    it('uses the edited id and a saved location reference', () => {
        const request = buildDomainWorldResolveRequest('District', { townId: 3, locationId: 12, worldName: 'gameplay' }, '5');

        expect(request.id).toBe(5);
        expect(request.townId).toBe(3);
        expect(request.locationId).toBe(12);
        expect(request.worldName).toBe('gameplay');
    });
});
