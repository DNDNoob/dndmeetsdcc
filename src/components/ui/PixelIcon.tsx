import React from 'react';
import { cn } from '@/lib/utils';

interface PixelIconProps {
  src?: string;
  alt: string;
  className?: string;
  /** Shown when there is no generated or matched icon yet. */
  fallback?: React.ReactNode;
}

/** A small pixel-art icon rendered with crisp (unsmoothed) scaling. */
const PixelIcon: React.FC<PixelIconProps> = ({ src, alt, className, fallback = null }) => {
  if (!src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={cn('w-6 h-6 shrink-0 rounded-sm border border-border/50 bg-background', className)}
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

export default PixelIcon;
