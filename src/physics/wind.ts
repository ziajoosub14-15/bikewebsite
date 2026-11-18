import { PHYSICS } from './config';

export interface WindComponents {
  /** Wind along the direction of travel (m/s). Positive = headwind, negative = tailwind. */
  headwindMs: number;
  /** Wind across the direction of travel (m/s), always ≥ 0. */
  crosswindMs: number;
}

const DEG = Math.PI / 180;

/**
 * Split the wind into headwind and crosswind for a rider travelling on `headingDeg`.
 * `windFromDeg` is where the wind comes FROM (0 = a north wind, blowing south).
 * Riding north into a north wind is a full headwind.
 */
export function resolveWind(windSpeedMs: number, windFromDeg: number, headingDeg: number): WindComponents {
  const speed = windSpeedMs * PHYSICS.WIND_HEIGHT_FACTOR;
  const rel = (windFromDeg - headingDeg) * DEG;
  const headwindMs = speed * Math.cos(rel);
  const crosswindMs = Math.abs(speed * Math.sin(rel));
  return { headwindMs: clean(headwindMs), crosswindMs: clean(crosswindMs) };
}

/** Remove floating-point dust like 1e-16 so tests and displays read cleanly. */
function clean(x: number): number {
  return Math.abs(x) < 1e-9 ? 0 : x;
}

/**
 * Extra drag area (m²) caused by crosswind upsetting the wheels. The rider sits up and
 * steers defensively, so it acts like a worse position. Zero for light winds or shallow rims.
 */
export function crosswindCdaPenalty(crosswindMs: number, wheelSensitivity: number): number {
  const excess = Math.max(0, crosswindMs - PHYSICS.CROSSWIND_THRESHOLD_MS);
  return excess * wheelSensitivity * PHYSICS.CROSSWIND_CDA_PENALTY_PER_MS;
}
