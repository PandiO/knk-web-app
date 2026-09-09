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

export const deriveGateGeometryStepData = (
    entityName: string,
    stepData: Record<string, unknown>
): Record<string, unknown> => {
    if (entityName.toLowerCase() !== 'gatestructure') return stepData;

    const anchorPoint = getProperty(stepData, 'AnchorPointId');
    const referencePoint1 = getProperty(stepData, 'ReferencePoint1Id');
    const referencePoint2 = getProperty(stepData, 'ReferencePoint2Id');
    const width = calculateInclusiveBlockSpan(anchorPoint, referencePoint1);
    const height = calculateInclusiveBlockSpan(anchorPoint, referencePoint2);

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
    if (entityName.toLowerCase() !== 'gatestructure') return false;

    const anchorPoint = getProperty(stepData, 'AnchorPointId');
    if (fieldName === 'GeometryWidth') {
        return calculateInclusiveBlockSpan(anchorPoint, getProperty(stepData, 'ReferencePoint1Id')) !== null;
    }
    if (fieldName === 'GeometryHeight') {
        return calculateInclusiveBlockSpan(anchorPoint, getProperty(stepData, 'ReferencePoint2Id')) !== null;
    }

    return false;
};