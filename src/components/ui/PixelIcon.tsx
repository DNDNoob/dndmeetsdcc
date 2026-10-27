import React from 'react';
import { cn } from '@/lib/utils';

interface PixelIconProps {
  src?: string;
  alt: string;
  className?: string;
  /** Shown when there is no generated or matched icon yet. */
  fallback?: React.ReactNode;
  /** Upgraded, new icon not drawn yet: a gold frame marks it. */
  upgraded?: boolean;
}

/** A small pixel-art icon rendered with crisp (unsmoothed) scaling. */
const PixelIcon: React.FC<PixelIconProps> = ({ src, alt, className, fallback = null, upgraded = false }) => {
  if (!src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      title={upgraded ? 'Upgraded: a new icon is on its way' : undefined}
      className={cn('w-6 h-6 shrink-0 object-contain', upgraded && 'rounded-sm ring-2 ring-accent shadow-[0_0_6px_hsl(var(--accent))]', className)}
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

export default PixelIcon;
