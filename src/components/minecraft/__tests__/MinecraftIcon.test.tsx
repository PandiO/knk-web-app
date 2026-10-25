import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MinecraftIcon } from '../MinecraftIcon';

// KNG-200 §7: a missing or broken icon URL shows a neutral placeholder, never a broken image.

describe('MinecraftIcon', () => {
  it('renders a lazy image for a URL', () => {
    render(<MinecraftIcon src="https://example.org/stone.png" alt="Stone" size={32} />);

    const img = screen.getByRole('img', { name: 'Stone' });
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', 'https://example.org/stone.png');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('width', '32');
    expect(screen.queryByTestId('minecraft-icon-placeholder')).not.toBeInTheDocument();
  });

  it.each([[null], [undefined], ['   ']])('shows the placeholder when the URL is %p', (src) => {
    render(<MinecraftIcon src={src as string | null | undefined} alt="Wall Torch" />);

    const placeholder = screen.getByTestId('minecraft-icon-placeholder');
    expect(placeholder).toHaveAttribute('aria-label', 'Wall Torch');
    expect(screen.getByRole('img', { name: 'Wall Torch' }).tagName).toBe('SPAN');
  });

  it('falls back to the placeholder when the image fails to load', () => {
    render(<MinecraftIcon src="https://example.org/broken.png" alt="Oak Stairs" />);

    fireEvent.error(screen.getByRole('img', { name: 'Oak Stairs' }));

    expect(screen.getByTestId('minecraft-icon-placeholder')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('tries again when a broken URL is replaced', () => {
    const { rerender } = render(<MinecraftIcon src="https://example.org/broken.png" alt="Oak Stairs" />);
    fireEvent.error(screen.getByRole('img', { name: 'Oak Stairs' }));

    rerender(<MinecraftIcon src="https://example.org/oak_stairs.png" alt="Oak Stairs" />);

    expect(screen.getByRole('img', { name: 'Oak Stairs' })).toHaveAttribute('src', 'https://example.org/oak_stairs.png');
  });
});
