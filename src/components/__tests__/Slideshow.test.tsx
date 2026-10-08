import React from 'react';
import { render, screen } from '@testing-library/react';
import { Slideshow, slidesToRender } from '../Slideshow';

const images = Array.from({ length: 9 }, (_, i) => ({ id: String(i + 1), url: `/images/${i + 1}.jpg`, title: `Slide ${i + 1}` }));

describe('slidesToRender', () => {
  it('keeps the current and the next slide, plus the one fading out', () => {
    expect(slidesToRender(9, 0, null)).toEqual([0, 1]);
    expect(slidesToRender(9, 8, null)).toEqual([8, 0]);
    expect(slidesToRender(9, 3, 2)).toEqual([3, 4, 2]);
    expect(slidesToRender(1, 0, null)).toEqual([0]);
    expect(slidesToRender(0, 0, null)).toEqual([]);
  });
});

describe('Slideshow', () => {
  it('renders two slides, not all nine', () => {
    render(<Slideshow images={images} />);
    expect(screen.getAllByTestId('slide')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /show image/i })).toHaveLength(9);
  });
});
