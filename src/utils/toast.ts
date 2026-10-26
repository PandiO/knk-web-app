import { Subject } from 'rxjs';
import { logging } from './logging';

/**
 * The success side of ToastRegion (PandiO/knk-workspace#177 link 1). Errors keep going through
 * `logging.errorHandler` (about 45 call sites); `toast.error` is only a shortcut to it. The full
 * feedback kit (kinds, actions, a Dialog) is #33.
 */
export const successToasts = new Subject<string>();

export const toast = {
    success: (message: string) => successToasts.next(message),
    error: (message: string) => logging.errorHandler.next(message),
};
