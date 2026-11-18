import { catalog } from '../data/catalog';
import { riderCda } from '../physics/aero';
import { airDensity, temperatureAt } from '../physics/atmosphere';
import { idealPressureBar, effectiveCrr } from '../physics/rolling';
import { steadySpeed } from '../physics/power';
import { systemMass } from '../physics/simulate';
import { PHYSICS } from '../physics/config';
import { buildGeometry } from '../physics/route';
import { resolveWind, crosswindCdaPenalty } from '../physics/wind';
import type { Route, Surface } from '../physics/types';
import type { BuildSelection, Frame, Groupset, Handlebars, RearDerailleur, Saddle, Tyres, Wheels } from '../types/components';
import { checkCompatibility, matchingDerailleur } from './compatibility';
import { PRESET_BUILDS } from './presets';
import { comfortScore } from './comfort';
import { fitRider } from './fit';
import { effectivePosition, riderPowerW, type RiderProfile } from './rider';
import { runRide, toEnvironment, type Conditions } from './ride';

export type Priority = 'climbing' | 'flat' | 'comfort' | 'allround';

/** All-round: each comfort point below 10 counts as this fraction of ride time (0.6% per point). */
const ALLROUND_COMFORT_WEIGHT = 0.006;

export const PRIORITY_LABEL: Record<Priority, string> = {
  climbing: 'Climbing',
  flat: 'Flat speed',
  comfort: 'Comfort',
  allround: 'All-round',
};

/** A route squeezed into a few gradient/surface/wind bins so thousands of combinations can be scored quickly. */
interface Bin {
  lengthM: number;
  gradePct: number;
  surface: Surface;
  headwindMs: number;
  crosswindMs: number;
  rho: number;
}

function binRoute(route: Route, conditions: Conditions): Bin[] {
  const env = toEnvironment(conditions);
  const geo = buildGeometry(route, env.startAltitudeM);
  const start = geo.elevationAt(0);
  const map = new Map<string, Bin>();
  route.segments.forEach((s, i) => {
    const surface = env.surfaceOverride ?? s.surface;
    const w = resolveWind(env.windSpeedMs, env.windFromDeg, s.headingDeg);
    const g = Math.round(s.gradePct);
    const h = Math.round(w.headwindMs);
    const key = `${g}|${surface}|${h}`;
    const elev = geo.segStartElevM[i];
    const rho = airDensity(temperatureAt(env.temperatureC, start, elev), elev);
    const b = map.get(key);
    if (b) {
      b.rho = (b.rho * b.lengthM + rho * s.lengthM) / (b.lengthM + s.lengthM);
      b.crosswindMs = (b.crosswindMs * b.lengthM + w.crosswindMs * s.lengthM) / (b.lengthM + s.lengthM);
      b.lengthM += s.lengthM;
    } else map.set(key, { lengthM: s.lengthM, gradePct: g, surface, headwindMs: h, crosswindMs: w.crosswindMs, rho });
  });
  return [...map.values()];
}

interface Core {
  frame: Frame;
  wheels: Wheels;
  groupset: Groupset;
  rd: RearDerailleur;
  tyres: Tyres;
}

function estimateTime(c: Core & { bars: Handlebars; saddle: Saddle }, rider: RiderProfile, bins: Bin[], priority: Priority) {
  const parts = [c.frame, c.wheels, c.groupset, c.rd, c.tyres, c.bars, c.saddle];
  const bikeKg = parts.reduce((s, p) => s + p.weight, 0) / 1000 + PHYSICS.MISC_BIKE_MASS_KG;
  const mass = systemMass(rider.weightKg, bikeKg);
  const pos = effectivePosition(rider.position, c.bars);
  const cdaBase = riderCda(pos, rider.heightCm / 100, rider.weightKg) + PHYSICS.BIKE_BASE_CDA + parts.reduce((s, p) => s + p.cdaDelta, 0);
  const power = riderPowerW(rider);
  let total = 0;
  let weighted = 0;
  for (const b of bins) {
    const pressure = idealPressureBar(c.tyres.widthMm, mass, 'smooth');
    const crr = effectiveCrr({ crrBase: c.tyres.crr, widthMm: c.tyres.widthMm, pressureBar: pressure, systemMassKg: mass, surface: b.surface });
    const coasting = b.gradePct < PHYSICS.COAST_BELOW_GRADE_PCT;
    let v = steadySpeed(coasting ? 0 : power, {
      massKg: mass,
      gradePct: b.gradePct,
      crr,
      cda: cdaBase + crosswindCdaPenalty(b.crosswindMs, c.wheels.crosswindSensitivity),
      rho: b.rho,
      headwindMs: b.headwindMs,
      drivetrainEfficiency: c.groupset.drivetrainEfficiency,
    });
    v = Math.min(v, 22); // corners and caution cap real descending speed
    const t = b.lengthM / Math.max(v, 0.8);
    total += t;
    const w = priority === 'climbing' ? (b.gradePct >= 2 ? 3 : 1) : priority === 'flat' ? (Math.abs(b.gradePct) < 2 ? 3 : 1) : 1;
    weighted += t * w;
  }
  return { total, weighted, mass, bikeKg };
}

export interface AutoBuildResult {
  selection: BuildSelection;
  priceAed: number;
  /** Simulated time on the route (s). */
  timeS: number;
  comfort: number;
  evaluated: number;
}

