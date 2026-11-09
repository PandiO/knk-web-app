import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

interface Image {
  id: string;
  url: string;
  title: string;
}

interface SlideshowProps {
  images: Image[];
  interval?: number;
  /** A pure background: no captions, arrows or dots (they would sit on top of page content). */
  decorative?: boolean;
  /** Resolves when an image is ready to show; tests pass their own. */
  preload?: (url: string) => Promise<void>;
}

/**
 * PandiO/knk-workspace#258: a change is two steps of the same length and easing: the shown image fades out to
 * black, then the next one fades in from black. (Before, the outgoing slide's DOM node was moved when the list of
 * rendered slides was reordered, which dropped its opacity transition: it snapped to black.)
 */
export const FADE_MS = 1250;
const FADE_EASING = 'cubic-bezier(0.4, 0, 0.6, 1)';

const loadedUrls = new Set<string>();

/**
 * Resolves once the browser has the image (or failed to get it), so a fade-in never starts on a black screen
 * that is still waiting for its picture. A failed image resolves too: the slideshow goes on.
 */
export function preloadImage(url: string): Promise<void> {
  if (loadedUrls.has(url) || typeof Image === 'undefined') return Promise.resolve();
  return new Promise(resolve => {
    const image = new Image();
    const done = () => {
      loadedUrls.add(url);
      resolve();
    };
    image.onload = done;
    image.onerror = done;
    image.src = url;
    if (image.complete && image.naturalWidth > 0) done();
  });
}

/**
 * Indexes of the slides to keep in the DOM, ascending: the current one, the next one (so it's loaded before it
 * fades in) and any other slide that is still visible or fading out. Every other slide stays out of the DOM, so
 * the browser doesn't download all the background images up front. Ascending order keeps two slides in the same
 * order from one render to the next, so React never moves a slide's node in the middle of its fade (#258).
 */
export function slidesToRender(count: number, current: number, others: Array<number | null> = []): number[] {
  if (count === 0) return [];
  const indexes = new Set<number>([current]);
  if (count > 1) indexes.add((current + 1) % count);
  others.forEach(index => {
    if (index !== null && index >= 0 && index < count) indexes.add(index);
  });
  return Array.from(indexes).sort((a, b) => a - b);
}

export function Slideshow({ images, interval = 6000, decorative = false, preload = preloadImage }: SlideshowProps) {
  const reducedMotion = usePrefersReducedMotion();
  // The slide the show is on or heading to (dots, aria-hidden).
  const [currentIndex, setCurrentIndex] = useState(0);
  // The slide at full opacity or fading in; null while the screen fades to (or is) black.
  const [visible, setVisible] = useState<number | null>(null);
  // The slide fading out to black, kept in the DOM until the next one starts to fade in.
  const [leaving, setLeaving] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const leavingRef = useRef(leaving);
  leavingRef.current = leaving;
  const fadeMs = reducedMotion ? 0 : FADE_MS;
  const fadeMsRef = useRef(fadeMs);
  fadeMsRef.current = fadeMs;
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const preloadRef = useRef(preload);
  preloadRef.current = preload;
  // Every change gets a number; a step that belongs to an older change does nothing.
  const generation = useRef(0);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((index: number) => {
    const ticket = ++generation.current;
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    setCurrentIndex(index);
    const url = imagesRef.current[index]?.url;
    // The shown image stays up while the next one loads; only then does it fade out.
    preloadRef.current(url ?? '').then(() => {
      if (ticket !== generation.current) return;
      const fade = fadeMsRef.current;
      const outgoing = visibleRef.current;
      if (outgoing === index) return;
      if (fade === 0) {
        // prefers-reduced-motion: no fades, the image is swapped at once.
        setLeaving(null);
        setVisible(index);
        return;
      }
      const fadeIn = () => {
        setLeaving(null);
        setVisible(index);
      };
      // Already black (the first image): fade in at once.
      const fadingOut = outgoing ?? leavingRef.current;
      if (fadingOut === null) {
        fadeIn();
        return;
      }
      // Step 1: fade the shown image out to black (or let the one already fading out finish).
      if (outgoing !== null) {
        setLeaving(outgoing);
        setVisible(null);
      }
      // Step 2: fade the next image in from black once the screen is black.
      fadeTimer.current = setTimeout(() => {
        if (ticket === generation.current) fadeIn();
      }, fade);
    });
  }, []);

  const goTo = useCallback((index: number) => {
    if (index === currentIndex) return;
    show(index);
  }, [currentIndex, show]);

  // The first image fades in from black once it has loaded.
  useEffect(() => {
    if (!imagesRef.current.length) return;
    show(0);
  }, [show]);

  const transition = useCallback((direction: 'next' | 'previous') => {
    if (images.length <= 1) return;
    const newIndex = direction === 'next'
      ? (currentIndex + 1) % images.length
      : (currentIndex - 1 + images.length) % images.length;
    goTo(newIndex);
  }, [currentIndex, images.length, goTo]);

  useEffect(() => {
    if (images.length <= 1 || isPaused) return;
    const timer = setInterval(() => transition('next'), interval);
    return () => clearInterval(timer);
  }, [transition, interval, images.length, isPaused]);

  // Preload the slide after the current one while the current one is on screen.
  useEffect(() => {
    if (images.length > 1) void preloadRef.current(images[(currentIndex + 1) % images.length].url);
  }, [currentIndex, images]);

  useEffect(() => () => {
    generation.current++;
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
  }, []);

  if (!images.length) return null;

  const rendered = slidesToRender(images.length, currentIndex, [visible, leaving]);

  return (
    <div
      className="group relative h-screen w-full overflow-hidden bg-black"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {rendered.map(index => {
        const image = images[index];
        const isCurrent = index === currentIndex;
        const isVisible = index === visible;
        return (
          <div
            key={image.id}
            data-testid="slide"
            data-slide-index={index}
            data-state={isVisible ? 'visible' : index === leaving ? 'leaving' : 'hidden'}
            aria-hidden={!isCurrent}
            className={`absolute inset-0 transition-opacity ${isVisible ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            style={{
              // The same duration and easing for the fade-out and the fade-in (#258).
              transitionDuration: `${fadeMs}ms`,
              transitionTimingFunction: FADE_EASING,
            }}
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${image.url})` }}
            >
              <div className="absolute inset-0 bg-black bg-opacity-40" />
            </div>

            {!decorative && (
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent text-white">
                <div className="max-w-7xl mx-auto">
                  <p className="text-lg font-semibold">{image.title}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {images.length > 1 && !decorative && (
        <>
          <button
            type="button"
            onClick={() => transition('previous')}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-75 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white z-20"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => transition('next')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-75 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white z-20"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </button>

          <div className="absolute bottom-16 left-0 right-0 z-20">
            <div className="flex justify-center space-x-2">
              {images.map((image, index) => (
                <button
                  type="button"
                  key={image.id}
                  onClick={() => goTo(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? 'bg-white w-8'
                      : 'w-2 bg-white bg-opacity-50 hover:bg-opacity-75'
                  }`}
                  aria-label={`Show image ${index + 1}`}
                  aria-current={index === currentIndex ? 'true' : undefined}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
