import { getComponent } from '../data/catalog';
import { PHYSICS } from '../physics/config';
import type { BikePhysics } from '../physics/types';
import type { BuildSelection, Category, ComponentByCategory } from '../types/components';

export type ResolvedBuild = { [K in Category]: ComponentByCategory[K] };

/** Look up every selected part. Throws if an id is unknown (e.g. a part was deleted from the JSON). */
export function resolveBuild(sel: BuildSelection): ResolvedBuild {
  const get = <K extends Category>(cat: K): ComponentByCategory[K] => {
    const c = getComponent(cat, sel[cat]);
    if (!c) throw new Error(`Unknown ${cat} id "${sel[cat]}"`);
    return c;
  };
  return {
    frame: get('frame'),
    wheels: get('wheels'),
    groupset: get('groupset'),
    rearDerailleur: get('rearDerailleur'),
    handlebars: get('handlebars'),
    saddle: get('saddle'),
    tyres: get('tyres'),
  };
}

export interface BuildTotals {
  priceAed: number;
  weightKg: number;
  cdaBike: number;
}

export function buildTotals(b: ResolvedBuild): BuildTotals {
  const parts = Object.values(b);
  return {
    priceAed: parts.reduce((s, p) => s + p.price, 0),
    weightKg: parts.reduce((s, p) => s + p.weight, 0) / 1000 + PHYSICS.MISC_BIKE_MASS_KG,
    cdaBike: PHYSICS.BIKE_BASE_CDA + parts.reduce((s, p) => s + p.cdaDelta, 0),
  };
}

/** Convert chosen parts into the numbers the physics engine needs. */
export function bikePhysics(b: ResolvedBuild, opts: { tyrePressureBar?: number } = {}): BikePhysics {
  const totals = buildTotals(b);
  return {
    massKg: totals.weightKg,
    cdaBike: totals.cdaBike,
    crrBase: b.tyres.crr,
    tyreWidthMm: b.tyres.widthMm,
    tyrePressureBar: opts.tyrePressureBar ?? b.tyres.recommendedPressureBar,
    tyreGrip: b.tyres.grip,
    drivetrainEfficiency: b.groupset.drivetrainEfficiency,
    brakeType: b.frame.compat.brakeType ?? 'disc',
    wheelCrosswindSensitivity: b.wheels.crosswindSensitivity,
    wheelMassKg: (b.wheels.weight + b.tyres.weight) / 1000,
  };
}
