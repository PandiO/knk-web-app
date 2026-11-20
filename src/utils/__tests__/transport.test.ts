import {
    canCancelOrder,
    defaultTransportSettings,
    formatDistance,
    newOrderPath,
    orderFormErrors,
    ordersPath,
    readOrderFilters,
    shortLines,
    timelineOf,
    toOrderRequest,
    transportEventLabel,
    transportSettingsErrors,
    transportStatusIsProblem,
    transportStatusLabel,
} from '../transport';

/** Transport core P5 helpers (PandiO/knk-workspace#682). */
describe('transport helpers', () => {
    it('names statuses, events and distance sources in words', () => {
        expect(transportStatusLabel('InTransit')).toBe('On the road');
        expect(transportStatusLabel('AwaitingSpace')).toBe('Waiting for room');
        expect(transportStatusLabel('Something')).toBe('Something');
        expect(transportEventLabel('ArrivedAtStop')).toBe('Arrived at a stop');
        expect(formatDistance(431.7, 'Lane')).toBe('431.7 blocks (measured lane)');
        expect(formatDistance(420, 'Estimated')).toBe('420 blocks (estimated (straight line × factor))');
        expect(formatDistance(null, 'Lane')).toBe('-');
        expect(transportStatusIsProblem('ReturnBlocked')).toBe(true);
        expect(transportStatusIsProblem('InTransit')).toBe(false);
    });

    it('offers Cancel only while the API would accept it (not final, not returning)', () => {
        expect(canCancelOrder({ status: 'Planned', isFinal: false })).toBe(true);
        expect(canCancelOrder({ status: 'InTransit', isFinal: false })).toBe(true);
        expect(canCancelOrder({ status: 'Returning', isFinal: false })).toBe(false);
        expect(canCancelOrder({ status: 'Delivered', isFinal: true })).toBe(false);
    });

    it('orders the timeline by time, then id', () => {
        const events = [
            { id: 3, at: '2026-11-20T10:05:00Z' },
            { id: 2, at: '2026-11-20T10:00:00Z' },
            { id: 1, at: '2026-11-20T10:00:00Z' },
        ];
        expect(timelineOf(events).map(e => e.id)).toEqual([1, 2, 3]);
        expect(timelineOf(null)).toEqual([]);
    });

    it('builds the manual order request and checks it before the dry run', () => {
        const form = { sourceStorageId: 3, carrierStructureId: null, origin: 'Manual' as const, executeAfter: '', note: ' ' };
        const request = toOrderRequest(form, [{ storageId: 4, lines: [{ blueprintId: 5, amount: '10' }] }], 'key-1');
        expect(request).toEqual({
            sourceStorageId: 3, carrierStructureId: null, origin: 'Manual', executeAfter: null, note: null, clientKey: 'key-1',
            stops: [{ storageId: 4, lines: [{ itemBlueprintId: 5, amount: 10 }] }],
        });
        expect(orderFormErrors(request)).toEqual([]);

        const bad = toOrderRequest({ ...form, sourceStorageId: null }, [
            { storageId: 4, lines: [{ blueprintId: null, amount: '1.5' }] },
            { storageId: 4, lines: [] },
        ]);
        expect(orderFormErrors(bad)).toEqual([
            'Pick the source storage.',
            'Stop 1, item 1: pick the blueprint.',
            'Stop 1, item 1: the amount is a whole number of at least 1.',
            'Stop 2: add at least one item.',
            'Each storage can be a stop once.',
        ]);
        expect(orderFormErrors(toOrderRequest(form, [{ storageId: 3, lines: [{ blueprintId: 5, amount: '1' }] }])))
            .toEqual(["Stop 1: the source storage can't be a stop."]);
        expect(orderFormErrors(toOrderRequest(form, []))).toEqual(['Add at least one stop.']);
    });

    it('lists the lines the source cannot cover', () => {
        expect(shortLines({
            lines: [
                { itemBlueprintId: 5, itemBlueprintName: 'Cobblestone', requested: 64, available: 40 },
                { itemBlueprintId: 6, itemBlueprintName: 'Coal', requested: 4, available: 4 },
            ],
        })).toEqual([{ name: 'Cobblestone', requested: 64, available: 40 }]);
    });

    it('checks the transport settings against the API\'s bounds', () => {
        expect(transportSettingsErrors(defaultTransportSettings())).toEqual([]);
        expect(transportSettingsErrors({ ...defaultTransportSettings(), walkingSpeedBlocksPerSecond: 0, maxReroutes: 1.5 })).toEqual([
            'production.transport.walkingSpeedBlocksPerSecond must be a number between 0.1 and 50.',
            'production.transport.maxReroutes must be a whole number between 0 and 10.',
        ]);
    });

    it('builds and reads the order list and manual order links', () => {
        expect(ordersPath()).toBe('/admin/transport/orders');
        expect(ordersPath({ structureId: '821', status: ' ' })).toBe('/admin/transport/orders?structureId=821');
        expect(newOrderPath(12, 821)).toBe('/admin/transport/orders/new?sourceStorageId=12&carrierStructureId=821');
        expect(readOrderFilters(new URLSearchParams('open=true&foo=1&storageId=4'))).toEqual({ open: 'true', storageId: '4' });
    });
});
