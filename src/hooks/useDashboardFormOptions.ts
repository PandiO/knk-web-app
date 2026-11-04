import { useEffect, useState } from 'react';
import { formConfigClient } from '../apiClients/formConfigClient';
import { formSubmissionClient } from '../apiClients/formSubmissionClient';
import { FormConfigurationDto, FormSubmissionProgressSummaryDto } from '../types/dtos/forms/FormModels';
import { FormSubmissionStatus } from '../utils/enums';

export type DashboardFormOptions = {
    /** Form configurations other than the default (the "New with" menu), A-Z. */
    otherConfigs: FormConfigurationDto[];
    /** The caller's open drafts of this type (the "Drafts (n)" chip), newest first. */
    drafts: FormSubmissionProgressSummaryDto[];
};

const EMPTY: DashboardFormOptions = { otherConfigs: [], drafts: [] };

/** Drafts that can be resumed: this type, not Completed or Abandoned. */
export const openDraftsOf = (
    progress: FormSubmissionProgressSummaryDto[],
    entityTypeName: string
): FormSubmissionProgressSummaryDto[] =>
    progress
        .filter(item => (item.entityTypeName ?? '').toLowerCase() === entityTypeName.toLowerCase())
        .filter(item => item.status !== FormSubmissionStatus.Completed && item.status !== FormSubmissionStatus.Abandoned)
        .sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''));

/**
 * Every configuration but the default, A-Z. Without a default (New then goes to the Entity setup
 * page, #177 decision 3) that is all of them.
 */
export const otherConfigsOf = (configs: FormConfigurationDto[]): FormConfigurationDto[] =>
    configs
        .filter(config => !config.isDefault && config.id)
        .sort((a, b) => (a.configurationName ?? '').localeCompare(b.configurationName ?? '', undefined, { sensitivity: 'base' }));

/**
 * #177 follow-up: what the dashboard header offers next to "New {Type}": the type's other form
 * configurations and the caller's open drafts (the Entity setup page's "Saved Progress", #186: the
 * caller's own). Both are extras: a failed request just leaves them out (beyond the API client's
 * usual failure toast); the Entity setup page still has both.
 */
export function useDashboardFormOptions(entityTypeName: string | null | undefined): DashboardFormOptions {
    const [options, setOptions] = useState<DashboardFormOptions>(EMPTY);

    useEffect(() => {
        setOptions(EMPTY);
        if (!entityTypeName) return undefined;
        let cancelled = false;

        formConfigClient.getByEntityTypeName(entityTypeName, false)
            .then(result => {
                if (cancelled) return;
                const configs = Array.isArray(result) ? result : result ? [result] : [];
                setOptions(previous => ({ ...previous, otherConfigs: otherConfigsOf(configs) }));
            })
            .catch(error => {
                if (!cancelled) console.error('Failed to load form configurations for the dashboard', error);
            });

        formSubmissionClient.getByEntityTypeName(entityTypeName, true)
            .then(result => {
                if (cancelled) return;
                const drafts = openDraftsOf((result ?? []) as FormSubmissionProgressSummaryDto[], entityTypeName);
                setOptions(previous => ({ ...previous, drafts }));
            })
            .catch(error => {
                if (!cancelled) console.error('Failed to load saved progress for the dashboard', error);
            });

        return () => {
            cancelled = true;
        };
    }, [entityTypeName]);

    return options;
}
