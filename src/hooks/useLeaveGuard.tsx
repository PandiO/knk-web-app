import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom';
import type { BlockerFunction } from 'react-router-dom';
import { FeedbackModal } from '../components/FeedbackModal';

export const LEAVE_FORM_TITLE = 'Leave this form?';
export const LEAVE_FORM_MESSAGE = "Changes you haven't saved are lost. A saved draft stays in Saved Progress.";

export interface LeaveGuard {
    /** Render once; holds the "Leave this form?" dialog. */
    element: React.ReactNode;
    /** The next navigation leaves without asking (after a submit, or a Cancel that already asked). */
    allowLeave: () => void;
    /** Runs `leave` at once when nothing changed, else after the person confirms. */
    confirmLeave: (leave: () => void) => void;
}

/**
 * #109: asks before an open form with unsaved changes is left. Covers links, Back/Forward and the
 * breadcrumb (react-router `useBlocker`, which needs the data router of App.tsx), a page reload or
 * closing the tab (`beforeunload`, the browser's own question), and own actions that close the form
 * without a navigation (`confirmLeave`). With nothing changed, nothing asks.
 */
const NoDataRouter = React.createContext<unknown>(null);

export function useLeaveGuard(when: boolean): LeaveGuard {
    const whenRef = useRef(when);
    whenRef.current = when;
    const bypassRef = useRef(false);
    const [pending, setPending] = useState<{ proceed: () => void; cancel: () => void } | null>(null);
    // Without a data router (unit tests with a MemoryRouter) useBlocker throws, so it only runs inside
    // one. Tests that mock react-router-dom may not export the context at all.
    const hasDataRouter = useContext(UNSAFE_DataRouterContext ?? NoDataRouter) != null;

    useEffect(() => {
        if (when) bypassRef.current = false;
    }, [when]);

    useEffect(() => {
        if (!when) return undefined;
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (bypassRef.current) return;
            event.preventDefault();
            // Older browsers show the question only when returnValue is set.
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [when]);

    const allowLeave = useCallback(() => {
        bypassRef.current = true;
    }, []);

    const confirmLeave = useCallback((leave: () => void) => {
        if (!whenRef.current || bypassRef.current) {
            leave();
            return;
        }
        setPending({
            proceed: () => {
                bypassRef.current = true;
                leave();
            },
            cancel: () => undefined
        });
    }, []);

    const shouldBlock = useCallback<BlockerFunction>(({ currentLocation, nextLocation }) =>
        whenRef.current
        && !bypassRef.current
        && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search), []);

    const onBlocked = useCallback((proceed: () => void, cancel: () => void) => {
        setPending({ proceed: () => { bypassRef.current = true; proceed(); }, cancel });
    }, []);

    const close = () => {
        pending?.cancel();
        setPending(null);
    };
    const leave = () => {
        const action = pending?.proceed;
        setPending(null);
        action?.();
    };

    const element = (
        <>
            {hasDataRouter && <NavigationBlocker shouldBlock={shouldBlock} onBlocked={onBlocked} />}
            <FeedbackModal
                open={pending !== null}
                title={LEAVE_FORM_TITLE}
                message={LEAVE_FORM_MESSAGE}
                status="info"
                onClose={close}
                onContinue={leave}
                continueLabel="Leave form"
                cancelLabel="Stay"
            />
        </>
    );

    return { element, allowLeave, confirmLeave };
}

const NavigationBlocker: React.FC<{
    shouldBlock: BlockerFunction;
    onBlocked: (proceed: () => void, cancel: () => void) => void;
}> = ({ shouldBlock, onBlocked }) => {
    const blocker = useBlocker(shouldBlock);
    useEffect(() => {
        if (blocker.state === 'blocked') {
            onBlocked(() => blocker.proceed(), () => blocker.reset());
        }
    }, [blocker, onBlocked]);
    return null;
};
