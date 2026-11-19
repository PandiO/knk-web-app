import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Map as MapIcon } from 'lucide-react';
import { productionAreaClient } from '../../apiClients/productionAreaClient';
import { areaSurveyClient } from '../../apiClients/areaSurveyClient';
import { productionStructureClient } from '../../apiClients/productionStructureClient';
import { useActionGate } from '../../hooks/useActionGate';
import type {
    AreaSurveyDto,
    AreaSurveyListDto,
    AreaSurveyTrendDto,
    ProductionAreaDto,
    ProductionAreaOverlapDto,
} from '../../types/dtos/production/ProductionYieldDtos';
import { formatDateTime } from '../../utils/format';
import { PRODUCTION_WRITE_NODE, productionRefusalReason } from '../../utils/productionEngine';
import { areaOverCap, areaSizeLabel, sizeCapHint } from '../../utils/productionYield';
import { displayPath } from '../../utils/returnTo';
import { toast } from '../../utils/toast';
import { AreaPlot } from './AreaPlot';
import { SurveyCompositionTable } from './SurveyCompositionTable';
import { SurveyTrendTable } from './SurveyTrendTable';

interface Props {
    areaId: number;
    returnTo: string | null;
    onChanged?: () => void;
    refreshKey?: number;
}

/**
 * A production area (PandiO/knk-workspace#680; PRODUCTION_KINDS § 3, decisions G5, G6, G7): its size against the
 * level's cap, a plot from above with the areas that overlap it, the latest survey's composition, the trend over the
 * last 30 surveys, the survey history and "Survey this area". The area's own fields are edited with its seeded form.
 */
