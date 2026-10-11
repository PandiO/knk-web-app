import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HeatmapCellDto, HeatmapDto } from '../../types/dtos/analytics/WorldAnalyticsDtos';

/**
 * Movement heatmap on a plain <canvas> (KNG-34 link 7, DESIGN.md D10; no chart dependency). North
 * (negative z) is up, east (positive x) to the right, like the in-game map. Colour is log-scaled so a
 * busy spawn doesn't wash out everything else. Hovering a cell shows its block range and samples.
 */

export interface HeatmapLayout {
  minX: number;
  minZ: number;
  cols: number;
  rows: number;
  /** Pixels per cell. */
  scale: number;
  width: number;
  height: number;
}

/** Fits the cells' bounding box into maxWidth × maxHeight pixels (at least 1 px per cell). */
export function heatmapLayout(cells: HeatmapCellDto[], maxWidth: number, maxHeight: number): HeatmapLayout | null {
  if (cells.length === 0) return null;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.z < minZ) minZ = c.z;
    if (c.z > maxZ) maxZ = c.z;
  }
  const cols = maxX - minX + 1;
  const rows = maxZ - minZ + 1;
  const scale = Math.max(1, Math.min(32, Math.floor(Math.min(maxWidth / cols, maxHeight / rows))));
  return { minX, minZ, cols, rows, scale, width: cols * scale, height: rows * scale };
}

/** 0 → cool blue, 1 → hot red, on a log scale of samples / max. */
export function heatColor(samples: number, max: number): string {
  if (max <= 0 || samples <= 0) return 'rgba(0,0,0,0)';
  const t = Math.min(1, Math.log1p(samples) / Math.log1p(max));
  const hue = Math.round(240 - 240 * t);
  const alpha = (0.35 + 0.65 * t).toFixed(2);
  return `hsla(${hue}, 90%, 50%, ${alpha})`;
}

interface Props {
  heatmap: HeatmapDto;
  maxWidth?: number;
  maxHeight?: number;
}

export const HeatmapCanvas: React.FC<Props> = ({ heatmap, maxWidth = 720, maxHeight = 480 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layout = useMemo(() => heatmapLayout(heatmap.cells, maxWidth, maxHeight), [heatmap.cells, maxWidth, maxHeight]);
  const byCell = useMemo(() => new Map(heatmap.cells.map(c => [`${c.x},${c.z}`, c.samples])), [heatmap.cells]);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;
    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return;
    ctx.clearRect(0, 0, layout.width, layout.height);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, layout.width, layout.height);
    for (const c of heatmap.cells) {
      ctx.fillStyle = heatColor(c.samples, heatmap.maxSamples);
      ctx.fillRect((c.x - layout.minX) * layout.scale, (c.z - layout.minZ) * layout.scale, layout.scale, layout.scale);
    }
  }, [heatmap, layout]);

  if (!layout) {
    return <p className="text-sm text-gray-500">No movement samples for {heatmap.world} in this range.</p>;
  }

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = layout.minX + Math.floor((e.clientX - rect.left) / layout.scale);
    const z = layout.minZ + Math.floor((e.clientY - rect.top) / layout.scale);
    const size = heatmap.cellSize;
    setHover(`x ${x * size}…${(x + 1) * size - 1}, z ${z * size}…${(z + 1) * size - 1}: ${byCell.get(`${x},${z}`) ?? 0} samples`);
  };

  return (
    <figure className="space-y-1">
      <canvas
        ref={canvasRef}
        width={layout.width}
        height={layout.height}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Movement heatmap of ${heatmap.world}: ${heatmap.cells.length} cells of ${heatmap.cellSize} blocks, busiest ${heatmap.maxSamples} samples`}
        className="rounded border border-gray-300 max-w-full"
      />
      <figcaption className="text-xs text-gray-500 min-h-[1rem]">
        {hover ?? `Blocks x ${layout.minX * heatmap.cellSize}…${(layout.minX + layout.cols) * heatmap.cellSize - 1}, `
          + `z ${layout.minZ * heatmap.cellSize}…${(layout.minZ + layout.rows) * heatmap.cellSize - 1} (north is up). Hover a cell for its count.`}
      </figcaption>
    </figure>
  );
};
