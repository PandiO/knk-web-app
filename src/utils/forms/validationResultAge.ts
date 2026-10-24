/**
 * KNG-269: how long ago a validation rule really ran, for a result the API answered from its log
 * ("checked 2 h ago"). Empty when the time can't be read.
 */
export const describeCheckedAgo = (executedAtIso: string | undefined, now: Date = new Date()): string => {
    if (!executedAtIso) return '';
    const at = new Date(executedAtIso).getTime();
    if (Number.isNaN(at)) return '';
    const seconds = Math.max(0, Math.round((now.getTime() - at) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    return `${days} days ago`;
};