export const ProductionAreaPanel: React.FC<Props> = ({ areaId, returnTo, onChanged, refreshKey }) => {
    const gate = useActionGate(PRODUCTION_WRITE_NODE);
    const [area, setArea] = useState<ProductionAreaDto | null>(null);
    const [overlaps, setOverlaps] = useState<ProductionAreaOverlapDto[]>([]);
    const [latest, setLatest] = useState<AreaSurveyDto | null>(null);
    const [trend, setTrend] = useState<AreaSurveyTrendDto | null>(null);
    const [history, setHistory] = useState<AreaSurveyListDto[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        let dto: ProductionAreaDto;
        try {
            dto = await productionAreaClient.getById(areaId);
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the area.");
            return;
        }
        setArea(dto);
        const [overlapList, latestSurvey, trendDto, page] = await Promise.all([
            productionAreaClient.getOverlaps(areaId).catch(() => []),
            dto.lastSurveyId ? areaSurveyClient.getById(dto.lastSurveyId).catch(() => null) : Promise.resolve(null),
            areaSurveyClient.getTrend(areaId, 30).catch(() => null),
            areaSurveyClient.search({ pageNumber: 1, pageSize: 10, filters: { productionAreaId: String(areaId) } }).catch(() => null),
        ]);
        setOverlaps(overlapList ?? []);
        setLatest(latestSurvey);
        setTrend(trendDto);
        setHistory(page?.items ?? []);
    }, [areaId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    const surveyThis = async () => {
        if (!area?.productionStructureId) return;
        setBusy(true);
        setActionError(null);
        try {
            await productionStructureClient.requestSurvey(area.productionStructureId, { productionAreaId: area.id });
            toast.success('Survey requested: the game server surveys the area at its next poll.');
            await load();
            onChanged?.();
        } catch (err) {
            setActionError(productionRefusalReason(err) ?? 'The survey request was refused.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="production-area-heading" data-testid="production-area">
            <h2 id="production-area-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <MapIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                Area and surveys
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !area && <p className="text-sm text-muted">Loading the area…</p>}
            {area && (
                <>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-muted">Structure</dt>
                            <dd>{area.productionStructureId
                                ? <Link className="link" to={displayPath('ProductionStructure', area.productionStructureId, returnTo)}>{area.productionStructure?.name ?? `#${area.productionStructureId}`}</Link>
                                : '-'}</dd>
                        </div>
                        <div>
                            <dt className="text-muted">Model and shape</dt>
                            <dd>{area.model ?? '-'}, {area.shape}{area.wgRegionId ? ` (region ${area.wgRegionId})` : ''}</dd>
                        </div>
                        <div>
                            <dt className="text-muted">Size</dt>
                            <dd data-testid="area-size" className={areaOverCap(area) ? 'field-error' : ''}>
                                {areaSizeLabel(area)}{areaOverCap(area) ? ': over the level\'s cap' : ''}
                            </dd>
                            <dd className="text-xs text-muted">{sizeCapHint(area.maxSize, area.sizeUnit)}</dd>
                        </div>
                        <div>
                            <dt className="text-muted">Kind of area</dt>
                            <dd>{area.exclusive ? 'Exclusive: no other exclusive area of this model may overlap it' : 'Shared: overlapping units are split equally'}</dd>
                        </div>
                        <div>
                            <dt className="text-muted">Last survey</dt>
                            <dd>{area.lastSurveyedAt ? formatDateTime(area.lastSurveyedAt) : 'Never'}
                                {area.surveyRequestedAt && <span className="ml-2 text-muted">(survey requested {formatDateTime(area.surveyRequestedAt)})</span>}</dd>
                        </div>
                        <div>
                            <dt className="text-muted">Enabled</dt>
                            <dd>{area.enabled === false ? 'No: not surveyed and yields nothing' : 'Yes'}</dd>
                        </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className="btn-primary text-sm" disabled={!gate.allowed || busy || area.enabled === false}
                            title={gate.hint ?? undefined} onClick={() => void surveyThis()}>
                            Survey this area now
                        </button>
                    </div>
                    {actionError && <p className="mt-3 text-sm field-error" role="alert">{actionError}</p>}

                    <h3 className="mb-2 mt-5 text-base font-semibold text-fg">From above</h3>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <AreaPlot area={area} overlaps={overlaps} />
                        <div>
                            {overlaps.length === 0 && <p className="text-sm text-muted">No other area overlaps this one.</p>}
                            {overlaps.length > 0 && (
                                <table className="min-w-full text-sm" aria-label="Overlapping areas">
                                    <thead>
                                        <tr className="text-left text-muted">
                                            <th className="py-1 pr-3 font-medium">Area</th>
                                            <th className="py-1 pr-3 font-medium">Structure</th>
                                            <th className="py-1 pr-3 font-medium">Kind of area</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {overlaps.map(o => (
                                            <tr key={o.productionAreaId} className="border-t border-line">
                                                <td className="py-1 pr-3"><Link className="link" to={displayPath('ProductionArea', o.productionAreaId, returnTo)}>{o.name}</Link></td>
                                                <td className="py-1 pr-3">{o.productionStructureName}</td>
                                                <td className="py-1 pr-3">{o.exclusive ? 'Exclusive' : 'Shared'} ({o.model})</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    <h3 className="mb-2 mt-5 text-base font-semibold text-fg">Latest survey</h3>
                    {!latest && <p className="text-sm text-muted">No survey yet.</p>}
                    {latest && (
                        <>
                            <p className="mb-2 text-sm text-muted">
                                <Link className="link" to={displayPath('AreaSurvey', latest.id, returnTo)}>Survey #{latest.id}</Link>
                                {` on ${formatDateTime(latest.surveyedAt)} (${latest.trigger ?? 'Scheduled'}, profile v${latest.profileVersion ?? 0}), ${latest.totalUnits} units.`}
                            </p>
                            <SurveyCompositionTable units={latest.units} totalUnits={latest.totalUnits} />
                        </>
                    )}

                    <h3 className="mb-2 mt-5 text-base font-semibold text-fg">Trend</h3>
                    {trend ? <SurveyTrendTable trend={trend} /> : <p className="text-sm text-muted">No surveys yet.</p>}

                    <h3 className="mb-2 mt-5 text-base font-semibold text-fg">Survey history</h3>
                    {history.length === 0 && <p className="text-sm text-muted">No surveys yet.</p>}
                    {history.length > 0 && (
                        <ul className="space-y-1 text-sm" aria-label="Survey history">
                            {history.map(s => (
                                <li key={s.id}>
                                    <Link className="link" to={displayPath('AreaSurvey', s.id, returnTo)}>{formatDateTime(s.surveyedAt)}</Link>
                                    {`: ${s.trigger}, ${s.totalUnits} units, profile v${s.profileVersion}`}
                                </li>
                            ))}
                        </ul>
                    )}
                    {gate.hint && <p className="mt-3 text-xs text-muted">Survey requests: {gate.hint}.</p>}
                </>
            )}
        </section>
    );
};

export default ProductionAreaPanel;
