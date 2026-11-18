import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Landmark as LandmarkIcon, Plus } from 'lucide-react';
import { landmarkClient } from '../../apiClients/landmarkClient';
import { LandmarkListDto } from '../../types/dtos/landmark/LandmarkDtos';
import { useAllNodesGate } from '../../hooks/useActionGate';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { displayPath, newFormPath } from '../../utils/returnTo';
import { landmarkAreaLabel, landmarkPointLabel } from '../../utils/landmarks';

/** The node that creates and edits landmarks (knk-web-api StaffPermissions.LandmarkManage, PandiO/knk-workspace#708). */
export const LANDMARK_WRITE_NODE = 'knk.admin.world.landmark';
const ADD_NODES = [LANDMARK_WRITE_NODE, 'knk.admin.content'];

/** The detail pages that show the panel: every domain type (a landmark links to any domain, DESIGN § 6.1). */
export const LANDMARK_DOMAIN_TYPES = ['town', 'district', 'structure', 'gatestructure', 'domain'];

export function showsDomainLandmarks(entityTypeName: string | null | undefined): boolean {
    return LANDMARK_DOMAIN_TYPES.includes((entityTypeName ?? '').toLowerCase());
}

interface Props {
    domainId: number;
    domainName: string;
    /** This page, so a landmark's page and the new-landmark form come back here. */
    returnTo: string | null;
}

/**
 * The landmarks linked to a domain, on the domain's detail page (off-road navigation phase 5.1,
 * PandiO/knk-workspace#708, DESIGN § 6.4.3): name (to the landmark's page), area, point and whether /navigate offers it.
 * "Add landmark" opens the landmark form (the domain is picked there); it needs knk.admin.world.landmark and
 * knk.admin.content, like the dashboard's Create.
 */
export const DomainLandmarksPanel: React.FC<Props> = ({ domainId, domainName, returnTo }) => {
    const navigate = useNavigate();
    const addGate = useAllNodesGate(ADD_NODES);
    const [rows, setRows] = useState<LandmarkListDto[] | null>(null);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setRows(null);
        setError(null);
        landmarkClient.getByDomain(domainId)
            .then(result => {
                if (cancelled) return;
                setRows(result?.items ?? []);
                setTotal(result?.totalCount ?? 0);
            })
            .catch(err => {
                if (!cancelled) setError(apiRefusalReason(err) ?? "Couldn't load the landmarks.");
            });
        return () => { cancelled = true; };
    }, [domainId]);

    const more = useMemo(() => (rows ? Math.max(0, total - rows.length) : 0), [rows, total]);

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="domain-landmarks-heading" data-testid="domain-landmarks">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 id="domain-landmarks-heading" className="flex items-center text-lg font-semibold text-fg">
                    <LandmarkIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                    Landmarks
                </h2>
                <button
                    type="button"
                    className="btn-secondary inline-flex items-center text-sm"
                    disabled={!addGate.allowed}
                    title={addGate.hint ?? undefined}
                    onClick={() => navigate(newFormPath('Landmark', returnTo))}
                >
                    <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                    Add landmark
                </button>
            </div>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && rows === null && <p className="text-sm text-muted">Loading landmarks…</p>}
            {!error && rows !== null && rows.length === 0 && (
                <p className="text-sm text-muted">No landmarks are linked to {domainName}.</p>
            )}
            {!error && rows !== null && rows.length > 0 && (
                <ul className="divide-y divide-line rounded-md border border-line" aria-label="Landmarks">
                    {rows.map(row => (
                        <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
                            <Link to={displayPath('Landmark', row.id, returnTo)} className="font-medium text-primary hover:underline">
                                {row.name}
                            </Link>
                            <span className="text-muted">
                                {landmarkAreaLabel(row)} · {landmarkPointLabel(row)}
                                {row.world ? ` · ${row.world}` : ''}
                                {row.navigationEnabled ? '' : ' · not in /navigate'}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {more > 0 && <p className="mt-2 text-xs text-muted">And {more} more; the dashboard lists them all.</p>}
        </section>
    );
};

export default DomainLandmarksPanel;
