import React, { useCallback, useEffect, useRef } from 'react';
import type { BlockerFunction } from 'react-router-dom';
import { useConfirm } from './useConfirm';
import { NavigationBlocker, useHasDataRouter } from './useLeaveGuard';
import { LEAVE_SETTINGS_TITLE } from '../components/SettingsPage';

export interface BuilderLeaveGuard {
    /** Render once: the blocker and the question. */
    element: React.ReactNode;
    /** Runs `leave` at once without changes, else after "Leave". Resolves false when the person stays. */
    confirmLeave: (leave: () => void) => Promise<boolean>;
    /** The next navigation leaves without asking (after a save, before its own redirect). */
    allowNextLeave: () => void;
}

/**
 * PandiO/knk-workspace#71: the form and display builders ask "Leave without saving?" (the SettingsPage question, #187)
 * when unsaved changes would be lost: links, Back/Forward and the breadcrumb (react-router's blocker, inside the data
 * router), a reload or closing the tab (the browser's own question) and the builder's own Close.
 */
export function useBuilderLeaveGuard(dirty: boolean, what: string): BuilderLeaveGuard {
    const [confirm, confirmModal] = useConfirm();
    const hasDataRouter = useHasDataRouter();
    const dirtyRef = useRef(dirty);
    dirtyRef.current = dirty;
    const bypassRef = useRef(false);

    useEffect(() => {
        if (!dirty) return undefined;
        bypassRef.current = false;
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (bypassRef.current) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [dirty]);

    const ask = useCallback(() => confirm({
        title: LEAVE_SETTINGS_TITLE,
        message: `Your unsaved changes to ${what} will be lost. What you saved before stays.`,
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        danger: true,
    }), [confirm, what]);

    const shouldBlock = useCallback<BlockerFunction>(({ currentLocation, nextLocation }) =>
        dirtyRef.current
        && !bypassRef.current
        && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search), []);

    const onBlocked = useCallback((proceed: () => void, cancel: () => void) => {
        void ask().then(leave => {
            if (leave) {
                bypassRef.current = true;
                proceed();
            } else {
                cancel();
            }
        });
    }, [ask]);

    const confirmLeave = useCallback(async (leave: () => void) => {
        if (!dirtyRef.current || bypassRef.current) {
            leave();
            return true;
        }
        if (!(await ask())) return false;
        bypassRef.current = true;
        leave();
        return true;
    }, [ask]);

    const allowNextLeave = useCallback(() => {
        bypassRef.current = true;
    }, []);

    const element = (
        <>
            {hasDataRouter && <NavigationBlocker shouldBlock={shouldBlock} onBlocked={onBlocked} />}
            {confirmModal}
        </>
    );

    return { element, confirmLeave, allowNextLeave };
}
