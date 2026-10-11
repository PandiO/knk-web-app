import en from './languages/en-en.json';

// Turns what code sends to logging.errorHandler into a sentence a user can read (X-1, KNG-141).
// Callers send either a message key ("ErrorMessage.Town.LoadFailed") or a ready message. A key
// missing from en-en.json gets a readable fallback instead of showing the raw key.

const KEY_PREFIX = 'ErrorMessage.';

const VERBS: Record<string, string> = {
    Load: 'load',
    Save: 'save',
    Delete: 'delete',
    Add: 'add',
    Update: 'update',
    Create: 'create',
    Resolve: 'resolve',
};

/** "DisplayConfiguration" -> "display configuration"; "UIConfigurations" -> "UI configurations". */
export const words = (identifier: string): string =>
    identifier
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(' ')
        .map(word => (word.length > 1 && word === word.toUpperCase() ? word : word.toLowerCase()))
        .join(' ');

const lookup = (path: string): string | undefined => {
    let current: unknown = en;
    for (const part of path.split('.').filter(Boolean)) {
        if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)) {
            current = (current as Record<string, unknown>)[part];
        } else {
            return undefined;
        }
    }
    return typeof current === 'string' ? current : undefined;
};

/** "ErrorMessage.<Subject>.<Verb><Rest>Failed" -> "Could not <verb> <rest> (<subject>)."; otherwise a generic line. */
const fallback = (key: string): string => {
    const parts = key.slice(KEY_PREFIX.length).split('.').filter(Boolean);
    if (parts.length === 0) {
        return 'Something went wrong. Please try again.';
    }
    const last = parts[parts.length - 1];
    const subject = words(parts.slice(0, -1).join(' '));
    const match = /^([A-Z][a-z]+)(\w*)Failed$/.exec(last);
    if (match && VERBS[match[1]]) {
        const rest = match[2] ? words(match[2]) : '';
        if (rest && subject) return `Could not ${VERBS[match[1]]} ${rest} (${subject}).`;
        if (rest || subject) return `Could not ${VERBS[match[1]]} ${rest || subject}.`;
        return `Could not ${VERBS[match[1]]}.`;
    }
    return `Something went wrong${subject ? ` (${subject}: ${words(last)})` : ` (${words(last)})`}. Please try again.`;
};

export const resolveErrorMessage = (data: unknown): string => {
    if (data instanceof Error) {
        return data.message || 'Something went wrong. Please try again.';
    }
    const text = typeof data === 'string' ? data.trim() : String(data ?? '').trim();
    if (!text) {
        return 'Something went wrong. Please try again.';
    }
    if (!text.startsWith(KEY_PREFIX)) {
        return text;
    }
    return lookup(text) ?? fallback(text);
};
