import React from 'react';
import { Info, Loader2, RefreshCw, Route } from 'lucide-react';
import { roadClient } from '../../apiClients/roadClient';
import { StreetRoadDto, formatRoadFlags } from '../../types/dtos/road/RoadDtos';

interface Props {
    streetId?: string;
    label?: string;
    description?: string;
}

/**
 * Road navigation Phase 5 (docs/specs/navigation/DESIGN.md §3.7, §7): the Street form's read-only
 * road panel - GET api/Streets/{id}/road for the SAVED street: how many stretches carry its name,
 * their total length, and the stretches themselves. Labels are changed on the Roads page (or in
 * game); this panel only shows them. Registered as the `streetRoad` display panel. Plain anchors
 * rather than router Links, like SiegeReadinessPanel: FieldRenderers is imported by many test
 * suites without a react-router-dom mock (CRA's Jest resolver can't resolve its exports).
 */
export const StreetRoadPanel: React.FC<Props> = ({ streetId, label, description }) => {
    const [road, setRoad] = React.useState<StreetRoadDto | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const numericId = streetId ? Number(streetId) : NaN;
    const isSaved = Number.isFinite(numericId) && numericId > 0;

    const load = React.useCallback(async () => {
        if (!isSaved) return;
        setLoading(true);
        setError(null);
        try {
            setRoad(await roadClient.getStreetRoad(numericId));
        } catch (err: any) {
            setRoad(null);
            setError(err?.status === 404 ? 'This street does not exist (any more).' : (err?.message || 'Could not load the street’s road.'));
        } finally {
            setLoading(false);
        }
    }, [isSaved, numericId]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const header = (
        <div className="flex items-start justify-between gap-3">
            <div>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Route className="h-4 w-4 text-gray-500" />
                    {label || 'Road'}
                </h3>
                {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
            </div>
            {isSaved && (
                <button
                    type="button"
                    onClick={() => void load()}
                    disabled={loading}
                    className="btn-secondary whitespace-nowrap inline-flex items-center gap-1 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                </button>
            )}
        </div>
    );

    if (!isSaved) {
        return (
            <div className="space-y-3" data-testid="street-road-panel">
                {header}
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                        Submit to save the street first. Its road stretches appear here once the street exists - the
                        next build labels the stretches along its buildings, and the Roads page assigns the rest.
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3" data-testid="street-road-panel">
            {header}

            {loading && !road && (
                <div className="flex items-center text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
                </div>
            )}

            {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            {road && (
                <>
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 flex flex-wrap gap-6">
                        <span><span className="font-semibold">{road.edgeCount}</span> stretch{road.edgeCount === 1 ? '' : 'es'}</span>
                        <span><span className="font-semibold">{Math.round(road.totalLength).toLocaleString('en-US')}</span> blocks in total</span>
                        <span><span className="font-semibold">{road.nodes.length}</span> junctions and ends</span>
                    </div>

                    {road.edges.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            No road stretch carries this street yet. Build the area in game (<code className="text-xs bg-gray-100 px-1 rounded">/knk road build</code>)
                            or label stretches on the <a href="/admin/roads" className="text-primary hover:underline">Roads page</a>.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b border-gray-200 text-xs text-gray-600">
                                        <th className="py-1 pr-3">Stretch</th>
                                        <th className="py-1 pr-3">World</th>
                                        <th className="py-1 pr-3">From (x, y, z)</th>
                                        <th className="py-1 pr-3">To (x, y, z)</th>
                                        <th className="py-1 pr-3 text-right">Length</th>
                                        <th className="py-1 pr-3">Label</th>
                                        <th className="py-1 pr-3">Flags</th>
                                        <th className="py-1 pr-3">State</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {road.edges.map((edge) => {
                                        const start = edge.geometry[0];
                                        const end = edge.geometry[edge.geometry.length - 1];
                                        return (
                                            <tr key={edge.id} className="border-b border-gray-100">
                                                <td className="py-1 pr-3 text-gray-900">#{edge.id}</td>
                                                <td className="py-1 pr-3 text-gray-700">{edge.world}</td>
                                                <td className="py-1 pr-3 text-gray-700 font-mono text-xs">{start ? start.join(', ') : '-'}</td>
                                                <td className="py-1 pr-3 text-gray-700 font-mono text-xs">{end ? end.join(', ') : '-'}</td>
                                                <td className="py-1 pr-3 text-gray-700 text-right">{Math.round(edge.length).toLocaleString('en-US')}</td>
                                                <td className="py-1 pr-3 text-gray-700">{edge.streetSource}</td>
                                                <td className="py-1 pr-3 text-gray-700">{formatRoadFlags(edge.flags)}</td>
                                                <td className="py-1 pr-3 text-gray-500 text-xs">{edge.source}{edge.status === 'Stale' ? ' · stale' : ''}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <p className="text-xs text-gray-500">
                        Renaming this street renames it on every stretch - navigation picks the new name up within a
                        minute. To move a stretch to another street, use the <a href="/admin/roads" className="text-primary hover:underline">Roads page</a>.
                    </p>
                </>
            )}
        </div>
    );
};
