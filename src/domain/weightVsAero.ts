import { catalog } from '../data/catalog';
import { riderCda } from '../physics/aero';
import { airDensity } from '../physics/atmosphere';
import { steadySpeed } from '../physics/power';
import { systemMass } from '../physics/simulate';
import type { BuildSelection } from '../types/components';
import { checkCompatibility } from './compatibility';
import type { RiderProfile } from './rider';
import { rideSetup, type BuildSpec } from './setup';

export interface WeightAeroPoint {
  gradePct: number;
  /** Seconds per km: aero bike minus light bike. Negative = aero is faster. */
  diffSPerKm: number;
  lightSPerKm: number;
  aeroSPerKm: number;
}

export interface WeightAeroResult {
  light: { selection: BuildSelection; label: string; massKg: number; cda: number };
  aero: { selection: BuildSelection; label: string; massKg: number; cda: number };
  points: WeightAeroPoint[];
  /** Gradient (%) where the lighter bike starts winning; null if it never does in range. */
  crossoverPct: number | null;
}

/** Swap in the lightest (or most aero) road frame + wheels that suit this build's brakes and axles. */
function variant(sel: BuildSelection, by: 'light' | 'aero'): BuildSelection {
  const score = (p: { weight: number; cdaDelta: number }) => (by === 'light' ? p.weight : p.cdaDelta * 100000 + p.weight / 1000);
  const frames = catalog.frame.filter((f) => f.frameType !== 'tt' && f.frameType !== 'gravel').sort((a, b) => score(a) - score(b));
  const wheels = catalog.wheels.filter((w) => w.profile !== 'disc').sort((a, b) => score(a) - score(b));
  for (const f of frames)
    for (const w of wheels) {
      const cand = { ...sel, frame: f.id, wheels: w.id };
      if (!checkCompatibility(cand).some((i) => i.severity === 'error')) return cand;
    }
  return sel;
}

/**
 * At what gradient does a lighter bike beat a more aerodynamic one for this rider?
 * Compares the lightest and the most aero frame + wheel combination that fit the rest of the build.
 */
export function weightVsAero(spec: BuildSpec, rider: RiderProfile, maxGrade = 12): WeightAeroResult {
  const mk = (sel: BuildSelection) => {
    const s = rideSetup({ ...spec, selection: sel }, rider);
    const cda = riderCda(s.rider.position, s.rider.heightM, s.rider.massKg) + s.bike.cdaBike;
    return { s, cda, label: `${s.parts.frame.brand} ${s.parts.frame.name} + ${s.parts.wheels.brand} ${s.parts.wheels.name}` };
  };
  const L = mk(variant(spec.selection, 'light'));
  const A = mk(variant(spec.selection, 'aero'));
  const rho = airDensity(20, 0);
  const sPerKm = (x: ReturnType<typeof mk>, g: number) =>
    1000 /
    steadySpeed(x.s.rider.powerW, {
      massKg: systemMass(x.s.rider.massKg, x.s.bike.massKg),
      gradePct: g,
      crr: x.s.bike.crrBase,
      cda: x.cda,
      rho,
      headwindMs: 0,
      drivetrainEfficiency: x.s.bike.drivetrainEfficiency,
    });
  const points: WeightAeroPoint[] = [];
  for (let g = 0; g <= maxGrade + 1e-9; g += 0.5) {
    const l = sPerKm(L, g);
    const a = sPerKm(A, g);
    points.push({ gradePct: g, lightSPerKm: l, aeroSPerKm: a, diffSPerKm: a - l });
  }
  let crossoverPct: number | null = null;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1];
    const q = points[i];
    if (p.diffSPerKm <= 0 && q.diffSPerKm > 0) {
      crossoverPct = p.gradePct + ((0 - p.diffSPerKm) / (q.diffSPerKm - p.diffSPerKm)) * (q.gradePct - p.gradePct);
      break;
    }
  }
  if (crossoverPct === null && points[0].diffSPerKm > 0) crossoverPct = 0;
  const pack = (x: ReturnType<typeof mk>) => ({ selection: x.s.parts && { ...spec.selection, frame: x.s.parts.frame.id, wheels: x.s.parts.wheels.id }, label: x.label, massKg: x.s.weightKg, cda: x.cda });
  return { light: pack(L), aero: pack(A), points, crossoverPct: crossoverPct === null ? null : Math.round(crossoverPct * 10) / 10 };
}