/**
 * Pick the best combination within budget. Scores every compatible frame × wheels × drivetrain × tyres
 * combination with a fast steady-speed estimate, then chooses bars and saddle, then confirms the top few
 * with the full simulation.
 */
export function autoBuild(budgetAed: number, priority: Priority, rider: RiderProfile, conditions: Conditions, route: Route): AutoBuildResult | null {
  const bins = binRoute(route, conditions);
  const cheapestBars = [...catalog.handlebars].filter((b) => b.barType === 'standard').sort((a, b) => a.price - b.price)[0];
  const cheapestSaddle = [...catalog.saddle].sort((a, b) => a.price - b.price)[0];

  // Drivetrains: each groupset with the cheapest compatible derailleur.
  const drivetrains = catalog.groupset
    .map((g) => {
      const id = matchingDerailleur(PRESET_BUILDS.colnagoUltegra.selection, g.id);
      const rd = id ? catalog.rearDerailleur.find((r) => r.id === id) : undefined;
      return rd ? { g, rd } : null;
    })
    .filter((x): x is { g: Groupset; rd: RearDerailleur } => !!x);

  const reserve = cheapestBars.price + cheapestSaddle.price;
  const candidates: { core: Core; score: number; price: number }[] = [];
  let evaluated = 0;
  for (const frame of catalog.frame) {
    if (frame.price + reserve > budgetAed) continue;
    if (frame.frameType === 'tt' && rider.position !== 'aero') continue;
    for (const wheels of catalog.wheels) {
      if (wheels.compat.brakeType !== frame.compat.brakeType || wheels.compat.axle !== frame.compat.axle) continue;
      const p1 = frame.price + wheels.price + reserve;
      if (p1 > budgetAed) continue;
      for (const { g, rd } of drivetrains) {
        if (g.compat.brakeType !== frame.compat.brakeType) continue;
        const p2 = p1 + g.price + rd.price;
        if (p2 > budgetAed) continue;
        for (const tyres of catalog.tyres) {
          if (tyres.widthMm > frame.maxTyreWidthMm) continue;
          if ((tyres.construction === 'tubular') !== (wheels.rimType === 'tubular')) continue;
          const price = p2 + tyres.price;
          if (price > budgetAed) continue;
          const core = { frame, wheels, groupset: g, rd, tyres };
          const est = estimateTime({ ...core, bars: cheapestBars, saddle: cheapestSaddle }, rider, bins, priority);
          evaluated++;
          const comfortProxy = (frame.comfort * 0.2 + tyres.comfort * 0.2) / 0.4;
          const score = priority === 'comfort' ? -comfortProxy * 1000 + est.total * 0.05 : priority === 'allround' ? est.total * (1 + (10 - comfortProxy) * ALLROUND_COMFORT_WEIGHT) : est.weighted;
          candidates.push({ core, score, price });
        }
      }
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.score - b.score);

  // Finish the best few: choose bars + saddle, then confirm with the full simulation.
  const finalists = candidates.slice(0, 6).map(({ core, price }) => {
    const left = budgetAed - (price - reserve);
    let best: { sel: BuildSelection; score: number; price: number } | null = null;
    for (const bars of catalog.handlebars) {
      if (bars.barType === 'aero-integrated' && !core.frame.internalRouting) continue;
      for (const saddle of catalog.saddle) {
        if (bars.price + saddle.price > left) continue;
        const pos = effectivePosition(rider.position, bars);
        const est = estimateTime({ ...core, bars, saddle }, rider, bins, priority);
        const fit = fitRider(rider, core.frame, bars);
        const comfort = comfortScore({
          parts: { frame: core.frame, wheels: core.wheels, groupset: core.groupset, rearDerailleur: core.rd, handlebars: bars, saddle, tyres: core.tyres },
          position: pos,
          fitQuality: fit.quality,
          tyrePressureBar: idealPressureBar(core.tyres.widthMm, est.mass, 'smooth'),
          systemMassKg: est.mass,
        }).score;
        const score = priority === 'comfort' ? -comfort * 1000 + est.total * 0.05 : priority === 'allround' ? est.total * (1 + (10 - comfort) * ALLROUND_COMFORT_WEIGHT) : est.weighted - comfort * 0.01;
        if (!best || score < best.score) {
          best = {
            sel: { frame: core.frame.id, wheels: core.wheels.id, groupset: core.groupset.id, rearDerailleur: core.rd.id, handlebars: bars.id, saddle: saddle.id, tyres: core.tyres.id },
            score,
            price: price - reserve + bars.price + saddle.price,
          };
        }
      }
    }
    return best;
  });

  let winner: AutoBuildResult | null = null;
  let winnerScore = Infinity;
  for (const f of finalists) {
    if (!f || checkCompatibility(f.sel).some((i) => i.severity === 'error')) continue;
    const r = runRide({ selection: f.sel }, rider, conditions, route);
    const comfort = r.setup.comfort.score;
    const t = r.sim.totalTimeS;
    const score = priority === 'comfort' ? -comfort * 1000 + t * 0.05 : priority === 'allround' ? t * (1 + (10 - comfort) * ALLROUND_COMFORT_WEIGHT) : t;
    if (score < winnerScore) {
      winnerScore = score;
      winner = { selection: f.sel, priceAed: f.price, timeS: t, comfort, evaluated };
    }
  }
  return winner;
}
