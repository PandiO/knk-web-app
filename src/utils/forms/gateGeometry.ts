type Coordinates = {
    x: number;
    y: number;
    z: number;
    world?: string;
};

const getProperty = (value: Record<string, unknown>, propertyName: string): unknown => {
    const matchingKey = Object.keys(value).find(key => key.toLowerCase() === propertyName.toLowerCase());
    return matchingKey ? value[matchingKey] : undefined;
};

const parseCoordinate = (value: unknown): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || value.trim() === '') return null;

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseLocation = (value: unknown): Coordinates | null => {
    let location = value;

    if (typeof location === 'string') {
        try {
            location = JSON.parse(location);
        } catch {
            return null;
        }
    }

    if (!location || typeof location !== 'object' || Array.isArray(location)) return null;

    const record = location as Record<string, unknown>;
    const x = parseCoordinate(getProperty(record, 'x'));
    const y = parseCoordinate(getProperty(record, 'y'));
    const z = parseCoordinate(getProperty(record, 'z'));
    const worldValue = getProperty(record, 'world');

    if (x === null || y === null || z === null) return null;

    return {
        x,
        y,
        z,
        world: typeof worldValue === 'string' ? worldValue : undefined
    };
};

const gcd = (a: number, b: number): number => {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const t = y;
        y = x % y;
        x = t;
    }
    return x;
};

const calculateInclusiveBlockSpan = (fromValue: unknown, toValue: unknown): number | null => {
    const from = parseLocation(fromValue);
    const to = parseLocation(toValue);

    if (!from || !to) return null;
    if (from.world && to.world && from.world.toLowerCase() !== to.world.toLowerCase()) return null;

    // Number of lattice hops between the two points, mirroring the plugin's
    // VectorMath.primitiveLatticeStep (gcd of the integer delta). Euclidean distance
    // overcounts a diagonal span by a factor of sqrt(2) - e.g. a (3,0,3) diagonal delta
    // is 3 hops apart (4 blocks inclusive), not sqrt(18) ~= 4.24 rounded to 4 (5 blocks),
    // which is what caused GateStructure 14's scan to swallow an extra, unrelated block.
    const dx = Math.round(to.x - from.x);
    const dy = Math.round(to.y - from.y);
    const dz = Math.round(to.z - from.z);

    const hops = gcd(gcd(dx, dy), dz);

    return hops + 1;
};

type Delta = { x: number; y: number; z: number };

const delta = (from: Coordinates, to: Coordinates): Delta => ({
    x: Math.round(to.x - from.x),
    y: Math.round(to.y - from.y),
    z: Math.round(to.z - from.z)
});

const dot = (a: Delta, b: Delta): number => a.x * b.x + a.y * b.y + a.z * b.z;

const isZero = (d: Delta): boolean => d.x === 0 && d.y === 0 && d.z === 0;

const sameWorld = (a: Coordinates, b: Coordinates): boolean =>
    !a.world || !b.world || a.world.toLowerCase() === b.world.toLowerCase();

const formatCoordinate = (value: number): string => String(Math.round(value * 100) / 100);

/**
 * KNG-132: the gate spec measures both reference points from the anchor - Reference point 1 along
 * the door's width (bottom edge), Reference point 2 along its height, straight above the anchor -
 * so anchor -> Ref 2 must be at right angles to anchor -> Ref 1. Otherwise the plugin's lattice
 * steps are sheared: the height comes out wrong (e.g. 2 for a 0,+7,-2 step), the block scan stores
 * the wrong blocks and the door jams. Returns the error for Reference point 2, or null when the
 * points are fine or not all set yet. A Ref 2 put above Ref 1 (the opposite corner) gets the point
 * it should have been.
 */
export const gateReferencePoint2Error = (
    entityName: string,
    stepData: Record<string, unknown>
): string | null => {
    if (entityName.toLowerCase() !== 'gatedoor') return null;

    const anchor = parseLocation(getProperty(stepData, 'AnchorPointId'));
    const ref1 = parseLocation(getProperty(stepData, 'ReferencePoint1Id'));
    const ref2 = parseLocation(getProperty(stepData, 'ReferencePoint2Id'));
    if (!anchor || !ref1 || !ref2 || !sameWorld(anchor, ref1) || !sameWorld(anchor, ref2)) return null;

    const width = delta(anchor, ref1);
    const height = delta(anchor, ref2);
    if (isZero(width) || isZero(height) || dot(width, height) === 0) return null;

    const rule = 'Reference point 2 must be straight above the anchor (the door\'s height), at right angles '
        + 'to the anchor -> reference point 1 edge (its width).';
    const ref1ToRef2 = delta(ref1, ref2);
    if (!isZero(ref1ToRef2) && dot(ref1ToRef2, width) === 0) {
        const x = formatCoordinate(anchor.x + ref1ToRef2.x);
        const y = formatCoordinate(anchor.y + ref1ToRef2.y);
        const z = formatCoordinate(anchor.z + ref1ToRef2.z);
        return `${rule} This one is above reference point 1; use (${x}, ${y}, ${z}) instead.`;
    }
    return `${rule} This one is not.`;
};

/** The geometry error a GateDoor field shows, if any (only Reference point 2 has one). */
export const gateGeometryFieldError = (
    entityName: string,
    fieldName: string,
    stepData: Record<string, unknown>
): string | null => fieldName.toLowerCase() === 'referencepoint2id'
    ? gateReferencePoint2Error(entityName, stepData)
    : null;

export const deriveGateGeometryStepData = (
    entityName: string,
    stepData: Record<string, unknown>
): Record<string, unknown> => {
    // Item 5 (docs/features/gate-structure-animation/GATESTRUCTURE_QOL_IMPLEMENTATION_PLAN.md)
    // moved AnchorPoint/ReferencePoint1/ReferencePoint2/GeometryWidth/GeometryHeight from
    // GateStructure onto GateDoor - this utility's entity check follows that move.
    if (entityName.toLowerCase() !== 'gatedoor') return stepData;

    const anchorPoint = getProperty(stepData, 'AnchorPointId');
    const referencePoint1 = getProperty(stepData, 'ReferencePoint1Id');
    const referencePoint2 = getProperty(stepData, 'ReferencePoint2Id');
    const width = calculateInclusiveBlockSpan(anchorPoint, referencePoint1);
    // KNG-132: no height from a sheared Reference point 2 - the form refuses it instead.
    const height = gateReferencePoint2Error(entityName, stepData)
        ? null
        : calculateInclusiveBlockSpan(anchorPoint, referencePoint2);

    if (width === null && height === null) return stepData;

    return {
        ...stepData,
        ...(width === null ? {} : { GeometryWidth: width }),
        ...(height === null ? {} : { GeometryHeight: height })
    };
};

export const isDerivedGateGeometryField = (
    entityName: string,
    fieldName: string,
    stepData: Record<string, unknown>
): boolean => {
    if (entityName.toLowerCase() !== 'gatedoor') return false;

    const anchorPoint = getProperty(stepData, 'AnchorPointId');
    if (fieldName === 'GeometryWidth') {
        return calculateInclusiveBlockSpan(anchorPoint, getProperty(stepData, 'ReferencePoint1Id')) !== null;
    }
    if (fieldName === 'GeometryHeight') {
        return !gateReferencePoint2Error(entityName, stepData)
            && calculateInclusiveBlockSpan(anchorPoint, getProperty(stepData, 'ReferencePoint2Id')) !== null;
    }

    return false;
};