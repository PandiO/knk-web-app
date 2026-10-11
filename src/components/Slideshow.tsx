import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
}

const TRANSITION_DURATION = 2500;

/**
 * Indexes of the slides to keep in the DOM: the current one and the next one (so it's loaded
 * before it fades in), plus the previous one while it fades out. Every other slide stays out of
 * the DOM, so the browser doesn't download all the background images up front.
 */
export function slidesToRender(count: number, current: number, fadingOut: number | null): number[] {
  if (count === 0) return [];
  const indexes = [current];
  if (count > 1) indexes.push((current + 1) % count);
  if (fadingOut !== null && !indexes.includes(fadingOut)) indexes.push(fadingOut);
  return indexes;
}

export function Slideshow({ images, interval = 6000, decorative = false }: SlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback((index: number) => {
    if (index === currentIndex) return;
    setFadingOut(currentIndex);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setFadingOut(null), TRANSITION_DURATION);
    setCurrentIndex(index);
  }, [currentIndex]);

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

  useEffect(() => () => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
  }, []);

  if (!images.length) return null;

  const rendered = slidesToRender(images.length, currentIndex, fadingOut);

  return (
    <div
      className="group relative h-screen w-full overflow-hidden bg-black"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {rendered.map(index => {
        const image = images[index];
        const isCurrent = index === currentIndex;
        return (
          <div
            key={image.id}
            data-testid="slide"
            aria-hidden={!isCurrent}
            className={`absolute inset-0 transition-opacity ease-in-out ${isCurrent ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            style={{
              transitionDuration: `${TRANSITION_DURATION}ms`,
              transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.6, 1)',
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
