export type ProjectionSourceContext = 'changedField' | 'form' | 'constant';
export type ProjectionOverwritePolicy = 'always' | 'if-empty' | 'never' | 'if-auto';
export type ProjectionTransform =
    | 'none'
    | 'toString'
    | 'toInt'
    | 'toNumber'
    | 'toBoolean'
    | 'trim'
    | 'lowercase'
    | 'uppercase';

export interface ValueProjectionMapping {
    source: string;
    target: string;
    sourceContext?: ProjectionSourceContext;
    constantValue?: unknown;
    overwritePolicy?: ProjectionOverwritePolicy;
    clearOnNull?: boolean;
    transform?: ProjectionTransform;
}

export interface ValueProjectionConfig {
    enabled?: boolean;
    defaultOverwritePolicy?: ProjectionOverwritePolicy;
    clearOnNull?: boolean;
    mappings: ValueProjectionMapping[];
}

export const PROJECTION_OVERWRITE_POLICIES: ProjectionOverwritePolicy[] = ['always', 'if-empty', 'never', 'if-auto'];
export const PROJECTION_TRANSFORMS: ProjectionTransform[] = ['none', 'toString', 'toInt', 'toNumber', 'toBoolean', 'trim', 'lowercase', 'uppercase'];

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseValueProjection = (settingsJson?: string): ValueProjectionConfig | null => {
    if (!settingsJson) return null;
    try {
        const parsed = JSON.parse(settingsJson) as Record<string, unknown>;
        const projection = parsed?.valueProjection;
        if (!projection || typeof projection !== 'object') return null;

        const projectionObj = projection as Record<string, unknown>;
        const mappingsRaw = Array.isArray(projectionObj.mappings) ? projectionObj.mappings : [];
        const mappings: ValueProjectionMapping[] = mappingsRaw
            .filter(isObject)
            .map((mapping) => ({
                source: String(mapping.source ?? '').trim(),
                target: String(mapping.target ?? '').trim(),
                sourceContext: (mapping.sourceContext as ProjectionSourceContext) || undefined,
                constantValue: mapping.constantValue,
                overwritePolicy: (mapping.overwritePolicy as ProjectionOverwritePolicy) || undefined,
                clearOnNull: typeof mapping.clearOnNull === 'boolean' ? mapping.clearOnNull : undefined,
                transform: (mapping.transform as ProjectionTransform) || undefined
            }))
            .filter((mapping) => mapping.source.length > 0 && mapping.target.length > 0);

        return {
            enabled: typeof projectionObj.enabled === 'boolean' ? projectionObj.enabled : undefined,
            defaultOverwritePolicy: (projectionObj.defaultOverwritePolicy as ProjectionOverwritePolicy) || undefined,
            clearOnNull: typeof projectionObj.clearOnNull === 'boolean' ? projectionObj.clearOnNull : undefined,
            mappings
        };
    } catch {
        return null;
    }
};

export const mergeValueProjectionIntoSettings = (
    settingsJson: string | undefined,
    projection: ValueProjectionConfig | null
): string => {
    let base: Record<string, unknown> = {};
    try {
        base = settingsJson ? JSON.parse(settingsJson) : {};
    } catch {
        base = {};
    }

    if (!projection || !projection.enabled || projection.mappings.length === 0) {
        delete base.valueProjection;
        return JSON.stringify(base);
    }

    base.valueProjection = {
        enabled: true,
        defaultOverwritePolicy: projection.defaultOverwritePolicy,
        clearOnNull: projection.clearOnNull,
        mappings: projection.mappings
    };

    return JSON.stringify(base);
};

export const isEffectivelyEmpty = (value: unknown): boolean =>
    value === null || value === undefined || value === '';

const toPathSegments = (path: string): string[] =>
    path
        .replace(/^\$value\./i, '')
        .replace(/^\$form\./i, '')
        .split('.')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

const readCaseInsensitive = (obj: Record<string, unknown>, key: string): unknown => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
        return obj[key];
    }

    const foundKey = Object.keys(obj).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (!foundKey) return undefined;
    return obj[foundKey];
};

export const getValueByPath = (source: unknown, path: string): unknown => {
    if (!path || source === null || source === undefined) return undefined;

    const normalizedPath = path.trim();
    if (!normalizedPath) return undefined;

    const segments = toPathSegments(normalizedPath);
    if (segments.length === 0) return source;

    let current: unknown = source;
    for (const segment of segments) {
        if (Array.isArray(current)) {
            const index = Number(segment);
            if (!Number.isInteger(index)) return undefined;
            current = current[index];
            continue;
        }

        if (!isObject(current)) return undefined;
        current = readCaseInsensitive(current, segment);
    }

    return current;
};

export const applyProjectionTransform = (value: unknown, transform?: ProjectionTransform): unknown => {
    if (!transform || transform === 'none') return value;

    switch (transform) {
        case 'toString':
            return value === null || value === undefined ? '' : String(value);
        case 'toInt': {
            const num = Number(value);
            return Number.isFinite(num) ? Math.trunc(num) : value;
        }
        case 'toNumber': {
            const num = Number(value);
            return Number.isFinite(num) ? num : value;
        }
        case 'toBoolean':
            if (typeof value === 'string') {
                const normalized = value.trim().toLowerCase();
                if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
                if (['false', '0', 'no', 'n', ''].includes(normalized)) return false;
            }
            return Boolean(value);
        case 'trim':
            return typeof value === 'string' ? value.trim() : value;
        case 'lowercase':
            return typeof value === 'string' ? value.toLowerCase() : value;
        case 'uppercase':
            return typeof value === 'string' ? value.toUpperCase() : value;
        default:
            return value;
    }
};

export const extractProjectionEdges = (fields: Array<{ fieldName: string; settingsJson?: string }>): Array<{ from: string; to: string }> => {
    const edges: Array<{ from: string; to: string }> = [];

    fields.forEach((field) => {
        const projection = parseValueProjection(field.settingsJson);
        if (!projection?.enabled) return;

        projection.mappings.forEach((mapping) => {
            if (!mapping.target || !field.fieldName) return;
            edges.push({ from: field.fieldName.trim(), to: mapping.target.trim() });
        });
    });

    return edges;
};

export const detectProjectionCycles = (fields: Array<{ fieldName: string; settingsJson?: string }>): string[] => {
    const edges = extractProjectionEdges(fields);
    const adjacency = new Map<string, string[]>();

    edges.forEach(({ from, to }) => {
        if (!adjacency.has(from)) adjacency.set(from, []);
        adjacency.get(from)!.push(to);
    });

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const path: string[] = [];
    const cycles = new Set<string>();

    const dfs = (node: string) => {
        if (visiting.has(node)) {
            const cycleStart = path.indexOf(node);
            const cyclePath = cycleStart >= 0 ? [...path.slice(cycleStart), node] : [node, node];
            cycles.add(cyclePath.join(' -> '));
            return;
        }

        if (visited.has(node)) return;

        visiting.add(node);
        path.push(node);

        const neighbors = adjacency.get(node) || [];
        neighbors.forEach((neighbor) => dfs(neighbor));

        path.pop();
        visiting.delete(node);
        visited.add(node);
    };

    Array.from(adjacency.keys()).forEach((node) => dfs(node));

    return Array.from(cycles);
};
