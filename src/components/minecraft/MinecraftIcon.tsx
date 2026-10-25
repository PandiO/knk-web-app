import React from 'react';
import { Box } from 'lucide-react';

// KNG-200 §7: the one way to show a Minecraft material icon. Icons are textures hot-linked from
// GitHub raw, so a URL can be missing or broken: both show the same neutral placeholder instead of
// the browser's broken-image glyph. Phase 3 uses it on the catalogue admin page; phase 4 moves the
// picker, DisplayField and DisplaySection onto it.

export interface MinecraftIconProps {
  /** The icon URL; null, undefined or blank shows the placeholder. */
  src?: string | null;
  /** What the icon shows, e.g. the material's name or key. */
  alt: string;
  /** Width and height in px (default 24). */
  size?: number;
  className?: string;
}

export const MinecraftIcon: React.FC<MinecraftIconProps> = ({ src, alt, size = 24, className = '' }) => {
  const url = src?.trim() || null;
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const failed = url !== null && failedUrl === url;

  if (url === null || failed) {
    return (
      <span
        role="img"
        aria-label={alt}
        title={url === null ? `${alt} (no icon)` : `${alt} (icon could not be loaded)`}
        data-testid="minecraft-icon-placeholder"
        className={`inline-flex shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-100 text-gray-400 ${className}`}
        style={{ width: size, height: size }}
      >
        <Box aria-hidden="true" style={{ width: Math.round(size * 0.6), height: Math.round(size * 0.6) }} />
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      title={alt}
      loading="lazy"
      width={size}
      height={size}
      // Textures are 16x16 pixel art: keep them crisp when scaled up.
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
      className={`inline-block shrink-0 object-contain ${className}`}
      onError={() => setFailedUrl(url)}
    />
  );
};

export default MinecraftIcon;
