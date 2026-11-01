import { WorldTaskReadDto } from '../../types/dtos/workflow/WorkflowDtos';
import { worldTaskClient } from '../../apiClients/worldTaskClient';
import { workflowClient } from '../../apiClients/workflowClient';
import { formSubmissionClient } from '../../apiClients/formSubmissionClient';

/**
 * PandiO/knk-workspace#180 (DESIGN §8.2, §8.7): world-task states as the web app shows them, and the calls that keep a
 * form's tasks anchored to its draft.
 */

export const normalizeWorldTaskStatus = (status?: string | null): string => (status || '').toLowerCase();

/** Pending or InProgress: the task can still be claimed, completed or cancelled. */
export function isOpenWorldTask(task?: Pick<WorldTaskReadDto, 'status'> | null): boolean {
    const status = normalizeWorldTaskStatus(task?.status);
    return status === 'pending' || status === 'inprogress';
}

/** Completed, Failed, Cancelled or Expired: nothing will change any more, so polling stops. */
export function isClosedWorldTask(task?: Pick<WorldTaskReadDto, 'status'> | null): boolean {
    const status = normalizeWorldTaskStatus(task?.status);
    return status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'expired';
}

/** A result that finished (perhaps while the form was closed) but is not in the draft yet. */
export function needsApplying(task?: WorldTaskReadDto | null): boolean {
    return !!task && normalizeWorldTaskStatus(task.status) === 'completed' && !task.appliedAt && !!task.outputJson;
}

/** The in-game command for a task code (#180: `/knk task`; `/knk task-claim` still works). */
export const taskCodeCommand = (code: string): string => `/knk task ${code}`;

/** The latest task per field, keyed by field name (what GET FormSubmissionProgress/{id}/world-tasks returns). */
export function tasksByField(tasks: WorldTaskReadDto[] | null | undefined): Record<string, WorldTaskReadDto> {
    const result: Record<string, WorldTaskReadDto> = {};
    for (const task of tasks ?? []) {
        if (!task.fieldName) continue;
        const current = result[task.fieldName];
        if (!current || task.id > current.id) {
            result[task.fieldName] = task;
        }
    }
    return result;
}

/** Cancels the open tasks among `tasks` (leaving the form). Best effort: a task that moved on meanwhile answers 409. */
export async function cancelOpenTasks(tasks: Iterable<WorldTaskReadDto>, reason: string): Promise<void> {
    const open = Array.from(tasks).filter(isOpenWorldTask);
    await Promise.allSettled(open.map(task => Promise.resolve().then(() => worldTaskClient.cancel(task.id, { reason }))));
}

export interface WorkflowSessionRequest {
    /** The draft being resumed, if any: its session is reused (one session per draft). */
    progressId?: string;
    formConfigurationId?: number;
    entityTypeName?: string;
    entityId?: number;
}

/**
 * The workflow session a form's world tasks belong to. A resumed draft keeps its session (DESIGN §8.7); otherwise a new
 * session is started. Undefined when no session can be had (e.g. the user lacks knk.admin.world): the form then shows
 * no world-task panels, as before.
 */
export async function resolveWorkflowSessionId(request: WorkflowSessionRequest): Promise<number | undefined> {
    if (request.progressId) {
        try {
            const draft = await formSubmissionClient.getById(request.progressId);
            const sessionId = draft?.workflowSessionId;
            if (sessionId != null) {
                const session = await workflowClient.getById(sessionId);
                if (session?.id != null) return session.id;
            }
        } catch {
            // Fall through to a new session (the old one was removed by the sweep, or the draft can't be read).
        }
    }
    try {
        const session = await workflowClient.createSession({
            formConfigurationId: request.formConfigurationId,
            entityTypeName: request.entityTypeName,
            entityId: request.entityId,
        });
        return session.id;
    } catch {
        return undefined;
    }
}
