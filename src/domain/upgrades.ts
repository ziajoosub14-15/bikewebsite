import { catalog } from '../data/catalog';
import type { Route, Surface } from '../physics/types';
import { idealPressureBar } from '../physics/rolling';
import { systemMass } from '../physics/simulate';
import { CATEGORIES, type BikeComponent, type BuildSelection, type Category } from '../types/components';
import { checkCompatibility, matchingDerailleur } from './compatibility';
import type { RiderProfile } from './rider';
import { runRide, type Conditions } from './ride';
import type { BuildSpec } from './setup';
import { POSITION_LABEL } from './rider';

export interface Upgrade {
  kind: 'part' | 'free';
  title: string;
  detail: string;
  /** Parts to change (for 'part'), or spec changes (for 'free'). */
  change: Partial<BuildSelection>;
  riderChange?: Partial<RiderProfile>;
  specChange?: Partial<BuildSpec>;
  costAed: number;
  secondsSaved: number;
  /** Seconds saved per 100 AED spent (Infinity when it costs nothing or saves money). */
  secPer100: number;
}

/** Most common surface on a route, by distance. */
export function dominantSurface(route: Route, override?: Surface | 'route'): Surface {
  if (override && override !== 'route') return override;
  const by: Record<string, number> = {};
  for (const s of route.segments) by[s.surface] = (by[s.surface] ?? 0) + s.lengthM;
  return (Object.entries(by).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'smooth') as Surface;
}

/** A groupset change also needs a matching rear derailleur from the same family. */
function withMatchingDerailleur(sel: BuildSelection, groupsetId: string): BuildSelection | null {
  const rd = matchingDerailleur(sel, groupsetId);
  return rd ? { ...sel, groupset: groupsetId, rearDerailleur: rd } : null;
}

/**
 * Try every compatible single-part swap (plus groupset + derailleur pairs) and the free changes,
 * simulate each on the route, and rank by seconds saved per 100 AED.
 */
export function suggestUpgrades(spec: BuildSpec, rider: RiderProfile, conditions: Conditions, route: Route, limit = 8): { baselineS: number; upgrades: Upgrade[]; free: Upgrade[] } {
  const base = runRide(spec, rider, conditions, route);
  const baselineS = base.sim.totalTimeS;
  const baseErrors = checkCompatibility(spec.selection).filter((i) => i.severity === 'error').length;
  const priceOf = (sel: BuildSelection) => CATEGORIES.reduce((s, c) => s + (catalog[c] as BikeComponent[]).find((p) => p.id === sel[c])!.price, 0);
  const basePrice = priceOf(spec.selection);

  const out: Upgrade[] = [];
  const tryPart = (cat: Category, part: BikeComponent) => {
    let sel: BuildSelection | null = { ...spec.selection, [cat]: part.id };
    if (cat === 'groupset') sel = withMatchingDerailleur(spec.selection, part.id);
    if (!sel) return;
    if (checkCompatibility(sel).filter((i) => i.severity === 'error').length > baseErrors) return;
    // Keep the rider's pressure choice only if the tyre is unchanged.
    const s2: BuildSpec = { ...spec, selection: sel, tyrePressureBar: cat === 'tyres' ? undefined : spec.tyrePressureBar };
    const t = runRide(s2, rider, conditions, route).sim.totalTimeS;
    const saved = baselineS - t;
    if (saved < 2) return;
    const cost = priceOf(sel) - basePrice;
    const extra = cat === 'groupset' && sel.rearDerailleur !== spec.selection.rearDerailleur ? ` (with matching ${(catalog.rearDerailleur.find((r) => r.id === sel!.rearDerailleur)!).name} derailleur)` : '';
    out.push({
      kind: 'part',
      title: `${part.brand} ${part.name}${extra}`,
      detail: cat === 'rearDerailleur' ? 'Rear derailleur' : cat[0].toUpperCase() + cat.slice(1),
      change: cat === 'groupset' ? { groupset: sel.groupset, rearDerailleur: sel.rearDerailleur } : { [cat]: part.id },
      costAed: cost,
      secondsSaved: saved,
      secPer100: cost <= 0 ? Infinity : (saved / cost) * 100,
    });
  };
  for (const cat of CATEGORIES) {
    if (cat === 'rearDerailleur') continue; // derailleurs barely change speed; handled with groupsets
    for (const part of catalog[cat] as BikeComponent[]) if (part.id !== spec.selection[cat]) tryPart(cat, part);
  }
  out.sort((a, b) => (b.secPer100 === a.secPer100 ? b.secondsSaved - a.secondsSaved : b.secPer100 - a.secPer100));

  // Free changes
  const free: Upgrade[] = [];
  const bars = base.setup.parts.handlebars;
  for (const pos of bars.positions) {
    if (pos === base.setup.rider.position) continue;
    const t = runRide(spec, { ...rider, position: pos }, conditions, route).sim.totalTimeS;
    if (baselineS - t >= 1)
      free.push({ kind: 'free', title: `Ride in the ${POSITION_LABEL[pos].toLowerCase()} position`, detail: pos === 'aero' ? 'Less comfortable, much less drag' : 'Lower position, less drag', change: {}, riderChange: { position: pos }, costAed: 0, secondsSaved: baselineS - t, secPer100: Infinity });
  }
  const surface = dominantSurface(route, conditions.surface);
  const mass = systemMass(rider.weightKg, base.setup.weightKg);
  const ideal = Math.round(idealPressureBar(base.setup.parts.tyres.widthMm, mass, surface) * 10) / 10;
  if (Math.abs(ideal - base.setup.tyrePressureBar) >= 0.2) {
    const t = runRide({ ...spec, tyrePressureBar: ideal }, rider, conditions, route).sim.totalTimeS;
    if (baselineS - t >= 0.5)
      free.push({ kind: 'free', title: `Set tyres to ${ideal.toFixed(1)} bar`, detail: `Best pressure for ${surface === 'smooth' ? 'smooth tarmac' : surface === 'rough' ? 'rough chip-seal' : 'gravel'} at your weight (now ${base.setup.tyrePressureBar.toFixed(1)} bar)`, change: {}, specChange: { tyrePressureBar: ideal }, costAed: 0, secondsSaved: baselineS - t, secPer100: Infinity });
  }
  free.sort((a, b) => b.secondsSaved - a.secondsSaved);
  return { baselineS, upgrades: out.slice(0, limit), free };
}
