import { PHYSICS } from '../physics/config';
import { airDensity, riderCda, steadySpeed, systemMass } from '../physics';
import type { Category } from '../types/components';
import { CATEGORIES } from '../types/components';
import { checkCompatibility, type CompatIssue } from './compatibility';
import type { RiderProfile } from './rider';
import { rideSetup, type BuildSpec, type RideSetup } from './setup';

export interface BuildSummary extends RideSetup {
  cdaBike: number;
  /** Bike + this rider in their effective position. */
  cdaTotal: number;
  /** Steady speed on a flat, calm road at the rider's power (m/s). */
  flatSpeedMs: number;
  issues: CompatIssue[];
  byCategory: { category: Category; priceAed: number; weightG: number }[];
}

export function summarize(spec: BuildSpec, profile: RiderProfile): BuildSummary {
  const s = rideSetup(spec, profile);
  const cdaTotal = riderCda(s.rider.position, s.rider.heightM, s.rider.massKg) + s.bike.cdaBike;
  const flatSpeedMs = steadySpeed(s.rider.powerW, {
    massKg: systemMass(s.rider.massKg, s.bike.massKg),
    gradePct: 0,
    crr: s.bike.crrBase,
    cda: cdaTotal,
    rho: airDensity(15, 0),
    headwindMs: 0,
    drivetrainEfficiency: s.bike.drivetrainEfficiency,
  });
  return {
    ...s,
    cdaBike: s.bike.cdaBike,
    cdaTotal,
    flatSpeedMs,
    issues: checkCompatibility(spec.selection),
    byCategory: CATEGORIES.map((category) => ({ category, priceAed: s.parts[category].price, weightG: s.parts[category].weight })),
  };
}

export const MISC_WEIGHT_G = PHYSICS.MISC_BIKE_MASS_KG * 1000;
