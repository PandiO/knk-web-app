import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { MapToPageMessage, originOf, PageToMapMessage, parseBridgeMessage } from './bridgeProtocol';

/** Where BlueMap's web app is served: same origin under /bluemap/ (O26); a build may point elsewhere. */
export const BLUEMAP_URL = process.env.REACT_APP_BLUEMAP_URL || '/bluemap/';

export interface BlueMapFrameHandle {
  /** Sends a message to the bridge; dropped while the iframe has no window. */
  send: (message: PageToMapMessage) => void;
}

interface Props {
  src?: string;
  onMessage: (message: MapToPageMessage) => void;
  className?: string;
}

/**
 * BlueMap's unmodified viewer in an iframe plus the page side of the bridge (O14, § 5 rule 14). Messages are accepted
 * only from this iframe's window on the BlueMap origin (A10); messages to it are posted to that origin only.
 */
export const BlueMapFrame = forwardRef<BlueMapFrameHandle, Props>(({ src = BLUEMAP_URL, onMessage, className }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const origin = useMemo(() => originOf(src), [src]);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const message = parseBridgeMessage(event, iframeRef.current?.contentWindow, origin);
      if (message) onMessageRef.current(message);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [origin]);

  const send = useCallback((message: PageToMapMessage) => {
    iframeRef.current?.contentWindow?.postMessage(message, origin);
  }, [origin]);

  useImperativeHandle(ref, () => ({ send }), [send]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title="Map of Knights and Kings"
      className={className}
      allow="fullscreen"
    />
  );
});
BlueMapFrame.displayName = 'BlueMapFrame';
