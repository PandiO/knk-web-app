import React from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ListFilter } from 'lucide-react';
import { RoadTileDto } from '../../../types/dtos/road/RoadDtos';

// docs/specs/navigation/DESIGN.md §3.3 / §7.1 F - the tile overview of a world: what was built
// when, which tiles are dirty (road blocks changed since the build; `/knk road build dirty`
// rebuilds them) and the build warnings (cell cap, suspected leaks, coverage gaps, street label
// conflicts). Tiles are 512 x 512 blocks; the coordinates shown are tile coordinates.

const formatBuilt = (iso?: string | null): string => {
  if (!iso) return 'never';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) || date.getFullYear() < 2000 ? 'never' : date.toLocaleString();
};

export const RoadTilesCard: React.FC<{
  tiles: RoadTileDto[];
  /** Show this tile's stretches in the edge table. */
  onShowEdges?: (tileId: number) => void;
}> = ({ tiles, onShowEdges }) => {
  const [dirtyOnly, setDirtyOnly] = React.useState(false);
  const [warningsOnly, setWarningsOnly] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sorted = [...tiles].sort((a, b) => a.tileX - b.tileX || a.tileZ - b.tileZ);
  const shown = sorted.filter((t) => (!dirtyOnly || t.dirty) && (!warningsOnly || t.warnings.length > 0));
  const dirtyCount = tiles.filter((t) => t.dirty).length;
  const warningCount = tiles.filter((t) => t.warnings.length > 0).length;

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Tiles</h2>
          <p className="mt-1 text-sm text-gray-500">
            512-block tiles built by <code className="text-xs bg-gray-100 px-1 rounded">/knk road build</code>. A dirty tile had road
            blocks changed since its build; routing keeps using it until <code className="text-xs bg-gray-100 px-1 rounded">/knk road build dirty</code>.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-700">
          <ListFilter className="h-4 w-4 text-gray-400" />
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={dirtyOnly} aria-label="Dirty tiles only" onChange={(e) => setDirtyOnly(e.target.checked)} />
            Dirty only ({dirtyCount})
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={warningsOnly} aria-label="Tiles with warnings only" onChange={(e) => setWarningsOnly(e.target.checked)} />
            With warnings only ({warningCount})
          </label>
        </div>
      </div>

      {tiles.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No tiles built in this world yet.</p>
      ) : shown.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No tile matches the filters.</p>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="py-2 pr-4">Tile</th>
                <th className="py-2 pr-4" title="The ETag of the tile's graph download; +1 per build">Version</th>
                <th className="py-2 pr-4">Built</th>
                <th className="py-2 pr-4">Builder</th>
                <th className="py-2 pr-4">State</th>
                <th className="py-2 pr-4 text-right">Cells</th>
                <th className="py-2 pr-4 text-right">Nodes</th>
                <th className="py-2 pr-4 text-right">Edges</th>
                <th className="py-2 pr-4 text-right" title="Most road cells stacked in one column (tunnels, bridges)">Levels</th>
                <th className="py-2 pr-4">Warnings</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {shown.map((tile) => {
                const label = `${tile.tileX}, ${tile.tileZ}`;
                const open = expanded.has(tile.id);
                return (
                  <React.Fragment key={tile.id}>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium text-gray-900 whitespace-nowrap" title={`Blocks ${tile.tileX * 512}..${tile.tileX * 512 + 511} / ${tile.tileZ * 512}..${tile.tileZ * 512 + 511} (tile id ${tile.id})`}>
                        {label}
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{tile.version}</td>
                      <td className="py-2 pr-4 text-gray-500 text-xs whitespace-nowrap">{formatBuilt(tile.builtAt)}</td>
                      <td className="py-2 pr-4 text-gray-500 text-xs">v{tile.builderVersion}</td>
                      <td className="py-2 pr-4">
                        {tile.dirty ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Dirty</span>
                        ) : tile.builtAt ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Built</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Not built</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 text-right">{tile.cellCount.toLocaleString('en-US')}</td>
                      <td className="py-2 pr-4 text-gray-700 text-right">{tile.nodeCount.toLocaleString('en-US')}</td>
                      <td className="py-2 pr-4 text-gray-700 text-right">{tile.edgeCount.toLocaleString('en-US')}</td>
                      <td className="py-2 pr-4 text-gray-700 text-right">{tile.levelCount}</td>
                      <td className="py-2 pr-4">
                        {tile.warnings.length === 0 ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 text-xs font-medium"
                            aria-expanded={open}
                            aria-label={`${open ? 'Hide' : 'Show'} warnings of tile ${label}`}
                            onClick={() => toggle(tile.id)}
                          >
                            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {tile.warnings.length}
                          </button>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right whitespace-nowrap">
                        {onShowEdges && tile.edgeCount > 0 && (
                          <button type="button" className="text-xs text-gray-500 hover:text-gray-900" onClick={() => onShowEdges(tile.id)} aria-label={`Show edges of tile ${label}`}>
                            Edges
                          </button>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b border-gray-100 bg-amber-50/40">
                        <td colSpan={11} className="py-2 px-4">
                          <ul className="space-y-1 text-xs text-amber-900 list-disc pl-4">
                            {tile.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
