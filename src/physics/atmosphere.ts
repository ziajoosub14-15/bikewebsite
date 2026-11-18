import { PHYSICS } from './config';

/**
 * Air pressure (Pa) at an altitude, from the standard-atmosphere barometric formula.
 */
export function pressureAtAltitude(altitudeM: number): number {
  const { SEA_LEVEL_PRESSURE_PA, SEA_LEVEL_STD_TEMP_K, LAPSE_RATE_K_PER_M, G, MOLAR_MASS_AIR, R_UNIVERSAL } =
    PHYSICS;
  const exponent = (G * MOLAR_MASS_AIR) / (R_UNIVERSAL * LAPSE_RATE_K_PER_M);
  return SEA_LEVEL_PRESSURE_PA * Math.pow(1 - (LAPSE_RATE_K_PER_M * altitudeM) / SEA_LEVEL_STD_TEMP_K, exponent);
}

/**
 * Air density ρ (kg/m³) from temperature (°C) and altitude (m), assuming dry air.
 * Sea level at 15 °C ≈ 1.225. Hot air and high altitude are both thinner, so drag is lower.
 */
export function airDensity(temperatureC: number, altitudeM: number): number {
  const tempK = temperatureC + PHYSICS.KELVIN_OFFSET;
  return pressureAtAltitude(altitudeM) / (PHYSICS.R_DRY_AIR * tempK);
}

/**
 * Temperature (°C) at `altitudeM`, given the temperature measured at `refAltitudeM`.
 * Air cools about 6.5 °C per 1000 m climbed.
 */
export function temperatureAt(refTempC: number, refAltitudeM: number, altitudeM: number): number {
  return refTempC - PHYSICS.LAPSE_RATE_K_PER_M * (altitudeM - refAltitudeM);
}
