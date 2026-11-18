import { PHYSICS } from './config';
import { airDensity, temperatureAt } from './atmosphere';
import { riderCda } from './aero';
import { brakingDecel, maxCornerSpeed } from './cornering';
import { gradeToAngle, resistiveForces, type PointConditions } from './power';
import { effectiveCrr } from './rolling';
import { buildGeometry, type RouteGeometry } from './route';
import { crosswindCdaPenalty, resolveWind } from './wind';
import type { BrakingPoint, CornerInfo, SimInput, SimResult, SimSample, Surface } from './types';

/** Per-segment values that do not change while riding the segment. */
interface SegmentConditions {
  surface: Surface;
  crr: number;
  cda: number;
  headwindMs: number;
  gradePct: number;
}

/** Total mass the rider has to move (kg): rider + kit + bike. */
export function systemMass(riderMassKg: number, bikeMassKg: number): number {
  return riderMassKg + PHYSICS.RIDER_KIT_MASS_KG + bikeMassKg;
}

function segmentConditions(input: SimInput): SegmentConditions[] {
  const { bike, rider, env, route } = input;
  const mass = systemMass(rider.massKg, bike.massKg);
  const baseCda = riderCda(rider.position, rider.heightM, rider.massKg) + bike.cdaBike;
  return route.segments.map((seg) => {
    const surface = env.surfaceOverride ?? seg.surface;
    const wind = resolveWind(env.windSpeedMs, env.windFromDeg, seg.headingDeg);
    return {
      surface,
      gradePct: seg.gradePct,
      headwindMs: wind.headwindMs,
      cda: baseCda + crosswindCdaPenalty(wind.crosswindMs, bike.wheelCrosswindSensitivity),
      crr: effectiveCrr({
        crrBase: bike.crrBase,
        widthMm: bike.tyreWidthMm,
        pressureBar: bike.tyrePressureBar,
        systemMassKg: mass,
        surface,
      }),
    };
  });
}

/** Corners on the route with their maximum safe speed. */
export function routeCorners(input: SimInput, geo: RouteGeometry = buildGeometry(input.route)): CornerInfo[] {
  const corners: CornerInfo[] = [];
  input.route.segments.forEach((seg, i) => {
    if (!seg.cornerRadiusM) return;
    const surface = input.env.surfaceOverride ?? seg.surface;
    corners.push({
      distM: geo.segStartM[i] + seg.lengthM,
      radiusM: seg.cornerRadiusM,
      maxSafeSpeedMs: maxCornerSpeed(seg.cornerRadiusM, input.bike.tyreGrip, surface),
    });
  });
  return corners;
}

/**
 * Max-safe-speed profile along the route. Starts with the corner speed limits, then works
 * backwards from each corner using the available braking to find how fast the rider can be
 * going at every earlier point and still slow down in time. Where the rider's speed meets
 * this curve, they brake: that is the braking point.
 */
export function speedEnvelope(input: SimInput, geo: RouteGeometry, corners: CornerInfo[]) {
  const step = PHYSICS.SPEED_ENVELOPE_STEP_M;
  const n = Math.ceil(geo.totalM / step) + 1;
  const env = new Float64Array(n).fill(Infinity);
  for (const c of corners) {
    const k = Math.min(n - 1, Math.round(c.distM / step));
    env[k] = Math.min(env[k], c.maxSafeSpeedMs);
  }
  for (let k = n - 2; k >= 0; k--) {
    if (env[k + 1] === Infinity) continue;
    const seg = input.route.segments[geo.segmentAt(k * step)];
    const surface = input.env.surfaceOverride ?? seg.surface;
    // Gravity helps braking uphill and works against it downhill.
    const decel = Math.max(
      0.3,
      brakingDecel(input.bike.brakeType, input.bike.tyreGrip, surface) +
        PHYSICS.G * Math.sin(gradeToAngle(seg.gradePct)),
    );
    env[k] = Math.min(env[k], Math.sqrt(env[k + 1] ** 2 + 2 * decel * step));
  }
  const clampK = (k: number) => Math.max(0, Math.min(n - 1, k));
  /** Max safe speed at x (linear interpolation between grid points). */
  const at = (x: number): number => {
    const k = clampK(Math.floor(x / step));
    const a = env[k];
    const b = env[clampK(k + 1)];
    if (a === Infinity || b === Infinity) return Math.min(a, b);
    const frac = x / step - k;
    return a + (b - a) * Math.min(Math.max(frac, 0), 1);
  };
  /** Lowest max-safe speed anywhere between x and x + dist. */
  const minAhead = (x: number, dist: number): number => {
    let m = Infinity;
    for (let k = clampK(Math.floor(x / step)); k <= clampK(Math.ceil((x + dist) / step)); k++) m = Math.min(m, env[k]);
    return m;
  };
  return { at, minAhead, values: env, step };
}

/**
 * Ride the route in small time steps (PHYSICS.DT_S). Each step:
 *  1. Look up gradient, surface, wind and air density where the rider is.
 *  2. Decide whether the rider pedals (holds target power) or coasts (fast or steep downhill).
 *  3. Net force = pedal force − gravity − rolling − drag; acceleration = force / effective mass.
 *  4. If the new speed is above the safe-speed curve, stop pedalling and brake down to it.
 * Momentum is kept between steps, so riders carry speed into climbs and take time to accelerate.
 */
