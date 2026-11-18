import type { Frame, GeometryFamily, Handlebars } from '../types/components';
import type { RiderProfile } from './rider';

/**
 * Fit rules of thumb. Good enough to flag bad matches; not a substitute for a professional bike fit.
 */
export const FIT = {
  /** Frame size (seat tube, cm) = inseam × this. */
  SIZE_FACTOR: { race: 0.665, endurance: 0.665, gravel: 0.655, tt: 0.665 } as Record<GeometryFamily, number>,
  /** Saddle height (BB centre to saddle top) = inseam × this (LeMond formula). */
  SADDLE_HEIGHT_FACTOR: 0.883,
  /** Saddle nose to handlebar (mm) per cm of (torso + arm), where torso = height − inseam. */
  COCKPIT_MM_PER_CM: 3.85,
  /** Endurance and gravel bikes are ridden a little more upright and shorter. */
  COCKPIT_FAMILY_FACTOR: { race: 1, endurance: 0.97, gravel: 0.97, tt: 1 } as Record<GeometryFamily, number>,
  /** Horizontal distance from saddle nose to BB plus headset/bar offsets (mm). */
  SADDLE_TO_BB_OFFSET_MM: 90,
  STEM_MIN_MM: 70,
  STEM_MAX_MM: 140,
};

/** Approximate stack and reach (mm) by geometry family and size. */
export function geometryFor(family: GeometryFamily, sizeCm: number): { reachMm: number; stackMm: number } {
  switch (family) {
    case 'endurance':
      return { reachMm: 365 + (sizeCm - 50) * 3.2, stackMm: 540 + (sizeCm - 50) * 8 };
    case 'gravel':
      return { reachMm: 370 + (sizeCm - 50) * 3.4, stackMm: 545 + (sizeCm - 50) * 8 };
    case 'tt':
      return { reachMm: 410 + (sizeCm - 50) * 5, stackMm: 495 + (sizeCm - 50) * 7 };
    case 'race':
    default:
      return { reachMm: 373 + (sizeCm - 49) * 3.1, stackMm: 500 + (sizeCm - 49) * 7.5 };
  }
}

export interface FitNote {
  severity: 'ok' | 'warning' | 'bad';
  text: string;
}

export interface FitResult {
  idealSizeCm: number;
  /** Size the build uses (the user's choice, or nearest to ideal). */
  sizeCm: number;
  recommendedSizeCm: number;
  saddleHeightMm: number;
  reachMm: number;
  stackMm: number;
  stemNeededMm: number;
  stemFittedMm: number;
  /** 0–10. Feeds the comfort score. */
  quality: number;
  notes: FitNote[];
}

const nearest = (list: number[], x: number) => list.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));

export function fitRider(r: RiderProfile, frame: Frame, bars: Handlebars, chosenSizeCm?: number): FitResult {
  const family = frame.geometry;
  const idealSizeCm = r.inseamCm * FIT.SIZE_FACTOR[family];
  const recommendedSizeCm = nearest(frame.sizesCm, idealSizeCm);
  const sizeCm = chosenSizeCm && frame.sizesCm.includes(chosenSizeCm) ? chosenSizeCm : recommendedSizeCm;
  const { reachMm, stackMm } = geometryFor(family, sizeCm);
  const saddleHeightMm = r.inseamCm * 10 * FIT.SADDLE_HEIGHT_FACTOR;
  const torso = r.heightCm - r.inseamCm;
  const cockpit = FIT.COCKPIT_MM_PER_CM * (torso + r.armCm) * FIT.COCKPIT_FAMILY_FACTOR[family];
  const stemNeededMm = cockpit - FIT.SADDLE_TO_BB_OFFSET_MM - reachMm;
  const stemFittedMm =
    bars.integratedStemMm ?? Math.min(FIT.STEM_MAX_MM, Math.max(FIT.STEM_MIN_MM, Math.round(stemNeededMm / 10) * 10));

  const notes: FitNote[] = [];
  const sizeOff = sizeCm - idealSizeCm;
  if (Math.abs(sizeOff) > 2.5)
    notes.push({
      severity: 'bad',
      text: `The ${sizeCm} cm frame is ${Math.abs(sizeOff).toFixed(1)} cm ${sizeOff > 0 ? 'too big' : 'too small'} for your ${r.inseamCm} cm inseam (ideal ≈ ${idealSizeCm.toFixed(1)} cm).${
        recommendedSizeCm !== sizeCm ? ` Try size ${recommendedSizeCm}.` : ' This frame doesn’t come in a size that fits you well.'
      }`,
    });
  else if (Math.abs(sizeOff) > 1.2)
    notes.push({ severity: 'warning', text: `Size ${sizeCm} is a little ${sizeOff > 0 ? 'big' : 'small'} (ideal ≈ ${idealSizeCm.toFixed(1)} cm). Saddle and stem can make up the difference.` });

  if (stemNeededMm < FIT.STEM_MIN_MM)
    notes.push({ severity: 'bad', text: `Even a ${FIT.STEM_MIN_MM} mm stem leaves you stretched: you'd need about ${Math.round(stemNeededMm)} mm. The frame is too long for your torso and arms; try a smaller size.` });
  else if (stemNeededMm > FIT.STEM_MAX_MM)
    notes.push({ severity: 'bad', text: `You'd need a ${Math.round(stemNeededMm)} mm stem, longer than any normal stem: the frame is too short for you. Try a bigger size.` });
  if (bars.integratedStemMm && Math.abs(bars.integratedStemMm - stemNeededMm) > 15)
    notes.push({
      severity: 'warning',
      text: `This one-piece cockpit comes with a ${bars.integratedStemMm} mm stem, but you need about ${Math.round(stemNeededMm / 10) * 10} mm. Order it in a different length, or use a separate bar and stem.`,
    });

  const sizePenalty = Math.max(0, Math.abs(sizeOff) - 1) * 1.5;
  const stemPenalty = (Math.abs(stemNeededMm - stemFittedMm) / 10) * 1.2;
  const quality = Math.max(0, Math.min(10, 10 - sizePenalty - stemPenalty));
  if (notes.length === 0) notes.push({ severity: 'ok', text: `Good fit: size ${sizeCm} with a ${stemFittedMm} mm stem.` });

  return { idealSizeCm, sizeCm, recommendedSizeCm, saddleHeightMm, reachMm, stackMm, stemNeededMm, stemFittedMm, quality: Math.round(quality * 10) / 10, notes };
}
