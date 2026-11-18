import { simulate } from '../physics/simulate';
import type { Environment, Route, SimResult, Surface } from '../physics/types';
import type { RiderProfile } from './rider';
import { rideSetup, type BuildSpec, type RideSetup } from './setup';

/** Weather and road settings shared by every simulation and race. */
export interface Conditions {
  windKmh: number;
  /** Direction the wind blows FROM (0 = north). */
  windFromDeg: number;
  temperatureC: number;
  /** Start altitude override (m); null = use the route's own elevation. */
  altitudeM: number | null;
  /** 'route' = each segment's own surface. */
  surface: 'route' | Surface;
}

export const DEFAULT_CONDITIONS: Conditions = { windKmh: 10, windFromDeg: 315, temperatureC: 30, altitudeM: null, surface: 'route' };

export function toEnvironment(c: Conditions): Environment {
  return {
    temperatureC: c.temperatureC,
    windSpeedMs: c.windKmh / 3.6,
    windFromDeg: c.windFromDeg,
    surfaceOverride: c.surface === 'route' ? undefined : c.surface,
    startAltitudeM: c.altitudeM ?? undefined,
  };
}

export interface RideResult {
  setup: RideSetup;
  sim: SimResult;
}

export function runRide(spec: BuildSpec, rider: RiderProfile, conditions: Conditions, route: Route): RideResult {
  const setup = rideSetup(spec, rider);
  const sim = simulate({ bike: setup.bike, rider: setup.rider, env: toEnvironment(conditions), route });
  return { setup, sim };
}

/** Time (s) at which the rider passed distance d, interpolated between samples. */
export function timeAtDistance(sim: SimResult, d: number): number {
  const s = sim.samples;
  if (d <= 0) return 0;
  if (d >= sim.distanceM) return sim.totalTimeS;
  let lo = 0;
  let hi = s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid].distM < d) lo = mid;
    else hi = mid;
  }
  const a = s[lo];
  const b = s[hi];
  const t = b.distM === a.distM ? 0 : (d - a.distM) / (b.distM - a.distM);
  return a.t + (b.t - a.t) * t;
}

/** Sample nearest to time t (binary search). */
export function sampleAtTime(sim: SimResult, t: number) {
  const s = sim.samples;
  if (t >= sim.totalTimeS) return s[s.length - 1];
  let lo = 0;
  let hi = s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid].t < t) lo = mid;
    else hi = mid;
  }
  const a = s[lo];
  const b = s[hi];
  const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
  return { ...a, distM: a.distM + (b.distM - a.distM) * f, speedMs: a.speedMs + (b.speedMs - a.speedMs) * f, t };
}
