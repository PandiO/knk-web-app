import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Image {
  id: string;
  url: string;
  title: string;
  // photographer: string;
  // description: string;
}

interface SlideshowProps {
  images: Image[];
  interval?: number;
}

export function Slideshow({ images, interval = 6000 }: SlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [activeImages, setActiveImages] = useState<Image[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const TRANSITION_DURATION = 2500; // Extended to 2.5 seconds

  useEffect(() => {
    setActiveImages(images);
  }, [images]);

  const preloadImage = (url: string) => {
    const img = new Image();
    img.src = url;
  };

  useEffect(() => {
    if (activeImages.length > 1) {
      const nextIdx = (currentIndex + 1) % activeImages.length;
      preloadImage(activeImages[nextIdx].url);
    }
  }, [currentIndex, activeImages]);

  const transition = useCallback((direction: 'next' | 'previous') => {
    if (activeImages.length <= 1) return;

    const newIndex = direction === 'next'
      ? (currentIndex + 1) % activeImages.length
      : (currentIndex - 1 + activeImages.length) % activeImages.length;

    setCurrentIndex(newIndex);
  }, [currentIndex, activeImages.length]);

  useEffect(() => {
    if (activeImages.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      transition('next');
    }, interval);

    return () => {
      clearInterval(timer);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [transition, interval, activeImages.length, isPaused]);

  if (!activeImages.length) return null;

  return (
    <div
      className="relative h-screen w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {activeImages.map((image, index) => (
        <div
          key={image.id}
          className={`absolute inset-0 transition-opacity ease-in-out
            ${index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          style={{ 
            transitionDuration: `${TRANSITION_DURATION}ms`,
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.6, 1)' // Adjusted for smoother transition
          }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${image.url})`
            }}
          >
            <div className="absolute inset-0 bg-black bg-opacity-30" />
          </div>

          {/* Image Information */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent text-white">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-2xl font-bold mb-2">{image.title}</h2>
                {/* <p className="text-sm opacity-90 mb-1">
                Photographed by {image.photographer}
                </p>
                <p className="text-sm opacity-75">{image.description}</p> */}
            </div>
          </div>
        </div>
      ))}

      {activeImages.length > 1 && (
        <>
          <button
            onClick={() => transition('previous')}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-75 transition-all opacity-0 group-hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white z-20"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={() => transition('next')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-75 transition-all opacity-0 group-hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white z-20"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div className="absolute bottom-28 left-0 right-0 z-20">
            <div className="flex justify-center space-x-2">
              {activeImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? 'bg-white w-8'
                      : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                  }`}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}