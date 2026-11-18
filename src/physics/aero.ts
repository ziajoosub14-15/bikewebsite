import { PHYSICS, type Position } from './config';

/** Body surface area (m²), Du Bois formula. Frontal area scales roughly with it. */
export function bodySurfaceArea(heightM: number, massKg: number): number {
  return 0.007184 * Math.pow(massKg, 0.425) * Math.pow(heightM * 100, 0.725);
}

/**
 * Rider-only drag area (m²) for a position, scaled from the reference rider by body size.
 * A bigger rider punches a bigger hole in the air.
 */
export function riderCda(position: Position, heightM: number, massKg: number): number {
  const ref = bodySurfaceArea(PHYSICS.REFERENCE_RIDER_HEIGHT_M, PHYSICS.REFERENCE_RIDER_MASS_KG);
  return PHYSICS.RIDER_CDA_BY_POSITION[position] * (bodySurfaceArea(heightM, massKg) / ref);
}

/**
 * Aerodynamic drag force (N) along the direction of travel.
 * F = ½ · ρ · CdA · v_air · |v_air|, where v_air = ground speed + headwind.
 * Negative when a tailwind is faster than the rider (the wind pushes).
 */
export function dragForce(rho: number, cda: number, airSpeedMs: number): number {
  return 0.5 * rho * cda * airSpeedMs * Math.abs(airSpeedMs);
}
