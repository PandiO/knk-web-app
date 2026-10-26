import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Breadcrumb } from '../utils/breadcrumbs';

type Props = {
    trail: Breadcrumb[];
    /** Called instead of navigating when given (e.g. to close an open form first). */
    onNavigate?: (to: string) => void;
    className?: string;
};

/**
 * Renders a breadcrumb trail (#177 link 2). Crumbs are real links (middle-click opens a tab); a
 * plain click navigates inside the app. The last crumb is the current page.
 */
export const Breadcrumbs: React.FC<Props> = ({ trail, onNavigate, className = '' }) => {
    const navigate = useNavigate();
    if (trail.length === 0) return null;

    const follow = (event: React.MouseEvent<HTMLAnchorElement>, to: string) => {
        // Let the browser handle new-tab clicks.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (onNavigate) onNavigate(to);
        else navigate(to);
    };

    return (
        <nav aria-label="Breadcrumb" className={className}>
            <ol className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
                {trail.map((crumb, index) => {
                    const last = index === trail.length - 1;
                    return (
                        <li key={`${index}:${crumb.label}`} className="flex min-w-0 items-center gap-1">
                            {index > 0 && <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />}
                            {crumb.to && !last ? (
                                <a
                                    href={crumb.to}
                                    onClick={event => follow(event, crumb.to!)}
                                    className="truncate text-gray-600 hover:text-gray-900 hover:underline"
                                >
                                    {crumb.label}
                                </a>
                            ) : (
                                <span className="truncate font-medium text-gray-900" aria-current={last ? 'page' : undefined}>
                                    {crumb.label}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default Breadcrumbs;
