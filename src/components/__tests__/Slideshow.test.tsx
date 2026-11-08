import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { FADE_MS, Slideshow, slidesToRender } from '../Slideshow';
import { REDUCED_MOTION_QUERY } from '../../hooks/usePrefersReducedMotion';

const images = Array.from({ length: 9 }, (_, i) => ({ id: String(i + 1), url: `/images/${i + 1}.jpg`, title: `Slide ${i + 1}` }));

/** A preloader the test resolves by hand: `ready(url)`; `instant` resolves every URL at once. */
const manualPreload = () => {
  const pending = new Map<string, () => void>();
  const loaded = new Set<string>();
  const preload = jest.fn((url: string) => (loaded.has(url)
    ? Promise.resolve()
    : new Promise<void>(resolve => pending.set(url, () => { loaded.add(url); resolve(); }))));
  const ready = async (url: string) => {
    if (!pending.has(url)) loaded.add(url);
    pending.get(url)?.();
    pending.delete(url);
    await act(async () => { await Promise.resolve(); });
  };
  return { preload, ready };
};
const instant = () => Promise.resolve();

const state = () => screen.getAllByTestId('slide').map(el => `${el.getAttribute('data-slide-index')}:${el.getAttribute('data-state')}`);
const slide = (index: number) => screen.getAllByTestId('slide').find(el => el.getAttribute('data-slide-index') === String(index))!;
const flush = () => act(async () => { await Promise.resolve(); });
const advance = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); await Promise.resolve(); });

const setReducedMotion = (reduce: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduce && query === REDUCED_MOTION_QUERY, media: query,
      addEventListener: jest.fn(), removeEventListener: jest.fn(), addListener: jest.fn(), removeListener: jest.fn(),
    }),
  });
};

describe('slidesToRender', () => {
  it('keeps the current and the next slide, plus any slide still on screen, in ascending order', () => {
    expect(slidesToRender(9, 0)).toEqual([0, 1]);
    expect(slidesToRender(9, 8)).toEqual([0, 8]);
    expect(slidesToRender(9, 3, [2, null])).toEqual([2, 3, 4]);
    expect(slidesToRender(9, 0, [8, 8])).toEqual([0, 1, 8]);
    expect(slidesToRender(1, 0)).toEqual([0]);
    expect(slidesToRender(0, 0)).toEqual([]);
  });

  it('never swaps two slides that stay rendered (a moved node loses its fade, #258)', () => {
    // From one step to the next, the slides in both lists keep their relative order, also when wrapping.
    for (let current = 0; current < 9; current++) {
      const next = (current + 1) % 9;
      const before = slidesToRender(9, current);
      const during = slidesToRender(9, next, [null, current]);
      const kept = during.filter(i => before.includes(i));
      expect(kept).toEqual(before.filter(i => during.includes(i)));
    }
  });
});

describe('Slideshow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setReducedMotion(false);
  });
  afterEach(() => {
    jest.useRealTimers();
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it('renders two slides, not all nine', async () => {
    render(<Slideshow images={images} preload={instant} />);
    await flush();
    expect(screen.getAllByTestId('slide')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /show image/i })).toHaveLength(9);
  });

  it('fades the first image in from black once it has loaded', async () => {
    const { preload, ready } = manualPreload();
    render(<Slideshow images={images} preload={preload} decorative />);
    expect(state()).toEqual(['0:hidden', '1:hidden']);
    await ready('/images/1.jpg');
    expect(state()).toEqual(['0:visible', '1:hidden']);
    expect(slide(0)).toHaveClass('opacity-100');
    expect(slide(0).style.transitionDuration).toBe(`${FADE_MS}ms`);
  });

  it('fades the shown image out to black first, then the next one in, with the same duration and easing', async () => {
    render(<Slideshow images={images} interval={6000} preload={instant} decorative />);
    await flush();
    expect(state()).toEqual(['0:visible', '1:hidden']);

    await advance(6000);
    // Step 1: image 1 fades out (still in the DOM, opacity 0 with the transition), image 2 waits on black.
    expect(state()).toEqual(['0:leaving', '1:hidden', '2:hidden']);
    expect(slide(0)).toHaveClass('opacity-0');
    expect(slide(1)).toHaveClass('opacity-0');
    const out = slide(0).style;

    await advance(FADE_MS - 1);
    expect(state()).toEqual(['0:leaving', '1:hidden', '2:hidden']);

    // Step 2: once the screen is black, image 2 fades in.
    await advance(1);
    expect(state()).toEqual(['1:visible', '2:hidden']);
    const inStyle = slide(1).style;
    expect(inStyle.transitionDuration).toBe(out.transitionDuration);
    expect(inStyle.transitionTimingFunction).toBe(out.transitionTimingFunction);
  });

  it('keeps the same DOM node for the outgoing slide during its fade', async () => {
    render(<Slideshow images={images} preload={instant} decorative />);
    await flush();
    const node = slide(0);
    await advance(6000);
    expect(slide(0)).toBe(node);
    expect(node.isConnected).toBe(true);
  });

  it('wraps from the last image to the first the same way', async () => {
    render(<Slideshow images={images} preload={instant} />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Show image 9' }));
    await flush();
    await advance(FADE_MS);
    expect(state()).toEqual(['0:hidden', '8:visible']);
    const last = slide(8);

    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    await flush();
    expect(state()).toEqual(['0:hidden', '1:hidden', '8:leaving']);
    expect(slide(8)).toBe(last);
    await advance(FADE_MS);
    expect(state()).toEqual(['0:visible', '1:hidden']);
  });

  it('keeps the shown image up until the next one has loaded', async () => {
    const { preload, ready } = manualPreload();
    render(<Slideshow images={images} preload={preload} decorative />);
    await ready('/images/1.jpg');

    await advance(6000);
    // Image 2 is not loaded yet: no fade-out, image 1 stays (image 3 is rendered to preload it).
    expect(state()).toEqual(['0:visible', '1:hidden', '2:hidden']);
    await advance(3000);
    expect(state()).toEqual(['0:visible', '1:hidden', '2:hidden']);

    await ready('/images/2.jpg');
    expect(state()).toEqual(['0:leaving', '1:hidden', '2:hidden']);
    await advance(FADE_MS);
    expect(state()).toEqual(['1:visible', '2:hidden']);
  });

  it('starts over from the newest choice when a dot is clicked during a change', async () => {
    render(<Slideshow images={images} preload={instant} />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Show image 2' }));
    await flush();
    await advance(FADE_MS / 2);
    fireEvent.click(screen.getByRole('button', { name: 'Show image 5' }));
    await flush();
    // Image 1 is still fading out; image 2 never shows.
    expect(state()).toEqual(['0:leaving', '4:hidden', '5:hidden']);
    await advance(FADE_MS);
    expect(state()).toEqual(['4:visible', '5:hidden']);
    expect(screen.getByRole('button', { name: 'Show image 5' })).toHaveAttribute('aria-current', 'true');
  });

  it('swaps the images without fades when the system asks for reduced motion', async () => {
    setReducedMotion(true);
    render(<Slideshow images={images} preload={instant} decorative />);
    await flush();
    expect(state()).toEqual(['0:visible', '1:hidden']);
    expect(slide(0).style.transitionDuration).toBe('0ms');

    await advance(6000);
    // No black step: the next image is up at once.
    expect(state()).toEqual(['1:visible', '2:hidden']);
    expect(slide(1).style.transitionDuration).toBe('0ms');
  });
});
