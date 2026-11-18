/**
 * Every physical constant and tuning value used by the simulator lives here.
 * Change a number here and the whole app follows. Units are SI unless the name says otherwise
 * (m, s, kg, W, N, Pa, K). Gradients are in percent (rise/run × 100).
 */
export const PHYSICS = {
  // ───────────────────────── Basic constants ─────────────────────────
  /** Standard gravity (m/s²). */
  G: 9.80665,
  /** 0 °C in kelvin. */
  KELVIN_OFFSET: 273.15,

  // ───────────────────────── Atmosphere ─────────────────────────
  /** Standard sea-level air pressure (Pa). */
  SEA_LEVEL_PRESSURE_PA: 101325,
  /** Standard sea-level temperature used by the barometric formula (K). */
  SEA_LEVEL_STD_TEMP_K: 288.15,
  /** Temperature drop with height in the standard atmosphere (K per m). ≈ 6.5 °C per km. */
  LAPSE_RATE_K_PER_M: 0.0065,
  /** Specific gas constant for dry air (J/(kg·K)). Density = pressure / (R · T). */
  R_DRY_AIR: 287.05,
  /** Molar mass of air (kg/mol) and universal gas constant (J/(mol·K)), for the pressure-vs-height formula. */
  MOLAR_MASS_AIR: 0.0289644,
  R_UNIVERSAL: 8.31446,

  // ───────────────────────── Aerodynamics ─────────────────────────
  /**
   * Drag area (CdA, m²) of the RIDER ALONE for a reference rider (1.78 m, 70 kg).
   * The rider is roughly 70–80% of total drag; the bike adds the rest (BIKE_BASE_CDA).
   * Totals with a basic bike: hoods ≈ 0.36, drops ≈ 0.31, aero bars ≈ 0.25 m².
   */
  RIDER_CDA_BY_POSITION: { hoods: 0.3, drops: 0.255, aero: 0.195 },
  /** Body size of the reference rider that RIDER_CDA_BY_POSITION was measured for. */
  REFERENCE_RIDER_HEIGHT_M: 1.78,
  REFERENCE_RIDER_MASS_KG: 70,
  /**
   * Drag area (m²) of a basic reference bike: round-tube frame, shallow wheels, standard bar.
   * Each part's `cdaDelta` is added to this.
   */
  BIKE_BASE_CDA: 0.055,
  /** Crosswind below this speed (m/s) causes no handling problems, even on deep wheels. */
  CROSSWIND_THRESHOLD_MS: 2,
  /**
   * Extra CdA (m²) per m/s of crosswind above the threshold, multiplied by the wheel's
   * crosswindSensitivity (0–1). Represents the rider sitting up and steering defensively
   * when deep rims get pushed around. 80 mm wheels in 8 m/s crosswind ≈ +0.019 m².
   */
  CROSSWIND_CDA_PENALTY_PER_MS: 0.004,
  /**
   * Factor applied to the entered wind speed. Weather reports measure wind at 10 m height;
   * at rider height it is usually 60–80% of that. Set to 1 so the number you enter is the
   * wind the rider feels.
   */
  WIND_HEIGHT_FACTOR: 1.0,

  // ───────────────────────── Rolling resistance ─────────────────────────
  /** Multiplies a tyre's smooth-tarmac Crr on each surface (for a 28 mm reference tyre). */
  SURFACE_CRR_MULTIPLIER: { smooth: 1.0, rough: 1.6, gravel: 2.8 },
  /** Tyre width (mm) at which SURFACE_CRR_MULTIPLIER applies unchanged. */
  TYRE_REFERENCE_WIDTH_MM: 28,
  /**
   * How much wider tyres soften the rough-surface penalty. Penalty × (28 / width)^this.
   * A 45 mm tyre on gravel loses about a third less than a 28 mm one.
   */
  TYRE_WIDTH_ROUGHNESS_EXPONENT: 0.8,
  /** Ideal pressure model: P = REF × (REF_WIDTH / width)^EXP × √(system mass / REF_MASS) × surface factor. */
  PRESSURE_REF_BAR: 6.5,
  PRESSURE_REF_WIDTH_MM: 25,
  PRESSURE_WIDTH_EXPONENT: 1.3,
  PRESSURE_REF_SYSTEM_MASS_KG: 85,
  /** Ideal pressure is lower on rough surfaces so the tyre can absorb bumps. */
  PRESSURE_SURFACE_FACTOR: { smooth: 1.0, rough: 0.88, gravel: 0.75 },
  /** Crr rises by this × (fraction under ideal)² when under-inflated (casing flex). */
  UNDER_INFLATION_PENALTY: 1.2,
  /** Crr rises by this × (fraction over ideal)² when over-inflated (bike bounces over bumps). */
  OVER_INFLATION_PENALTY: { smooth: 0.1, rough: 1.0, gravel: 2.0 },

  // ───────────────────────── Mass and inertia ─────────────────────────
  /**
   * Spinning wheels must be accelerated twice: forward and around. This fraction of the
   * wheel + tyre mass is added as extra "effective mass" when accelerating.
   */
  WHEEL_ROTATIONAL_FACTOR: 0.6,
  /** Mass (kg) of bits every bike has that are not chosen in the builder: pedals, bottle cages, computer, tubes/sealant. */
  MISC_BIKE_MASS_KG: 0.7,
  /** Kit, shoes and helmet (kg), added to rider weight. */
  RIDER_KIT_MASS_KG: 1.2,

  // ───────────────────────── Riding behaviour ─────────────────────────
  /** Rider stops pedalling above this speed (km/h): you cannot usefully pedal faster. */
  COAST_ABOVE_KMH: 55,
  /** Rider stops pedalling on gradients steeper than this downhill (%). */
  COAST_BELOW_GRADE_PCT: -6,
  /**
   * Power is converted into force as P / v. Near standstill that blows up, so we use at least
   * this speed (m/s) for the conversion. Caps the push at standing starts.
   */
  MIN_SPEED_FOR_FORCE_MS: 1.5,
  /** Lowest speed (m/s) we let the rider fall to on very steep climbs (stops the sim stalling). */
  MIN_SPEED_MS: 0.8,

  // ───────────────────────── Cornering and braking ─────────────────────────
  /**
   * Peak deceleration (in g) the brakes can deliver on dry tarmac with good tyres.
   * Hydraulic disc brakes are stronger and more consistent than rim brakes, so riders
   * can brake later and harder.
   */
  BRAKE_DECEL_G: { disc: 0.55, rim: 0.42 },
  /** Fraction of tyre grip a rider actually uses in braking (keeps a safety margin). */
  BRAKE_GRIP_UTILISATION: 0.7,
  /**
   * Fraction of available tyre grip used for cornering. Max safe speed = √(μ · g · r · this).
   * Riders leave a margin for bumps, sand and surprises; 0.6 is a confident but safe amateur
   * (a 12 m hairpin at ≈ 29 km/h). Racers on closed roads go nearer 0.8.
   */
  CORNER_GRIP_UTILISATION: 0.6,
  /** Grip multiplier by road surface (tyre grip × this = friction coefficient μ). */
  SURFACE_GRIP: { smooth: 1.0, rough: 0.9, gravel: 0.65 },

  // ───────────────────────── Simulation ─────────────────────────
  /** Time step (s). Smaller = more accurate, slower. 0.5 s is plenty for road cycling. */
  DT_S: 0.5,
  /**
   * Shorter time step (s) used inside braking zones, where speed changes quickly and a
   * few metres of error decide where braking starts.
   */
  BRAKING_DT_S: 0.05,
  /** Spacing (m) of the precomputed max-safe-speed profile used for braking. */
  SPEED_ENVELOPE_STEP_M: 2,
  /** Speed (m/s) at the start line. 0 = standing start. */
  DEFAULT_START_SPEED_MS: 0,
  /** Safety stop: abort a simulation after this many simulated seconds. */
  MAX_SIM_TIME_S: 12 * 3600,

  // ───────────────────────── Results ─────────────────────────
  /** Gradients at or above this count as climbing (%). */
  CLIMB_GRADE_PCT: 2,
  /** Gradients at or below this count as descending (%). */
  DESCENT_GRADE_PCT: -2,
} as const;

export type Surface = keyof typeof PHYSICS.SURFACE_CRR_MULTIPLIER;
export type Position = keyof typeof PHYSICS.RIDER_CDA_BY_POSITION;
export type BrakeKind = keyof typeof PHYSICS.BRAKE_DECEL_G;
