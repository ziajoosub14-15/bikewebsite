import { useEffect, useState } from 'react';
import type { ResolvedBuild } from '../../domain/bikeModel';
import type { Colourway } from '../../types/components';
import { BikeIllustration } from '../builder/BikeIllustration';

/** A realistic still picture of the bike (rendered off-screen); falls back to the drawing without WebGL. */
export function BikeImage({ parts, colourway, width = 1000, className = '' }: { parts: ResolvedBuild; colourway: Colourway; width?: number; className?: string }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const key = JSON.stringify([Object.values(parts).map((p) => p.id), colourway, width]);
  useEffect(() => {
    let alive = true;
    setUrl(undefined);
    import('./three/snapshot')
      .then((m) => m.bikeSnapshot(parts, colourway, { width }))
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (url) return <img src={url} alt={`${parts.frame.brand} ${parts.frame.name}`} className={`relative block h-auto w-full ${className}`} draggable={false} />;
  if (url === null) return <BikeIllustration build={parts} colourway={colourway} floorLine={false} />;
  return <div className={`relative aspect-[920/520] w-full animate-pulse rounded-xl bg-white/20 ${className}`} aria-label="Rendering the bike" />;
}
