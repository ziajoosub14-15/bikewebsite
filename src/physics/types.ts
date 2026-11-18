import type { BrakeKind, Position, Surface } from './config';

export type { BrakeKind, Position, Surface };

/** Everything the physics needs to know about the bike. Built from components in src/domain/bikeModel.ts. */
export interface BikePhysics {
  /** Complete bike mass (kg). */
  massKg: number;
  /** Bike's share of drag area: base bike + sum of component deltas (m²). */
  cdaBike: number;
  /** Tyre Crr on smooth tarmac at ideal pressure. */
  crrBase: number;
  tyreWidthMm: number;
  /** Pressure actually used (bar). */
  tyrePressureBar: number;
  /** Dry tarmac grip coefficient of the tyre. */
  tyreGrip: number;
  /** Fraction of pedal power reaching the wheel (0.96–0.98). */
  drivetrainEfficiency: number;
  brakeType: BrakeKind;
  /** 0–1, how badly crosswind upsets the wheels. */
  wheelCrosswindSensitivity: number;
  /** Wheels + tyres mass (kg), for rotational inertia. */
  wheelMassKg: number;
}

export interface RiderPhysics {
  massKg: number;
  heightM: number;
  /** Power the rider holds while pedalling (W). */
  powerW: number;
  position: Position;
}

export interface Environment {
  /** Air temperature at the start of the route (°C). */
  temperatureC: number;
  /** Wind speed (m/s). */
  windSpeedMs: number;
  /** Direction the wind blows FROM, in degrees (0 = north, 90 = east), as weather reports give it. */
  windFromDeg: number;
  /** If set, overrides every segment's road surface. */
  surfaceOverride?: Surface;
  /** If set, replaces the route's start elevation (m), e.g. to try the same course at altitude. */
  startAltitudeM?: number;
}

/** A straight piece of road with constant gradient. Corners sit at the END of a segment. */
export interface RouteSegment {
  lengthM: number;
  gradePct: number;
  /** Direction of travel in degrees (0 = north, 90 = east). */
  headingDeg: number;
  surface: Surface;
  /** Radius (m) of a corner at the end of this segment. Omit for no corner. */
  cornerRadiusM?: number;
  /** Section name used for split times ("Climb 1", "Descent" ...). Consecutive segments with the same label form one section. */
  label?: string;
}

export interface Route {
  id: string;
  name: string;
  description?: string;
  startElevationM: number;
  segments: RouteSegment[];
}

export interface SimSample {
  t: number;
  distM: number;
  speedMs: number;
  powerW: number;
  elevationM: number;
  gradePct: number;
  braking: boolean;
  coasting: boolean;
  segmentIndex: number;
}

export interface BrakingPoint {
  /** Where braking started (m). */
  startDistM: number;
  endDistM: number;
  fromSpeedMs: number;
  toSpeedMs: number;
}

export interface CornerInfo {
  distM: number;
  radiusM: number;
  maxSafeSpeedMs: number;
}

/** Energy totals for the ride (J). Rider energy = drivetrain + rolling + aero + gravity + braking + kinetic. */
export interface EnergyBreakdown {
  riderJ: number;
  drivetrainJ: number;
  rollingJ: number;
  /** Work done against air. Can be negative if a strong tailwind pushes the rider. */
  aeroJ: number;
  /** Net potential energy gained (negative if the route ends lower than it starts). */
  gravityNetJ: number;
  /** Energy turned into heat by the brakes. */
  brakingJ: number;
  /** Change in kinetic energy from start to finish. */
  kineticNetJ: number;
}

export interface SimResult {
  samples: SimSample[];
  totalTimeS: number;
  distanceM: number;
  avgSpeedMs: number;
  maxSpeedMs: number;
  avgPowerW: number;
  timeByTerrainS: { climb: number; flat: number; descent: number };
  energy: EnergyBreakdown;
  brakingPoints: BrakingPoint[];
  corners: CornerInfo[];
  /** True if the simulation hit MAX_SIM_TIME_S before finishing. */
  timedOut: boolean;
}

export interface SimInput {
  bike: BikePhysics;
  rider: RiderPhysics;
  env: Environment;
  route: Route;
  startSpeedMs?: number;
}
