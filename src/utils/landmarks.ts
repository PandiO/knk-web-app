import { LandmarkAreaKind, LandmarkListDto } from '../types/dtos/landmark/LandmarkDtos';

/**
 * Display helpers for landmarks (off-road navigation phase 5.1, PandiO/knk-workspace#708; a domain subtype since
 * landmark-domain, #986): the dashboard columns and the domain pages' landmark list show the same words.
 */

/** The words of each area kind, as the landmark form names them (landmark-domain DESIGN § 4.1 item 1). */
export const LANDMARK_AREA_LABELS: Record<LandmarkAreaKind, string> = {
    None: 'Point',
    OwnRegion: 'Own region',
    LinkedDomain: "Linked domain's area",
};

/** "Point", "Own region" or "Linked domain's area"; an unknown value is shown as sent. */
export function landmarkAreaLabel(row: { areaKind?: LandmarkAreaKind | string | null }): string {
    if (!row.areaKind) return LANDMARK_AREA_LABELS.None;
    return LANDMARK_AREA_LABELS[row.areaKind as LandmarkAreaKind] ?? row.areaKind;
}

/** The landmark's own main region, or a dash (a point, or the parent's area). */
export function landmarkRegionLabel(row: Pick<LandmarkListDto, 'areaKind' | 'wgRegionId'>): string {
    return row.areaKind === 'OwnRegion' && row.wgRegionId ? row.wgRegionId : '—';
}

/** "x y z" rounded to whole blocks, or a dash without a pin. */
export function landmarkPointLabel(row: Pick<LandmarkListDto, 'x' | 'y' | 'z'>): string {
    if (row.x == null || row.y == null || row.z == null) return '—';
    return `${Math.round(row.x)} ${Math.round(row.y)} ${Math.round(row.z)}`;
}

/** The parent with its type, "Keep (Structure)", or a dash at top level. */
export function landmarkParentLabel(row: Pick<LandmarkListDto, 'parentDomainName' | 'parentDomainType'>): string {
    if (!row.parentDomainName) return '—';
    return row.parentDomainType
        ? `${row.parentDomainName} (${domainTypeLabel(row.parentDomainType)})`
        : row.parentDomainName;
}

/**
 * The words of a domain type in lists and pickers (landmark-domain LD20): the API's CLR type name, with
 * `GateStructure` as "Gate" and the production subtypes spelled out.
 */
export function domainTypeLabel(domainType: string | null | undefined): string {
    switch (domainType) {
        case null:
        case undefined:
        case '':
            return '—';
        case 'GateStructure':
            return 'Gate';
        case 'ProductionStructure':
            return 'Production structure';
        case 'CrownLand':
            return 'Crown land';
        default:
            return domainType;
    }
}

/**
 * The entity type a dashboard row opens as (landmark-domain DESIGN § 4.3, #986): a landmark in the domain list opens its
 * landmark page and the landmark form, because the generic domain form doesn't know its fields. Every other row, and
 * every other table, opens as the table's type.
 */
export function rowEntityType(tableType: string, row: { domainType?: unknown } | null | undefined): string {
    return tableType.toLowerCase() === 'domain' && row?.domainType === 'Landmark' ? 'Landmark' : tableType;
}
