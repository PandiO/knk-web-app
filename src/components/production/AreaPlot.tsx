import React from 'react';
import type { ProductionAreaDto, ProductionAreaOverlapDto } from '../../types/dtos/production/ProductionYieldDtos';
import { Footprint, footprintOf, plotBox } from '../../utils/productionYield';

interface Props {
    area: ProductionAreaDto;
    overlaps: ProductionAreaOverlapDto[];
}

const SIZE = 320;

function shapeOf(f: Footprint, key: string, className: string, title: string) {
    if (f.kind === 'circle') {
        return <circle key={key} cx={f.cx + 0.5} cy={f.cz + 0.5} r={f.r + 0.5} className={className}><title>{title}</title></circle>;
    }
    if (f.kind === 'polygon') {
        return <polygon key={key} points={f.points.map(p => `${p.x},${p.z}`).join(' ')} className={className}><title>{title}</title></polygon>;
    }
    return (
        <rect key={key} x={f.minX} y={f.minZ} width={f.maxX - f.minX + 1} height={f.maxZ - f.minZ + 1} className={className}>
            <title>{title}</title>
        </rect>
    );
}

/**
 * The area seen from above (PandiO/knk-workspace#680; PRODUCTION_KINDS § 3.1, § 3.4): its footprint (cuboid, region
 * box, polygon or radius) with the other areas whose bounding box overlaps it, north up. The overlaps are listed in the
 * table beside it too, so the plot is not the only way to read them.
 */
export const AreaPlot: React.FC<Props> = ({ area, overlaps }) => {
    const own = footprintOf(area);
    const others = overlaps.map(o => ({ overlap: o, footprint: footprintOf(o) })).filter(o => o.footprint) as { overlap: ProductionAreaOverlapDto; footprint: Footprint }[];
    const box = plotBox([...(own ? [own] : []), ...others.map(o => o.footprint)]);
    if (!own || !box) return <p className="text-sm text-muted">The area has no stored bounds to draw yet.</p>;
    const stroke = Math.max(box.width, box.height) / SIZE * 2;
    return (
        <figure className="max-w-sm" data-testid="area-plot">
            <svg viewBox={`${box.minX} ${box.minZ} ${box.width} ${box.height}`} width="100%" height={SIZE}
                preserveAspectRatio="xMidYMid meet" role="img"
                aria-label={`Plot of ${area.name ?? 'the area'} from above with ${others.length} overlapping ${others.length === 1 ? 'area' : 'areas'}`}
                className="rounded border border-line bg-surface-alt" style={{ strokeWidth: stroke }}>
                {others.map(({ overlap, footprint }) => shapeOf(footprint, `o-${overlap.productionAreaId}`,
                    'fill-current text-muted stroke-current [fill-opacity:0.12] [stroke-dasharray:4_2]',
                    `${overlap.name} (${overlap.productionStructureName}, ${overlap.exclusive ? 'exclusive' : 'shared'})`))}
                {shapeOf(own, 'own', 'fill-current text-primary stroke-current [fill-opacity:0.25]', `${area.name ?? 'This area'} (${area.shape})`)}
            </svg>
            <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-primary bg-primary/25" aria-hidden="true" />This area</span>
                {others.length > 0 && (
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-dashed border-fg" aria-hidden="true" />Overlapping areas</span>
                )}
                <span>x {box.minX} to {box.minX + box.width}, z {box.minZ} to {box.minZ + box.height} (north up)</span>
            </figcaption>
        </figure>
    );
};

export default AreaPlot;
