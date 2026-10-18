/**
 * KNG-166: the values a relationship picker shows to tell rows apart (a street's districts, a
 * structure's town, ...). A picker shows two row shapes side by side:
 *  - search rows: the API's list DTO (`POST api/<Resource>/search`), with flat names such as
 *    `townName`, `districtName`, `districtNames`;
 *  - pinned rows (KNG-136, "Created in this form"): the full read DTO a child form's save returned,
 *    with nested objects such as `town: { id, name }` or `districts: [{ name, town: { name } }]`.
 * Each accessor reads the flat list field first and falls back to the nested read DTO shape, so a
 * column shows the same value for both. Property names are matched case-insensitively.
 */

type Row = Record<string, unknown> | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function prop(row: unknown, name: string): unknown {
    if (!isRecord(row)) {
        return undefined;
    }
    if (Object.prototype.hasOwnProperty.call(row, name)) {
        return row[name];
    }
    const lower = name.toLowerCase();
    const key = Object.keys(row).find(candidate => candidate.toLowerCase() === lower);
    return key === undefined ? undefined : row[key];
}

function text(value: unknown): string | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
}

function nameOf(value: unknown): string | undefined {
    return text(prop(value, 'name'));
}

function townNameOf(value: unknown): string | undefined {
    return text(prop(value, 'townName')) ?? nameOf(prop(value, 'town'));
}

/**
 * ", "-joined, distinct (exact match), sorted A-Z ignoring case - the same as the API's list DTOs
 * (`JoinNames` in knk-web-api Mapping). Undefined when there are none.
 */
export function joinNames(names: Array<string | undefined>): string | undefined {
    const distinct = Array.from(new Set(names.map(text).filter((name): name is string => name !== undefined)));
    if (distinct.length === 0) {
        return undefined;
    }
    distinct.sort((a, b) => {
        const left = a.toUpperCase();
        const right = b.toUpperCase();
        return left < right ? -1 : left > right ? 1 : 0;
    });
    return distinct.join(', ');
}

function districtsOf(row: Row): unknown[] {
    const districts = prop(row, 'districts');
    return Array.isArray(districts) ? districts : [];
}

/** District, Structure, GateStructure, SiegeScenario: `townName`, or the nested town's name. */
export function pickerTownName(row: Row): string | undefined {
    return townNameOf(row) ?? townNameOf(prop(row, 'district'));
}

/** Structure, GateStructure: `districtName`, or the nested district's name. */
export function pickerDistrictName(row: Row): string | undefined {
    return text(prop(row, 'districtName')) ?? nameOf(prop(row, 'district'));
}

/** Structure, GateStructure: `streetName`, or the nested street's name. */
export function pickerStreetName(row: Row): string | undefined {
    return text(prop(row, 'streetName')) ?? nameOf(prop(row, 'street'));
}

/** Structure, GateStructure: "Main Street 12" (the street, then the house number when set). */
export function pickerStreetAddress(row: Row): string | undefined {
    const street = pickerStreetName(row);
    const houseNumberValue = prop(row, 'houseNumber');
    // An unset house number is 0 in the list DTO.
    const houseNumber = typeof houseNumberValue === 'number'
        ? (houseNumberValue > 0 ? String(houseNumberValue) : undefined)
        : text(houseNumberValue);
    if (street && houseNumber) {
        return `${street} ${houseNumber}`;
    }
    return street ?? houseNumber;
}

/** Street: `districtNames`, or the names of the nested districts. */
export function pickerDistrictNames(row: Row): string | undefined {
    return text(prop(row, 'districtNames')) ?? joinNames(districtsOf(row).map(nameOf));
}

/** Street: `townNames`, or the towns of the nested districts. */
export function pickerTownNames(row: Row): string | undefined {
    return text(prop(row, 'townNames')) ?? joinNames(districtsOf(row).map(townNameOf));
}

/** Domains (town, district, structure, ...): the Minecraft world (KNG-111). */
export function pickerWorldName(row: Row): string | undefined {
    return text(prop(row, 'worldName'));
}
