import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '../utils/format';

/**
 * PandiO/knk-workspace#187 (X-9): the one pager under a DataTable (was three styles: the entity tables',
 * moderation's arrow buttons and the logs' own). Pages are 1-based. A `<nav aria-label>` with Previous/Next
 * buttons and "Page x of y"; from `sm` up also "Showing a to b of n results". The caller decides whether to
 * show it (e.g. only with more than one page).
 *
 *     <Pager page={page} pageSize={20} totalCount={total} onPageChange={setPage} disabled={loading} />
 */
export interface PagerProps {
    page: number;
    pageSize: number;
    totalCount: number;
    onPageChange: (page: number) => void;
    /** Both buttons off, e.g. while a page loads. */
    disabled?: boolean;
    /** The nav landmark's name; default "Pagination". */
    label?: string;
    /** The word in "Showing 1 to 20 of 45 {noun}"; default "results". */
    noun?: string;
    className?: string;
}

export const totalPagesOf = (totalCount: number, pageSize: number): number =>
    Math.max(1, Math.ceil(Math.max(0, totalCount) / Math.max(1, pageSize)));

export const Pager: React.FC<PagerProps> = ({
    page,
    pageSize,
    totalCount,
    onPageChange,
    disabled = false,
    label = 'Pagination',
    noun = 'results',
    className = '',
}) => {
    const totalPages = totalPagesOf(totalCount, pageSize);
    const isFirst = page <= 1;
    const isLast = page >= totalPages;
    const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, totalCount);
    const go = (target: number) => {
        if (target >= 1 && target <= totalPages && target !== page) onPageChange(target);
    };

    return (
        <nav
            aria-label={label}
            className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-surface border-t border-line sm:px-6 ${className}`}
        >
            <p className="hidden sm:block text-sm text-fg">
                Showing <span className="font-medium">{formatNumber(from)}</span> to{' '}
                <span className="font-medium">{formatNumber(to)}</span> of{' '}
                <span className="font-medium">{formatNumber(totalCount)}</span> {noun}
            </p>
            <div className="flex flex-1 sm:flex-none items-center justify-between sm:justify-end gap-2">
                <button
                    type="button"
                    onClick={() => go(page - 1)}
                    disabled={disabled || isFirst}
                    className="btn-secondary disabled:opacity-50"
                >
                    <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
                    Previous
                </button>
                <span className="inline-flex items-center px-2 text-sm font-medium text-fg" aria-live="polite">
                    Page {page} of {totalPages}
                </span>
                <button
                    type="button"
                    onClick={() => go(page + 1)}
                    disabled={disabled || isLast}
                    className="btn-secondary disabled:opacity-50"
                >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
                </button>
            </div>
        </nav>
    );
};