export function simulate(input: SimInput): SimResult {
  const { bike, rider, env, route } = input;
  const geo = buildGeometry(route, env.startAltitudeM);
  const conds = segmentConditions(input);
  const corners = routeCorners(input, geo);
  const envelope = speedEnvelope(input, geo, corners);

  const mass = systemMass(rider.massKg, bike.massKg);
  const effMass = mass + bike.wheelMassKg * PHYSICS.WHEEL_ROTATIONAL_FACTOR;
  const eff = bike.drivetrainEfficiency;
  const startElev = geo.elevationAt(0);
  const coastAboveMs = PHYSICS.COAST_ABOVE_KMH / 3.6;

  const samples: SimSample[] = [];
  const brakingPoints: BrakingPoint[] = [];
  let openBrake: BrakingPoint | null = null;
  const timeByTerrainS = { climb: 0, flat: 0, descent: 0 };
  const energy = { riderJ: 0, drivetrainJ: 0, rollingJ: 0, aeroJ: 0, gravityNetJ: 0, brakingJ: 0, kineticNetJ: 0 };

  let t = 0;
  let x = 0;
  let v = input.startSpeedMs ?? PHYSICS.DEFAULT_START_SPEED_MS;
  const v0 = v;
  let maxV = v;
  let timedOut = false;

  const pushSample = (powerW: number, braking: boolean, coasting: boolean, segIdx: number) => {
    samples.push({
      t,
      distM: x,
      speedMs: v,
      powerW,
      elevationM: geo.elevationAt(x),
      gradePct: route.segments[segIdx]?.gradePct ?? 0,
      braking,
      coasting,
      segmentIndex: segIdx,
    });
  };
  pushSample(0, false, false, 0);

  while (x < geo.totalM - 1e-6) {
    if (t >= PHYSICS.MAX_SIM_TIME_S) {
      timedOut = true;
      break;
    }
    const i = geo.segmentAt(x);
    const c = conds[i];
    const elev = geo.elevationAt(x);
    const rho = airDensity(temperatureAt(env.temperatureC, startElev, elev), elev);
    const pc: PointConditions = {
      massKg: mass,
      gradePct: c.gradePct,
      crr: c.crr,
      cda: c.cda,
      rho,
      headwindMs: c.headwindMs,
      drivetrainEfficiency: eff,
    };
    const f = resistiveForces(v, pc);
    const resist = f.gravity + f.rolling + f.aero;
    // Use fine steps when the safe-speed limit is close ahead, so braking is placed accurately.
    const nearLimit = envelope.minAhead(x, Math.max(v, 5) * PHYSICS.DT_S * 2) < v + 2;
    const dt = nearLimit ? PHYSICS.BRAKING_DT_S : PHYSICS.DT_S;

    const advance = (powerW: number) => {
      const propulsive = (powerW * eff) / Math.max(v, PHYSICS.MIN_SPEED_FOR_FORCE_MS);
      const vNext = v + ((propulsive - resist) / effMass) * dt;
      return { vNext, propulsive };
    };

    let coasting = v > coastAboveMs || c.gradePct < PHYSICS.COAST_BELOW_GRADE_PCT;
    let power = coasting ? 0 : rider.powerW;
    let { vNext, propulsive } = advance(power);
    let braking = false;
    let brakeJ = 0;

    let limit = envelope.at(x + ((v + vNext) / 2) * dt);
    if (vNext > limit) {
      // Too fast for what's ahead: stop pedalling first, then brake if still too fast.
      power = 0;
      coasting = true;
      ({ vNext, propulsive } = advance(0));
      limit = envelope.at(x + ((v + vNext) / 2) * dt);
      if (vNext > limit) {
        braking = true;
        brakeJ = 0.5 * effMass * (vNext * vNext - limit * limit);
        vNext = limit;
      }
    }
    vNext = Math.max(vNext, PHYSICS.MIN_SPEED_MS);

    let ds = ((v + vNext) / 2) * dt;
    let stepDt = dt;
    // Finish line: only count the part of the step needed to reach it.
    if (x + ds > geo.totalM) {
      const frac = (geo.totalM - x) / ds;
      stepDt *= frac;
      ds = geo.totalM - x;
      vNext = v + (vNext - v) * frac;
      brakeJ *= frac;
    }

    // Energy bookkeeping (J).
    const wheelJ = propulsive * ds;
    energy.riderJ += wheelJ / eff;
    energy.drivetrainJ += wheelJ / eff - wheelJ;
    energy.rollingJ += f.rolling * ds;
    energy.aeroJ += f.aero * ds;
    energy.brakingJ += brakeJ;

    if (c.gradePct >= PHYSICS.CLIMB_GRADE_PCT) timeByTerrainS.climb += stepDt;
    else if (c.gradePct <= PHYSICS.DESCENT_GRADE_PCT) timeByTerrainS.descent += stepDt;
    else timeByTerrainS.flat += stepDt;

    if (braking && !openBrake) {
      openBrake = { startDistM: x, endDistM: x, fromSpeedMs: v, toSpeedMs: v };
    } else if (!braking && openBrake) {
      openBrake.endDistM = x;
      openBrake.toSpeedMs = v;
      brakingPoints.push(openBrake);
      openBrake = null;
    }

    t += stepDt;
    x += ds;
    v = vNext;
    maxV = Math.max(maxV, v);
    pushSample(power, braking, coasting, geo.segmentAt(Math.min(x, geo.totalM - 1e-6)));
  }
  if (openBrake) {
    openBrake.endDistM = x;
    openBrake.toSpeedMs = v;
    brakingPoints.push(openBrake);
  }

  energy.gravityNetJ = mass * PHYSICS.G * (geo.elevationAt(geo.totalM) - startElev);
  energy.kineticNetJ = 0.5 * effMass * (v * v - v0 * v0);

  return {
    samples,
    totalTimeS: t,
    distanceM: x,
    avgSpeedMs: t > 0 ? x / t : 0,
    maxSpeedMs: maxV,
    avgPowerW: t > 0 ? energy.riderJ / t : 0,
    timeByTerrainS,
    energy,
    brakingPoints,
    corners,
    timedOut,
  };
}
