import { EntityReferencesDto } from '../../types/dtos/forms/FormModels';

/** The reference a form configuration's saved drafts show up as in its entity references. */
export const SAVED_DRAFTS_REFERENCE = 'FormSubmissionProgress.FormConfigurationId';

/** How many saved drafts (FormSubmissionProgress rows) use the configuration; 0 when unknown. */
export function savedDraftCount(references: EntityReferencesDto | null | undefined): number {
    const entry = references?.references?.find(r => r.referencedBy === SAVED_DRAFTS_REFERENCE);
    return entry && entry.count > 0 ? entry.count : 0;
}

/**
 * KNG-172: the delete confirm of a form configuration says what goes with it - its saved drafts
 * are deleted too. Without drafts (or when they couldn't be counted) it is the plain question.
 */
export function formConfigDeleteMessage(configurationName: string, draftCount: number): string {
    const question = `Are you sure you want to delete "${configurationName}"?`;
    if (draftCount <= 0) return question;
    const drafts = draftCount === 1 ? 'Its 1 saved draft is' : `Its ${draftCount} saved drafts are`;
    return `${question} ${drafts} deleted too.`;
}
