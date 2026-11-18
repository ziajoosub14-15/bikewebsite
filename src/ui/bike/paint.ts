import type { Colourway, Finish, Frame } from '../../types/components';

export type TubeId = 'top' | 'down' | 'seat' | 'head' | 'chainstay' | 'seatstay' | 'fork';

/**
 * A painted stretch of tube. `t` runs 0→1 along the tube in these directions:
 * top: seat → head · down: BB → head · seat: BB → top · head: top → bottom ·
 * chainstay: rear axle → BB · seatstay: rear axle → seat tube · fork: crown → axle
 */
export interface PaintSeg {
  t0: number;
  t1: number;
  color: string;
  finish: Finish;
}

export interface Stripe {
  t: number;
  width: number;
  color: string;
}

export function hexMix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a);
  const y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export function isLightHex(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

/** The colourway a build uses: an official one by id, or a plain custom paint. */
export function resolveColourway(frame: Frame, colourwayId: string | undefined, customPaint: string): Colourway {
  if (colourwayId !== 'custom') {
    const found = frame.colourways.find((c) => c.id === colourwayId) ?? (colourwayId === undefined ? frame.colourways[0] : undefined);
    if (found) return found;
  }
  return { id: 'custom', name: 'Custom paint', base: customPaint, pattern: 'solid', finish: 'gloss', decal: isLightHex(customPaint) ? '#1f2937' : '#ffffff', official: false };
}

/**
 * Paint segments for one tube. `xAt(t)` gives the tube's position from the rear axle (0) to the
 * front axle (1), used for fades.
 */
export function tubeSegments(cw: Colourway, tube: TubeId, xAt: (t: number) => number): PaintSeg[] {
  const base = { color: cw.base, finish: cw.finish };
  const acc = { color: cw.accent ?? cw.base, finish: cw.accentFinish ?? cw.finish };
  const whole = (p: { color: string; finish: Finish }): PaintSeg[] => [{ t0: 0, t1: 1, ...p }];
  switch (cw.pattern) {
    case 'headBlock':
      if (tube === 'head' || tube === 'fork') return whole(acc);
      if (tube === 'top') return [{ t0: 0, t1: 0.62, ...base }, { t0: 0.62, t1: 1, ...acc }];
      if (tube === 'down') return [{ t0: 0, t1: 0.55, ...base }, { t0: 0.55, t1: 1, ...acc }];
      return whole(base);
    case 'rear':
      return tube === 'chainstay' || tube === 'seatstay' ? whole(acc) : whole(base);
    case 'topTube':
      return tube === 'top' ? whole(acc) : whole(base);
    case 'front':
      return tube === 'fork' || tube === 'chainstay' || tube === 'seatstay' ? whole(acc) : whole(base);
    case 'fade': {
      const n = 8;
      return Array.from({ length: n }, (_, i) => {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        const x = Math.max(0, Math.min(1, xAt((t0 + t1) / 2)));
        return { t0, t1, color: hexMix(cw.base, cw.accent ?? cw.base, x), finish: cw.finish };
      });
    }
    default:
      return whole(base);
  }
}

/** Decorative bands (e.g. world champion rainbow) across the top tube, seat tube and fork. */
export function tubeStripes(cw: Colourway, tube: TubeId): Stripe[] {
  if (!cw.stripes?.length) return [];
  const centre = tube === 'top' ? 0.5 : tube === 'seat' ? 0.78 : tube === 'fork' ? 0.3 : -1;
  if (centre < 0) return [];
  const w = 0.025;
  const n = cw.stripes.length;
  return cw.stripes.map((color, i) => ({ t: centre + (i - (n - 1) / 2) * w, width: w, color }));
}

export const RIM_COLORS = {
  'carbon-matte': '#1d2125',
  'carbon-gloss': '#101215',
  'alloy-black': '#262a2f',
  'alloy-silver': '#c4ccd6',
} as const;

export const TAN_WALL = '#c49a62';
