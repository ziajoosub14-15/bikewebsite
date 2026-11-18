import type { Position } from '../physics/types';
import { idealPressureBar } from '../physics/rolling';
import type { ResolvedBuild } from './bikeModel';

export type ComfortKey = 'frame' | 'tyres' | 'saddle' | 'handlebars' | 'position' | 'fit';

export interface ComfortFactor {
  key: ComfortKey;
  label: string;
  /** 0–10 */
  score: number;
  /** Share of the overall score (weights sum to 1). */
  weight: number;
  /** Why this factor scored what it did. */
  why: string;
}

export const COMFORT_WEIGHTS: Record<ComfortKey, number> = {
  frame: 0.2,
  tyres: 0.2,
  saddle: 0.15,
  handlebars: 0.1,
  position: 0.15,
  fit: 0.2,
};

/** Upright is comfy; the aero tuck is not. */
export const POSITION_COMFORT: Record<Position, number> = { hoods: 9, drops: 6, aero: 3 };

const clamp = (x: number) => Math.max(0, Math.min(10, x));

export interface ComfortInput {
  parts: ResolvedBuild;
  position: Position;
  fitQuality: number;
  tyrePressureBar: number;
  systemMassKg: number;
}

export function comfortScore(i: ComfortInput): { score: number; factors: ComfortFactor[] } {
  const { parts: b } = i;
  const ideal = idealPressureBar(b.tyres.widthMm, i.systemMassKg, 'smooth');
  const pressureEffect = ((ideal - i.tyrePressureBar) / ideal) * 6;
  const tyreScore = clamp(b.tyres.comfort + pressureEffect);
  const factors: ComfortFactor[] = [
    { key: 'frame', label: 'Frame', score: b.frame.comfort, weight: COMFORT_WEIGHTS.frame, why: `${b.frame.frameType === 'tt' ? 'Time-trial' : b.frame.frameType[0].toUpperCase() + b.frame.frameType.slice(1)} frame` },
    {
      key: 'tyres',
      label: 'Tyres',
      score: Math.round(tyreScore * 10) / 10,
      weight: COMFORT_WEIGHTS.tyres,
      why: `${b.tyres.widthMm} mm at ${i.tyrePressureBar.toFixed(1)} bar${Math.abs(pressureEffect) > 0.5 ? (pressureEffect > 0 ? ' (softer than usual)' : ' (harder than usual)') : ''}`,
    },
    { key: 'saddle', label: 'Saddle', score: b.saddle.comfort, weight: COMFORT_WEIGHTS.saddle, why: `${b.saddle.widthMm} mm, ${b.saddle.padding} padding` },
    { key: 'handlebars', label: 'Bars', score: b.handlebars.comfort, weight: COMFORT_WEIGHTS.handlebars, why: b.handlebars.name },
    { key: 'position', label: 'Position', score: POSITION_COMFORT[i.position], weight: COMFORT_WEIGHTS.position, why: i.position === 'aero' ? 'Tucked on aero bars' : i.position === 'drops' ? 'Low in the drops' : 'Upright on the hoods' },
    { key: 'fit', label: 'Fit', score: i.fitQuality, weight: COMFORT_WEIGHTS.fit, why: i.fitQuality >= 8 ? 'Frame fits you well' : i.fitQuality >= 5 ? 'Fit is a compromise' : 'Poor fit' },
  ];
  const score = factors.reduce((s, f) => s + f.score * f.weight, 0);
  return { score: Math.round(score * 10) / 10, factors };
}
