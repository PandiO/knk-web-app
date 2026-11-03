import React from 'react';
import { useLocation } from 'react-router-dom';
import { PAGE_BACKGROUND_IMAGES, usePageBackground } from './pageBackground';

// `fetchpriority` is not in React 18's typings; lower-case, React passes it to the <img> as is.
const LOW_PRIORITY = { fetchpriority: 'low' } as React.ImgHTMLAttributes<HTMLImageElement>;

/**
 * Image 1 fixed behind every page while the page background is on (#231). It is only rendered then, so with
 * the setting off (the default) the image is never downloaded. Not on the landing page: its slideshow starts
 * with image 1 itself, so the landing loads the picture once (the slideshow's own file).
 *
 * A fixed layer instead of `background-attachment: fixed` (which iOS Safari ignores); `object-fit: cover`
 * fills the viewport at every width without stretching. z-index -1 inside #root's stacking context: behind
 * the app's translucent page backdrop, above the body. Low fetch priority: the page's own requests go first.
 */
export function PageBackground() {
  const setting = usePageBackground();
  const { pathname } = useLocation();
  if (setting !== 'on' || pathname === '/') return null;
  return (
    <div aria-hidden="true" data-testid="page-background" className="page-background-image fixed inset-0 -z-10 pointer-events-none bg-canvas">
      <picture>
        <source srcSet={PAGE_BACKGROUND_IMAGES.avif} type="image/avif" />
        <img
          src={PAGE_BACKGROUND_IMAGES.webp}
          alt=""
          decoding="async"
          {...LOW_PRIORITY}
          className="h-full w-full object-cover"
        />
      </picture>
    </div>
  );
}
