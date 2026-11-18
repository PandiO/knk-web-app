import { LandmarkListDto } from '../types/dtos/landmark/LandmarkDtos';

/**
 * Display helpers for landmarks (off-road navigation phase 5.1, PandiO/knk-workspace#708): the dashboard columns and
 * the domain pages' landmark list show the same words.
 */

/** "Point", "Region" or "Radius 12 blocks" (the region id is on the detail page). */
export function landmarkAreaLabel(row: Pick<LandmarkListDto, 'extentKind'> & { radius?: number | null }): string {
    switch (row.extentKind) {
        case 'Region':
            return 'Region';
        case 'Radius':
            return row.radius != null ? `Radius ${formatNumber(row.radius)} blocks` : 'Radius';
        default:
            return 'Point';
    }
}

/** "x y z" rounded to whole blocks, or a dash without a pin. */
export function landmarkPointLabel(row: Pick<LandmarkListDto, 'x' | 'y' | 'z'>): string {
    if (row.x == null || row.y == null || row.z == null) return '—';
    return `${Math.round(row.x)} ${Math.round(row.y)} ${Math.round(row.z)}`;
}

/** The domain with its type, "Keep (Structure)", or a dash. */
export function landmarkDomainLabel(row: Pick<LandmarkListDto, 'domainName' | 'domainType'>): string {
    if (!row.domainName) return '—';
    return row.domainType ? `${row.domainName} (${row.domainType})` : row.domainName;
}

function formatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
