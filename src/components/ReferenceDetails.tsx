// The rows behind a refused delete, inside FeedbackModal's "Show details" (PandiO/knk-workspace#44).
import React, { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EntityReferenceRowsDto, entityReferenceClient } from '../apiClients/entityReferenceClient';
import { FeedbackDetails } from './FeedbackModal';
import { displayPath } from '../utils/returnTo';
import { formatNumber } from '../utils/format';
import { referenceNoun } from '../utils/referenceDetails';
import { apiRefusalReason } from '../utils/apiRefusalReason';

export interface ReferenceDetailsProps {
    data: EntityReferenceRowsDto;
    /** The metadata's display name of a type ("Gate Structure"). */
    typeLabel?: (entityType: string) => string;
    /** Where a row's page returns to (the page the refusal was shown on). */
    returnTo?: string | null;
    /** Called when a row's link is followed (the dialog closes). */
    onFollow?: () => void;
    /** What an empty answer says (default: nothing blocks the delete any more). */
    emptyText?: string;
}

/**
 * One group per reference ("3 structures"), each row a link to its detail page when the viewer may read the type,
 * plain text otherwise (with the nodes that would open it), and only a count when the API lists no rows. Never more
 * than the API's id + label + one detail line.
 */
export const ReferenceDetails: React.FC<ReferenceDetailsProps> = ({ data, typeLabel, returnTo, onFollow, emptyText }) => {
    const navigate = useNavigate();
    // A plain click opens the row here (and closes the dialog); Ctrl/Cmd/middle-click keep the browser's own tab.
    const follow = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onFollow?.();
        navigate(href);
    };
    if (data.groups.length === 0) {
        return <p className="text-sm text-muted">{emptyText ?? 'Nothing blocks the delete any more. Try again.'}</p>;
    }

    return (
        <div className="space-y-4" data-testid="reference-details">
            {data.groups.map(group => {
                const noun = referenceNoun(group, group.count, typeLabel);
                const shown = group.rows.length;
                const typeName = group.entityType ?? '';
                const typeWords = referenceNoun(group, 2, typeLabel);
                return (
                    <section key={group.referencedBy} aria-label={`${formatNumber(group.count)} ${noun}`}>
                        <h3 className="text-sm font-semibold text-fg">{formatNumber(group.count)} {noun}</h3>
                        {group.listed && shown > 0 && (
                            <ul className="mt-1 divide-y divide-line rounded-md border border-line">
                                {group.rows.map(row => (
                                    <li key={row.id} className="flex min-w-0 flex-wrap items-baseline gap-x-2 px-3 py-1.5 text-sm">
                                        {group.readable && typeName ? (
                                            <a
                                                href={displayPath(typeName, row.id, returnTo)}
                                                onClick={event => follow(event, displayPath(typeName, row.id, returnTo))}
                                                className="min-w-0 break-words font-medium text-primary hover:underline"
                                            >
                                                {row.label}
                                            </a>
                                        ) : (
                                            <span className="min-w-0 break-words font-medium text-fg">{row.label}</span>
                                        )}
                                        {row.detail && <span className="min-w-0 break-words text-xs text-muted">{row.detail}</span>}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {group.listed && group.more && (
                            <p className="mt-1 text-xs text-muted">
                                … and {formatNumber(group.count - shown)} more.
                            </p>
                        )}
                        {group.listed && !group.readable && group.nodes.length > 0 && (
                            <p className="mt-1 text-xs text-muted">
                                Opening {typeWords} requires one of: {group.nodes.join(', ')}
                            </p>
                        )}
                        {!group.listed && group.reason && (
                            <p className="mt-1 text-xs text-muted">{group.reason}</p>
                        )}
                    </section>
                );
            })}
        </div>
    );
};

/**
 * The "Show details" of a refused delete of `entityType` `id` (#44): offered only for the API's "still in use" 409
 * (`isReferenceRefusal`), loads the rows on request.
 */
export function refusedDeleteDetails(
    entityType: string,
    id: number | string,
    options: Omit<ReferenceDetailsProps, 'data'> = {}
): FeedbackDetails {
    return {
        label: 'Show what uses it',
        load: async () => {
            const data = await entityReferenceClient.getRows(entityType, id);
            return <ReferenceDetails data={data} {...options} />;
        },
    };
}

export interface ReferenceDetailsToggleOptions extends Omit<ReferenceDetailsProps, 'data'> {
    /** Every reference, cascades included (KNG-162's "in use" check), not only what stops a delete. */
    all?: boolean;
}

/**
 * "Show what uses it" for one row inside a list (bulk delete's refused rows, a cancelled form's "skipped: in use",
 * PandiO/knk-workspace#205, #289): `button` loads the rows once on request (Hide/Show keeps them) and `panel` shows them,
 * or the API's reason when the load failed. The caller places both (the button beside the row's name, the panel under
 * its text).
 */
export function useReferenceDetailsToggle(
    entityType: string,
    id: number | string,
    { all, ...options }: ReferenceDetailsToggleOptions = {}
): { button: React.ReactNode; panel: React.ReactNode } {
    const [details, setDetails] = useState<{ state: 'closed' | 'loading' | 'open' | 'failed'; data?: EntityReferenceRowsDto; error?: string }>({ state: 'closed' });
    const detailsId = useId();
    const toggle = async () => {
        if (details.state === 'open') {
            setDetails(previous => ({ ...previous, state: 'closed' }));
            return;
        }
        if (details.data) {
            setDetails(previous => ({ ...previous, state: 'open' }));
            return;
        }
        setDetails({ state: 'loading' });
        try {
            const data = await entityReferenceClient.getRows(entityType, id, all ? { all: true } : {});
            setDetails({ state: 'open', data });
        } catch (error) {
            setDetails({ state: 'failed', error: apiRefusalReason(error) ?? "The list couldn't be loaded." });
        }
    };
    const button = (
        <button
            type="button"
            className="btn-tertiary px-2 py-0.5 text-xs"
            onClick={() => void toggle()}
            aria-expanded={details.state === 'open'}
            aria-controls={detailsId}
            disabled={details.state === 'loading'}
        >
            {details.state === 'loading' ? 'Loading…' : details.state === 'open' ? 'Hide' : 'Show what uses it'}
        </button>
    );
    const panel = (
        <div id={detailsId}>
            {details.state === 'open' && details.data && (
                <div className="mt-2">
                    <ReferenceDetails data={details.data} {...options} />
                </div>
            )}
            {details.state === 'failed' && <p className="mt-1 text-xs text-danger-strong">{details.error}</p>}
        </div>
    );
    return { button, panel };
}
