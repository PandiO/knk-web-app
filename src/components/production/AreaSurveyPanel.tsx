import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScanSearch } from 'lucide-react';
import { areaSurveyClient } from '../../apiClients/areaSurveyClient';
import type { AreaSurveyDto } from '../../types/dtos/production/ProductionYieldDtos';
import { formatDateTime } from '../../utils/format';
import { productionRefusalReason } from '../../utils/productionEngine';
import { displayPath } from '../../utils/returnTo';
import { SurveyCompositionTable } from './SurveyCompositionTable';

interface Props {
    surveyId: number;
    returnTo: string | null;
    refreshKey?: number;
}

/** One survey (PandiO/knk-workspace#680; PRODUCTION_KINDS § 3.2): what the game server counted, largest first. */
export const AreaSurveyPanel: React.FC<Props> = ({ surveyId, returnTo, refreshKey }) => {
    const [survey, setSurvey] = useState<AreaSurveyDto | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            setSurvey(await areaSurveyClient.getById(surveyId));
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the survey.");
        }
    }, [surveyId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="area-survey-heading" data-testid="area-survey">
            <h2 id="area-survey-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <ScanSearch className="mr-2 h-5 w-5" aria-hidden="true" />
                Composition
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !survey && <p className="text-sm text-muted">Loading the survey…</p>}
            {survey && (
                <>
                    <p className="mb-3 text-sm text-muted">
                        <Link className="link" to={displayPath('ProductionArea', survey.productionAreaId, returnTo)}>{survey.productionArea?.name ?? `Area #${survey.productionAreaId}`}</Link>
                        {`, surveyed ${formatDateTime(survey.surveyedAt)} (${survey.trigger ?? 'Scheduled'}, profile v${survey.profileVersion ?? 0}): ${survey.totalUnits} units.`}
                        {survey.note ? ` ${survey.note}` : ''}
                    </p>
                    <SurveyCompositionTable units={survey.units} totalUnits={survey.totalUnits} />
                </>
            )}
        </section>
    );
};

export default AreaSurveyPanel;
