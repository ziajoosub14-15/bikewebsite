import { PHYSICS, type Surface } from './config';

/**
 * Ideal tyre pressure (bar) for a tyre width, total system mass (rider + bike) and surface.
 * Wider tyres, lighter riders and rougher roads all want less pressure.
 */
export function idealPressureBar(widthMm: number, systemMassKg: number, surface: Surface): number {
  const {
    PRESSURE_REF_BAR,
    PRESSURE_REF_WIDTH_MM,
    PRESSURE_WIDTH_EXPONENT,
    PRESSURE_REF_SYSTEM_MASS_KG,
    PRESSURE_SURFACE_FACTOR,
  } = PHYSICS;
  return (
    PRESSURE_REF_BAR *
    Math.pow(PRESSURE_REF_WIDTH_MM / widthMm, PRESSURE_WIDTH_EXPONENT) *
    Math.sqrt(systemMassKg / PRESSURE_REF_SYSTEM_MASS_KG) *
    PRESSURE_SURFACE_FACTOR[surface]
  );
}

/**
 * Multiplier (≥ 1) on Crr from running the wrong pressure.
 * Too soft: the casing flexes and wastes energy. Too hard: on rough roads the whole bike and
 * rider bounce, which costs far more than the tyre saves.
 */
export function pressureCrrFactor(pressureBar: number, idealBar: number, surface: Surface): number {
  const diff = (pressureBar - idealBar) / idealBar;
  if (diff < 0) return 1 + PHYSICS.UNDER_INFLATION_PENALTY * diff * diff;
  return 1 + PHYSICS.OVER_INFLATION_PENALTY[surface] * diff * diff;
}

/**
 * Surface multiplier on Crr, softened for wide tyres which float over bumps and gravel.
 */
export function surfaceCrrFactor(surface: Surface, widthMm: number): number {
  const base = PHYSICS.SURFACE_CRR_MULTIPLIER[surface];
  const widthEffect = Math.pow(PHYSICS.TYRE_REFERENCE_WIDTH_MM / widthMm, PHYSICS.TYRE_WIDTH_ROUGHNESS_EXPONENT);
  return 1 + (base - 1) * widthEffect;
}

/** Effective rolling resistance coefficient for a tyre on a surface at a given pressure. */
export function effectiveCrr(params: {
  crrBase: number;
  widthMm: number;
  pressureBar: number;
  systemMassKg: number;
  surface: Surface;
}): number {
  const ideal = idealPressureBar(params.widthMm, params.systemMassKg, params.surface);
  return (
    params.crrBase *
    surfaceCrrFactor(params.surface, params.widthMm) *
    pressureCrrFactor(params.pressureBar, ideal, params.surface)
  );
}
