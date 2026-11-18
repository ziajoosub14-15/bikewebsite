import { idealPressureBar } from '../physics/rolling';
import { systemMass } from '../physics/simulate';
import type { BikePhysics, RiderPhysics } from '../physics/types';
import type { BuildSelection } from '../types/components';
import { bikePhysics, buildTotals, resolveBuild, type ResolvedBuild } from './bikeModel';
import { comfortScore, type ComfortFactor } from './comfort';
import { fitRider, type FitResult } from './fit';
import { riderPhysics, type RiderProfile } from './rider';

/** The parts of a saved build that affect riding. */
export interface BuildSpec {
  selection: BuildSelection;
  frameSizeCm?: number;
  tyrePressureBar?: number;
}

export interface RideSetup {
  parts: ResolvedBuild;
  bike: BikePhysics;
  rider: RiderPhysics;
  fit: FitResult;
  tyrePressureBar: number;
  idealPressureBar: number;
  comfort: { score: number; factors: ComfortFactor[] };
  priceAed: number;
  weightKg: number;
}

/** Ideal tyre pressure for this rider on smooth roads, rounded to 0.1 bar. */
export function defaultPressure(parts: ResolvedBuild, riderKg: number): number {
  const mass = systemMass(riderKg, buildTotals(parts).weightKg);
  return Math.round(idealPressureBar(parts.tyres.widthMm, mass, 'smooth') * 10) / 10;
}

/** Everything needed to simulate or score a build for a given rider. */
export function rideSetup(spec: BuildSpec, profile: RiderProfile): RideSetup {
  const parts = resolveBuild(spec.selection);
  const totals = buildTotals(parts);
  const ideal = defaultPressure(parts, profile.weightKg);
  const tyrePressureBar = spec.tyrePressureBar ?? ideal;
  const bike = bikePhysics(parts, { tyrePressureBar });
  const rider = riderPhysics(profile, parts.handlebars);
  const fit = fitRider(profile, parts.frame, parts.handlebars, spec.frameSizeCm);
  const comfort = comfortScore({
    parts,
    position: rider.position,
    fitQuality: fit.quality,
    tyrePressureBar,
    systemMassKg: systemMass(profile.weightKg, totals.weightKg),
  });
  return { parts, bike, rider, fit, tyrePressureBar, idealPressureBar: ideal, comfort, priceAed: totals.priceAed, weightKg: totals.weightKg };
}
