/**
 * "Show details" of a refused delete (PandiO/knk-workspace#44). A DELETE the database refuses because the row is still
 * used answers 409 `{ code: "DbConstraint", message, references: [{ referencedBy, count }] }` (knk-web-api
 * `DeleteConstraintExceptionFilter`); the rows behind those counts come from `GET api/EntityReferences/{type}/{id}/rows`,
 * fetched only when the admin asks.
 */
import { EntityReferenceGroupDto } from '../apiClients/entityReferenceClient';
import { entityTypeFallbackLabel } from './entityLabel';

/** True for the API's "still in use" refusal of a delete, the one with rows behind it. */
export function isReferenceRefusal(error: unknown): boolean {
    const e = error as { status?: number; response?: unknown } | null;
    if (e?.status !== 409) return false;
    const body = e.response as { code?: unknown } | null | undefined;
    return !!body && typeof body === 'object' && body.code === 'DbConstraint';
}

/** The names the API's refusal message uses for references whose type alone says little (`FriendlyReferences`). */
const FRIENDLY: Record<string, [string, string]> = {
    'FormField.SubConfigurationId': ['form field that opens it as a sub-form', 'form fields that open it as a sub-form'],
    'FormStep.SubConfigurationId': ['form step that uses it as a sub-form', 'form steps that use it as a sub-form'],
    'WorkflowSession.FormConfigurationId': ['form session started with it', 'form sessions started with it'],
    'FormSubmissionProgress.FormConfigurationId': ['saved draft', 'saved drafts'],
    'FormSubmissionProgress.ParentProgressId': ['draft of a sub-form opened from it', 'drafts of sub-forms opened from it'],
};

const plural = (words: string): string => {
    if (/[^aeiou]y$/.test(words)) return `${words.slice(0, -1)}ies`;
    if (/(s|x|ch|sh)$/.test(words)) return `${words}es`;
    return `${words}s`;
};

/**
 * What a group is called, as the refusal message says it: "structure" / "structures", or a friendly name.
 * `typeLabel` gives the metadata's display name ("Gate Structure"); it is lower-cased like the message.
 */
export function referenceNoun(group: Pick<EntityReferenceGroupDto, 'referencedBy' | 'entityType'>, count: number,
                              typeLabel?: (entityType: string) => string): string {
    const friendly = FRIENDLY[group.referencedBy];
    if (friendly) return count === 1 ? friendly[0] : friendly[1];
    const typeName = group.entityType || group.referencedBy.split(/[. ]/, 1)[0];
    const words = (typeLabel ? typeLabel(typeName) : entityTypeFallbackLabel(typeName)).toLowerCase();
    return count === 1 ? words : plural(words);
}
