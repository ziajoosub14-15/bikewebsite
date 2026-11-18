import { PHYSICS, type BrakeKind, type Surface } from './config';

/** Friction coefficient between tyre and road. */
export function roadGrip(tyreGrip: number, surface: Surface): number {
  return tyreGrip * PHYSICS.SURFACE_GRIP[surface];
}

/**
 * Highest safe speed (m/s) through a corner of radius r: v = √(μ · g · r · utilisation).
 * Grippier tyres, cleaner roads and wider corners all allow more speed.
 */
export function maxCornerSpeed(radiusM: number, tyreGrip: number, surface: Surface): number {
  const mu = roadGrip(tyreGrip, surface);
  return Math.sqrt(mu * PHYSICS.G * radiusM * PHYSICS.CORNER_GRIP_UTILISATION);
}

/**
 * Braking deceleration (m/s²) available on flat ground: the weaker of what the brakes can
 * deliver and what the tyres can hold.
 */
export function brakingDecel(brakeType: BrakeKind, tyreGrip: number, surface: Surface): number {
  const brakeLimit = PHYSICS.BRAKE_DECEL_G[brakeType] * PHYSICS.G;
  const gripLimit = roadGrip(tyreGrip, surface) * PHYSICS.BRAKE_GRIP_UTILISATION * PHYSICS.G;
  return Math.min(brakeLimit, gripLimit);
}
