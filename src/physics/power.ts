import { PHYSICS } from './config';
import { dragForce } from './aero';

/** Conditions at one instant: everything needed to apply the power model. */
export interface PointConditions {
  /** Rider + bike + kit (kg). */
  massKg: number;
  gradePct: number;
  crr: number;
  cda: number;
  rho: number;
  /** Positive = headwind. */
  headwindMs: number;
  drivetrainEfficiency: number;
}

export interface PowerBreakdown {
  gravityW: number;
  rollingW: number;
  aeroW: number;
  drivetrainW: number;
  /** Power the rider must put into the pedals. */
  totalW: number;
}

/** Road angle (rad) from a percentage gradient. */
export function gradeToAngle(gradePct: number): number {
  return Math.atan(gradePct / 100);
}

/** Resisting forces (N) at speed v. Positive values oppose motion. */
export function resistiveForces(v: number, c: PointConditions) {
  const theta = gradeToAngle(c.gradePct);
  const gravity = c.massKg * PHYSICS.G * Math.sin(theta);
  const rolling = c.massKg * PHYSICS.G * Math.cos(theta) * c.crr;
  const aero = dragForce(c.rho, c.cda, v + c.headwindMs);
  return { gravity, rolling, aero };
}

/**
 * Steady-speed power model:
 *   P_wheel = m·g·sin(θ)·v + m·g·cos(θ)·Crr·v + ½·ρ·CdA·v_air²·v
 *   P_rider = P_wheel / drivetrain efficiency
 */
export function powerAtSpeed(v: number, c: PointConditions): PowerBreakdown {
  const f = resistiveForces(v, c);
  const gravityW = f.gravity * v;
  const rollingW = f.rolling * v;
  const aeroW = f.aero * v;
  const wheelW = gravityW + rollingW + aeroW;
  const totalW = wheelW > 0 ? wheelW / c.drivetrainEfficiency : wheelW;
  return { gravityW, rollingW, aeroW, drivetrainW: totalW - wheelW, totalW };
}

/**
 * Steady speed (m/s) a rider reaches holding `powerW` in these conditions (bisection search).
 * On descents with 0 W this is the terminal coasting speed.
 */
export function steadySpeed(powerW: number, c: PointConditions): number {
  let lo = 0;
  let hi = 60;
  if (powerAtSpeed(hi, c).totalW < powerW) return hi;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (powerAtSpeed(mid, c).totalW < powerW) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
