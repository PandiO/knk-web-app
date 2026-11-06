import type { ConfirmOptions } from '../../components/ConfirmDialog';

/**
 * #109 / #33: the "Leave this form?" question, the same on a page form (useLeaveGuard, the page's
 * Cancel) and on a child form's Escape and × (ChildFormModal, LW2-2). Kept out of useLeaveGuard so a
 * component can ask it without pulling in the router.
 */
export const LEAVE_FORM_TITLE = 'Leave this form?';
export const LEAVE_FORM_MESSAGE = "Changes you haven't saved are lost. A saved draft stays in Saved Progress.";
export const LEAVE_FORM_CONTINUE_LABEL = 'Leave form';
export const LEAVE_FORM_STAY_LABEL = 'Stay';

/** The question for `useConfirm()`: red, focus on Stay. */
export const LEAVE_FORM_CONFIRM: ConfirmOptions = {
    title: LEAVE_FORM_TITLE,
    message: LEAVE_FORM_MESSAGE,
    confirmLabel: LEAVE_FORM_CONTINUE_LABEL,
    cancelLabel: LEAVE_FORM_STAY_LABEL,
    danger: true
};
